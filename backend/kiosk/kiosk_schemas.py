"""
키오스크 출석 데이터 스키마
"""
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class KioskAttendanceData(BaseModel):
    """클래스업 키오스크에서 보내는 데이터 구조"""
    studentId: Optional[str] = None
    studentName: Optional[str] = None
    fingerprint: Optional[str] = None
    type: Optional[str] = "attendance"  # attendance, outing, return, exit
    deviceId: Optional[str] = None
    timestamp: Optional[str] = None


class WebhookPayload(BaseModel):
    """프록시 서버에서 보내는 전체 페이로드"""
    id: Optional[int] = None
    timestamp: str
    data: KioskAttendanceData
    synced: bool = False
    source: str = "classup-kiosk"


class KioskAttendanceResponse(BaseModel):
    """웹훅 응답"""
    success: bool
    message: str
    id: Optional[int] = None
    received_at: str


class KioskAttendanceRecord(BaseModel):
    """저장된 출석 기록"""
    id: int
    kiosk_id: Optional[int]
    student_id: Optional[str]
    student_name: Optional[str]
    attendance_type: str
    device_id: Optional[str]
    timestamp: datetime
    received_at: datetime
    synced: str
    source: str

    class Config:
        from_attributes = True


class KioskDashboardStats(BaseModel):
    """대시보드 통계"""
    total_records: int
    today_records: int
    attendance_count: int
    outing_count: int
    return_count: int
    exit_count: int
    recent_records: list[KioskAttendanceRecord]
