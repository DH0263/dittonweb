"""
키오스크 웹훅 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import List
import json

from . import kiosk_models, kiosk_schemas
from database import SessionLocal

router = APIRouter(prefix="/api/kiosk", tags=["Kiosk"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/attendance", response_model=kiosk_schemas.KioskAttendanceResponse)
async def receive_attendance_webhook(
    payload: kiosk_schemas.WebhookPayload,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    키오스크 출석 웹훅 수신

    이 엔드포인트는 클래스업 키오스크에서 보내는 출석 데이터를 받습니다.
    """
    try:
        # 웹훅 로그 저장
        webhook_log = kiosk_models.KioskWebhookLog(
            method=request.method,
            endpoint=str(request.url),
            headers=dict(request.headers),
            request_body=payload.dict(),
            status_code=200,
            success="true"
        )
        db.add(webhook_log)

        # 출석 데이터 저장
        attendance_record = kiosk_models.KioskAttendance(
            kiosk_id=payload.id,
            student_id=payload.data.studentId,
            student_name=payload.data.studentName,
            attendance_type=payload.data.type or "attendance",
            fingerprint_hash=payload.data.fingerprint[:50] if payload.data.fingerprint else None,  # 보안상 일부만
            device_id=payload.data.deviceId,
            timestamp=datetime.fromisoformat(payload.timestamp.replace('Z', '+00:00')) if payload.timestamp else datetime.now(),
            received_at=datetime.now(),
            raw_data=payload.dict(),
            synced="received",
            source=payload.source
        )

        db.add(attendance_record)
        db.commit()
        db.refresh(attendance_record)

        print(f"✅ 출석 데이터 수신: {payload.data.studentName} ({payload.data.type})")

        return kiosk_schemas.KioskAttendanceResponse(
            success=True,
            message="출석 데이터 수신 완료",
            id=attendance_record.id,
            received_at=datetime.now().isoformat()
        )

    except Exception as e:
        # 에러 로그 저장
        error_log = kiosk_models.KioskWebhookLog(
            method=request.method,
            endpoint=str(request.url),
            headers=dict(request.headers),
            request_body=payload.dict() if payload else None,
            status_code=500,
            success="false",
            error_message=str(e)
        )
        db.add(error_log)
        db.commit()

        print(f"❌ 출석 데이터 수신 실패: {str(e)}")

        raise HTTPException(status_code=500, detail=str(e))


@router.get("/attendance", response_model=List[kiosk_schemas.KioskAttendanceRecord])
def get_attendance_records(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """모든 출석 기록 조회"""
    records = db.query(kiosk_models.KioskAttendance)\
        .order_by(kiosk_models.KioskAttendance.received_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    return records


@router.get("/attendance/today", response_model=List[kiosk_schemas.KioskAttendanceRecord])
def get_today_attendance(db: Session = Depends(get_db)):
    """오늘 출석 기록 조회"""
    today = date.today()
    records = db.query(kiosk_models.KioskAttendance)\
        .filter(func.date(kiosk_models.KioskAttendance.received_at) == today)\
        .order_by(kiosk_models.KioskAttendance.received_at.desc())\
        .all()
    return records


@router.get("/stats", response_model=kiosk_schemas.KioskDashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """대시보드 통계 조회"""
    today = date.today()

    total_records = db.query(kiosk_models.KioskAttendance).count()

    today_records = db.query(kiosk_models.KioskAttendance)\
        .filter(func.date(kiosk_models.KioskAttendance.received_at) == today)\
        .count()

    attendance_count = db.query(kiosk_models.KioskAttendance)\
        .filter(
            func.date(kiosk_models.KioskAttendance.received_at) == today,
            kiosk_models.KioskAttendance.attendance_type == "attendance"
        ).count()

    outing_count = db.query(kiosk_models.KioskAttendance)\
        .filter(
            func.date(kiosk_models.KioskAttendance.received_at) == today,
            kiosk_models.KioskAttendance.attendance_type == "outing"
        ).count()

    return_count = db.query(kiosk_models.KioskAttendance)\
        .filter(
            func.date(kiosk_models.KioskAttendance.received_at) == today,
            kiosk_models.KioskAttendance.attendance_type == "return"
        ).count()

    exit_count = db.query(kiosk_models.KioskAttendance)\
        .filter(
            func.date(kiosk_models.KioskAttendance.received_at) == today,
            kiosk_models.KioskAttendance.attendance_type == "exit"
        ).count()

    recent_records = db.query(kiosk_models.KioskAttendance)\
        .order_by(kiosk_models.KioskAttendance.received_at.desc())\
        .limit(10)\
        .all()

    return kiosk_schemas.KioskDashboardStats(
        total_records=total_records,
        today_records=today_records,
        attendance_count=attendance_count,
        outing_count=outing_count,
        return_count=return_count,
        exit_count=exit_count,
        recent_records=recent_records
    )


@router.delete("/attendance/{record_id}")
def delete_attendance_record(record_id: int, db: Session = Depends(get_db)):
    """출석 기록 삭제"""
    record = db.query(kiosk_models.KioskAttendance)\
        .filter(kiosk_models.KioskAttendance.id == record_id)\
        .first()

    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    db.delete(record)
    db.commit()

    return {"success": True, "message": "Record deleted"}


@router.get("/test")
def test_endpoint():
    """테스트 엔드포인트"""
    return {
        "success": True,
        "message": "키오스크 API가 정상 작동 중입니다!",
        "timestamp": datetime.now().isoformat()
    }
