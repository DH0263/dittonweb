"""
일정 조회 서비스
"""
from datetime import date, timedelta
from typing import Dict, List, Any
from collections import defaultdict

from bot.core.database import (
    DatabaseContext,
    Schedule,
    Outing,
    RecurringOuting,
    RecurringCounseling
)


class ScheduleService:
    """일정 조회 서비스"""

    @staticmethod
    def get_weekly_schedule(
        student_id: int,
        start_date: date,
        days: int = 7
    ) -> Dict[date, List[Dict[str, Any]]]:
        """
        학생의 주간 일정 조회

        Args:
            student_id: 학생 ID
            start_date: 시작 날짜
            days: 조회할 일수 (기본 7일)

        Returns:
            날짜별 일정 딕셔너리
            {
                date(2024, 1, 1): [
                    {"type": "외출", "time": "14:00~16:00", "reason": "학원"},
                    ...
                ],
                ...
            }
        """
        end_date = start_date + timedelta(days=days)
        result: Dict[date, List[Dict[str, Any]]] = defaultdict(list)

        with DatabaseContext() as db:
            # 1. 일회성 일정 (Schedule)
            schedules = db.query(Schedule).filter(
                Schedule.student_id == student_id,
                Schedule.date >= start_date,
                Schedule.date <= end_date
            ).all()

            for s in schedules:
                schedule_date = s.date.date() if hasattr(s.date, 'date') else s.date
                result[schedule_date].append({
                    "type": s.type or "일정",
                    "time": s.time or "",
                    "reason": s.memo or ""
                })

            # 2. 일회성 외출 (Outing)
            outings = db.query(Outing).filter(
                Outing.student_id == student_id,
                Outing.date >= start_date,
                Outing.date <= end_date,
                Outing.status == "승인"
            ).all()

            for o in outings:
                outing_date = o.date.date() if hasattr(o.date, 'date') else o.date
                time_str = f"{o.start_time}~{o.end_time}" if o.start_time and o.end_time else ""
                result[outing_date].append({
                    "type": "외출",
                    "time": time_str,
                    "reason": o.reason or ""
                })

            # 3. 정기 외출 (RecurringOuting)
            recurring_outings = db.query(RecurringOuting).filter(
                RecurringOuting.student_id == student_id,
                RecurringOuting.is_active == 1
            ).all()

            # 4. 정기 상담 (RecurringCounseling)
            recurring_counseling = db.query(RecurringCounseling).filter(
                RecurringCounseling.student_id == student_id,
                RecurringCounseling.is_active == 1
            ).all()

        # 정기 일정은 날짜 범위 내에서 매칭
        current = start_date
        while current <= end_date:
            day_of_week = current.weekday()  # 0=월, 6=일
            week_of_month = ScheduleService._get_week_of_month(current)

            # 정기 외출 체크
            for ro in recurring_outings:
                if ro.day_of_week == day_of_week:
                    time_str = f"{ro.start_time}~{ro.end_time}" if ro.start_time and ro.end_time else ""
                    result[current].append({
                        "type": "정기외출",
                        "time": time_str,
                        "reason": ro.reason or ""
                    })

            # 정기 상담 체크
            for rc in recurring_counseling:
                if rc.day_of_week == day_of_week and rc.week_of_month == week_of_month:
                    result[current].append({
                        "type": "정기상담",
                        "time": rc.time or "",
                        "reason": f"상담사: {rc.counselor_name}" if rc.counselor_name else ""
                    })

            current += timedelta(days=1)

        # 날짜순 정렬된 딕셔너리 반환
        return dict(sorted(result.items()))

    @staticmethod
    def _get_week_of_month(d: date) -> int:
        """
        해당 날짜가 월의 몇 번째 주인지 계산

        Args:
            d: 날짜

        Returns:
            1~5 (첫째 주 ~ 다섯째 주)
        """
        first_day = d.replace(day=1)
        first_weekday = first_day.weekday()

        # 해당 날짜가 속한 주 계산
        day_offset = d.day + first_weekday - 1
        week = day_offset // 7 + 1

        return min(week, 4)  # 최대 4로 제한 (5주차는 4주차로 처리)

    @staticmethod
    def get_today_schedules(student_id: int) -> List[Dict[str, Any]]:
        """
        오늘의 일정 조회

        Args:
            student_id: 학생 ID

        Returns:
            오늘의 일정 리스트
        """
        today = date.today()
        schedules = ScheduleService.get_weekly_schedule(student_id, today, days=0)
        return schedules.get(today, [])
