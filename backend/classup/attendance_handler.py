"""클래스업 출입 기록 처리 핸들러"""
import re
from datetime import datetime, timedelta, time as time_type
from typing import Optional, Tuple
from sqlalchemy.orm import Session
import pytz

import models
from .models import ClassUpAttendance

KST = pytz.timezone('Asia/Seoul')

# 시간표 정의
SCHEDULE = {
    "lunch": {"start": time_type(12, 0), "end": time_type(13, 0)},      # 점심시간
    "dinner": {"start": time_type(18, 0), "end": time_type(19, 0)},     # 저녁시간
    "breaks": [  # 쉬는시간들
        {"start": time_type(10, 0), "end": time_type(10, 20)},   # 1교시 쉬는시간
        {"start": time_type(15, 0), "end": time_type(15, 20)},   # 3교시 쉬는시간
        {"start": time_type(16, 40), "end": time_type(16, 50)},  # 4교시 쉬는시간
        {"start": time_type(20, 20), "end": time_type(20, 30)},  # 6교시 쉬는시간
    ],
    "closing": time_type(22, 0),  # 정규 하원 시간
}

# 교시별 시간 정의 (지각 처리용)
PERIODS = [
    {"name": "1교시", "start": time_type(8, 0), "end": time_type(10, 0)},
    {"name": "2교시", "start": time_type(10, 20), "end": time_type(12, 0)},
    {"name": "3교시", "start": time_type(13, 0), "end": time_type(15, 0)},
    {"name": "4교시", "start": time_type(15, 20), "end": time_type(16, 40)},
    {"name": "5교시", "start": time_type(16, 50), "end": time_type(18, 0)},
    {"name": "6교시", "start": time_type(19, 0), "end": time_type(20, 20)},
    {"name": "7교시", "start": time_type(20, 30), "end": time_type(22, 0)},
]

# 복귀 시간 설정
RETURN_TIMES = {
    "점심식사": 60,      # 점심 후 다음 교시 시작까지 (분)
    "저녁식사": 60,      # 저녁 후 다음 교시 시작까지 (분)
    "쉬는시간": 20,      # 쉬는시간 종료까지 (분)
    "정기외출": None,    # RecurringOuting에서 확인
    "병원 진료": 60,     # 1시간
    "7층 학원수업": 180, # 3시간
    "상담": 180,         # 3시간
}


def parse_status(raw_status: str) -> Tuple[str, Optional[str]]:
    """
    클래스업 상태 문자열 파싱
    예: "외출(점심식사)" -> ("외출", "점심식사")
         "이동(7층 학원수업)" -> ("이동", "7층 학원수업")
         "퇴장(강제퇴장)" -> ("강제퇴장", None)
         "입장" -> ("입장", None)
    """
    # 강제퇴장 특수 처리
    if "강제퇴장" in raw_status:
        return "강제퇴장", None

    # 괄호가 있는 경우
    match = re.match(r"(\w+)\((.+)\)", raw_status)
    if match:
        main_status = match.group(1)
        detail = match.group(2)
        return main_status, detail

    return raw_status, None


def is_within_schedule(current_time: time_type, schedule_type: str) -> bool:
    """주어진 시간이 시간표 내인지 확인"""
    if schedule_type == "lunch":
        return SCHEDULE["lunch"]["start"] <= current_time <= SCHEDULE["lunch"]["end"]
    elif schedule_type == "dinner":
        return SCHEDULE["dinner"]["start"] <= current_time <= SCHEDULE["dinner"]["end"]
    elif schedule_type == "break":
        for break_time in SCHEDULE["breaks"]:
            if break_time["start"] <= current_time <= break_time["end"]:
                return True
        return False
    return False


def get_next_session_start(current_time: time_type) -> Optional[time_type]:
    """현재 시간 이후 다음 교시 시작 시간 반환"""
    session_starts = [
        time_type(8, 0),    # 1교시
        time_type(10, 20),  # 2교시
        time_type(13, 0),   # 3교시
        time_type(15, 20),  # 4교시
        time_type(16, 50),  # 5교시
        time_type(19, 0),   # 6교시
        time_type(20, 30),  # 7교시
    ]
    for start in session_starts:
        if start > current_time:
            return start
    return None


def check_recurring_outing(student_id: int, current_datetime: datetime, db: Session) -> Optional[models.RecurringOuting]:
    """학생의 정기외출 일정 확인"""
    day_of_week = current_datetime.weekday()  # 0=Monday
    current_time = current_datetime.time()
    current_time_str = current_time.strftime("%H:%M")

    outing = db.query(models.RecurringOuting).filter(
        models.RecurringOuting.student_id == student_id,
        models.RecurringOuting.day_of_week == day_of_week,
        models.RecurringOuting.is_active == 1,
        models.RecurringOuting.start_time <= current_time_str,
        models.RecurringOuting.end_time >= current_time_str
    ).first()

    return outing


def calculate_expected_return(record_time: datetime, status: str, detail: str, student_id: int, db: Session) -> Optional[datetime]:
    """예상 복귀 시간 계산"""
    if status not in ["외출", "이동"]:
        return None

    current_time = record_time.time()

    if detail == "점심식사":
        # 다음 교시 시작 시간
        next_start = get_next_session_start(current_time)
        if next_start:
            return datetime.combine(record_time.date(), next_start).replace(tzinfo=KST)
        return record_time + timedelta(minutes=60)

    elif detail == "저녁식사":
        next_start = get_next_session_start(current_time)
        if next_start:
            return datetime.combine(record_time.date(), next_start).replace(tzinfo=KST)
        return record_time + timedelta(minutes=60)

    elif detail == "쉬는시간":
        # 쉬는시간 종료 시간
        for break_time in SCHEDULE["breaks"]:
            if break_time["start"] <= current_time <= break_time["end"]:
                return datetime.combine(record_time.date(), break_time["end"]).replace(tzinfo=KST)
        return record_time + timedelta(minutes=20)

    elif detail == "정기외출":
        # RecurringOuting에서 end_time 확인
        if student_id:
            outing = check_recurring_outing(student_id, record_time, db)
            if outing and outing.end_time:
                end_time = datetime.strptime(outing.end_time, "%H:%M").time()
                return datetime.combine(record_time.date(), end_time).replace(tzinfo=KST)
        return None  # 정기외출 없으면 None

    elif detail == "병원 진료":
        return record_time + timedelta(minutes=60)

    elif detail in ["7층 학원수업", "상담"]:
        return record_time + timedelta(minutes=180)

    return None


def validate_outing_schedule(record_time: datetime, detail: str, student_id: int, db: Session) -> Tuple[bool, str]:
    """
    외출 일정 유효성 검증
    Returns: (is_valid, reason)
    """
    current_time = record_time.time()

    if detail == "점심식사":
        if not is_within_schedule(current_time, "lunch"):
            return False, f"점심시간({SCHEDULE['lunch']['start'].strftime('%H:%M')}~{SCHEDULE['lunch']['end'].strftime('%H:%M')}) 외 시간에 점심식사 외출"
        return True, ""

    elif detail == "저녁식사":
        if not is_within_schedule(current_time, "dinner"):
            return False, f"저녁시간({SCHEDULE['dinner']['start'].strftime('%H:%M')}~{SCHEDULE['dinner']['end'].strftime('%H:%M')}) 외 시간에 저녁식사 외출"
        return True, ""

    elif detail == "쉬는시간":
        if not is_within_schedule(current_time, "break"):
            return False, "쉬는시간 외 시간에 쉬는시간 외출"
        return True, ""

    elif detail == "정기외출":
        if student_id:
            outing = check_recurring_outing(student_id, record_time, db)
            if outing:
                return True, f"정기외출: {outing.reason}"
            return False, "정기외출 일정 없음"
        return False, "학생 정보 없음"

    elif detail == "병원 진료":
        return True, "병원 진료 (1시간 내 복귀 확인)"

    return True, ""


def validate_exit(record_time: datetime, student_id: int, db: Session) -> Tuple[bool, str]:
    """
    퇴장 유효성 검증
    Returns: (is_valid, reason)
    """
    current_time = record_time.time()
    closing_time = SCHEDULE["closing"]

    # 22:00 이전 퇴장 체크
    if current_time < closing_time:
        # 정기외출이 있는지 확인
        if student_id:
            outing = check_recurring_outing(student_id, record_time, db)
            if outing:
                return True, f"정기외출 일정 있음: {outing.reason}"
        return False, f"정규 하원시간({closing_time.strftime('%H:%M')}) 이전 퇴장"

    return True, ""


def get_last_outing_record(student_name: str, today: datetime, db: Session) -> Optional[ClassUpAttendance]:
    """오늘의 마지막 외출/이동 기록 (복귀 대기 중인 것)"""
    start_of_day = datetime.combine(today.date(), time_type(0, 0)).replace(tzinfo=KST)
    end_of_day = datetime.combine(today.date(), time_type(23, 59, 59)).replace(tzinfo=KST)

    return db.query(ClassUpAttendance).filter(
        ClassUpAttendance.student_name == student_name,
        ClassUpAttendance.record_time >= start_of_day,
        ClassUpAttendance.record_time <= end_of_day,
        ClassUpAttendance.status.in_(["외출", "이동"]),
        ClassUpAttendance.return_record_id == None  # 아직 복귀 안됨
    ).order_by(ClassUpAttendance.record_time.desc()).first()


def link_return_to_outing(reentry_record: ClassUpAttendance, db: Session):
    """재입장 기록을 외출/이동 기록과 연결"""
    outing_record = get_last_outing_record(
        reentry_record.student_name,
        reentry_record.record_time,
        db
    )
    if outing_record:
        outing_record.return_record_id = reentry_record.id
        db.commit()
        return outing_record
    return None


def get_current_period(current_time: time_type) -> Optional[dict]:
    """현재 시간이 속한 교시 반환"""
    for period in PERIODS:
        if period["start"] <= current_time <= period["end"]:
            return period
    return None


def get_current_period_end(current_time: time_type) -> Optional[time_type]:
    """현재 교시의 종료 시간 반환 (지각 상태 해제 시점)"""
    period = get_current_period(current_time)
    if period:
        return period["end"]
    return None


def has_entry_today(student_name: str, today_date, db: Session) -> bool:
    """오늘 해당 학생의 입장/재입장 기록이 있는지 확인"""
    start_of_day = datetime.combine(today_date, time_type(0, 0)).replace(tzinfo=KST)
    end_of_day = datetime.combine(today_date, time_type(23, 59, 59)).replace(tzinfo=KST)

    entry_count = db.query(ClassUpAttendance).filter(
        ClassUpAttendance.student_name == student_name,
        ClassUpAttendance.record_time >= start_of_day,
        ClassUpAttendance.record_time <= end_of_day,
        ClassUpAttendance.status.in_(["입장", "재입장"])
    ).count()

    return entry_count > 0


def get_late_students_in_period(current_time: time_type, db: Session) -> list:
    """현재 교시에 지각으로 표시된 학생 목록 (다음 교시 시작 시 자습중으로 변경용)"""
    today = datetime.now(KST).date()

    # 현재 교시 확인
    current_period = get_current_period(current_time)
    if not current_period:
        return []

    # 오늘 지각한 학생들 중 아직 "지각" 상태인 출석 기록 조회
    late_records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.date == today,
        models.AttendanceRecord.status == "지각"
    ).all()

    return late_records
