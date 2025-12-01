import os
from dotenv import load_dotenv
import pytz

load_dotenv()

# Environment Variables
DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')
NOTION_TOKEN = os.getenv('NOTION_TOKEN')

# Notion Database IDs
PENALTY_DB_ID = os.getenv('PENALTY_DB_ID')
PATROL_DB_ID = os.getenv('PATROL_DB_ID')
SEAT_DB_ID = os.getenv('SEAT_DB_ID')
COUNSEL_DB_ID = os.getenv('COUNSEL_DB_ID')
STUDENT_DB_ID = os.getenv('STUDENT_DB_ID')

# New Databases
SCHEDULE_DB_ID = '2b16382ebced8013a0f7f2d921f572f5'  # 수업 시간표 DB
OUTING_DB_ID = '64a6d90ad5d1401c8666fc5aa4785759'   # 정기 외출 DB

# Channel IDs
MANAGER_CHANNEL_ID = 1440573166433996800        # 학습관리팀 (지각보고, 순찰알림 등)
ATTENDANCE_CHANNEL_ID = 1440566391404232726     # 출결 알림 (순찰 입력도 여기서)
SUPPLY_COMPLETE_CHANNEL_ID = 1438429054540714105 # 비품 구입 완료 알림
COUNSEL_CHANNEL_ID = 1438433666991652988        # 상담 알림

# Patrol & Attendance
PATROL_CHANNEL_ID = ATTENDANCE_CHANNEL_ID # 순찰 명령어 입력 및 알림 채널
PATROL_WARNING_THRESHOLD_1 = 15 # minutes
PATROL_WARNING_THRESHOLD_2 = 30 # minutes

# Penalty
PENALTY_ALERT_THRESHOLD = 10 # points

# Time Settings
KST = pytz.timezone('Asia/Seoul')
ATTENDANCE_ALARM_TIME = "08:10"
DAILY_BRIEFING_TIME = "09:00"

# Seat Configuration
SEAT_A_RANGE = [f"A{i}" for i in range(1, 43)] # A1 ~ A42
SEAT_B_RANGE = [f"B{i}" for i in range(1, 24)] # B1 ~ B23
ALL_SEATS = SEAT_A_RANGE + SEAT_B_RANGE
