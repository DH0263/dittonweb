"""ClassUp 지속 스크래퍼 - 브라우저를 한 번 시작하고 유지"""
import json
import threading
import time
from datetime import datetime
from pathlib import Path
from queue import Queue, Empty
import pytz

KST = pytz.timezone('Asia/Seoul')

# 파일 경로
SESSION_FILE = Path(__file__).parent / "classup_session.json"
RESULT_FILE = Path(__file__).parent / "scrape_result.json"

# 전역 상태
_browser = None
_context = None
_page = None
_playwright = None
_lock = threading.Lock()
_initialized = False


def parse_datetime(datetime_str: str):
    """날짜/시간 문자열 파싱"""
    try:
        datetime_str = datetime_str.strip()
        if " " in datetime_str:
            dt = datetime.strptime(datetime_str, "%Y-%m-%d %H:%M:%S")
        else:
            today = datetime.now(KST).date()
            time_part = datetime.strptime(datetime_str, "%H:%M:%S").time()
            dt = datetime.combine(today, time_part)
        return KST.localize(dt) if dt.tzinfo is None else dt
    except Exception as e:
        print(f"시간 파싱 실패: {datetime_str} - {e}")
        return None


def init_browser():
    """브라우저 초기화 (한 번만 실행)"""
    global _browser, _context, _page, _playwright, _initialized

    if _initialized and _page:
        return True

    with _lock:
        if _initialized and _page:
            return True

        try:
            from playwright.sync_api import sync_playwright

            if not SESSION_FILE.exists():
                print("세션 파일 없음")
                return False

            print("브라우저 초기화 중...")
            _playwright = sync_playwright().start()
            _browser = _playwright.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            )

            _context = _browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                locale='ko-KR',
                timezone_id='Asia/Seoul',
                storage_state=str(SESSION_FILE)
            )

            _page = _context.new_page()

            # 출입 기록 페이지로 이동
            print("출입 기록 페이지 접속...")
            _page.goto("https://academy.classup.io/user/entrance", wait_until='networkidle', timeout=30000)
            _page.wait_for_timeout(1000)

            # 로그인 체크
            if "login" in _page.url.lower():
                print("로그인 필요 - 세션 만료")
                close_browser()
                return False

            # 팝업 닫기
            for _ in range(2):
                _page.keyboard.press("Escape")
                _page.wait_for_timeout(200)

            _initialized = True
            print("브라우저 초기화 완료!")
            return True

        except Exception as e:
            import traceback
            print(f"브라우저 초기화 오류: {e}")
            print(f"Traceback: {traceback.format_exc()}")
            close_browser()
            return False


def close_browser():
    """브라우저 종료"""
    global _browser, _context, _page, _playwright, _initialized

    with _lock:
        _initialized = False
        if _page:
            try:
                _page.close()
            except:
                pass
            _page = None
        if _context:
            try:
                _context.close()
            except:
                pass
            _context = None
        if _browser:
            try:
                _browser.close()
            except:
                pass
            _browser = None
        if _playwright:
            try:
                _playwright.stop()
            except:
                pass
            _playwright = None


def scrape_records():
    """출입 기록 스크래핑 (페이지 새로고침만)"""
    global _page, _initialized

    if not _initialized or not _page:
        if not init_browser():
            return {"success": False, "error": "브라우저 초기화 실패", "records": []}

    records = []

    try:
        # 페이지 새로고침
        _page.reload(wait_until='networkidle', timeout=15000)
        _page.wait_for_timeout(500)

        # 로그인 체크
        if "login" in _page.url.lower():
            print("세션 만료 감지")
            close_browser()
            return {"success": False, "error": "세션 만료", "records": []}

        # 팝업 닫기
        _page.keyboard.press("Escape")
        _page.wait_for_timeout(200)

        # 테이블 데이터 수집
        rows = _page.query_selector_all('table tbody tr, table tr')

        for row in rows:
            try:
                cells = row.query_selector_all('td')

                if len(cells) >= 5:
                    name = cells[0].inner_text().strip()
                    phone = cells[1].inner_text().strip()
                    available_time = cells[2].inner_text().strip()
                    status = cells[3].inner_text().strip()
                    record_time_str = cells[4].inner_text().strip()

                    record_time = parse_datetime(record_time_str)

                    if name and status and record_time:
                        records.append({
                            "student_name": name,
                            "phone_number": phone,
                            "available_time": available_time,
                            "status": status,
                            "record_time": record_time.isoformat()
                        })
            except Exception as e:
                continue

        return {"success": True, "records": records}

    except Exception as e:
        print(f"스크래핑 오류: {e}")
        # 오류 시 브라우저 재시작
        close_browser()
        return {"success": False, "error": str(e), "records": []}


def is_initialized():
    """초기화 상태 확인"""
    return _initialized and _page is not None
