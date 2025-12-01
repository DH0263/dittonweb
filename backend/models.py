from sqlalchemy import Column, Date, Time, Integer, String, DateTime, ForeignKey, Text, Boolean, JSON

from sqlalchemy.orm import relationship

from database import Base

from datetime import datetime



class Student(Base):

    __tablename__ = "students"

    

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, index=True)

    seat_number = Column(String, unique=True, index=True)

    status = Column(String, default="재원")

    # Extended fields for registration

    student_phone = Column(String, nullable=True)

    parent_phone = Column(String, nullable=True)

    gender = Column(String, nullable=True)

    student_type = Column(String, nullable=True)  # 고1, 고2, 고3, N수생 등

    korean_subject = Column(String, nullable=True)

    math_subject = Column(String, nullable=True)

    inquiry_subjects = Column(JSON, nullable=True)  # 탐구 선택 (배열)

    recent_grade = Column(String, nullable=True)

    school_name = Column(String, nullable=True)

    seat_type = Column(String, nullable=True)  # 독서실형, 오픈형

    first_attendance_date = Column(DateTime, nullable=True)



    penalties = relationship("Penalty", back_populates="student")

    schedules = relationship("Schedule", back_populates="student")

    outings = relationship("Outing", back_populates="student")

    recurring_outings = relationship("RecurringOuting", back_populates="student")

    recurring_counseling = relationship("RecurringCounseling", back_populates="student")
    attendance_records = relationship("AttendanceRecord", back_populates="student")
    study_attitude_checks = relationship("StudyAttitudeCheck", back_populates="student")

    # 다이아몬드 상담 시스템
    diamond_counselings = relationship("DiamondCounseling", back_populates="student")
    counseling_sessions = relationship("CounselingSession", back_populates="student")
    counseling_surveys = relationship("CounselingSurvey", back_populates="student")
    schedule_change_requests = relationship("ScheduleChangeRequest", back_populates="student")



class Penalty(Base):

    __tablename__ = "penalties"

    

    id = Column(Integer, primary_key=True, index=True)

    student_id = Column(Integer, ForeignKey("students.id"))

    reason = Column(String)

    points = Column(Integer)

    date = Column(DateTime)

    type = Column(String)

    

    student = relationship("Student", back_populates="penalties")



class Schedule(Base):

    __tablename__ = "schedules"

    

    id = Column(Integer, primary_key=True, index=True)

    student_id = Column(Integer, ForeignKey("students.id"))

    date = Column(DateTime)

    time = Column(String)

    type = Column(String)

    memo = Column(String, nullable=True)

    

    student = relationship("Student", back_populates="schedules")



class Outing(Base):

    __tablename__ = "outings"

    

    id = Column(Integer, primary_key=True, index=True)

    student_id = Column(Integer, ForeignKey("students.id"))

    date = Column(DateTime)

    start_time = Column(String)

    end_time = Column(String)

    reason = Column(String)

    status = Column(String, default="승인")

    

    student = relationship("Student", back_populates="outings")



class Patrol(Base):

    __tablename__ = "patrols"



    id = Column(Integer, primary_key=True, index=True)

    patrol_date = Column(Date, nullable=False)

    start_time = Column(Time, nullable=False)

    end_time = Column(Time, nullable=True)

    notes = Column(String, nullable=True)

    inspector_name = Column(String, nullable=True)

    location = Column(String, nullable=True)

    special_notes = Column(String, nullable=True)



class RecurringOuting(Base):

    __tablename__ = "recurring_outings"

    

    id = Column(Integer, primary_key=True, index=True)

    student_id = Column(Integer, ForeignKey("students.id"))

    day_of_week = Column(Integer)  # 0=Monday, 6=Sunday

    start_time = Column(String)

    end_time = Column(String)

    reason = Column(String)

    is_active = Column(Integer, default=1)

    

    student = relationship("Student", back_populates="recurring_outings")



class RecurringCounseling(Base):

    __tablename__ = "recurring_counseling"

    

    id = Column(Integer, primary_key=True, index=True)

    student_id = Column(Integer, ForeignKey("students.id"))

    week_of_month = Column(Integer)  # 1-4

    day_of_week = Column(Integer)  # 0=Monday, 6=Sunday

    time = Column(String)

    counselor_name = Column(String)

    is_active = Column(Integer, default=1)

    

    student = relationship("Student", back_populates="recurring_counseling")



class Inquiry(Base):

    __tablename__ = "inquiries"

    

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, index=True)  # 학생 이름

    visit_date = Column(DateTime, nullable=True)  # 방문 예약

    status = Column(String, default="방문예약")  # 등록 여부

    program = Column(String, nullable=True)  # 정규, 올케어

    student_phone = Column(String, nullable=True)

    parent_phone = Column(String, nullable=True)

    inquiry_source = Column(String, nullable=True)  # 전화, 워크인, 네이버 예약, 카카오채널

    memo = Column(Text, nullable=True)

    payment_info = Column(Text, nullable=True)  # 결제방법/일시/금액

    created_at = Column(DateTime, default=datetime.now)



class StudentRegistration(Base):

    __tablename__ = "student_registrations"

    

    id = Column(Integer, primary_key=True, index=True)

    student_name = Column(String, index=True)

    student_phone = Column(String)

    parent_phone = Column(String)

    pre_attendance_status = Column(String)  # 완료, 미신청, 신청

    pre_attendance_date = Column(DateTime, nullable=True)

    first_attendance_date = Column(DateTime)

    gender = Column(String)

    student_type = Column(String)  # 자퇴생, N수생, 고1, 고2, 고3, 예비고1

    korean_subject = Column(String)

    math_subject = Column(String)

    inquiry_subjects = Column(JSON)  # 탐구 선택 (배열)

    recent_grade = Column(String)

    special_notes = Column(Text, nullable=True)

    seat_type = Column(String)  # 독서실형, 오픈형

    school_name = Column(String)

    recurring_outings_data = Column(JSON, nullable=True)  # 정기 외출 일정

    created_at = Column(DateTime, default=datetime.now)

    is_processed = Column(Boolean, default=False)  # 학생 DB 생성 여부

    processed_student_id = Column(Integer, nullable=True)  # 생성된 학생 ID

# 출결 기록 �??�습 ?�도 체크 모델 추�?



# models.py??추�????�용:



class AttendanceRecord(Base):

    __tablename__ = "attendance_records"



    id = Column(Integer, primary_key=True, index=True)

    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)

    date = Column(Date, nullable=False)

    period = Column(Integer, nullable=True)  # 1-7교시, NULL이면 일일 출석

    status = Column(String, nullable=False)  # '자습중', '출석', '지각', '결석', '일정중', '조퇴'

    check_in_time = Column(Time, nullable=True)

    check_out_time = Column(Time, nullable=True)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    

    student = relationship("Student", back_populates="attendance_records")





class StudyAttitudeCheck(Base):

    __tablename__ = "study_attitude_checks"

    

    id = Column(Integer, primary_key=True, index=True)

    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)

    patrol_id = Column(Integer, ForeignKey("patrols.id"), nullable=True)

    check_date = Column(Date, nullable=False)

    check_time = Column(Time, nullable=False)

    attitude_type = Column(String, nullable=False)  # '?�상', '졸음', '?�짓', '?�탈', '기�?'

    notes = Column(Text, nullable=True)

    checker_name = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    

    student = relationship("Student", back_populates="study_attitude_checks")





# Student model relationships:
# attendance_records = relationship("AttendanceRecord", back_populates="student")
# study_attitude_checks = relationship("StudyAttitudeCheck", back_populates="student")


class SchoolAttendance(Base):
    """High school student school attendance tracking (daily)"""
    __tablename__ = "school_attendance"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student")


# ==================== 다이아몬드 상담 시스템 모델 ====================

class Counselor(Base):
    """상담사 마스터 테이블"""
    __tablename__ = "counselors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    diamond_counselings = relationship("DiamondCounseling", back_populates="counselor")
    counseling_sessions = relationship("CounselingSession", back_populates="counselor")
    counseling_surveys = relationship("CounselingSurvey", back_populates="counselor")


class DiamondCounseling(Base):
    """다이아몬드 상담 정기 스케줄 (월별 주차)"""
    __tablename__ = "diamond_counselings"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    counselor_id = Column(Integer, ForeignKey("counselors.id"), nullable=False)

    # 주차: 1, 2, 3, 4 (월의 몇째주)
    # 1&3주차 쌍 또는 2&4주차 쌍으로 운영
    week_number = Column(Integer, nullable=False)  # 1, 2, 3, or 4
    day_of_week = Column(Integer, nullable=False)  # 0=월, 6=일
    start_time = Column(String, nullable=False)    # "14:00" 형식

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # 페어 상담 (자동 생성된 다른 선생님 상담 - 1↔3, 2↔4 쌍)
    paired_counseling_id = Column(Integer, ForeignKey("diamond_counselings.id"), nullable=True)

    # Relationships
    student = relationship("Student", back_populates="diamond_counselings")
    counselor = relationship("Counselor", back_populates="diamond_counselings")
    paired_counseling = relationship("DiamondCounseling", remote_side=[id])
    sessions = relationship("CounselingSession", back_populates="diamond_counseling")


class CounselingSession(Base):
    """실제 상담 세션 (개별 날짜별)"""
    __tablename__ = "counseling_sessions"

    id = Column(Integer, primary_key=True, index=True)
    diamond_counseling_id = Column(Integer, ForeignKey("diamond_counselings.id"), nullable=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    counselor_id = Column(Integer, ForeignKey("counselors.id"), nullable=False)

    scheduled_date = Column(Date, nullable=False)
    scheduled_time = Column(String, nullable=False)

    # 상태: scheduled, completed, cancelled, rescheduled
    status = Column(String, default="scheduled")
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    diamond_counseling = relationship("DiamondCounseling", back_populates="sessions")
    student = relationship("Student", back_populates="counseling_sessions")
    counselor = relationship("Counselor", back_populates="counseling_sessions")
    survey = relationship("CounselingSurvey", back_populates="session", uselist=False)
    change_requests = relationship("ScheduleChangeRequest", back_populates="session")


class CounselingSurvey(Base):
    """상담 설문지 응답"""
    __tablename__ = "counseling_surveys"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("counseling_sessions.id"), nullable=False, unique=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    counselor_id = Column(Integer, ForeignKey("counselors.id"), nullable=False)

    # 상담 유형: 다이아몬드, 국어상담, 수학상담, 영어상담, 탐구상담, 멘탈상담, 진단평가상담
    counseling_type = Column(String, nullable=False)

    # 필수 필드
    overall_achievement = Column(String, nullable=False)  # 상, 중, 하

    # 선택 필드
    allcare_satisfaction = Column(String, nullable=True)  # 매우만족~매우불만족
    allcare_satisfaction_reason = Column(Text, nullable=True)

    # 과목별 필드
    korean_notes = Column(Text, nullable=True)
    math_notes = Column(Text, nullable=True)
    english_notes = Column(Text, nullable=True)
    inquiry_notes = Column(Text, nullable=True)

    # 기타
    other_notes = Column(Text, nullable=True)

    submitted_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("CounselingSession", back_populates="survey")
    student = relationship("Student", back_populates="counseling_surveys")
    counselor = relationship("Counselor", back_populates="counseling_surveys")


class ScheduleChangeRequest(Base):
    """상담 일정 변경 요청"""
    __tablename__ = "schedule_change_requests"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("counseling_sessions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)

    # 요청 정보
    requested_date = Column(Date, nullable=True)
    requested_time = Column(String, nullable=True)
    reason = Column(Text, nullable=False)

    # 상태: pending, approved, rejected
    status = Column(String, default="pending")

    # 처리 정보
    processed_by = Column(String, nullable=True)
    processed_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    alternative_times = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("CounselingSession", back_populates="change_requests")
    student = relationship("Student", back_populates="schedule_change_requests")


class Item(Base):
    """물품 마스터 (보조배터리, 스탠드, 우산 등)"""
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # 보조배터리 #1, 스탠드 #2 등
    category = Column(String, nullable=False)  # 보조배터리, 스탠드, 우산, 기타
    serial_number = Column(String, nullable=True, unique=True)  # 바코드/시리얼 (선택)
    is_available = Column(Boolean, default=True)  # 현재 대여 가능 여부
    notes = Column(Text, nullable=True)  # 메모 (상태, 특이사항 등)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    rental_records = relationship("StudentRequest", back_populates="item")


class StudentRequest(Base):
    """학생 요청 시스템 (보조배터리, 프린트, 학관 호출, 외출, 상담)"""
    __tablename__ = "student_requests"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    request_type = Column(String, nullable=False)  # 보조배터리, 프린트, 학관호출, 외출신청, 상담신청
    title = Column(String, nullable=True)  # 요청 제목 (선택적)
    content = Column(Text, nullable=True)  # 요청 내용

    # 물품 대여 연결
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)  # 실제 대여된 물품

    # 보조배터리 관련
    cable_type = Column(String, nullable=True)  # C타입, 라이트닝
    return_due_period = Column(Integer, nullable=True)  # 반납 예정 교시 (1-7)

    # 프린트 관련 (request_type='프린트'일 때만 사용)
    print_file_link = Column(String, nullable=True)  # 클라우드 링크 (Google Drive 등)
    paper_size = Column(String, nullable=True)  # A4, B4, A3
    print_sides = Column(String, nullable=True)  # 단면, 양면

    # 외출/상담 관련
    preferred_datetime = Column(DateTime, nullable=True)  # 희망 시간

    # 상태 관리
    status = Column(String, default="대기")  # 대기, 승인, 거부, 완료
    priority = Column(String, default="일반")  # 일반, 긴급
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    processed_by = Column(String, nullable=True)  # 처리자 이름
    admin_note = Column(Text, nullable=True)  # 관리자 메모

    # 배달/반납 관리
    delivered = Column(Boolean, default=False)  # 가져다줬는지 여부
    delivered_at = Column(DateTime, nullable=True)  # 가져다준 시간
    delivered_by = Column(String, nullable=True)  # 가져다준 사람
    returned = Column(Boolean, default=False)  # 반납 여부 (보조배터리 등)
    returned_at = Column(DateTime, nullable=True)  # 반납 시간

    # Relationships
    student = relationship("Student", backref="student_requests")
    item = relationship("Item", back_populates="rental_records")


class PhoneSubmission(Base):
    """휴대폰 제출 기록 (교시별, 출석 체크와 동일한 방식)"""
    __tablename__ = "phone_submissions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    date = Column(Date, nullable=False)
    period = Column(Integer, nullable=False)  # 1-7교시
    is_submitted = Column(Boolean, default=True)  # True=제출, False=미제출 (기본: 제출)
    checked_by = Column(String, nullable=True)  # 체크한 사람 (관리자 이름)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student = relationship("Student", backref="phone_submissions")


# ==================== ClassUp 세션 저장 (배포 영속성) ====================

class ClassUpSession(Base):
    """ClassUp 로그인 세션 저장 (컨테이너 재시작 시에도 유지)"""
    __tablename__ = "classup_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_key = Column(String, unique=True, default="default")  # 세션 식별자
    session_data = Column(Text, nullable=False)  # JSON 형식의 세션 데이터
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

