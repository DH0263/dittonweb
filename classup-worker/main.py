"""ClassUp 스크래퍼 독립 워커 - 안정적인 스크래핑"""
import os
import sys
import time
import json
import logging
import threading
from datetime import datetime, timedelta
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

import pytz
from playwright.sync_api import sync_playwright, Error as PlaywrightError

# ============ Healthcheck 서버 ============
class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'OK')
    def log_message(self, format, *args):
        pass  # 로그 무시

def start_health_server():
    port = int(os.getenv("PORT", 8080))
    server = HTTPServer(('0.0.0.0', port), HealthHandler)
    server.serve_forever()

# Healthcheck 서버를 별도 스레드로 시작
health_thread = threading.Thread(target=start_health_server, daemon=True)
health_thread.start()

# 환경변수에서 DB 연결 정보 가져오기
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL 환경변수가 설정되지 않았습니다.")
    sys.exit(1)

# SQLAlchemy 설정
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Postgres URL 변환 (Railway 형식)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

KST = pytz.timezone('Asia/Seoul')

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============ 설정 ============
SCRAPE_INTERVAL = 5  # 5초 간격 (안정성을 위해)
BROWSER_RESTART_INTERVAL = 50  # 50회마다 브라우저 재시작

# ============ 모델 정의 ============

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    seat_number = Column(String, nullable=True)
    student_phone = Column(String, nullable=True)
    parent_phone = Column(String, nullable=True)
    status = Column(String, default="재원")


class ClassUpAttendance(Base):
    __tablename__ = "classup_attendance"
    id = Column(Integer, primary_key=True, index=True)
    student_name = Column(String, nullable=False)
    phone_number = Column(String, nullable=True)
    available_time = Column(String, nullable=True)
    status = Column(String, nullable=False)
    status_detail = Column(String, nullable=True)
    record_time = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(KST))
    local_student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    synced_to_attendance = Column(Boolean, default=False)
    is_late = Column(Boolean, default=False)
    discord_notified = Column(Boolean, default=False)
    expected_return_time = Column(DateTime, nullable=True)
    return_record_id = Column(Integer, nullable=True)
    return_alert_sent = Column(Boolean, default=False)
    is_schedule_valid = Column(Boolean, nullable=True)


class ClassUpSyncLog(Base):
    __tablename__ = "classup_sync_logs"
    id = Column(Integer, primary_key=True, index=True)
    sync_time = Column(DateTime, default=lambda: datetime.now(KST))
    records_fetched = Column(Integer, default=0)
    new_records = Column(Integer, default=0)
    errors = Column(String, nullable=True)
    status = Column(String, default="success")


class ClassUpSession(Base):
    __tablename__ = "classup_sessions"
    id = Column(Integer, primary_key=True, index=True)
    session_key = Column(String, unique=True, default="default")
    session_data = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(KST))
    updated_at = Column(DateTime, default=lambda: datetime.now(KST))


# ============ 유틸리티 함수 ============

CLASSUP_URL = "https://academy.classup.io/user/entrance"
SESSION_FILE = Path(__file__).parent / "classup_session.json"


def get_session_from_db():
    """DB에서 세션 storage_state 조회 및 파일로 저장"""
    db = SessionLocal()
    try:
        session = db.query(ClassUpSession).filter_by(session_key="default").first()
        if session:
            with open(SESSION_FILE, 'w', encoding='utf-8') as f:
                f.write(session.session_data)
            storage_state = json.loads(session.session_data)
            cookie_count = len(storage_state.get("cookies", [])) if isinstance(storage_state, dict) else 0
            return cookie_count
        return None
    finally:
        db.close()


def match_student(name: str, phone: str, db) -> int:
    """학생 이름/전화번호로 매칭"""
    student = db.query(Student).filter(
        Student.name == name,
        Student.status == "재원"
    ).first()

    if student:
        return student.id

    if phone:
        clean_phone = phone.replace("-", "").replace(" ", "")
        if len(clean_phone) >= 4:
            student = db.query(Student).filter(
                (Student.student_phone.contains(clean_phone[-4:])) |
                (Student.parent_phone.contains(clean_phone[-4:]))
            ).first()
            if student:
                return student.id

    return None


def is_duplicate(db, name: str, status: str, record_time: datetime) -> bool:
    """중복 기록 확인"""
    time_window = timedelta(minutes=1)
    existing = db.query(ClassUpAttendance).filter(
        ClassUpAttendance.student_name == name,
        ClassUpAttendance.status == status,
        ClassUpAttendance.record_time >= record_time - time_window,
        ClassUpAttendance.record_time <= record_time + time_window
    ).first()
    return existing is not None


def parse_record_time(record_time_str: str):
    """시간 문자열 파싱"""
    try:
        record_time_str = record_time_str.strip()
        if " " in record_time_str:
            record_time = datetime.strptime(record_time_str, "%Y-%m-%d %H:%M:%S")
            return KST.localize(record_time)
        elif ":" in record_time_str:
            today = datetime.now(KST).date()
            parts = record_time_str.split(":")
            hour, minute = int(parts[0]), int(parts[1])
            return datetime(today.year, today.month, today.day, hour, minute, tzinfo=KST)
    except:
        pass
    return None


def save_records(records: list) -> dict:
    """기록을 DB에 저장"""
    db = SessionLocal()
    result = {"fetched": len(records), "new": 0}

    try:
        for rec in records:
            if is_duplicate(db, rec["name"], rec["status"], rec["record_time"]):
                continue

            student_id = match_student(rec["name"], rec["phone"], db)

            is_late = False
            if rec["status"] == "입장":
                if rec["record_time"].hour >= 8 and rec["record_time"].minute > 10:
                    is_late = True

            attendance = ClassUpAttendance(
                student_name=rec["name"],
                phone_number=rec["phone"],
                available_time=rec["available_time"],
                status=rec["status"],
                status_detail=rec["status_detail"],
                record_time=rec["record_time"],
                local_student_id=student_id,
                is_late=is_late
            )
            db.add(attendance)
            result["new"] += 1

        sync_log = ClassUpSyncLog(
            records_fetched=result["fetched"],
            new_records=result["new"],
            status="success"
        )
        db.add(sync_log)
        db.commit()

    except Exception as e:
        logger.error(f"저장 오류: {e}")
        db.rollback()
        result["error"] = str(e)
    finally:
        db.close()

    return result


# ============ 브라우저 관리 클래스 ============

class BrowserManager:
    """브라우저 생명주기 관리"""

    def __init__(self):
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.is_initialized = False

    def start(self):
        """브라우저 시작"""
        try:
            self.playwright = sync_playwright().start()
            self.browser = self.playwright.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--single-process',
                    '--no-zygote'
                ]
            )
            self._create_context()
            logger.info("브라우저 시작 완료")
            return True
        except Exception as e:
            logger.error(f"브라우저 시작 실패: {e}")
            return False

    def _create_context(self):
        """새 컨텍스트/페이지 생성"""
        if self.context:
            try:
                self.context.close()
            except:
                pass

        self.context = self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ignore_https_errors=True,
            locale='ko-KR',
            timezone_id='Asia/Seoul',
            storage_state=str(SESSION_FILE) if SESSION_FILE.exists() else None
        )
        self.page = self.context.new_page()
        self.is_initialized = False

    def initialize_page(self) -> bool:
        """페이지 초기 로드"""
        try:
            self.page.goto(CLASSUP_URL, wait_until='networkidle', timeout=30000)
            time.sleep(1)

            if "login" in self.page.url.lower():
                logger.error("로그인 페이지로 리다이렉트됨 - 세션 만료")
                return False

            # 팝업 닫기
            self.page.keyboard.press("Escape")
            time.sleep(0.3)

            self.page.wait_for_selector("table", timeout=10000)
            self.is_initialized = True
            logger.info(f"페이지 초기화 완료: {self.page.url}")
            return True
        except Exception as e:
            logger.error(f"페이지 초기화 실패: {e}")
            return False

    def scrape(self) -> list:
        """페이지에서 데이터 스크래핑"""
        records = []

        try:
            # 초기화 안됐으면 초기화
            if not self.is_initialized:
                if not self.initialize_page():
                    return []
            else:
                # 이미 초기화됐으면 reload만
                self.page.reload(wait_until='networkidle', timeout=15000)
                time.sleep(0.3)

            # 로그인 체크
            if "login" in self.page.url.lower():
                logger.error("세션 만료 감지")
                self.is_initialized = False
                return []

            # 팝업 닫기
            self.page.keyboard.press("Escape")
            time.sleep(0.1)

            # 테이블 데이터 수집
            rows = self.page.query_selector_all('table tbody tr, table tr')

            for row in rows:
                try:
                    cells = row.query_selector_all('td')
                    if len(cells) >= 5:
                        name = cells[0].inner_text().strip()
                        phone = cells[1].inner_text().strip()
                        available_time = cells[2].inner_text().strip()
                        status = cells[3].inner_text().strip()
                        record_time_str = cells[4].inner_text().strip()

                        record_time = parse_record_time(record_time_str)

                        if name and status and record_time:
                            records.append({
                                "name": name,
                                "phone": phone,
                                "available_time": available_time,
                                "status": status,
                                "status_detail": None,
                                "record_time": record_time
                            })
                except:
                    continue

            return records

        except PlaywrightError as e:
            error_msg = str(e).lower()
            if "crash" in error_msg or "closed" in error_msg or "target" in error_msg:
                logger.warning(f"페이지 크래시 감지, 컨텍스트 재생성: {e}")
                self._create_context()
            else:
                logger.error(f"Playwright 오류: {e}")
            return []
        except Exception as e:
            logger.error(f"스크래핑 오류: {e}")
            return []

    def restart(self):
        """브라우저 완전 재시작"""
        logger.info("브라우저 재시작 중...")
        self.stop()
        time.sleep(2)
        get_session_from_db()  # 세션 다시 로드
        return self.start()

    def stop(self):
        """브라우저 종료"""
        try:
            if self.page:
                self.page.close()
        except:
            pass
        try:
            if self.context:
                self.context.close()
        except:
            pass
        try:
            if self.browser:
                self.browser.close()
        except:
            pass
        try:
            if self.playwright:
                self.playwright.stop()
        except:
            pass
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.is_initialized = False


# ============ 메인 워커 ============

def run_worker():
    """워커 메인 루프"""
    logger.info("ClassUp Worker 시작")

    # 세션 확인
    cookie_count = get_session_from_db()
    if not cookie_count:
        logger.error("세션이 없습니다. 메인 서버에서 ClassUp 로그인을 해주세요.")
        logger.info("30초 후 재시도...")
        time.sleep(30)
        return run_worker()

    logger.info(f"세션 로드 완료: {cookie_count}개 쿠키")

    manager = BrowserManager()
    if not manager.start():
        logger.error("브라우저 시작 실패, 30초 후 재시도")
        time.sleep(30)
        return run_worker()

    scrape_count = 0
    error_count = 0

    try:
        while True:
            scrape_count += 1

            # 주기적 브라우저 재시작 (메모리 관리)
            if scrape_count > 0 and scrape_count % BROWSER_RESTART_INTERVAL == 0:
                logger.info(f"[{scrape_count}] 주기적 브라우저 재시작")
                if not manager.restart():
                    logger.error("브라우저 재시작 실패")
                    time.sleep(10)
                    continue
                error_count = 0

            # 스크래핑
            records = manager.scrape()

            if records:
                result = save_records(records)
                if result.get("new", 0) > 0:
                    logger.info(f"[{scrape_count}] 새 기록: {result['new']}개 (총 {len(records)}개)")
                elif scrape_count % 20 == 0:
                    # 20회마다 상태 로그 (새 기록 없어도)
                    logger.info(f"[{scrape_count}] 스크래핑 정상 - {len(records)}개 확인 (새 기록 없음)")
                error_count = 0
            else:
                error_count += 1
                if error_count % 10 == 0:
                    logger.warning(f"연속 {error_count}회 빈 결과")

                # 연속 에러가 많으면 브라우저 재시작
                if error_count >= 20:
                    logger.warning("연속 20회 실패, 브라우저 재시작")
                    if manager.restart():
                        error_count = 0
                    else:
                        time.sleep(30)

            time.sleep(SCRAPE_INTERVAL)

    except KeyboardInterrupt:
        logger.info("종료 신호 수신")
    except Exception as e:
        logger.error(f"워커 오류: {e}")
    finally:
        manager.stop()
        logger.info("ClassUp Worker 종료")


if __name__ == "__main__":
    run_worker()
