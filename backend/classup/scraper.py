"""ClassUp 출입 기록 스크래퍼 (subprocess 방식 - Windows 완벽 호환)"""
import asyncio
import json
import os
import sys
import logging
import subprocess
from datetime import datetime, date, time
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
import pytz

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KST = pytz.timezone('Asia/Seoul')

# 지각 기준 시간
LATE_THRESHOLD = time(8, 0)  # 08:00

# 세션 저장 경로
SESSION_FILE = Path(__file__).parent / "classup_session.json"

# 스크래핑 결과 임시 파일
RESULT_FILE = Path(__file__).parent / "scrape_result.json"


@dataclass
class AttendanceRecord:
    """출입 기록 데이터 클래스"""
    student_name: str
    phone_number: str
    available_time: str
    status: str  # 입장, 퇴장, 강제퇴장
    record_time: datetime

    def to_dict(self):
        return {
            "student_name": self.student_name,
            "phone_number": self.phone_number,
            "available_time": self.available_time,
            "status": self.status,
            "record_time": self.record_time.isoformat() if self.record_time else None
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'AttendanceRecord':
        record_time = None
        if data.get("record_time"):
            record_time = datetime.fromisoformat(data["record_time"])
        return cls(
            student_name=data["student_name"],
            phone_number=data.get("phone_number", ""),
            available_time=data.get("available_time", ""),
            status=data["status"],
            record_time=record_time
        )


class ClassUpScraper:
    """클래스업 출입 기록 스크래퍼 (subprocess 방식)"""

    def __init__(self):
        self.logged_in = False

    async def start(self, headless: bool = True):
        """브라우저 시작 (subprocess에서 처리하므로 여기서는 상태만 확인)"""
        # 세션 파일이 있으면 로그인된 것으로 간주
        if SESSION_FILE.exists():
            self.logged_in = True
            logger.info("세션 파일 존재 - 로그인 상태로 설정")
        else:
            self.logged_in = False
            logger.warning("세션 파일 없음 - 수동 로그인 필요")

    async def close(self):
        """브라우저 종료 (subprocess에서 자동 종료됨)"""
        pass

    async def ensure_logged_in(self) -> bool:
        """로그인 상태 확인"""
        if SESSION_FILE.exists():
            self.logged_in = True
            return True
        self.logged_in = False
        logger.warning("세션 파일 없음 - 수동 로그인 필요")
        return False

    async def fetch_entrance_records(self, target_date: date = None) -> List[AttendanceRecord]:
        """출입 기록 가져오기 (subprocess로 실행)"""
        if not SESSION_FILE.exists():
            logger.error("세션 파일 없음 - 수동 로그인 필요")
            return []

        logger.info("ThreadPoolExecutor로 스크래핑 실행...")

        # subprocess로 스크래핑 스크립트 실행
        script_path = Path(__file__).parent / "_scraper_worker.py"
        python_exe = sys.executable
        cwd = str(Path(__file__).parent)

        def run_worker():
            """동기적으로 worker 실행"""
            import subprocess as sp
            result = sp.run(
                [python_exe, str(script_path)],
                capture_output=True,
                cwd=cwd,
                timeout=60
            )
            return result

        try:
            # ThreadPoolExecutor로 동기 subprocess 실행
            import concurrent.futures
            loop = asyncio.get_event_loop()
            with concurrent.futures.ThreadPoolExecutor() as executor:
                result = await loop.run_in_executor(executor, run_worker)

            stdout_str = result.stdout.decode('utf-8', errors='ignore')
            stderr_str = result.stderr.decode('utf-8', errors='ignore')

            logger.info(f"Worker stdout: {stdout_str[:500]}")
            if stderr_str:
                logger.info(f"Worker stderr: {stderr_str[:500]}")

            if result.returncode != 0:
                logger.error(f"스크래핑 실패 (returncode={result.returncode})")
                logger.error(f"stderr: {stderr_str}")
                logger.error(f"stdout: {stdout_str}")
                return []

            # 결과 파일 읽기
            if RESULT_FILE.exists():
                with open(RESULT_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                records = [AttendanceRecord.from_dict(r) for r in data.get("records", [])]
                logger.info(f"스크래핑 완료: {len(records)}개 기록")
                return records
            else:
                logger.error("결과 파일이 생성되지 않았습니다.")
                return []

        except Exception as e:
            logger.error(f"스크래핑 오류: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []


def has_saved_session() -> bool:
    """저장된 세션 파일이 있는지 확인"""
    return SESSION_FILE.exists()


def delete_session():
    """저장된 세션 파일 삭제"""
    if SESSION_FILE.exists():
        SESSION_FILE.unlink()
        logger.info("세션 파일 삭제됨")
        return True
    return False


# ============ 독립 실행용 함수 (수동 로그인) ============

def run_manual_login():
    """
    수동 로그인 실행 (터미널에서 직접 실행)
    python -m classup.scraper
    """
    from playwright.sync_api import sync_playwright

    print("=" * 50)
    print("ClassUp 수동 로그인")
    print("=" * 50)
    print("브라우저 창이 열리면 전화번호로 로그인해주세요.")
    print("로그인 완료 후 세션이 자동으로 저장됩니다.")
    print("=" * 50)

    playwright = None
    browser = None

    try:
        playwright = sync_playwright().start()
        browser = playwright.chromium.launch(
            headless=False,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )

        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='ko-KR',
            timezone_id='Asia/Seoul'
        )

        page = context.new_page()

        # 로그인 페이지로 이동
        print("\n로그인 페이지로 이동 중...")
        page.goto("https://academy.classup.io/login", wait_until='networkidle')

        # 사용자가 로그인할 때까지 대기
        print("브라우저 창에서 전화번호 로그인을 완료해주세요.")
        print("로그인 대기 중... (최대 180초)")

        import time as time_module
        start_time = time_module.time()
        timeout_seconds = 180

        while True:
            page.wait_for_timeout(2000)
            current_url = page.url

            if "login" not in current_url.lower() and "academy.classup.io" in current_url:
                print(f"\n로그인 성공 감지: {current_url}")
                break

            elapsed = time_module.time() - start_time
            if elapsed > timeout_seconds:
                print(f"\n로그인 타임아웃 ({timeout_seconds}초)")
                return

        # 세션 저장
        context.storage_state(path=str(SESSION_FILE))
        print(f"\n세션 저장 완료: {SESSION_FILE}")

        # 테스트로 데이터 가져오기
        print("\n출입 기록 테스트 조회...")
        page.goto("https://academy.classup.io/user/entrance", wait_until='networkidle')
        page.wait_for_timeout(2000)

        # 테이블 데이터 파싱
        rows = page.query_selector_all('table tbody tr')
        print(f"조회된 행 수: {len(rows)}")

        for i, row in enumerate(rows[:5]):
            cells = row.query_selector_all('td')
            if len(cells) >= 4:
                name = cells[0].inner_text()
                status = cells[3].inner_text()
                print(f"  - {name}: {status}")

        print("\n로그인 성공! 세션이 저장되었습니다.")
        print("이제 웹 API에서 동기화를 시작할 수 있습니다.")

    except Exception as e:
        print(f"\n오류 발생: {e}")

    finally:
        if browser:
            browser.close()
        if playwright:
            playwright.stop()


if __name__ == "__main__":
    run_manual_login()
