"""ClassUp 출입 기록 데이터베이스 모델"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Date, Time
from sqlalchemy.orm import relationship
from datetime import datetime
import pytz

from database import Base

KST = pytz.timezone('Asia/Seoul')


class ClassUpAttendance(Base):
    """클래스업에서 스크래핑한 출입 기록"""
    __tablename__ = "classup_attendance"

    id = Column(Integer, primary_key=True, index=True)

    # 클래스업 원본 데이터
    student_name = Column(String, nullable=False)           # 이름
    phone_number = Column(String, nullable=True)            # 휴대폰번호
    available_time = Column(String, nullable=True)          # 입퇴실 가능 시간 (05:00-23:59)
    status = Column(String, nullable=False)                 # 상태 (입장/재입장/퇴장/강제퇴장/외출/이동)
    status_detail = Column(String, nullable=True)           # 상세 상태 (점심식사/저녁식사/쉬는시간/정기외출/병원 진료/7층 학원수업/상담)
    record_time = Column(DateTime, nullable=False)          # 클래스업 기록 시간

    # 메타 데이터
    created_at = Column(DateTime, default=lambda: datetime.now(KST))

    # Dittonweb 연동
    local_student_id = Column(Integer, ForeignKey("students.id"), nullable=True)  # 매칭된 Dittonweb 학생
    synced_to_attendance = Column(Boolean, default=False)   # AttendanceRecord에 동기화 완료 여부
    is_late = Column(Boolean, default=False)                # 지각 여부 (08:00 기준)
    discord_notified = Column(Boolean, default=False)       # Discord 알림 전송 여부

    # 복귀 추적
    expected_return_time = Column(DateTime, nullable=True)  # 예상 복귀 시간
    return_record_id = Column(Integer, nullable=True)       # 재입장 기록 ID (연결됨)
    return_alert_sent = Column(Boolean, default=False)      # 미복귀 알림 전송 여부
    is_schedule_valid = Column(Boolean, nullable=True)      # 일정 유효성 (정기외출/시간표 체크)

    # 관계 설정
    student = relationship("Student", backref="classup_records", foreign_keys=[local_student_id])

    def __repr__(self):
        return f"<ClassUpAttendance {self.student_name} {self.status} {self.record_time}>"


class ClassUpSyncLog(Base):
    """클래스업 동기화 로그"""
    __tablename__ = "classup_sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    sync_time = Column(DateTime, default=lambda: datetime.now(KST))
    records_fetched = Column(Integer, default=0)            # 가져온 기록 수
    new_records = Column(Integer, default=0)                # 새로 추가된 기록 수
    errors = Column(String, nullable=True)                  # 에러 메시지
    status = Column(String, default="success")              # success/error

    def __repr__(self):
        return f"<ClassUpSyncLog {self.sync_time} fetched={self.records_fetched}>"
