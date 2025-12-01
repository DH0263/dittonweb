from typing import List, Optional, ForwardRef
from pydantic import BaseModel
from datetime import datetime, date as date_type, date, time

# Forward references for circular dependencies
Penalty = ForwardRef('Penalty')
Schedule = ForwardRef('Schedule')
Outing = ForwardRef('Outing')
RecurringOuting = ForwardRef('RecurringOuting')
RecurringCounseling = ForwardRef('RecurringCounseling')

class StudentBase(BaseModel):
    name: str
    seat_number: str
    status: str = "재원"
    student_phone: Optional[str] = None
    parent_phone: Optional[str] = None
    gender: Optional[str] = None
    student_type: Optional[str] = None
    korean_subject: Optional[str] = None
    math_subject: Optional[str] = None
    inquiry_subjects: Optional[List[str]] = None
    recent_grade: Optional[str] = None
    school_name: Optional[str] = None
    seat_type: Optional[str] = None
    first_attendance_date: Optional[datetime] = None

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    seat_number: Optional[str] = None
    status: Optional[str] = None
    student_phone: Optional[str] = None
    parent_phone: Optional[str] = None
    gender: Optional[str] = None
    student_type: Optional[str] = None
    korean_subject: Optional[str] = None
    math_subject: Optional[str] = None
    inquiry_subjects: Optional[List[str]] = None
    recent_grade: Optional[str] = None
    school_name: Optional[str] = None
    seat_type: Optional[str] = None
    first_attendance_date: Optional[datetime] = None

class Student(StudentBase):
    id: int
    
    class Config:
        from_attributes = True

class PenaltyBase(BaseModel):
    student_id: int
    reason: str
    points: int
    date: datetime = datetime.now()
    type: str

class PenaltyCreate(PenaltyBase):
    pass

class Penalty(PenaltyBase):
    id: int
    
    class Config:
        from_attributes = True

class ScheduleBase(BaseModel):
    student_id: int
    date: datetime
    time: str
    type: str
    memo: Optional[str] = None

class ScheduleCreate(ScheduleBase):
    pass

class ScheduleUpdate(BaseModel):
    student_id: Optional[int] = None
    date: Optional[datetime] = None
    time: Optional[str] = None
    type: Optional[str] = None
    memo: Optional[str] = None

class Schedule(ScheduleBase):
    id: int
    
    class Config:
        from_attributes = True

class OutingBase(BaseModel):
    student_id: int
    date: datetime
    start_time: str
    end_time: str
    reason: str
    status: str = "승인"

class OutingCreate(OutingBase):
    pass

class OutingUpdate(BaseModel):
    student_id: Optional[int] = None
    date: Optional[datetime] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    reason: Optional[str] = None
    status: Optional[str] = None

class Outing(OutingBase):
    id: int
    
    class Config:
        from_attributes = True

class PatrolBase(BaseModel):
    patrol_date: date_type
    start_time: time
    end_time: Optional[time] = None
    notes: Optional[str] = None
    inspector_name: Optional[str] = None
    location: Optional[str] = None
    special_notes: Optional[str] = None

class PatrolCreate(PatrolBase):
    pass

class Patrol(PatrolBase):
    id: int

    class Config:
        from_attributes = True

class RecurringOutingBase(BaseModel):
    student_id: int
    day_of_week: int
    start_time: str
    end_time: str
    reason: str
    is_active: int = 1

class RecurringOutingCreate(RecurringOutingBase):
    pass

class RecurringOutingUpdate(BaseModel):
    student_id: Optional[int] = None
    day_of_week: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    reason: Optional[str] = None
    is_active: Optional[int] = None

class RecurringOuting(RecurringOutingBase):
    id: int
    
    class Config:
        from_attributes = True

class RecurringCounselingBase(BaseModel):
    student_id: int
    week_of_month: int
    day_of_week: int
    time: str
    counselor_name: str
    is_active: int = 1

class RecurringCounselingCreate(RecurringCounselingBase):
    pass

class RecurringCounselingUpdate(BaseModel):
    student_id: Optional[int] = None
    week_of_month: Optional[int] = None
    day_of_week: Optional[int] = None
    time: Optional[str] = None
    counselor_name: Optional[str] = None
    is_active: Optional[int] = None

class RecurringCounseling(RecurringCounselingBase):
    id: int
    
    class Config:
        from_attributes = True

# Inquiry Schemas
class InquiryBase(BaseModel):
    name: str
    visit_date: Optional[datetime] = None
    status: str = "방문예약"
    program: Optional[str] = None
    student_phone: Optional[str] = None
    parent_phone: Optional[str] = None
    inquiry_source: Optional[str] = None
    memo: Optional[str] = None
    payment_info: Optional[str] = None

class InquiryCreate(InquiryBase):
    pass

class InquiryUpdate(BaseModel):
    name: Optional[str] = None
    visit_date: Optional[datetime] = None
    status: Optional[str] = None
    program: Optional[str] = None
    student_phone: Optional[str] = None
    parent_phone: Optional[str] = None
    inquiry_source: Optional[str] = None
    memo: Optional[str] = None
    payment_info: Optional[str] = None

class Inquiry(InquiryBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Student Registration Schemas
class StudentRegistrationBase(BaseModel):
    student_name: str
    student_phone: str
    parent_phone: str
    pre_attendance_status: str
    pre_attendance_date: Optional[datetime] = None
    first_attendance_date: datetime
    gender: str
    student_type: str
    korean_subject: str
    math_subject: str
    inquiry_subjects: List[str]
    recent_grade: str
    special_notes: Optional[str] = None
    seat_type: str
    school_name: str
    recurring_outings_data: Optional[dict] = None

class StudentRegistrationCreate(StudentRegistrationBase):
    pass

class StudentRegistration(StudentRegistrationBase):
    id: int
    created_at: datetime
    is_processed: bool
    processed_student_id: Optional[int] = None
    
    class Config:
        from_attributes = True

# Comprehensive Student Detail Schema
class StudentDetail(Student):
    penalties: List[Penalty] = []
    schedules: List[Schedule] = []
    outings: List[Outing] = []

    class Config:
        from_attributes = True

# Update forward refs
StudentDetail.update_forward_refs()
# Pydantic schemas - attendance and study attitude

# Additional schemas added below

# AttendanceRecord 스키마
class AttendanceRecordBase(BaseModel):
    student_id: int
    date: date
    period: Optional[int] = None  # 1-7교시, NULL이면 일일 출석
    status: str  # '자습중', '출석', '지각', '결석', '일정중', '조퇴'
    check_in_time: Optional[time] = None
    check_out_time: Optional[time] = None
    notes: Optional[str] = None

class AttendanceRecordCreate(AttendanceRecordBase):
    pass

class AttendanceRecord(AttendanceRecordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# StudyAttitudeCheck ?�키�?
class StudyAttitudeCheckBase(BaseModel):
    student_id: int
    patrol_id: Optional[int] = None
    check_date: date
    check_time: time
    attitude_type: str  # '정상', '졸음', '딴짓', '이탈', '기타'
    notes: Optional[str] = None
    checker_name: Optional[str] = None

class StudyAttitudeCheckCreate(StudyAttitudeCheckBase):
    pass

class StudyAttitudeCheck(StudyAttitudeCheckBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# ?�습 감독 ?�합 ?�답 ?�키�?
class StudentSupervisionStatus(BaseModel):
    id: int
    name: str
    seat_number: str
    current_status: str  # 'studying', 'absent', 'on_schedule', 'late', 'attitude_warning'
    status_color: str  # 'green', 'red', 'yellow', 'orange', 'purple', 'gray'
    attendance_today: Optional[AttendanceRecord] = None
    current_schedule: Optional[dict] = None
    recent_attitude_checks: List[StudyAttitudeCheck] = []

class SupervisionDashboard(BaseModel):
    students: List[StudentSupervisionStatus]
    current_time: datetime
    total_students: int
    present_count: int
    absent_count: int
    on_schedule_count: int


# ==================== 다이아몬드 상담 시스템 스키마 ====================

# Counselor 스키마
class CounselorBase(BaseModel):
    name: str
    is_active: bool = True

class CounselorCreate(CounselorBase):
    pass

class CounselorUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class Counselor(CounselorBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# DiamondCounseling (정기 상담 스케줄) 스키마
class DiamondCounselingBase(BaseModel):
    student_id: int
    counselor_id: int
    week_number: int  # 1, 2, 3, 4 (월의 몇째주)
    day_of_week: int  # 0=월, 6=일
    start_time: str  # "14:00" 형식
    is_active: bool = True

class DiamondCounselingCreate(BaseModel):
    student_id: int
    counselor_id: int  # 첫 번째 주차 담당 선생님
    week_pattern: str  # "1_3" 또는 "2_4" (입력용)
    day_of_week: int
    start_time: str

class DiamondCounselingUpdate(BaseModel):
    counselor_id: Optional[int] = None
    day_of_week: Optional[int] = None
    start_time: Optional[str] = None
    is_active: Optional[bool] = None

class DiamondCounseling(DiamondCounselingBase):
    id: int
    paired_counseling_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class DiamondCounselingWithDetails(DiamondCounseling):
    student_name: Optional[str] = None
    counselor_name: Optional[str] = None
    paired_counselor_name: Optional[str] = None


# CounselingSession (실제 상담 세션) 스키마
class CounselingSessionBase(BaseModel):
    diamond_counseling_id: Optional[int] = None
    student_id: int
    counselor_id: int
    scheduled_date: date
    scheduled_time: str
    status: str = "scheduled"  # scheduled, completed, cancelled, rescheduled

class CounselingSessionCreate(CounselingSessionBase):
    pass

class CounselingSessionUpdate(BaseModel):
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    status: Optional[str] = None
    completed_at: Optional[datetime] = None

class CounselingSession(CounselingSessionBase):
    id: int
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CounselingSessionWithDetails(CounselingSession):
    student_name: Optional[str] = None
    counselor_name: Optional[str] = None
    has_survey: bool = False


# CounselingSurvey (상담 설문지) 스키마
class CounselingSurveyBase(BaseModel):
    session_id: int
    student_id: int
    counselor_id: int
    counseling_type: str  # 다이아몬드, 국어상담, 수학상담, 영어상담, 탐구상담, 멘탈상담, 진단평가상담
    overall_achievement: str  # 상, 중, 하
    allcare_satisfaction: Optional[str] = None  # 매우만족~매우불만족
    allcare_satisfaction_reason: Optional[str] = None
    korean_notes: Optional[str] = None
    math_notes: Optional[str] = None
    english_notes: Optional[str] = None
    inquiry_notes: Optional[str] = None
    other_notes: Optional[str] = None

class CounselingSurveyCreate(CounselingSurveyBase):
    pass

class CounselingSurveyStandaloneCreate(BaseModel):
    """독립 설문 제출 (세션 없이 직접 제출)"""
    student_id: int
    counselor_id: int
    counseling_date: date
    counseling_type: str
    overall_achievement: str
    allcare_satisfaction: Optional[str] = None
    allcare_satisfaction_reason: Optional[str] = None
    korean_notes: Optional[str] = None
    math_notes: Optional[str] = None
    english_notes: Optional[str] = None
    inquiry_notes: Optional[str] = None
    other_notes: Optional[str] = None

class CounselingSurveyUpdate(BaseModel):
    counseling_type: Optional[str] = None
    overall_achievement: Optional[str] = None
    allcare_satisfaction: Optional[str] = None
    allcare_satisfaction_reason: Optional[str] = None
    korean_notes: Optional[str] = None
    math_notes: Optional[str] = None
    english_notes: Optional[str] = None
    inquiry_notes: Optional[str] = None
    other_notes: Optional[str] = None

class CounselingSurvey(CounselingSurveyBase):
    id: int
    submitted_at: datetime

    class Config:
        from_attributes = True

class CounselingSurveyWithDetails(CounselingSurvey):
    student_name: Optional[str] = None
    counselor_name: Optional[str] = None


# ScheduleChangeRequest (일정 변경 요청) 스키마
class ScheduleChangeRequestBase(BaseModel):
    session_id: int
    student_id: int
    requested_date: Optional[date] = None
    requested_time: Optional[str] = None
    reason: str

class ScheduleChangeRequestCreate(ScheduleChangeRequestBase):
    pass

class ScheduleChangeRequestProcess(BaseModel):
    status: str  # approved, rejected
    processed_by: str
    rejection_reason: Optional[str] = None
    alternative_times: Optional[str] = None

class ScheduleChangeRequest(ScheduleChangeRequestBase):
    id: int
    status: str = "pending"  # pending, approved, rejected
    processed_by: Optional[str] = None
    processed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    alternative_times: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ScheduleChangeRequestWithDetails(ScheduleChangeRequest):
    student_name: Optional[str] = None
    original_date: Optional[date] = None
    original_time: Optional[str] = None
    counselor_name: Optional[str] = None


# 월별 세션 생성 요청
class GenerateMonthlySessionsRequest(BaseModel):
    year: int
    month: int


# StudentRequest (학생 요청 시스템) 스키마
class StudentRequestBase(BaseModel):
    student_id: int
    request_type: str  # 보조배터리, 프린트, 학관호출, 외출신청, 상담신청
    title: Optional[str] = None
    content: Optional[str] = None

    # 보조배터리 관련
    cable_type: Optional[str] = None  # C타입, 라이트닝
    return_due_period: Optional[int] = None  # 반납 예정 교시

    # 프린트 관련
    print_file_link: Optional[str] = None
    paper_size: Optional[str] = None  # A4, B4, A3
    print_sides: Optional[str] = None  # 단면, 양면

    # 외출/상담 관련
    preferred_datetime: Optional[datetime] = None

    # 우선순위
    priority: str = "일반"  # 일반, 긴급

class StudentRequestCreate(StudentRequestBase):
    pass

class StudentRequestUpdate(BaseModel):
    status: Optional[str] = None  # 대기, 승인, 거부, 완료
    processed_by: Optional[str] = None
    admin_note: Optional[str] = None

class StudentRequest(StudentRequestBase):
    id: int
    status: str = "대기"
    created_at: datetime
    processed_at: Optional[datetime] = None
    processed_by: Optional[str] = None
    admin_note: Optional[str] = None
    delivered: bool = False
    delivered_at: Optional[datetime] = None
    delivered_by: Optional[str] = None
    returned: bool = False
    returned_at: Optional[datetime] = None
    item_id: Optional[int] = None  # 실제 대여된 물품 ID

    class Config:
        from_attributes = True

class StudentRequestWithDetails(StudentRequest):
    student_name: Optional[str] = None
    student_seat_number: Optional[str] = None
    item_name: Optional[str] = None  # 물품 이름


# 학생 포털 로그인 스키마
class StudentPortalLogin(BaseModel):
    name: str
    seat_number: str

class StudentPortalLoginResponse(BaseModel):
    student_id: int
    name: str
    seat_number: str
    token: Optional[str] = None


# Item (물품 관리) 스키마
class ItemBase(BaseModel):
    name: str
    category: str  # 보조배터리, 스탠드, 우산, 기타
    serial_number: Optional[str] = None
    notes: Optional[str] = None

class ItemCreate(ItemBase):
    pass

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    serial_number: Optional[str] = None
    is_available: Optional[bool] = None
    notes: Optional[str] = None

class Item(ItemBase):
    id: int
    is_available: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


# =================
# 휴대폰 제출 관리 스키마 (교시별)
# =================

class PhoneSubmissionUpdate(BaseModel):
    """교시별 휴대폰 제출 상태 업데이트"""
    student_id: int
    is_submitted: bool  # True=제출, False=미제출

class PhoneSubmission(BaseModel):
    """휴대폰 제출 기록"""
    id: int
    student_id: int
    date: date
    period: int
    is_submitted: bool
    checked_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PhoneSubmissionWithDetails(BaseModel):
    """학생 정보 포함 휴대폰 제출 기록"""
    student_id: int
    student_name: Optional[str] = None
    student_seat_number: Optional[str] = None
    is_submitted: bool


# =================
# AI 분석 스키마
# =================

class AIAnalysisRequest(BaseModel):
    """AI 분석 요청"""
    student_id: int
    analysis_type: str  # comprehensive, attendance, attitude, counseling
    custom_query: Optional[str] = None  # 사용자 정의 질문

class AIAnalysisResponse(BaseModel):
    """AI 분석 응답"""
    student_id: int
    student_name: str
    analysis_type: str
    report: str  # 마크다운 형식 분석 결과
    generated_at: datetime
    data_period_days: int = 60

class StudentDataAggregation(BaseModel):
    """AI 분석용 학생 데이터 집계"""
    # 기본 정보
    student_id: int
    name: str
    seat_number: str
    status: str
    student_type: Optional[str] = None

    # 출석 통계 (최근 60일)
    attendance_stats: dict = {}  # total_days, present, late, absent, attendance_rate, late_rate
    attendance_records: List[dict] = []  # 출석 기록 리스트

    # 학습 태도 통계
    attitude_stats: dict = {}  # total_checks, normal, drowsy, distracted, left, other
    attitude_records: List[dict] = []  # 태도 체크 리스트

    # 벌점 통계
    penalty_stats: dict = {}  # total_penalty, total_merit, net_points
    penalties: List[dict] = []  # 벌점 리스트

    # 상담 기록
    counseling_stats: dict = {}  # total_sessions, by_type, achievement_trend
    counseling_surveys: List[dict] = []  # 상담 설문 리스트

    # 외출/일정
    outings: List[dict] = []
    schedules: List[dict] = []

class WebhookEventPayload(BaseModel):
    """n8n 웹훅 이벤트 페이로드"""
    event_type: str  # penalty.created, patrol.ended, attendance.updated
    timestamp: datetime
    data: dict
    metadata: Optional[dict] = None
