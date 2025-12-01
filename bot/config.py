"""
디턴봇 설정 파일
루트 config.py에서 필요한 설정을 가져옴
"""
import sys
import os

# 프로젝트 루트 경로 설정
BOT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BOT_DIR)
BACKEND_DIR = os.path.join(PROJECT_ROOT, 'backend')

# 경로 추가
sys.path.insert(0, PROJECT_ROOT)
sys.path.insert(0, BACKEND_DIR)

# 루트 config에서 설정 가져오기
from config import (
    DISCORD_TOKEN,
    KST,
    # 채널 ID
    MANAGER_CHANNEL_ID,
    ATTENDANCE_CHANNEL_ID,
    PATROL_CHANNEL_ID,
    COUNSEL_CHANNEL_ID,
    SUPPLY_COMPLETE_CHANNEL_ID,
    # 임계값
    PATROL_WARNING_THRESHOLD_1,
    PATROL_WARNING_THRESHOLD_2,
    PENALTY_ALERT_THRESHOLD,
    # 좌석
    ALL_SEATS,
    SEAT_A_RANGE,
    SEAT_B_RANGE,
)

# 봇 전용 설정
BOT_NAME = "디턴봇"
BOT_DESCRIPTION = "디턴 학습관 관리 봇"
COMMAND_PREFIX = "!"

# 순찰 경고 시간 (분) - 원하는 값으로 수정 가능
PATROL_WARNING_MINUTES_1 = 15
PATROL_WARNING_MINUTES_2 = 25

# 교시 시간표
PERIOD_SCHEDULE = {
    1: ("08:00", "10:00"),   # 1교시
    2: ("10:20", "12:00"),   # 2교시
    3: ("13:00", "15:00"),   # 3교시
    4: ("15:20", "16:40"),   # 4교시
    5: ("16:50", "18:00"),   # 5교시
    6: ("19:00", "20:20"),   # 6교시
    7: ("20:30", "22:00"),   # 7교시
}

# 권한 레벨
PERMISSION_LEVELS = {
    "관리자": 100,      # 전동현
    "운영진": 20,       # 정현재, 김현철
    "학습관리팀": 10,
    "올케어팀": 10,
}
