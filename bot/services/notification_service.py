"""
알림 서비스 - 순찰 및 출석 체크
"""
from datetime import date, datetime, time, timedelta
from typing import Optional, List, Dict, Any

from bot.core.database import (
    DatabaseContext,
    Patrol,
    AttendanceRecord,
    Student
)
from bot.config import PERIOD_SCHEDULE


class NotificationService:
    """알림 관련 서비스"""

    @staticmethod
    def get_current_patrol() -> Optional[Dict[str, Any]]:
        """
        현재 진행 중인 순찰 조회

        Returns:
            순찰 정보 딕셔너리 또는 None
            {
                "id": int,
                "start_time": time,
                "elapsed_minutes": int
            }
        """
        with DatabaseContext() as db:
            today = date.today()
            now = datetime.now()

            patrol = db.query(Patrol).filter(
                Patrol.patrol_date == today,
                Patrol.end_time == None  # 진행 중인 순찰
            ).first()

            if not patrol:
                return None

            # 경과 시간 계산
            start_datetime = datetime.combine(today, patrol.start_time)
            elapsed = now - start_datetime
            elapsed_minutes = int(elapsed.total_seconds() / 60)

            return {
                "id": patrol.id,
                "start_time": patrol.start_time,
                "elapsed_minutes": elapsed_minutes,
                "inspector_name": patrol.inspector_name
            }

    @staticmethod
    def get_current_period() -> Optional[int]:
        """
        현재 교시 조회

        Returns:
            현재 교시 번호 (1-7) 또는 None
        """
        now = datetime.now()
        current_time = now.strftime("%H:%M")

        for period, (start, end) in PERIOD_SCHEDULE.items():
            if start <= current_time <= end:
                return period

        return None

    @staticmethod
    def get_period_start_time(period: int) -> Optional[str]:
        """교시 시작 시간 조회"""
        if period in PERIOD_SCHEDULE:
            return PERIOD_SCHEDULE[period][0]
        return None

    @staticmethod
    def get_unconfirmed_attendance(period: int) -> List[Dict[str, Any]]:
        """
        특정 교시 출석 미확인 학생 조회

        Args:
            period: 교시 번호

        Returns:
            미확인 학생 리스트
            [{"id": int, "name": str, "seat_number": str}, ...]
        """
        with DatabaseContext() as db:
            today = date.today()

            # 재원 중인 학생 조회
            students = db.query(Student).filter(
                Student.status == "재원"
            ).all()

            # 해당 교시 출석 확인된 학생 ID 조회
            confirmed_records = db.query(AttendanceRecord.student_id).filter(
                AttendanceRecord.date == today,
                AttendanceRecord.period == period
            ).all()

            confirmed_ids = {r.student_id for r in confirmed_records}

            # 미확인 학생 필터링
            unconfirmed = []
            for student in students:
                if student.id not in confirmed_ids:
                    unconfirmed.append({
                        "id": student.id,
                        "name": student.name,
                        "seat_number": student.seat_number
                    })

            return unconfirmed

    @staticmethod
    def is_period_start_time(period: int, tolerance_minutes: int = 5) -> bool:
        """
        현재 시간이 특정 교시 시작 시간인지 확인

        Args:
            period: 교시 번호
            tolerance_minutes: 허용 오차 (분)

        Returns:
            시작 시간 여부
        """
        if period not in PERIOD_SCHEDULE:
            return False

        start_str = PERIOD_SCHEDULE[period][0]
        start_hour, start_min = map(int, start_str.split(":"))
        start_time = time(start_hour, start_min)

        now = datetime.now()
        start_datetime = datetime.combine(date.today(), start_time)

        diff = abs((now - start_datetime).total_seconds() / 60)
        return diff <= tolerance_minutes

    @staticmethod
    def get_next_period_start() -> Optional[Dict[str, Any]]:
        """
        다음 교시 시작 정보 조회

        Returns:
            {"period": int, "start_time": str, "minutes_until": int} 또는 None
        """
        now = datetime.now()
        current_time = now.strftime("%H:%M")

        for period, (start, end) in PERIOD_SCHEDULE.items():
            if start > current_time:
                start_hour, start_min = map(int, start.split(":"))
                start_datetime = datetime.combine(date.today(), time(start_hour, start_min))
                minutes_until = int((start_datetime - now).total_seconds() / 60)

                return {
                    "period": period,
                    "start_time": start,
                    "minutes_until": minutes_until
                }

        return None

    @staticmethod
    def check_attendance_alert() -> Optional[Dict[str, Any]]:
        """
        출석 확인 알림 체크

        각 교시 시작 후 10분이 경과했는데 출석 확인이 안 된 경우 알림 필요

        Returns:
            {
                "period": int,
                "start_time": str,
                "elapsed_minutes": int,
                "message": str
            } 또는 None
        """
        import requests

        now = datetime.now()
        current_time = now.strftime("%H:%M")

        # 각 교시를 순회하며 시작 후 10분 이상 경과했는지 체크
        for period, (start, end) in PERIOD_SCHEDULE.items():
            start_hour, start_min = map(int, start.split(":"))
            start_datetime = datetime.combine(date.today(), time(start_hour, start_min))

            # 교시 시작 시간과 현재 시간 차이 계산
            elapsed = now - start_datetime
            elapsed_minutes = int(elapsed.total_seconds() / 60)

            # 교시 시작 후 10분 이상 경과했고, 아직 교시 종료 전인지 확인
            if 10 <= elapsed_minutes and start <= current_time <= end:
                # API 호출하여 출석 확인 완료 여부 체크
                try:
                    response = requests.get(
                        f"http://localhost:8000/attendance-records/check-completion/{period}",
                        timeout=5
                    )

                    if response.status_code == 200:
                        data = response.json()

                        # 출석 확인이 완료되지 않았으면 알림
                        if not data.get("is_completed", False):
                            return {
                                "period": period,
                                "start_time": start,
                                "elapsed_minutes": elapsed_minutes,
                                "message": f"⚠️ {period}교시 출석 확인이 아직 완료되지 않았습니다!\n"
                                          f"교시 시작: {start}\n"
                                          f"경과 시간: {elapsed_minutes}분\n"
                                          f"출석 확인을 진행해주세요."
                            }
                except Exception as e:
                    # API 호출 실패 시 로그만 남기고 계속 진행
                    print(f"[ERROR] 출석 확인 API 호출 실패: {e}")
                    continue

        return None
