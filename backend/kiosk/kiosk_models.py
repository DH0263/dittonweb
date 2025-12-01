"""
키오스크 출석 데이터 모델
"""
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class KioskAttendance(Base):
    """키오스크에서 받은 출석 데이터"""
    __tablename__ = "kiosk_attendance"

    id = Column(Integer, primary_key=True, index=True)

    # 키오스크에서 받은 원본 ID
    kiosk_id = Column(Integer, nullable=True)

    # 학생 정보
    student_id = Column(String, index=True)  # 클래스업 학생 ID
    student_name = Column(String, nullable=True)

    # 출석 유형: attendance(등원), outing(외출), return(복귀), exit(퇴원)
    attendance_type = Column(String, default="attendance")

    # 지문 데이터 (보안상 해시값만 저장 권장)
    fingerprint_hash = Column(String, nullable=True)

    # 기기 정보
    device_id = Column(String, nullable=True)

    # 타임스탬프
    timestamp = Column(DateTime, default=datetime.utcnow)
    received_at = Column(DateTime, default=datetime.utcnow)

    # 원본 데이터 (JSON)
    raw_data = Column(JSON, nullable=True)

    # 동기화 상태
    synced = Column(String, default="received")  # received, processed, error

    # 에러 메시지
    error_message = Column(String, nullable=True)

    # 출처
    source = Column(String, default="classup-kiosk")

    # 우리 시스템의 학생과 매칭 (선택)
    local_student_id = Column(Integer, ForeignKey('students.id'), nullable=True)
    local_student = relationship("Student", backref="kiosk_records")


class KioskWebhookLog(Base):
    """웹훅 수신 로그"""
    __tablename__ = "kiosk_webhook_log"

    id = Column(Integer, primary_key=True, index=True)

    # 요청 정보
    method = Column(String)
    endpoint = Column(String)
    headers = Column(JSON, nullable=True)

    # 요청 데이터
    request_body = Column(JSON, nullable=True)

    # 응답 정보
    status_code = Column(Integer)
    response_body = Column(JSON, nullable=True)

    # 타임스탬프
    received_at = Column(DateTime, default=datetime.utcnow)

    # 처리 결과
    success = Column(String, default="true")
    error_message = Column(String, nullable=True)
