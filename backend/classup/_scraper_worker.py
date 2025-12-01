"""ClassUp 스크래핑 Worker (subprocess로 실행됨)"""
import json
import sys
from datetime import datetime
from pathlib import Path
import pytz

from playwright.sync_api import sync_playwright

KST = pytz.timezone('Asia/Seoul')

# 파일 경로
SESSION_FILE = Path(__file__).parent / "classup_session.json"
RESULT_FILE = Path(__file__).parent / "scrape_result.json"


def parse_datetime(datetime_str: str):
    """날짜/시간 문자열 파싱"""
    try:
        datetime_str = datetime_str.strip()
        # "2025-11-30 08:00:00" 형식
        if " " in datetime_str:
            dt = datetime.strptime(datetime_str, "%Y-%m-%d %H:%M:%S")
        else:
            # "08:00:00" 형식 (오늘 날짜로 간주)
            today = datetime.now(KST).date()
            time_part = datetime.strptime(datetime_str, "%H:%M:%S").time()
            dt = datetime.combine(today, time_part)

        return KST.localize(dt) if dt.tzinfo is None else dt
    except Exception as e:
        print(f"시간 파싱 실패: {datetime_str} - {e}", file=sys.stderr)
        return None


def scrape_entrance_records():
    """출입 기록 스크래핑"""
    if not SESSION_FILE.exists():
        print("세션 파일 없음", file=sys.stderr)
        return {"success": False, "error": "세션 파일 없음", "records": []}

    records = []
    playwright = None
    browser = None

    try:
        print("Playwright 시작...")
        playwright = sync_playwright().start()
        browser = playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )

        # 세션 로드
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='ko-KR',
            timezone_id='Asia/Seoul',
            storage_state=str(SESSION_FILE)
        )

        page = context.new_page()

        # 출입 기록 페이지로 이동
        print("출입 기록 페이지 접속...")
        page.goto("https://academy.classup.io/user/entrance", wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(2000)

        # 로그인 체크
        if "login" in page.url.lower():
            print("로그인 필요 - 세션 만료", file=sys.stderr)
            return {"success": False, "error": "세션 만료", "records": []}

        print(f"현재 URL: {page.url}")

        # 팝업/모달 닫기 시도 (여러 번)
        for _ in range(3):
            # ESC 키로 팝업 닫기
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)

            # X 버튼 클릭 시도 (styled-components 버튼)
            close_buttons = page.query_selector_all('button')
            for btn in close_buttons:
                try:
                    # X 아이콘이 있는 버튼 찾기
                    inner = btn.inner_html()
                    if 'close' in inner.lower() or '×' in inner or 'X' in inner:
                        if btn.is_visible():
                            btn.click()
                            page.wait_for_timeout(300)
                except:
                    pass

            # 모달 외부 클릭
            page.mouse.click(800, 50)
            page.wait_for_timeout(300)

        # "자동으로 열지 않기" 체크박스 클릭 시도
        try:
            checkbox = page.query_selector('input[type="checkbox"]')
            if checkbox and checkbox.is_visible():
                checkbox.click()
                page.wait_for_timeout(200)
        except:
            pass

        # 다시 ESC
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # 스크린샷 저장
        screenshot_path = Path(__file__).parent / "debug_screenshot.png"
        page.screenshot(path=str(screenshot_path))
        print(f"스크린샷 저장: {screenshot_path}")

        # HTML 저장
        html_path = Path(__file__).parent / "debug_page.html"
        html_content = page.content()
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print(f"HTML 저장: {html_path}")

        # 다양한 셀렉터 시도
        selectors_to_try = [
            'table',
            'tr',
            '[class*="row"]',
            '[class*="list"]',
            '[class*="item"]',
            '[class*="card"]',
            '[class*="data"]',
            '[class*="entrance"]',
            'div[class*="table"]',
        ]

        for selector in selectors_to_try:
            elements = page.query_selector_all(selector)
            if elements:
                print(f"셀렉터 '{selector}': {len(elements)}개 발견")

        # 테이블 데이터 수집
        page_num = 1
        while True:
            print(f"페이지 {page_num} 수집 중...")

            # 테이블 행 가져오기 - 더 넓은 셀렉터
            rows = page.query_selector_all('table tbody tr, table tr')

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
                    print(f"행 파싱 오류: {e}", file=sys.stderr)
                    continue

            # 다음 페이지 확인
            next_btn = page.query_selector('button:has-text(">"), a:has-text(">"), .pagination-next')
            if next_btn:
                is_disabled = next_btn.get_attribute('disabled')
                if is_disabled:
                    break
                next_btn.click()
                page.wait_for_timeout(1000)
                page_num += 1
            else:
                break

            if page_num > 20:
                break

        print(f"총 {len(records)}개 기록 수집 완료")
        return {"success": True, "records": records}

    except Exception as e:
        print(f"스크래핑 오류: {e}", file=sys.stderr)
        return {"success": False, "error": str(e), "records": []}

    finally:
        if browser:
            browser.close()
        if playwright:
            playwright.stop()


if __name__ == "__main__":
    result = scrape_entrance_records()

    # 결과를 파일로 저장
    with open(RESULT_FILE, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    if result["success"]:
        print(f"완료: {len(result['records'])}개 기록")
        sys.exit(0)
    else:
        print(f"실패: {result.get('error', 'Unknown error')}", file=sys.stderr)
        sys.exit(1)
