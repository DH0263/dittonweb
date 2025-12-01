# -*- coding: utf-8 -*-
"""
Dittonweb 시간표 종 시스템
각 교시 시작/종료 시간에 종소리를 재생합니다.
"""

import schedule
import time
import datetime
import os
import sys

# 종소리 재생 라이브러리 (설치 필요: pip install playsound)
try:
    from playsound import playsound
    SOUND_AVAILABLE = True
except ImportError:
    SOUND_AVAILABLE = False
    print("[경고] playsound 라이브러리가 없습니다. pip install playsound 로 설치하세요.")

# Windows 비프음 (대체용)
try:
    import winsound
    WINSOUND_AVAILABLE = True
except ImportError:
    WINSOUND_AVAILABLE = False


# ============================================
# 설정
# ============================================

# 종소리 파일 경로 (없으면 시스템 비프음 사용)
# 이 스크립트와 같은 폴더(종소리)에 bell.mp3를 넣으세요
BELL_SOUND_FILE = os.path.join(os.path.dirname(__file__), "bell.mp3")

# 시간표 정의 (시작시간, 종료시간, 이름)
SCHEDULE = [
    # 등원
    ("08:00", "등원 시작"),

    # 1교시
    ("08:00", "1교시 시작"),
    ("10:00", "1교시 종료"),

    # 1교시 쉬는시간
    ("10:20", "2교시 시작"),
    ("12:00", "2교시 종료"),

    # 점심시간
    ("13:00", "3교시 시작"),
    ("15:00", "3교시 종료"),

    # 3교시 쉬는시간
    ("15:20", "4교시 시작"),
    ("16:40", "4교시 종료"),

    # 쉬는시간
    ("16:50", "5교시 시작"),
    ("18:00", "5교시 종료"),

    # 저녁시간
    ("19:00", "6교시 시작"),
    ("20:20", "6교시 종료"),

    # 6교시 쉬는시간
    ("20:30", "7교시 시작"),
    ("22:00", "7교시 종료 (하원)"),
]

# 중복 제거 (같은 시간에 여러 이벤트가 있을 수 있음)
BELL_TIMES = {}
for bell_time, description in SCHEDULE:
    if bell_time not in BELL_TIMES:
        BELL_TIMES[bell_time] = description
    else:
        BELL_TIMES[bell_time] += f" / {description}"


# ============================================
# 종소리 재생 함수
# ============================================

def play_bell(description=""):
    """종소리를 재생합니다."""
    now = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"\n🔔 [{now}] {description}")
    print("=" * 50)

    # 1. MP3 파일이 있으면 재생
    if SOUND_AVAILABLE and os.path.exists(BELL_SOUND_FILE):
        try:
            playsound(BELL_SOUND_FILE)
            return
        except Exception as e:
            print(f"[오류] 종소리 파일 재생 실패: {e}")

    # 2. Windows 비프음 사용 (대체)
    if WINSOUND_AVAILABLE:
        try:
            # 종소리 패턴: 높은 음 3번
            for _ in range(3):
                winsound.Beep(800, 300)  # 주파수 800Hz, 300ms
                time.sleep(0.1)
            return
        except Exception as e:
            print(f"[오류] 비프음 재생 실패: {e}")

    # 3. 콘솔 벨 (최후의 수단)
    print("\a")  # ASCII Bell


def schedule_bell(bell_time, description):
    """특정 시간에 종소리를 예약합니다."""
    schedule.every().day.at(bell_time).do(play_bell, description=description)
    print(f"  ⏰ {bell_time} - {description}")


# ============================================
# 메인 실행
# ============================================

def main():
    print("=" * 50)
    print("🔔 Dittonweb 시간표 종 시스템")
    print("=" * 50)
    print()

    # 종소리 파일 확인
    if os.path.exists(BELL_SOUND_FILE):
        print(f"✅ 종소리 파일: {BELL_SOUND_FILE}")
    else:
        print(f"⚠️  종소리 파일 없음 (시스템 비프음 사용)")
        print(f"   파일 위치: {BELL_SOUND_FILE}")
    print()

    # 스케줄 등록
    print("📅 등록된 종 시간:")
    print("-" * 50)
    for bell_time, description in sorted(BELL_TIMES.items()):
        schedule_bell(bell_time, description)
    print("-" * 50)
    print()

    # 현재 시간 표시
    now = datetime.datetime.now()
    print(f"🕐 현재 시간: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print("종 시스템이 실행 중입니다. 종료하려면 Ctrl+C를 누르세요.")
    print("=" * 50)
    print()

    # 테스트 종 (시작 시 한 번)
    if "--test" in sys.argv:
        print("[테스트] 종소리 테스트...")
        play_bell("테스트 종")

    # 스케줄러 실행
    try:
        while True:
            schedule.run_pending()
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n종 시스템을 종료합니다.")


if __name__ == "__main__":
    main()
