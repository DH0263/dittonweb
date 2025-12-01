"""ClassUp Async 스크래퍼 - Playwright async API 사용 (asyncio 완벽 호환)"""
import asyncio
import json
from datetime import datetime
from pathlib import Path
import pytz

KST = pytz.timezone('Asia/Seoul')

# 파일 경로
SESSION_FILE = Path(__file__).parent / "classup_session.json"

# 전역 상태 (async 버전)
_browser = None
_context = None
_page = None
_playwright = None
_initialized = False
_lock = asyncio.Lock()


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


async def init_browser():
    """브라우저 초기화 (async)"""
    global _browser, _context, _page, _playwright, _initialized

    if _initialized and _page:
        return True

    async with _lock:
        if _initialized and _page:
            return True

        try:
            from playwright.async_api import async_playwright

            if not SESSION_FILE.exists():
                print("세션 파일 없음")
                return False

            print("브라우저 초기화 중 (async)...")
            _playwright = await async_playwright().start()
            _browser = await _playwright.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            )

            _context = await _browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                locale='ko-KR',
                timezone_id='Asia/Seoul',
                storage_state=str(SESSION_FILE)
            )

            _page = await _context.new_page()

            # 출입 기록 페이지로 이동
            print("출입 기록 페이지 접속...")
            await _page.goto("https://academy.classup.io/user/entrance", wait_until='networkidle', timeout=30000)
            await asyncio.sleep(1)

            # 로그인 체크
            if "login" in _page.url.lower():
                print("로그인 필요 - 세션 만료")
                await close_browser()
                return False

            # 팝업 닫기
            for _ in range(2):
                await _page.keyboard.press("Escape")
                await asyncio.sleep(0.2)

            _initialized = True
            print("브라우저 초기화 완료! (async)")
            return True

        except Exception as e:
            import traceback
            print(f"브라우저 초기화 오류: {e}")
            print(f"Traceback: {traceback.format_exc()}")
            await close_browser()
            return False


async def close_browser():
    """브라우저 종료 (async)"""
    global _browser, _context, _page, _playwright, _initialized

    _initialized = False
    if _page:
        try:
            await _page.close()
        except:
            pass
        _page = None
    if _context:
        try:
            await _context.close()
        except:
            pass
        _context = None
    if _browser:
        try:
            await _browser.close()
        except:
            pass
        _browser = None
    if _playwright:
        try:
            await _playwright.stop()
        except:
            pass
        _playwright = None


async def scrape_records():
    """출입 기록 스크래핑 (페이지 새로고침만 - 매우 빠름)"""
    global _page, _initialized

    if not _initialized or not _page:
        if not await init_browser():
            return {"success": False, "error": "브라우저 초기화 실패", "records": []}

    records = []

    try:
        # 페이지 새로고침 (이미 열려있으므로 빠름)
        await _page.reload(wait_until='networkidle', timeout=15000)
        await asyncio.sleep(0.3)

        # 로그인 체크
        if "login" in _page.url.lower():
            print("세션 만료 감지")
            await close_browser()
            return {"success": False, "error": "세션 만료", "records": []}

        # 팝업 닫기
        await _page.keyboard.press("Escape")
        await asyncio.sleep(0.1)

        # 테이블 데이터 수집
        rows = await _page.query_selector_all('table tbody tr, table tr')

        for row in rows:
            try:
                cells = await row.query_selector_all('td')

                if len(cells) >= 5:
                    name = (await cells[0].inner_text()).strip()
                    phone = (await cells[1].inner_text()).strip()
                    available_time = (await cells[2].inner_text()).strip()
                    status = (await cells[3].inner_text()).strip()
                    record_time_str = (await cells[4].inner_text()).strip()

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
        await close_browser()
        return {"success": False, "error": str(e), "records": []}


def is_initialized():
    """초기화 상태 확인"""
    return _initialized and _page is not None
