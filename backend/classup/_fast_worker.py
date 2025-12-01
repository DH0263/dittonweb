"""ClassUp 빠른 스크래핑 Worker - 브라우저 유지하며 주기적 스크래핑"""
import json
import sys
import time
import signal
from datetime import datetime
from pathlib import Path
import pytz

from playwright.sync_api import sync_playwright

KST = pytz.timezone('Asia/Seoul')

# 파일 경로
SESSION_FILE = Path(__file__).parent / "classup_session.json"
RESULT_FILE = Path(__file__).parent / "scrape_result.json"
COMMAND_FILE = Path(__file__).parent / "worker_command.json"
STATUS_FILE = Path(__file__).parent / "worker_status.json"

# 전역 상태
_running = True


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
        return None


def save_status(status: dict):
    """Worker 상태 저장"""
    status["timestamp"] = datetime.now(KST).isoformat()
    with open(STATUS_FILE, 'w', encoding='utf-8') as f:
        json.dump(status, f, ensure_ascii=False, indent=2)


def save_result(result: dict):
    """스크래핑 결과 저장"""
    result["timestamp"] = datetime.now(KST).isoformat()
    with open(RESULT_FILE, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)


def check_command():
    """명령 파일 확인"""
    if COMMAND_FILE.exists():
        try:
            with open(COMMAND_FILE, 'r', encoding='utf-8') as f:
                cmd = json.load(f)
            COMMAND_FILE.unlink()  # 명령 파일 삭제
            return cmd.get("action")
        except:
            pass
    return None


def signal_handler(signum, frame):
    """종료 시그널 처리"""
    global _running
    print("종료 시그널 수신")
    _running = False


def scrape_page(page):
    """페이지에서 데이터 스크래핑"""
    records = []

    try:
        # 페이지 새로고침
        page.reload(wait_until='networkidle', timeout=15000)
        page.wait_for_timeout(300)

        # 로그인 체크
        if "login" in page.url.lower():
            return {"success": False, "error": "세션 만료", "records": []}

        # 팝업 닫기
        page.keyboard.press("Escape")
        page.wait_for_timeout(100)

        # 테이블 데이터 수집
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
            except:
                continue

        return {"success": True, "records": records}

    except Exception as e:
        return {"success": False, "error": str(e), "records": []}


def main():
    """메인 Worker 루프"""
    global _running

    # 시그널 핸들러 설정
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    if not SESSION_FILE.exists():
        save_status({"status": "error", "message": "세션 파일 없음"})
        print("세션 파일 없음")
        sys.exit(1)

    playwright = None
    browser = None
    page = None

    try:
        print("Worker 시작...")
        save_status({"status": "starting"})

        playwright = sync_playwright().start()
        browser = playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        )

        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='ko-KR',
            timezone_id='Asia/Seoul',
            storage_state=str(SESSION_FILE)
        )

        page = context.new_page()

        # 초기 페이지 로드
        print("출입 기록 페이지 접속...")
        page.goto("https://academy.classup.io/user/entrance", wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(1000)

        if "login" in page.url.lower():
            save_status({"status": "error", "message": "세션 만료"})
            print("세션 만료")
            sys.exit(1)

        # 팝업 닫기
        for _ in range(2):
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)

        save_status({"status": "running", "message": "브라우저 준비 완료"})
        print("Worker 준비 완료 - 스크래핑 루프 시작")

        scrape_count = 0
        while _running:
            # 명령 확인
            cmd = check_command()
            if cmd == "stop":
                print("중지 명령 수신")
                break

            # 스크래핑 수행
            start_time = time.time()
            result = scrape_page(page)
            elapsed = time.time() - start_time

            scrape_count += 1

            # 결과 저장
            result["scrape_count"] = scrape_count
            result["elapsed_ms"] = int(elapsed * 1000)
            save_result(result)

            if result["success"]:
                print(f"[{scrape_count}] 스크래핑 완료: {len(result['records'])}개 ({elapsed*1000:.0f}ms)")
            else:
                print(f"[{scrape_count}] 스크래핑 실패: {result.get('error')}")
                # 세션 만료 시 종료
                if "세션 만료" in result.get("error", ""):
                    break

            # 2초 대기 (빠른 폴링)
            time.sleep(2)

    except Exception as e:
        print(f"Worker 오류: {e}")
        save_status({"status": "error", "message": str(e)})

    finally:
        print("Worker 종료 중...")
        save_status({"status": "stopped"})

        if page:
            try:
                page.close()
            except:
                pass
        if browser:
            try:
                browser.close()
            except:
                pass
        if playwright:
            try:
                playwright.stop()
            except:
                pass

        print("Worker 종료 완료")


if __name__ == "__main__":
    main()
