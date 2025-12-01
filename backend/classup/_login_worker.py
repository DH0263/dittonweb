"""ClassUp 로그인 Worker (웹에서 호출)"""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

# 파일 경로
SESSION_FILE = Path(__file__).parent / "classup_session.json"
LOGIN_STATE_FILE = Path(__file__).parent / "login_state.json"


def save_state(state: dict):
    """로그인 상태 저장"""
    with open(LOGIN_STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def start_login(phone_number: str):
    """로그인 시작 - 전화번호 입력 후 인증번호 요청"""
    playwright = None
    browser = None

    try:
        print("Playwright 시작...")
        playwright = sync_playwright().start()
        browser = playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )

        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='ko-KR',
            timezone_id='Asia/Seoul'
        )

        page = context.new_page()

        # 로그인 페이지로 이동
        print("로그인 페이지 이동...")
        page.goto("https://academy.classup.io/login", wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(2000)

        # 스크린샷 저장
        screenshot_path = Path(__file__).parent / "login_screenshot.png"
        page.screenshot(path=str(screenshot_path))

        # 전화번호 입력 필드 찾기
        print(f"전화번호 입력: {phone_number}")

        # 전화번호 입력 시도 (여러 셀렉터)
        phone_input = None
        selectors = [
            'input[type="tel"]',
            'input[name="phone"]',
            'input[placeholder*="전화"]',
            'input[placeholder*="휴대"]',
            'input[placeholder*="번호"]',
            'input:not([type="password"]):not([type="hidden"])'
        ]

        for selector in selectors:
            try:
                elem = page.query_selector(selector)
                if elem and elem.is_visible():
                    phone_input = elem
                    print(f"전화번호 입력 필드 발견: {selector}")
                    break
            except:
                continue

        if not phone_input:
            # HTML 저장하고 오류 반환
            html_path = Path(__file__).parent / "login_page.html"
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(page.content())
            save_state({"status": "error", "message": "전화번호 입력 필드를 찾을 수 없습니다.", "step": "phone_input"})
            return {"success": False, "error": "전화번호 입력 필드를 찾을 수 없습니다."}

        # 전화번호 입력
        phone_input.fill(phone_number)
        page.wait_for_timeout(500)

        # 인증번호 요청 버튼 클릭
        print("인증번호 요청 버튼 찾기...")
        send_btn = None
        btn_selectors = [
            'button:has-text("인증")',
            'button:has-text("전송")',
            'button:has-text("요청")',
            'button:has-text("받기")',
            'button[type="submit"]',
            '.btn-primary'
        ]

        for selector in btn_selectors:
            try:
                elem = page.query_selector(selector)
                if elem and elem.is_visible():
                    send_btn = elem
                    print(f"인증 버튼 발견: {selector}")
                    break
            except:
                continue

        if not send_btn:
            save_state({"status": "error", "message": "인증번호 요청 버튼을 찾을 수 없습니다.", "step": "send_button"})
            return {"success": False, "error": "인증번호 요청 버튼을 찾을 수 없습니다."}

        # 버튼 클릭
        send_btn.click()
        page.wait_for_timeout(2000)

        # 스크린샷 저장
        page.screenshot(path=str(screenshot_path))

        # 세션 상태 저장 (인증번호 입력 대기 상태)
        context.storage_state(path=str(SESSION_FILE) + ".temp")

        save_state({
            "status": "awaiting_code",
            "message": "인증번호를 입력해주세요.",
            "phone_number": phone_number,
            "step": "verify_code"
        })

        print("인증번호 요청 완료 - 인증번호 입력 대기")
        return {"success": True, "status": "awaiting_code", "message": "인증번호가 전송되었습니다. SMS를 확인해주세요."}

    except Exception as e:
        print(f"로그인 시작 오류: {e}", file=sys.stderr)
        save_state({"status": "error", "message": str(e), "step": "start"})
        return {"success": False, "error": str(e)}

    finally:
        if browser:
            browser.close()
        if playwright:
            playwright.stop()


def verify_code(verification_code: str):
    """인증번호 확인 및 로그인 완료"""
    playwright = None
    browser = None

    # 저장된 상태 확인
    if not LOGIN_STATE_FILE.exists():
        return {"success": False, "error": "로그인 세션이 없습니다. 먼저 전화번호를 입력해주세요."}

    with open(LOGIN_STATE_FILE, 'r', encoding='utf-8') as f:
        state = json.load(f)

    if state.get("status") != "awaiting_code":
        return {"success": False, "error": "인증번호 입력 단계가 아닙니다."}

    phone_number = state.get("phone_number")

    try:
        print("Playwright 시작...")
        playwright = sync_playwright().start()
        browser = playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )

        # 임시 세션 파일이 있으면 사용
        temp_session = str(SESSION_FILE) + ".temp"
        if Path(temp_session).exists():
            context = browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                locale='ko-KR',
                timezone_id='Asia/Seoul',
                storage_state=temp_session
            )
        else:
            context = browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                locale='ko-KR',
                timezone_id='Asia/Seoul'
            )

        page = context.new_page()

        # 로그인 페이지로 이동 (또는 현재 상태에서 계속)
        print("로그인 페이지 이동...")
        page.goto("https://academy.classup.io/login", wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(2000)

        # 스크린샷 저장
        screenshot_path = Path(__file__).parent / "login_verify_screenshot.png"
        page.screenshot(path=str(screenshot_path))

        # 전화번호 다시 입력 (페이지가 리셋되었을 수 있음)
        phone_selectors = [
            'input[type="tel"]',
            'input[name="phone"]',
            'input[placeholder*="전화"]',
            'input[placeholder*="휴대"]',
        ]

        for selector in phone_selectors:
            try:
                elem = page.query_selector(selector)
                if elem and elem.is_visible():
                    elem.fill(phone_number)
                    page.wait_for_timeout(500)
                    break
            except:
                continue

        # 인증번호 입력 필드 찾기
        print(f"인증번호 입력: {verification_code}")
        code_input = None
        code_selectors = [
            'input[name="code"]',
            'input[name="verificationCode"]',
            'input[placeholder*="인증"]',
            'input[type="number"]',
            'input[maxlength="6"]',
            'input[maxlength="4"]',
        ]

        for selector in code_selectors:
            try:
                elem = page.query_selector(selector)
                if elem and elem.is_visible():
                    code_input = elem
                    print(f"인증번호 입력 필드 발견: {selector}")
                    break
            except:
                continue

        if not code_input:
            # 모든 input 필드 중 두 번째 것 시도
            inputs = page.query_selector_all('input:visible')
            if len(inputs) >= 2:
                code_input = inputs[1]
                print("두 번째 input 필드 사용")

        if code_input:
            code_input.fill(verification_code)
            page.wait_for_timeout(500)

        # 로그인/확인 버튼 클릭
        print("로그인 버튼 찾기...")
        login_btn = None
        btn_selectors = [
            'button:has-text("로그인")',
            'button:has-text("확인")',
            'button:has-text("완료")',
            'button[type="submit"]',
            '.btn-primary',
        ]

        for selector in btn_selectors:
            try:
                elem = page.query_selector(selector)
                if elem and elem.is_visible():
                    login_btn = elem
                    print(f"로그인 버튼 발견: {selector}")
                    break
            except:
                continue

        if login_btn:
            login_btn.click()
            page.wait_for_timeout(3000)

        # 스크린샷 저장
        page.screenshot(path=str(screenshot_path))

        # 로그인 성공 확인
        current_url = page.url
        print(f"현재 URL: {current_url}")

        if "login" not in current_url.lower():
            # 로그인 성공!
            context.storage_state(path=str(SESSION_FILE))

            # 임시 파일 삭제
            temp_path = Path(temp_session)
            if temp_path.exists():
                temp_path.unlink()

            save_state({
                "status": "success",
                "message": "로그인 완료",
                "phone_number": phone_number
            })

            print("로그인 성공! 세션 저장 완료")
            return {"success": True, "message": "로그인이 완료되었습니다."}
        else:
            # 로그인 실패
            save_state({
                "status": "error",
                "message": "로그인 실패 - 인증번호를 확인해주세요.",
                "step": "verify"
            })
            return {"success": False, "error": "로그인 실패 - 인증번호를 확인해주세요."}

    except Exception as e:
        print(f"인증 오류: {e}", file=sys.stderr)
        save_state({"status": "error", "message": str(e), "step": "verify"})
        return {"success": False, "error": str(e)}

    finally:
        if browser:
            browser.close()
        if playwright:
            playwright.stop()


if __name__ == "__main__":
    # 커맨드라인 인자 처리
    if len(sys.argv) < 2:
        print("사용법:")
        print("  python _login_worker.py start <전화번호>")
        print("  python _login_worker.py verify <인증번호>")
        sys.exit(1)

    action = sys.argv[1]

    if action == "start":
        if len(sys.argv) < 3:
            print("전화번호를 입력해주세요.")
            sys.exit(1)
        phone = sys.argv[2]
        result = start_login(phone)
    elif action == "verify":
        if len(sys.argv) < 3:
            print("인증번호를 입력해주세요.")
            sys.exit(1)
        code = sys.argv[2]
        result = verify_code(code)
    else:
        print(f"알 수 없는 액션: {action}")
        sys.exit(1)

    # 결과 출력
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result.get("success") else 1)
