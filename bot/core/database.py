"""
데이터베이스 세션 관리
백엔드의 database.py와 models.py를 재사용
"""
import sys
import os

# 경로 설정
BOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BOT_DIR)
BACKEND_DIR = os.path.join(PROJECT_ROOT, 'backend')

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from backend.database import SessionLocal, engine
from backend.models import (
    Student,
    Penalty,
    Schedule,
    Outing,
    RecurringOuting,
    RecurringCounseling,
    Patrol,
    AttendanceRecord,
    StudyAttitudeCheck
)


class DatabaseContext:
    """데이터베이스 세션 컨텍스트 매니저"""

    def __enter__(self):
        self.session = SessionLocal()
        return self.session

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.session.rollback()
        self.session.close()
        return False


def get_db_session():
    """새 데이터베이스 세션 생성"""
    return SessionLocal()
