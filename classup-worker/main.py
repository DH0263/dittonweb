"""ClassUp 스크래퍼 독립 워커 - 2초마다 출입 기록 스크래핑"""
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
from playwright.sync_api import sync_playwright

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
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, ForeignKey, Date, Time, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

# Postgres URL 변환 (Railway 형식)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

KST = pytz.timezone('Asia/Seoul')

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============ 모델 정의 ============

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    seat_number = Column(String, nullable=True)
    phone = Column(String, nullable=True)
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


# ============ 스크래퍼 ============

# 올바른 URL - dittonweb과 동일하게 academy.classup.io 사용
CLASSUP_URL = "https://academy.classup.io/user/entrance"

SESSION_FILE = Path(__file__).parent / "classup_session.json"

def get_session_from_db():
    """DB에서 세션 storage_state 조회 및 파일로 저장"""
    db = SessionLocal()
    try:
        session = db.query(ClassUpSession).filter_by(session_key="default").first()
        if session:
            # storage_state 전체를 파일로 저장 (Playwright가 파일 경로 필요)
            with open(SESSION_FILE, 'w', encoding='utf-8') as f:
                f.write(session.session_data)

            storage_state = json.loads(session.session_data)
            cookie_count = len(storage_state.get("cookies", [])) if isinstance(storage_state, dict) else 0
            return cookie_count  # 쿠키 개수 반환 (성공 여부 확인용)
        return None
    finally:
        db.close()


def match_student(name: str, phone: str, db) -> int:
    """학생 이름/전화번호로 매칭"""
    # 이름으로 먼저 검색
    student = db.query(Student).filter(
        Student.name == name,
        Student.status == "재원"
    ).first()

    if student:
        return student.id

    # 전화번호로 검색
    if phone:
        clean_phone = phone.replace("-", "").replace(" ", "")
        student = db.query(Student).filter(
            (Student.phone.contains(clean_phone[-4:])) |
            (Student.parent_phone.contains(clean_phone[-4:]))
        ).first()
        if student:
            return student.id

    return None


def is_duplicate(db, name: str, status: str, record_time: datetime) -> bool:
    """중복 기록 확인 (같은 이름, 상태, 시간)"""
    # 1분 이내 같은 기록이 있으면 중복
    time_window = timedelta(minutes=1)
    existing = db.query(ClassUpAttendance).filter(
        ClassUpAttendance.student_name == name,
        ClassUpAttendance.status == status,
        ClassUpAttendance.record_time >= record_time - time_window,
        ClassUpAttendance.record_time <= record_time + time_window
    ).first()
    return existing is not None


def scrape_attendance(page) -> list:
    """출입 기록 스크래핑"""
    try:
        # networkidle 대기하여 JavaScript 렌더링 완료 보장
        page.goto(CLASSUP_URL, wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(500)  # 추가 대기

        current_url = page.url
        logger.info(f"현재 URL: {current_url}")

        # 로그인 페이지로 리다이렉트되었는지 확인
        if "login" in current_url.lower():
            logger.error("로그인 페이지로 리다이렉트됨 - 세션이 만료되었을 수 있습니다")
            return []

        # 팝업 닫기 (있을 경우)
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

        page.wait_for_selector("table", timeout=10000)

        records = []
        # _fast_worker와 동일한 셀렉터 사용
        rows = page.query_selector_all('table tbody tr, table tr')
        logger.info(f"테이블 행 수: {len(rows)}")

        for row in rows:
            try:
                cells = row.query_selector_all('td')

                # _fast_worker와 동일한 5셀 구조: name, phone, available_time, status, record_time
                if len(cells) >= 5:
                    name = cells[0].inner_text().strip()
                    phone = cells[1].inner_text().strip()
                    available_time = cells[2].inner_text().strip()
                    status = cells[3].inner_text().strip()
                    record_time_str = cells[4].inner_text().strip()

                    # 시간 파싱 (예: "2025-12-03 14:30:00" 또는 "14:30")
                    record_time = None
                    try:
                        if " " in record_time_str:
                            # Full datetime format
                            record_time = datetime.strptime(record_time_str, "%Y-%m-%d %H:%M:%S")
                            record_time = KST.localize(record_time)
                        elif ":" in record_time_str:
                            # Time only
                            today = datetime.now(KST).date()
                            parts = record_time_str.split(":")
                            hour, minute = int(parts[0]), int(parts[1])
                            record_time = datetime(today.year, today.month, today.day,
                                                   hour, minute, tzinfo=KST)
                    except:
                        pass

                    if name and status and record_time:
                        records.append({
                            "name": name,
                            "phone": phone,
                            "available_time": available_time,
                            "status": status,
                            "status_detail": None,
                            "record_time": record_time
                        })
            except Exception as e:
                continue

        return records
    except Exception as e:
        logger.error(f"스크래핑 오류: {e}")
        return []


def save_records(records: list) -> dict:
    """기록을 DB에 저장"""
    db = SessionLocal()
    result = {"fetched": len(records), "new": 0}

    try:
        for rec in records:
            # 중복 확인
            if is_duplicate(db, rec["name"], rec["status"], rec["record_time"]):
                continue

            # 학생 매칭
            student_id = match_student(rec["name"], rec["phone"], db)

            # 지각 여부 (08:00 이후 입장)
            is_late = False
            if rec["status"] == "입장":
                if rec["record_time"].hour >= 8 and rec["record_time"].minute > 10:
                    is_late = True

            # 저장
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

        # 동기화 로그
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


def run_worker():
    """워커 메인 루프"""
    logger.info("ClassUp Worker 시작")

    # 세션 확인 및 파일로 저장
    cookie_count = get_session_from_db()
    if not cookie_count:
        logger.error("세션이 없습니다. 먼저 메인 서버에서 ClassUp 로그인을 해주세요.")
        logger.info("30초 후 재시도...")
        time.sleep(30)
        return run_worker()  # 재시도

    logger.info(f"세션 로드 완료: {cookie_count}개 쿠키")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )

        # storage_state 파일 경로로 전체 세션 로드 (쿠키 + localStorage)
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ignore_https_errors=True,  # SSL 인증서 오류 무시
            locale='ko-KR',
            timezone_id='Asia/Seoul',
            storage_state=str(SESSION_FILE)  # 전체 세션 상태 로드
        )

        page = context.new_page()

        logger.info("브라우저 시작 완료, 스크래핑 시작")

        scrape_count = 0
        error_count = 0

        while True:
            try:
                scrape_count += 1
                records = scrape_attendance(page)

                if records:
                    result = save_records(records)
                    if result.get("new", 0) > 0:
                        logger.info(f"[{scrape_count}] 새 기록: {result['new']}개")
                    error_count = 0  # 성공하면 에러 카운트 리셋
                else:
                    error_count += 1
                    if error_count > 10:
                        logger.warning("연속 10회 빈 결과, 세션 확인 필요")
                        error_count = 0

            except Exception as e:
                logger.error(f"루프 오류: {e}")
                error_count += 1

                # 너무 많은 에러면 세션 재확인
                if error_count > 5:
                    logger.info("세션 재확인 중...")
                    session_cookies = get_session_from_db()
                    if session_cookies:
                        context.clear_cookies()
                        context.add_cookies(session_cookies)
                        error_count = 0

            # 2초 대기
            time.sleep(2)


if __name__ == "__main__":
    run_worker()
