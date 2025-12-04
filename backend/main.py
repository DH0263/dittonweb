from fastapi import FastAPI, Depends, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime, time, timedelta
import models, schemas, database
from database import engine, SessionLocal
import pytz
import os
import httpx
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

# 키오스크 모듈 추가
from kiosk import kiosk_models, router as kiosk_router

# ClassUp 스크래핑 모듈 추가
from classup import classup_router
from classup.models import ClassUpAttendance, ClassUpSyncLog

# AI Chat 모듈 추가 (수능 수학 튜터)
from ai_chat import ai_chat_router
from ai_chat.models import ChatSession, ChatMessage, DailyUsage

# Solapi 문자/카카오톡 발송 서비스
from solapi_service import message_service

# 순찰 모니터링 스케줄러
from patrol_scheduler import patrol_monitor, get_patrol_monitor

# 시간표 유틸리티
from utils.schedule import (
    get_period_status, get_operating_hours_info, is_class_time,
    get_current_period as utils_get_current_period, is_meal_or_break_time
)

models.Base.metadata.create_all(bind=engine)
kiosk_models.Base.metadata.create_all(bind=engine)  # 키오스크 테이블 생성

# ClassUp 테이블 생성
ClassUpAttendance.__table__.create(bind=engine, checkfirst=True)
ClassUpSyncLog.__table__.create(bind=engine, checkfirst=True)

# AI Chat 테이블 생성
ChatSession.__table__.create(bind=engine, checkfirst=True)
ChatMessage.__table__.create(bind=engine, checkfirst=True)
DailyUsage.__table__.create(bind=engine, checkfirst=True)

# Period schedule (start_time, end_time) in HH:MM format
PERIOD_SCHEDULE = {
    1: ("08:00", "10:00"),   # 1교시
    2: ("10:20", "12:00"),   # 2교시
    3: ("13:00", "15:00"),   # 3교시
    4: ("15:20", "16:40"),   # 4교시
    5: ("16:50", "18:00"),   # 5교시
    6: ("19:00", "20:20"),   # 6교시
    7: ("20:30", "22:00"),   # 7교시
}

def get_current_period() -> Optional[int]:
    """Get current period based on time"""
    now = datetime.now()
    current_time = now.strftime("%H:%M")

    for period, (start, end) in PERIOD_SCHEDULE.items():
        if start <= current_time <= end:
            return period
    return None

def get_period_time_range(period: int):
    """Get start and end time for a period"""
    if period in PERIOD_SCHEDULE:
        start, end = PERIOD_SCHEDULE[period]
        return time.fromisoformat(start + ":00"), time.fromisoformat(end + ":00")
    return None, None

# Timezone support
KST = pytz.timezone('Asia/Seoul')

def validate_period_timing(requested_period: int) -> dict:
    """
    요청된 교시가 현재 시간과 맞는지 검증

    Returns:
        {
            "is_current": bool,  # 현재 교시인가?
            "current_period": int | None,  # 현재 교시 (없으면 None)
            "warning_message": str | None  # 경고 메시지
        }
    """
    current = get_current_period()

    if current is None:
        return {
            "is_current": False,
            "current_period": None,
            "warning_message": "현재는 교시 시간이 아닙니다 (쉬는시간/점심/저녁시간)"
        }

    if current != requested_period:
        return {
            "is_current": False,
            "current_period": current,
            "warning_message": f"현재는 {current}교시입니다. {requested_period}교시로 기록하시겠습니까?"
        }

    return {
        "is_current": True,
        "current_period": current,
        "warning_message": None
    }

app = FastAPI(title="Ditton Bot API")

# CORS 허용 도메인 (환경변수로 설정, 콤마로 구분)
# 예: ALLOWED_ORIGINS=https://frontend.railway.app,http://localhost:5173
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 키오스크 API 라우터 등록
app.include_router(kiosk_router)

# ClassUp 스크래핑 API 라우터 등록
app.include_router(classup_router)

# AI Chat API 라우터 등록 (수능 수학 튜터)
app.include_router(ai_chat_router)

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==================== Scheduler Setup ====================
scheduler = BackgroundScheduler(timezone='Asia/Seoul')

def auto_convert_school_to_studying():
    """
    오후 6시: 학교 등원 중인 고등학생을 자습중으로 전환
    """
    db = SessionLocal()
    try:
        today = date.today()
        now = datetime.now(KST)

        # 오늘 "학교" 상태인 AttendanceRecord 조회
        school_records = db.query(models.AttendanceRecord).join(
            models.Student,
            models.Student.id == models.AttendanceRecord.student_id
        ).filter(
            models.AttendanceRecord.date == today,
            models.AttendanceRecord.status == "학교",
            models.Student.student_type.in_(["예비고1", "고1", "고2", "고3"])
        ).all()

        converted_count = 0
        for record in school_records:
            record.status = "자습중"
            converted_count += 1

        db.commit()
        print(f"[오후 6시 자동 전환] {converted_count}명의 고등학생을 학교 → 자습중으로 전환")

    except Exception as e:
        print(f"[오류] auto_convert_school_to_studying: {e}")
        db.rollback()
    finally:
        db.close()

@app.on_event("startup")
async def startup_event():
    """FastAPI 시작 시 스케줄러 등록"""
    # 매일 오후 6시 실행 - 학교 → 자습중 전환
    scheduler.add_job(
        auto_convert_school_to_studying,
        trigger=CronTrigger(hour=18, minute=0, timezone='Asia/Seoul'),
        id="auto_convert_school",
        replace_existing=True
    )
    print("[스케줄러] 시작: 매일 18:00에 학교 → 자습중 자동 전환")

    # 매일 오전 9시 실행 - 강제퇴장 알림 (경고 채널)
    from classup.router import send_forced_exit_morning_alert_sync, convert_late_to_studying_sync
    scheduler.add_job(
        send_forced_exit_morning_alert_sync,
        trigger=CronTrigger(hour=9, minute=0, timezone='Asia/Seoul'),
        id="forced_exit_morning_alert",
        replace_existing=True
    )
    print("[스케줄러] 시작: 매일 09:00에 강제퇴장 알림")

    # 각 교시 시작 시 지각 → 자습중 변환
    # 2교시 10:20, 3교시 13:00, 4교시 15:20, 5교시 16:50, 6교시 19:00, 7교시 20:30
    period_starts = [
        (10, 20, "2교시"),
        (13, 0, "3교시"),
        (15, 20, "4교시"),
        (16, 50, "5교시"),
        (19, 0, "6교시"),
        (20, 30, "7교시"),
    ]
    for hour, minute, period_name in period_starts:
        scheduler.add_job(
            convert_late_to_studying_sync,
            trigger=CronTrigger(hour=hour, minute=minute, timezone='Asia/Seoul'),
            id=f"late_to_studying_{period_name}",
            replace_existing=True
        )
    print("[스케줄러] 시작: 각 교시 시작 시 지각 → 자습중 자동 변환")

    # 매일 새벽 4시 - ClassUp 데이터 자동 정리
    def run_classup_cleanup():
        from classup.cleanup import run_cleanup
        db = SessionLocal()
        try:
            result = run_cleanup(db)
            print(f"[ClassUp 정리] 완료: SyncLog {result['sync_logs_deleted']}개, 일반기록 {result['normal_records_deleted']}개 삭제")
        finally:
            db.close()

    scheduler.add_job(
        run_classup_cleanup,
        trigger=CronTrigger(hour=4, minute=0, timezone='Asia/Seoul'),
        id="classup_cleanup",
        replace_existing=True
    )
    print("[스케줄러] 시작: 매일 04:00에 ClassUp 데이터 자동 정리")

    scheduler.start()

    # 순찰 모니터링 스케줄러 시작
    patrol_monitor.set_db_session_factory(SessionLocal)
    patrol_monitor.start()
    print("[순찰 모니터] 시작: 15분/25분 경과 시 Discord 알림")

    # ClassUp 자동 동기화 시작
    from classup.scraper import has_saved_session
    from classup import router as classup_router_module
    import asyncio

    # 외부 Worker 모드 확인
    external_worker_env = os.getenv("CLASSUP_WORKER_EXTERNAL", "")
    external_worker_mode = external_worker_env.lower() in ("true", "1", "yes")
    print(f"[ClassUp] 환경변수 CLASSUP_WORKER_EXTERNAL='{external_worker_env}' -> 외부모드={external_worker_mode}")

    if external_worker_mode:
        # 외부 Worker 모드: 알림 처리 루프만 시작 (스크래핑은 classup-worker가 담당)
        classup_router_module._sync_running = True
        from database import SessionLocal
        classup_router_module._sync_task = asyncio.create_task(
            classup_router_module.external_worker_notification_loop(SessionLocal)
        )
        print("[ClassUp] 외부 Worker 모드 - Discord 알림 처리 루프 시작 (10초 간격)")
    elif has_saved_session():
        # 내부 모드: 직접 스크래핑 + 알림 처리
        classup_router_module._sync_running = True
        from database import SessionLocal
        classup_router_module._sync_task = asyncio.create_task(
            classup_router_module.continuous_sync_loop(SessionLocal)
        )
        print("[ClassUp] 내부 모드 - 자동 동기화 시작 (5초 간격)")

@app.on_event("shutdown")
def shutdown_event():
    """FastAPI 종료 시 스케줄러 종료"""
    scheduler.shutdown()
    patrol_monitor.stop()
    print("[스케줄러] 종료")
    print("[순찰 모니터] 종료")

@app.get("/")
def read_root():
    return {"message": "Welcome to Ditton Bot API"}

# --- System Endpoints (Period Validation) ---
@app.get("/system/current-period")
def get_current_period_api():
    """현재 교시 조회"""
    period = get_current_period()
    now = datetime.now(KST)
    return {
        "current_period": period,
        "current_time": now.strftime("%H:%M"),
        "is_class_time": period is not None
    }

@app.post("/system/validate-period")
def validate_period_api(period: int):
    """교시 시간 검증"""
    return validate_period_timing(period)

@app.get("/system/period-start-time/{period}")
def get_period_start_time(period: int):
    """
    교시 시작 시간 조회

    Returns:
        {
            "period": int,
            "start_time": str (HH:MM),
            "end_time": str (HH:MM)
        }
    """
    if period not in PERIOD_SCHEDULE:
        raise HTTPException(status_code=404, detail=f"{period}교시는 존재하지 않습니다.")

    start, end = PERIOD_SCHEDULE[period]

    return {
        "period": period,
        "start_time": start,
        "end_time": end
    }


# --- Schedule Utility Endpoints ---
@app.get("/schedule/status")
def get_schedule_status_api():
    """
    현재 시간대 상태 조회 (utils.schedule 모듈 사용)

    Returns:
        status: "class" | "break" | "lunch" | "dinner" | "before_opening" | "after_closing"
        period_name: "1교시" | None
        is_patrol_time: True | False (순찰 가능 시간인지)
        message: 현재 상태 메시지
    """
    return get_period_status()


@app.get("/schedule/operating-hours")
def get_operating_hours_api():
    """
    운영 시간 정보 조회 (프론트엔드 표시용)

    Returns:
        opening, closing, lunch, dinner, periods, breaks 정보
    """
    return get_operating_hours_info()


@app.get("/patrol-monitor/status")
def get_patrol_monitor_status_api():
    """
    순찰 모니터링 상태 조회

    Returns:
        is_running: 스케줄러 실행 중 여부
        is_class_time: 현재 수업 시간인지
        period_status: 현재 시간대 상태
        last_patrol_time: 마지막 순찰 시간
        elapsed_minutes: 경과 시간 (분)
        alert_15_sent: 15분 알림 전송 여부
        alert_25_sent: 25분 알림 전송 여부
        warning_threshold: 경고 임계값 (분)
        alert_threshold: 긴급 알림 임계값 (분)
    """
    return patrol_monitor.get_status()


# --- Student Endpoints ---
@app.post("/students/", response_model=schemas.Student)
def create_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    db_student = models.Student(**student.dict())
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student

@app.get("/students/", response_model=List[schemas.Student])
def read_students(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    students = db.query(models.Student).offset(skip).limit(limit).all()
    return students

@app.get("/students/{student_id}", response_model=schemas.StudentDetail)
def read_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

@app.put("/students/{student_id}", response_model=schemas.Student)
def update_student(student_id: int, student_update: schemas.StudentUpdate, db: Session = Depends(get_db)):
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if db_student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    
    update_data = student_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_student, key, value)
    
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student

@app.delete("/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if db_student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    
    db.delete(db_student)
    db.commit()
    return {"message": "Student deleted successfully"}

# --- Penalty Endpoints ---
@app.post("/penalties/", response_model=schemas.Penalty)
def create_penalty(penalty: schemas.PenaltyCreate, db: Session = Depends(get_db)):
    db_penalty = models.Penalty(**penalty.dict())
    db.add(db_penalty)
    db.commit()
    db.refresh(db_penalty)
    return db_penalty

@app.get("/students/{student_id}/penalties", response_model=List[schemas.Penalty])
def read_student_penalties(student_id: int, db: Session = Depends(get_db)):
    penalties = db.query(models.Penalty).filter(models.Penalty.student_id == student_id).all()
    return penalties

@app.get("/penalties/", response_model=List[schemas.Penalty])
def read_penalties(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    penalties = db.query(models.Penalty).order_by(models.Penalty.date.desc()).offset(skip).limit(limit).all()
    return penalties

# --- Schedule Endpoints ---
@app.post("/schedules/", response_model=schemas.Schedule)
def create_schedule(schedule: schemas.ScheduleCreate, db: Session = Depends(get_db)):
    db_schedule = models.Schedule(**schedule.dict())
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

@app.get("/schedules/", response_model=List[schemas.Schedule])
def read_schedules(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    schedules = db.query(models.Schedule).order_by(models.Schedule.date.asc()).offset(skip).limit(limit).all()
    return schedules

@app.put("/schedules/{schedule_id}", response_model=schemas.Schedule)
def update_schedule(schedule_id: int, schedule_update: schemas.ScheduleUpdate, db: Session = Depends(get_db)):
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if db_schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    update_data = schedule_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_schedule, key, value)
    
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

@app.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if db_schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    db.delete(db_schedule)
    db.commit()
    return {"message": "Schedule deleted successfully"}

# --- Outing Endpoints ---
@app.post("/outings/", response_model=schemas.Outing)
def create_outing(outing: schemas.OutingCreate, db: Session = Depends(get_db)):
    db_outing = models.Outing(**outing.dict())
    db.add(db_outing)
    db.commit()
    db.refresh(db_outing)
    return db_outing

@app.get("/outings/", response_model=List[schemas.Outing])
def read_outings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    outings = db.query(models.Outing).order_by(models.Outing.date.asc()).offset(skip).limit(limit).all()
    return outings

@app.put("/outings/{outing_id}", response_model=schemas.Outing)
def update_outing(outing_id: int, outing_update: schemas.OutingUpdate, db: Session = Depends(get_db)):
    db_outing = db.query(models.Outing).filter(models.Outing.id == outing_id).first()
    if db_outing is None:
        raise HTTPException(status_code=404, detail="Outing not found")
    
    update_data = outing_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_outing, key, value)
    
    db.add(db_outing)
    db.commit()
    db.refresh(db_outing)
    return db_outing

@app.delete("/outings/{outing_id}")
def delete_outing(outing_id: int, db: Session = Depends(get_db)):
    db_outing = db.query(models.Outing).filter(models.Outing.id == outing_id).first()
    if db_outing is None:
        raise HTTPException(status_code=404, detail="Outing not found")
    
    db.delete(db_outing)
    db.commit()
    return {"message": "Outing deleted successfully"}

# --- Patrol Endpoints ---
@app.post("/patrols/", response_model=schemas.Patrol)
def create_patrol(patrol: schemas.PatrolCreate, db: Session = Depends(get_db)):
    db_patrol = models.Patrol(**patrol.dict())
    db.add(db_patrol)
    db.commit()
    db.refresh(db_patrol)
    return db_patrol

@app.get("/patrols/", response_model=List[schemas.Patrol])
def read_patrols(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    patrols = db.query(models.Patrol).order_by(models.Patrol.patrol_date.desc()).offset(skip).limit(limit).all()
    return patrols

# --- Recurring Outing Endpoints ---
@app.post("/recurring-outings/", response_model=schemas.RecurringOuting)
def create_recurring_outing(recurring_outing: schemas.RecurringOutingCreate, db: Session = Depends(get_db)):
    db_recurring_outing = models.RecurringOuting(**recurring_outing.dict())
    db.add(db_recurring_outing)
    db.commit()
    db.refresh(db_recurring_outing)
    return db_recurring_outing

@app.get("/recurring-outings/", response_model=List[schemas.RecurringOuting])
def read_recurring_outings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    recurring_outings = db.query(models.RecurringOuting).filter(models.RecurringOuting.is_active == 1).offset(skip).limit(limit).all()
    return recurring_outings

@app.put("/recurring-outings/{recurring_outing_id}", response_model=schemas.RecurringOuting)
def update_recurring_outing(recurring_outing_id: int, recurring_outing_update: schemas.RecurringOutingUpdate, db: Session = Depends(get_db)):
    db_recurring_outing = db.query(models.RecurringOuting).filter(models.RecurringOuting.id == recurring_outing_id).first()
    if db_recurring_outing is None:
        raise HTTPException(status_code=404, detail="Recurring outing not found")
    
    update_data = recurring_outing_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_recurring_outing, key, value)
    
    db.add(db_recurring_outing)
    db.commit()
    db.refresh(db_recurring_outing)
    return db_recurring_outing

@app.delete("/recurring-outings/{recurring_outing_id}")
def delete_recurring_outing(recurring_outing_id: int, db: Session = Depends(get_db)):
    db_recurring_outing = db.query(models.RecurringOuting).filter(models.RecurringOuting.id == recurring_outing_id).first()
    if db_recurring_outing is None:
        raise HTTPException(status_code=404, detail="Recurring outing not found")
    
    db_recurring_outing.is_active = 0
    db.commit()
    return {"message": "Recurring outing deactivated successfully"}

# --- Recurring Counseling Endpoints ---
@app.post("/recurring-counseling/", response_model=schemas.RecurringCounseling)
def create_recurring_counseling(recurring_counseling: schemas.RecurringCounselingCreate, db: Session = Depends(get_db)):
    db_recurring_counseling = models.RecurringCounseling(**recurring_counseling.dict())
    db.add(db_recurring_counseling)
    db.commit()
    db.refresh(db_recurring_counseling)
    return db_recurring_counseling

@app.get("/recurring-counseling/", response_model=List[schemas.RecurringCounseling])
def read_recurring_counseling(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    recurring_counseling = db.query(models.RecurringCounseling).filter(models.RecurringCounseling.is_active == 1).offset(skip).limit(limit).all()
    return recurring_counseling

@app.put("/recurring-counseling/{recurring_counseling_id}", response_model=schemas.RecurringCounseling)
def update_recurring_counseling(recurring_counseling_id: int, recurring_counseling_update: schemas.RecurringCounselingUpdate, db: Session = Depends(get_db)):
    db_recurring_counseling = db.query(models.RecurringCounseling).filter(models.RecurringCounseling.id == recurring_counseling_id).first()
    if db_recurring_counseling is None:
        raise HTTPException(status_code=404, detail="Recurring counseling not found")
    
    update_data = recurring_counseling_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_recurring_counseling, key, value)
    
    db.add(db_recurring_counseling)
    db.commit()
    db.refresh(db_recurring_counseling)
    return db_recurring_counseling

@app.delete("/recurring-counseling/{recurring_counseling_id}")
def delete_recurring_counseling(recurring_counseling_id: int, db: Session = Depends(get_db)):
    db_recurring_counseling = db.query(models.RecurringCounseling).filter(models.RecurringCounseling.id == recurring_counseling_id).first()
    if db_recurring_counseling is None:
        raise HTTPException(status_code=404, detail="Recurring counseling not found")
    
    db_recurring_counseling.is_active = 0
    db.commit()
    return {"message": "Recurring counseling deactivated successfully"}
# Inquiry and Student Registration API endpoints
# Add these to main.py

# --- Inquiry Endpoints ---
@app.post("/inquiries/", response_model=schemas.Inquiry)
def create_inquiry(inquiry: schemas.InquiryCreate, db: Session = Depends(get_db)):
    """?좉퇋 ?깅줉 臾몄쓽 ?앹꽦"""
    db_inquiry = models.Inquiry(**inquiry.dict())
    db.add(db_inquiry)
    db.commit()
    db.refresh(db_inquiry)
    return db_inquiry

@app.get("/inquiries/", response_model=List[schemas.Inquiry])
def read_inquiries(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """臾몄쓽 紐⑸줉 議고쉶 (?곹깭蹂??꾪꽣留?각??"""
    query = db.query(models.Inquiry)
    if status:
        query = query.filter(models.Inquiry.status == status)
    inquiries = query.order_by(models.Inquiry.created_at.desc()).offset(skip).limit(limit).all()
    return inquiries

@app.get("/inquiries/{inquiry_id}", response_model=schemas.Inquiry)
def read_inquiry(inquiry_id: int, db: Session = Depends(get_db)):
    """臾몄쓽 ?곸꽭 議고쉶"""
    inquiry = db.query(models.Inquiry).filter(models.Inquiry.id == inquiry_id).first()
    if inquiry is None:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return inquiry

@app.put("/inquiries/{inquiry_id}", response_model=schemas.Inquiry)
def update_inquiry(inquiry_id: int, inquiry_update: schemas.InquiryUpdate, db: Session = Depends(get_db)):
    """臾몄쓽 ?섏젙"""
    db_inquiry = db.query(models.Inquiry).filter(models.Inquiry.id == inquiry_id).first()
    if db_inquiry is None:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    update_data = inquiry_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_inquiry, key, value)
    
    db.add(db_inquiry)
    db.commit()
    db.refresh(db_inquiry)
    return db_inquiry

@app.delete("/inquiries/{inquiry_id}")
def delete_inquiry(inquiry_id: int, db: Session = Depends(get_db)):
    """臾몄쓽 ??젣"""
    db_inquiry = db.query(models.Inquiry).filter(models.Inquiry.id == inquiry_id).first()
    if db_inquiry is None:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    db.delete(db_inquiry)
    db.commit()
    return {"message": "Inquiry deleted successfully"}

# --- Student Registration Endpoints ---
@app.post("/student-registrations/", response_model=schemas.StudentRegistration)
def create_student_registration(registration: schemas.StudentRegistrationCreate, db: Session = Depends(get_db)):
    """?좎엯??湲곗큹議곗궗 ?쒖텧 (怨듦컻 API)"""
    db_registration = models.StudentRegistration(**registration.dict())
    db.add(db_registration)
    db.commit()
    db.refresh(db_registration)
    
    # TODO: Send Discord webhook notification
    # send_discord_notification_registration(db_registration)
    
    return db_registration

@app.get("/student-registrations/", response_model=List[schemas.StudentRegistration])
def read_student_registrations(
    is_processed: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """湲곗큹議곗궗 ?쒖텧 紐⑸줉 議고쉶"""
    query = db.query(models.StudentRegistration)
    if is_processed is not None:
        query = query.filter(models.StudentRegistration.is_processed == is_processed)
    registrations = query.order_by(models.StudentRegistration.created_at.desc()).offset(skip).limit(limit).all()
    return registrations

@app.get("/student-registrations/{registration_id}", response_model=schemas.StudentRegistration)
def read_student_registration(registration_id: int, db: Session = Depends(get_db)):
    """湲곗큹議곗궗 ?쒖텧 ?곸꽭 議고쉶"""
    registration = db.query(models.StudentRegistration).filter(models.StudentRegistration.id == registration_id).first()
    if registration is None:
        raise HTTPException(status_code=404, detail="Registration not found")
    return registration

@app.post("/student-registrations/{registration_id}/process", response_model=schemas.Student)
def process_student_registration(registration_id: int, seat_number: str, db: Session = Depends(get_db)):
    """湲곗큹議곗궗 ?곗씠?곕? 湲곕컲?쇰줈 ?숈깮 DB ?앹꽦"""
    registration = db.query(models.StudentRegistration).filter(models.StudentRegistration.id == registration_id).first()
    if registration is None:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    if registration.is_processed:
        raise HTTPException(status_code=400, detail="Registration already processed")
    
    # Create student from registration data
    student_data = {
        "name": registration.student_name,
        "seat_number": seat_number,
        "status": "재원",
        "student_phone": registration.student_phone,
        "parent_phone": registration.parent_phone,
        "gender": registration.gender,
        "student_type": registration.student_type,
        "korean_subject": registration.korean_subject,
        "math_subject": registration.math_subject,
        "inquiry_subjects": registration.inquiry_subjects,
        "recent_grade": registration.recent_grade,
        "school_name": registration.school_name,
        "seat_type": registration.seat_type,
        "first_attendance_date": registration.first_attendance_date
    }
    
    db_student = models.Student(**student_data)
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    
    # Create recurring outings if provided
    if registration.recurring_outings_data:
        for day, outings_list in registration.recurring_outings_data.items():
            # Each day contains a LIST of outings
            for outing_info in outings_list:
                if outing_info.get('enabled'):
                    recurring_outing = models.RecurringOuting(
                        student_id=db_student.id,
                        day_of_week=int(day),
                        start_time=outing_info['start_time'],
                        end_time=outing_info['end_time'],
                        reason=outing_info['reason']
                    )
                    db.add(recurring_outing)
    
    # Mark registration as processed
    registration.is_processed = True
    registration.processed_student_id = db_student.id
    db.commit()
    
    return db_student

# API ?붾뱶?ъ씤??異붽?

# main.py??異붽????댁슜:

from datetime import date, time, datetime, timedelta

# ==================== 異쒓껐 愿由?API ====================

@app.post("/attendance-records/", response_model=schemas.AttendanceRecord)
def create_attendance_record(
    record: schemas.AttendanceRecordCreate,
    db: Session = Depends(get_db)
):
    """異쒓껐 湲곕줉 ?앹꽦"""
    db_record = models.AttendanceRecord(**record.dict())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


@app.get("/attendance-records/today", response_model=List[schemas.AttendanceRecord])
def get_today_attendance(db: Session = Depends(get_db)):
    """?ㅻ뒛 異쒓껐 ?꾪솴 議고쉶"""
    today = date.today()
    records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.date == today
    ).all()
    return records


@app.get("/attendance-records/", response_model=List[schemas.AttendanceRecord])
def get_attendance_records(
    date_filter: Optional[date] = None,
    student_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """異쒓껐 湲곕줉 議고쉶 (?좎쭨 ?먮뒗 ?숈깮蹂?"""
    query = db.query(models.AttendanceRecord)
    
    if date_filter:
        query = query.filter(models.AttendanceRecord.date == date_filter)
    if student_id:
        query = query.filter(models.AttendanceRecord.student_id == student_id)
    
    return query.all()


@app.get("/attendance-records/student/{student_id}", response_model=List[schemas.AttendanceRecord])
def get_student_attendance_history(student_id: int, db: Session = Depends(get_db)):
    """학생별 출석 이력"""
    records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.student_id == student_id
    ).order_by(models.AttendanceRecord.date.desc()).all()
    return records


@app.get("/attendance-records/period/{period}", response_model=List[schemas.AttendanceRecord])
def get_period_attendance(period: int, db: Session = Depends(get_db)):
    """특정 교시의 오늘 출석 현황"""
    today = date.today()
    records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.date == today,
        models.AttendanceRecord.period == period
    ).all()
    return records


@app.post("/attendance-records/period/bulk")
def bulk_update_period_attendance(
    period: int,
    attendance_updates: List[dict] = Body(...),
    force: bool = Query(default=False),
    db: Session = Depends(get_db)
):
    """교시별 출석 일괄 업데이트 (시간 검증 포함)"""

    # 시간 검증 (force=False일 때만)
    if not force:
        validation = validate_period_timing(period)
        if not validation["is_current"]:
            # 경고 반환 (프론트에서 사용자 확인 후 force=True로 재요청)
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "period_mismatch",
                    "message": validation["warning_message"],
                    "current_period": validation["current_period"]
                }
            )

    today = date.today()

    for update in attendance_updates:
        student_id = update.get("student_id")
        status = update.get("status")

        existing = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.student_id == student_id,
            models.AttendanceRecord.date == today,
            models.AttendanceRecord.period == period
        ).first()

        if existing:
            existing.status = status
        else:
            new_record = models.AttendanceRecord(
                student_id=student_id,
                date=today,
                period=period,
                status=status
            )
            db.add(new_record)

    db.commit()
    return {"message": f"{period}교시 출석이 업데이트되었습니다.", "updated_count": len(attendance_updates)}


@app.get("/attendance-records/today/by-period")
def get_today_attendance_by_period(db: Session = Depends(get_db)):
    """오늘 교시별 전체 출석 현황"""
    today = date.today()

    students = db.query(models.Student).filter(
        models.Student.status == "재원"
    ).all()

    result = []
    for student in students:
        student_data = {
            "student_id": student.id,
            "name": student.name,
            "seat_number": student.seat_number,
            "periods": {}
        }

        for period in range(1, 8):
            record = db.query(models.AttendanceRecord).filter(
                models.AttendanceRecord.student_id == student.id,
                models.AttendanceRecord.date == today,
                models.AttendanceRecord.period == period
            ).first()

            if record:
                student_data["periods"][period] = record.status
            else:
                prev_period = period - 1
                if prev_period > 0 and prev_period in student_data["periods"]:
                    student_data["periods"][period] = student_data["periods"][prev_period]
                else:
                    student_data["periods"][period] = None

        result.append(student_data)

    return result


@app.get("/attendance-records/check-completion/{period}")
def check_attendance_completion(period: int, db: Session = Depends(get_db)):
    """
    교시별 출석 확인 완료 여부 체크

    Returns:
        {
            "period": int,
            "is_completed": bool,
            "completed_at": datetime | None,
            "total_students": int,
            "checked_students": int
        }
    """
    today = date.today()

    # 재원 중인 학생 수
    total_students = db.query(models.Student).filter(
        models.Student.status == "재원"
    ).count()

    # 해당 교시 출석 기록이 있는 학생 수
    checked_records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.date == today,
        models.AttendanceRecord.period == period
    ).all()

    checked_students = len(checked_records)

    # 최소 1명 이상 출석 기록이 있으면 완료로 간주
    is_completed = checked_students > 0

    # 가장 최근 출석 기록 시간
    completed_at = None
    if checked_records:
        latest_record = max(checked_records, key=lambda r: r.created_at if r.created_at else datetime.min)
        completed_at = latest_record.created_at

    return {
        "period": period,
        "is_completed": is_completed,
        "completed_at": completed_at,
        "total_students": total_students,
        "checked_students": checked_students
    }


# ==================== ?먯뒿 ?쒕룄 泥댄겕 API ====================

@app.post("/study-attitude-checks/", response_model=schemas.StudyAttitudeCheck)
def create_attitude_check(
    check: schemas.StudyAttitudeCheckCreate,
    db: Session = Depends(get_db)
):
    """?먯뒿 ?쒕룄 泥댄겕 湲곕줉"""
    db_check = models.StudyAttitudeCheck(**check.dict())
    db.add(db_check)
    db.commit()
    db.refresh(db_check)
    return db_check


@app.get("/study-attitude-checks/today", response_model=List[schemas.StudyAttitudeCheck])
def get_today_attitude_checks(db: Session = Depends(get_db)):
    """?ㅻ뒛 ?쒕룄 泥댄겕 湲곕줉 議고쉶"""
    today = date.today()
    checks = db.query(models.StudyAttitudeCheck).filter(
        models.StudyAttitudeCheck.check_date == today
    ).all()
    return checks


@app.get("/study-attitude-checks/student/{student_id}", response_model=List[schemas.StudyAttitudeCheck])
def get_student_attitude_history(student_id: int, db: Session = Depends(get_db)):
    """?숈깮蹂??쒕룄 泥댄겕 ?대젰"""
    checks = db.query(models.StudyAttitudeCheck).filter(
        models.StudyAttitudeCheck.student_id == student_id
    ).order_by(models.StudyAttitudeCheck.check_date.desc(), models.StudyAttitudeCheck.check_time.desc()).all()
    return checks


@app.get("/study-attitude-checks/patrol/{patrol_id}", response_model=List[schemas.StudyAttitudeCheck])
def get_patrol_attitude_checks(patrol_id: int, db: Session = Depends(get_db)):
    """순찰별 태도 체크 목록 조회"""
    checks = db.query(models.StudyAttitudeCheck).filter(
        models.StudyAttitudeCheck.patrol_id == patrol_id
    ).order_by(models.StudyAttitudeCheck.check_time.desc()).all()
    return checks


@app.delete("/study-attitude-checks/{check_id}")
def delete_attitude_check(check_id: int, db: Session = Depends(get_db)):
    """태도 체크 삭제 (순찰 제출 전까지만 가능)"""
    check = db.query(models.StudyAttitudeCheck).filter(
        models.StudyAttitudeCheck.id == check_id
    ).first()

    if not check:
        raise HTTPException(status_code=404, detail="태도 체크를 찾을 수 없습니다")

    # 해당 순찰이 아직 종료되지 않았는지 확인
    if check.patrol_id:
        patrol = db.query(models.Patrol).filter(
            models.Patrol.id == check.patrol_id
        ).first()
        if patrol and patrol.end_time:
            raise HTTPException(status_code=400, detail="이미 제출된 순찰의 체크는 삭제할 수 없습니다")

    db.delete(check)
    db.commit()
    return {"message": "태도 체크가 삭제되었습니다", "deleted_id": check_id}


# ==================== ?숈뒿 각먮룆 ?듯빀 API ====================

@app.get("/supervision/current-status", response_model=schemas.SupervisionDashboard)
def get_supervision_status(db: Session = Depends(get_db)):
    """?꾩옱 ?쒓컙 湲곗? ?꾩껜 ?숈깮 ?곹깭 議고쉶"""
    now = datetime.now()
    today = now.date()
    current_time_str = now.strftime("%H:%M:%S")
    day_of_week = now.weekday()  # 0=Monday, 6=Sunday
    
    # 紐⑤뱺 ?ъ썝 ?숈깮 議고쉶
    students = db.query(models.Student).filter(
        models.Student.status == "재원"
    ).all()
    
    student_statuses = []
    present_count = 0
    absent_count = 0
    on_schedule_count = 0
    
    current_p = get_current_period()

    for student in students:
        # 1. Get attendance - prioritize current period, then most recent
        attendance = None
        if current_p:
            attendance = db.query(models.AttendanceRecord).filter(
                models.AttendanceRecord.student_id == student.id,
                models.AttendanceRecord.date == today,
                models.AttendanceRecord.period == current_p
            ).first()
        if not attendance:
            attendance = db.query(models.AttendanceRecord).filter(
                models.AttendanceRecord.student_id == student.id,
                models.AttendanceRecord.date == today
            ).order_by(models.AttendanceRecord.period.desc()).first()
        
        # 2. ?꾩옱 ?쇱젙 議고쉶
        current_schedule = None
        
        # ?곷떞 ?쇱젙 泥댄겕
        # Schedule 모델이 start_time/end_time 필드가 없어 현재 Skip
        counseling = None
        
        # ?몄텧 泥댄겕
        if not current_schedule:
            outing = db.query(models.Outing).filter(
                models.Outing.student_id == student.id,
                models.Outing.date == today,
                models.Outing.start_time <= current_time_str,
                models.Outing.end_time >= current_time_str
            ).first()
            
            if outing:
                current_schedule = {
                    "type": "outing",
                    "start_time": str(outing.start_time),
                    "end_time": str(outing.end_time),
                    "reason": outing.reason
                }
        
        # ?뺢린 ?몄텧 泥댄겕
        if not current_schedule:
            recurring_outing = db.query(models.RecurringOuting).filter(
                models.RecurringOuting.student_id == student.id,
                models.RecurringOuting.day_of_week == day_of_week,
                models.RecurringOuting.start_time <= current_time_str,
                models.RecurringOuting.end_time >= current_time_str,
                models.RecurringOuting.is_active == 1
            ).first()
            
            if recurring_outing:
                current_schedule = {
                    "type": "recurring_outing",
                    "start_time": str(recurring_outing.start_time),
                    "end_time": str(recurring_outing.end_time),
                    "reason": recurring_outing.reason
                }
        
        # 3. 理쒓렐 ?쒕룄 泥댄겕 議고쉶 (?ㅻ뒛)
        # 태도 체크 - 현재 교시와 전 교시만 표시
        current_period = get_current_period()
        recent_checks = []

        if current_period:
            periods_to_check = [current_period]
            if current_period > 1:
                periods_to_check.append(current_period - 1)

            time_ranges = []
            for p in periods_to_check:
                start_t, end_t = get_period_time_range(p)
                if start_t and end_t:
                    time_ranges.append((start_t, end_t))

            all_checks = db.query(models.StudyAttitudeCheck).filter(
                models.StudyAttitudeCheck.student_id == student.id,
                models.StudyAttitudeCheck.check_date == today
            ).order_by(models.StudyAttitudeCheck.check_time.desc()).all()

            for check in all_checks:
                for start_t, end_t in time_ranges:
                    if start_t <= check.check_time <= end_t:
                        recent_checks.append(check)
                        break
                if len(recent_checks) >= 3:
                    break
        else:
            recent_checks = db.query(models.StudyAttitudeCheck).filter(
                models.StudyAttitudeCheck.student_id == student.id,
                models.StudyAttitudeCheck.check_date == today
            ).order_by(models.StudyAttitudeCheck.check_time.desc()).limit(3).all()
        
        # 4. ?곹깭 ?먮떒
        if not attendance:
            status = "absent"
            color = "red"
            absent_count += 1
        elif attendance.status == "지각":
            status = "late"
            color = "orange"
            present_count += 1
        elif current_schedule:
            status = "on_schedule"
            color = "yellow"
            on_schedule_count += 1
        elif recent_checks and any(c.attitude_type != "?뺤긽" for c in recent_checks):
            status = "attitude_warning"
            color = "purple"
            present_count += 1
        else:
            status = "studying"
            color = "green"
            present_count += 1
        
        student_statuses.append({
            "id": student.id,
            "name": student.name,
            "seat_number": student.seat_number,
            "current_status": status,
            "status_color": color,
            "attendance_today": attendance,
            "current_schedule": current_schedule,
            "recent_attitude_checks": recent_checks
        })
    
    return {
        "students": student_statuses,
        "current_time": now,
        "total_students": len(students),
        "present_count": present_count,
        "absent_count": absent_count,
        "on_schedule_count": on_schedule_count
    }


from typing import Optional
from datetime import datetime

# ==================== ?쒖같 ?쒖옉/醫낅즺 API ====================

@app.post("/patrols/start")
def start_patrol(db: Session = Depends(get_db)):
    """?쒖같 ?쒖옉"""
    now = datetime.now()
    
    # ?ㅻ뒛 吏꾪뻾 以묒씤 ?쒖같???덈뒗吏 ?뺤씤
    existing_patrol = db.query(models.Patrol).filter(
        models.Patrol.patrol_date == now.date(),
        models.Patrol.end_time == None
    ).first()
    
    if existing_patrol:
        return {
            "patrol_id": existing_patrol.id,
            "message": "?대? 吏꾪뻾 以묒씤 ?쒖같???덉뒿?덈떎.",
            "start_time": str(existing_patrol.start_time)
        }
    
    # 새 순찰 시작
    new_patrol = models.Patrol(
        patrol_date=now.date(),
        start_time=now.time(),
        notes=""
    )
    db.add(new_patrol)
    db.commit()
    db.refresh(new_patrol)

    # 순찰 알림 상태 초기화
    patrol_monitor.reset_alerts()

    return {
        "patrol_id": new_patrol.id,
        "message": "순찰이 시작되었습니다.",
        "start_time": str(new_patrol.start_time)
    }


@app.post("/patrols/{patrol_id}/end")
def end_patrol(patrol_id: int, notes: str = "", inspector_name: str = "", db: Session = Depends(get_db)):
    """?쒖같 醫낅즺"""
    patrol = db.query(models.Patrol).filter(models.Patrol.id == patrol_id).first()
    
    if not patrol:
        raise HTTPException(status_code=404, detail="?쒖같??李얠쓣 ???놁뒿?덈떎.")
    
    if patrol.end_time:
        raise HTTPException(status_code=400, detail="?대? 醫낅즺???쒖같?낅땲??")
    
    now = datetime.now()
    patrol.end_time = now.time()
    patrol.notes = notes
    patrol.inspector_name = inspector_name

    db.commit()
    db.refresh(patrol)

    # 순찰 알림 상태 초기화
    patrol_monitor.reset_alerts()

    #???쒖같?먯꽌 泥댄겕???쒕룄 湲곕줉 ??議고쉶
    check_count = db.query(models.StudyAttitudeCheck).filter(
        models.StudyAttitudeCheck.patrol_id == patrol_id
    ).count()
    
    return {
        "patrol_id": patrol.id,
        "message": "?쒖같??醫낅즺?섏뿀?듬땲??",
        "start_time": str(patrol.start_time),
        "end_time": str(patrol.end_time),
        "attitude_checks_count": check_count
    }


@app.post("/patrols/{patrol_id}/force-end")
def force_end_patrol(patrol_id: int, notes: str = "강제종료 - 페이지 이탈", db: Session = Depends(get_db)):
    """순찰 강제종료 (페이지 이탈 시 자동 호출)"""
    patrol = db.query(models.Patrol).filter(models.Patrol.id == patrol_id).first()

    if not patrol:
        return {"message": "순찰을 찾을 수 없습니다."}

    if patrol.end_time:
        return {"message": "이미 종료된 순찰입니다."}

    now = datetime.now()
    patrol.end_time = now.time()
    patrol.notes = notes

    db.commit()

    return {
        "patrol_id": patrol.id,
        "message": "순찰이 강제종료되었습니다.",
        "end_time": str(patrol.end_time)
    }


@app.get("/patrols/current")
def get_current_patrol(db: Session = Depends(get_db)):
    """?꾩옱 吏꾪뻾 以묒씤 ?쒖같 議고쉶"""
    from datetime import date
    today = date.today()
    
    patrol = db.query(models.Patrol).filter(
        models.Patrol.patrol_date == today,
        models.Patrol.end_time == None
    ).first()
    
    if not patrol:
        return {"patrol_id": None, "is_active": False}
    
    # ???쒖같?먯꽌 泥댄겕???쒕룄 湲곕줉??
    check_count = db.query(models.StudyAttitudeCheck).filter(
        models.StudyAttitudeCheck.patrol_id == patrol.id
    ).count()
    
    return {
        "patrol_id": patrol.id,
        "is_active": True,
        "start_time": str(patrol.start_time),
        "check_count": check_count
    }


# ==================== School Attendance API ====================

@app.get("/school-attendance/today")
def get_today_school_attendance(db: Session = Depends(get_db)):
    """Get today's school attendance list (student IDs who are at school)"""
    today = date.today()
    records = db.query(models.SchoolAttendance).filter(
        models.SchoolAttendance.date == today
    ).all()
    return {"student_ids": [r.student_id for r in records]}


@app.post("/school-attendance/{student_id}")
def mark_school_attendance(student_id: int, db: Session = Depends(get_db)):
    """Mark a student as attending school today"""
    today = date.today()

    existing = db.query(models.SchoolAttendance).filter(
        models.SchoolAttendance.student_id == student_id,
        models.SchoolAttendance.date == today
    ).first()

    if existing:
        return {"message": "Already marked", "student_id": student_id}

    new_record = models.SchoolAttendance(
        student_id=student_id,
        date=today
    )
    db.add(new_record)
    db.commit()
    return {"message": "Marked as at school", "student_id": student_id}


@app.delete("/school-attendance/{student_id}")
def unmark_school_attendance(student_id: int, db: Session = Depends(get_db)):
    """Unmark a student's school attendance for today"""
    today = date.today()

    record = db.query(models.SchoolAttendance).filter(
        models.SchoolAttendance.student_id == student_id,
        models.SchoolAttendance.date == today
    ).first()

    if not record:
        return {"message": "Not found", "student_id": student_id}

    db.delete(record)
    db.commit()
    return {"message": "Unmarked", "student_id": student_id}


# ==================== 다이아몬드 상담 시스템 API ====================

# --- Counselor (상담사) Endpoints ---
@app.post("/counselors/", response_model=schemas.Counselor)
def create_counselor(counselor: schemas.CounselorCreate, db: Session = Depends(get_db)):
    """상담사 생성"""
    db_counselor = models.Counselor(**counselor.dict())
    db.add(db_counselor)
    db.commit()
    db.refresh(db_counselor)
    return db_counselor


@app.get("/counselors/", response_model=List[schemas.Counselor])
def read_counselors(is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    """상담사 목록 조회"""
    query = db.query(models.Counselor)
    if is_active is not None:
        query = query.filter(models.Counselor.is_active == is_active)
    return query.all()


@app.put("/counselors/{counselor_id}", response_model=schemas.Counselor)
def update_counselor(counselor_id: int, counselor_update: schemas.CounselorUpdate, db: Session = Depends(get_db)):
    """상담사 정보 수정"""
    db_counselor = db.query(models.Counselor).filter(models.Counselor.id == counselor_id).first()
    if not db_counselor:
        raise HTTPException(status_code=404, detail="상담사를 찾을 수 없습니다")

    update_data = counselor_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_counselor, key, value)

    db.commit()
    db.refresh(db_counselor)
    return db_counselor


# --- DiamondCounseling (정기 상담 스케줄) Endpoints ---
@app.post("/diamond-counselings/")
def create_diamond_counseling(counseling: schemas.DiamondCounselingCreate, db: Session = Depends(get_db)):
    """
    다이아몬드 상담 생성 (자동 페어링 - 다른 선생님)
    - week_pattern "1_3" 선택 → 1주차: 선택한 선생님, 3주차: 다른 선생님
    - week_pattern "2_4" 선택 → 2주차: 선택한 선생님, 4주차: 다른 선생님

    예: 1_3 패턴에 김현철 선택 → 1주차 김현철, 3주차 정현재
    """
    # week_pattern 파싱 (1_3 → [1, 3] 또는 2_4 → [2, 4])
    weeks = [int(w) for w in counseling.week_pattern.split("_")]
    first_week = weeks[0]  # 1 또는 2
    second_week = weeks[1]  # 3 또는 4

    # 다른 상담사 찾기
    all_counselors = db.query(models.Counselor).filter(models.Counselor.is_active == True).all()
    paired_counselor = None
    for c in all_counselors:
        if c.id != counseling.counselor_id:
            paired_counselor = c
            break

    # 첫 번째 주차 상담 생성 (선택한 선생님)
    first_counseling = models.DiamondCounseling(
        student_id=counseling.student_id,
        counselor_id=counseling.counselor_id,
        week_number=first_week,
        day_of_week=counseling.day_of_week,
        start_time=counseling.start_time,
        is_active=True
    )
    db.add(first_counseling)
    db.commit()
    db.refresh(first_counseling)

    result = {
        "message": "상담 스케줄이 생성되었습니다",
        "first_counseling": first_counseling,
        "second_counseling": None
    }

    if paired_counselor:
        # 두 번째 주차 상담 생성 (다른 선생님)
        second_counseling = models.DiamondCounseling(
            student_id=counseling.student_id,
            counselor_id=paired_counselor.id,
            week_number=second_week,
            day_of_week=counseling.day_of_week,
            start_time=counseling.start_time,
            is_active=True,
            paired_counseling_id=first_counseling.id
        )
        db.add(second_counseling)
        db.commit()
        db.refresh(second_counseling)

        # 첫 번째 상담에 페어 ID 연결
        first_counseling.paired_counseling_id = second_counseling.id
        db.commit()
        db.refresh(first_counseling)

        result["message"] = "상담 스케줄이 생성되었습니다 (두 선생님 배정)"
        result["second_counseling"] = second_counseling

    return result


@app.get("/diamond-counselings/")
def read_diamond_counselings(
    student_id: Optional[int] = None,
    counselor_id: Optional[int] = None,
    is_active: Optional[bool] = True,
    db: Session = Depends(get_db)
):
    """다이아몬드 상담 목록 조회"""
    query = db.query(models.DiamondCounseling)

    if student_id:
        query = query.filter(models.DiamondCounseling.student_id == student_id)
    if counselor_id:
        query = query.filter(models.DiamondCounseling.counselor_id == counselor_id)
    if is_active is not None:
        query = query.filter(models.DiamondCounseling.is_active == is_active)

    counselings = query.all()

    # 상세 정보 추가
    result = []
    for c in counselings:
        student = db.query(models.Student).filter(models.Student.id == c.student_id).first()
        counselor = db.query(models.Counselor).filter(models.Counselor.id == c.counselor_id).first()
        result.append({
            **c.__dict__,
            "student_name": student.name if student else None,
            "counselor_name": counselor.name if counselor else None
        })

    return result


@app.get("/diamond-counselings/counselor/{counselor_id}/week/{week_number}")
def get_counselor_weekly_schedule(counselor_id: int, week_number: int, db: Session = Depends(get_db)):
    """상담사별 주차 스케줄 조회 (week_number: 1-4)"""
    counselings = db.query(models.DiamondCounseling).filter(
        models.DiamondCounseling.counselor_id == counselor_id,
        models.DiamondCounseling.is_active == True,
        models.DiamondCounseling.week_number == week_number
    ).order_by(
        models.DiamondCounseling.day_of_week,
        models.DiamondCounseling.start_time
    ).all()

    result = []
    for c in counselings:
        student = db.query(models.Student).filter(models.Student.id == c.student_id).first()
        result.append({
            **c.__dict__,
            "student_name": student.name if student else None
        })

    return result


@app.put("/diamond-counselings/{counseling_id}")
def update_diamond_counseling(counseling_id: int, counseling_update: schemas.DiamondCounselingUpdate, db: Session = Depends(get_db)):
    """다이아몬드 상담 스케줄 수정"""
    counseling = db.query(models.DiamondCounseling).filter(
        models.DiamondCounseling.id == counseling_id
    ).first()

    if not counseling:
        raise HTTPException(status_code=404, detail="상담을 찾을 수 없습니다")

    # 업데이트할 필드만 적용
    if counseling_update.counselor_id is not None:
        counseling.counselor_id = counseling_update.counselor_id
    if counseling_update.day_of_week is not None:
        counseling.day_of_week = counseling_update.day_of_week
    if counseling_update.start_time is not None:
        counseling.start_time = counseling_update.start_time
    if counseling_update.is_active is not None:
        counseling.is_active = counseling_update.is_active

    db.commit()
    db.refresh(counseling)

    # 학생 이름 포함해서 반환
    student = db.query(models.Student).filter(models.Student.id == counseling.student_id).first()
    counselor = db.query(models.Counselor).filter(models.Counselor.id == counseling.counselor_id).first()

    return {
        **counseling.__dict__,
        "student_name": student.name if student else None,
        "counselor_name": counselor.name if counselor else None
    }


@app.delete("/diamond-counselings/{counseling_id}")
def delete_diamond_counseling(counseling_id: int, db: Session = Depends(get_db)):
    """다이아몬드 상담 비활성화 (페어도 함께)"""
    counseling = db.query(models.DiamondCounseling).filter(
        models.DiamondCounseling.id == counseling_id
    ).first()

    if not counseling:
        raise HTTPException(status_code=404, detail="상담을 찾을 수 없습니다")

    # 페어 상담도 비활성화
    if counseling.paired_counseling_id:
        paired = db.query(models.DiamondCounseling).filter(
            models.DiamondCounseling.id == counseling.paired_counseling_id
        ).first()
        if paired:
            paired.is_active = False

    counseling.is_active = False
    db.commit()

    return {"message": "상담 스케줄이 비활성화되었습니다"}


# --- CounselingSession (상담 세션) Endpoints ---
@app.post("/counseling-sessions/generate-monthly")
def generate_monthly_sessions(request: schemas.GenerateMonthlySessionsRequest, db: Session = Depends(get_db)):
    """월별 상담 세션 자동 생성"""
    from calendar import monthrange

    year = request.year
    month = request.month

    # 해당 월의 주차별 날짜 계산
    _, last_day = monthrange(year, month)

    # 활성 상담 조회
    active_counselings = db.query(models.DiamondCounseling).filter(
        models.DiamondCounseling.is_active == True
    ).all()

    created_sessions = []

    for counseling in active_counselings:
        # week_number로 직접 사용
        week = counseling.week_number

        # 해당 주차의 해당 요일 찾기
        week_count = 0

        for day in range(1, last_day + 1):
            check_date = date(year, month, day)
            if check_date.weekday() == counseling.day_of_week:
                week_count += 1
                if week_count == week:
                    # 이미 세션이 있는지 확인
                    existing = db.query(models.CounselingSession).filter(
                        models.CounselingSession.diamond_counseling_id == counseling.id,
                        models.CounselingSession.scheduled_date == check_date
                    ).first()

                    if not existing:
                        student = db.query(models.Student).filter(models.Student.id == counseling.student_id).first()
                        counselor = db.query(models.Counselor).filter(models.Counselor.id == counseling.counselor_id).first()

                        new_session = models.CounselingSession(
                            diamond_counseling_id=counseling.id,
                            student_id=counseling.student_id,
                            counselor_id=counseling.counselor_id,
                            scheduled_date=check_date,
                            scheduled_time=counseling.start_time,
                            status="scheduled"
                        )
                        db.add(new_session)
                        created_sessions.append({
                            "student_id": counseling.student_id,
                            "student_name": student.name if student else None,
                            "counselor_id": counseling.counselor_id,
                            "counselor_name": counselor.name if counselor else None,
                            "date": str(check_date),
                            "time": counseling.start_time,
                            "week_number": week
                        })
                    break

    db.commit()

    return {
        "message": f"{year}년 {month}월 상담 세션이 생성되었습니다",
        "created_count": len(created_sessions),
        "sessions": created_sessions
    }


@app.get("/counseling-sessions/")
def read_counseling_sessions(
    student_id: Optional[int] = None,
    counselor_id: Optional[int] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """상담 세션 목록 조회"""
    query = db.query(models.CounselingSession)

    if student_id:
        query = query.filter(models.CounselingSession.student_id == student_id)
    if counselor_id:
        query = query.filter(models.CounselingSession.counselor_id == counselor_id)
    if status:
        query = query.filter(models.CounselingSession.status == status)
    if start_date:
        query = query.filter(models.CounselingSession.scheduled_date >= start_date)
    if end_date:
        query = query.filter(models.CounselingSession.scheduled_date <= end_date)

    sessions = query.order_by(models.CounselingSession.scheduled_date.desc()).all()

    result = []
    for s in sessions:
        student = db.query(models.Student).filter(models.Student.id == s.student_id).first()
        counselor = db.query(models.Counselor).filter(models.Counselor.id == s.counselor_id).first()
        survey = db.query(models.CounselingSurvey).filter(models.CounselingSurvey.session_id == s.id).first()

        result.append({
            **s.__dict__,
            "student_name": student.name if student else None,
            "counselor_name": counselor.name if counselor else None,
            "has_survey": survey is not None
        })

    return result


@app.get("/counseling-sessions/week/{date_str}")
def get_weekly_sessions(date_str: str, db: Session = Depends(get_db)):
    """주간 상담 세션 조회"""
    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()

    # 해당 주의 월요일과 일요일 계산
    monday = target_date - timedelta(days=target_date.weekday())
    sunday = monday + timedelta(days=6)

    sessions = db.query(models.CounselingSession).filter(
        models.CounselingSession.scheduled_date >= monday,
        models.CounselingSession.scheduled_date <= sunday
    ).order_by(
        models.CounselingSession.scheduled_date,
        models.CounselingSession.scheduled_time
    ).all()

    result = []
    for s in sessions:
        student = db.query(models.Student).filter(models.Student.id == s.student_id).first()
        counselor = db.query(models.Counselor).filter(models.Counselor.id == s.counselor_id).first()

        result.append({
            **s.__dict__,
            "student_name": student.name if student else None,
            "counselor_name": counselor.name if counselor else None
        })

    return result


@app.post("/counseling-sessions/{session_id}/complete")
def complete_session(session_id: int, db: Session = Depends(get_db)):
    """상담 세션 완료 처리"""
    session = db.query(models.CounselingSession).filter(
        models.CounselingSession.id == session_id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    session.status = "completed"
    session.completed_at = datetime.now()
    db.commit()
    db.refresh(session)

    return {"message": "상담이 완료 처리되었습니다", "session": session}


# --- CounselingSurvey (상담 설문지) Endpoints ---
@app.post("/counseling-surveys/", response_model=schemas.CounselingSurvey)
def create_counseling_survey(survey: schemas.CounselingSurveyCreate, db: Session = Depends(get_db)):
    """상담 설문지 제출"""
    # 세션 존재 확인
    session = db.query(models.CounselingSession).filter(
        models.CounselingSession.id == survey.session_id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    # 이미 설문이 있는지 확인
    existing = db.query(models.CounselingSurvey).filter(
        models.CounselingSurvey.session_id == survey.session_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="이미 설문이 제출되었습니다")

    db_survey = models.CounselingSurvey(**survey.dict())
    db.add(db_survey)

    # 세션도 완료 처리
    session.status = "completed"
    session.completed_at = datetime.now()

    db.commit()
    db.refresh(db_survey)

    return db_survey


@app.get("/counseling-surveys/session/{session_id}", response_model=schemas.CounselingSurvey)
def get_survey_by_session(session_id: int, db: Session = Depends(get_db)):
    """세션별 설문지 조회"""
    survey = db.query(models.CounselingSurvey).filter(
        models.CounselingSurvey.session_id == session_id
    ).first()

    if not survey:
        raise HTTPException(status_code=404, detail="설문지를 찾을 수 없습니다")

    return survey


@app.get("/counseling-surveys/")
def get_all_surveys(
    counseling_type: Optional[str] = None,
    counselor_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """모든 상담 설문 조회 (필터 가능)"""
    query = db.query(models.CounselingSurvey)

    if counseling_type:
        query = query.filter(models.CounselingSurvey.counseling_type == counseling_type)
    if counselor_id:
        query = query.filter(models.CounselingSurvey.counselor_id == counselor_id)

    surveys = query.order_by(models.CounselingSurvey.submitted_at.desc()).all()

    result = []
    for s in surveys:
        student = db.query(models.Student).filter(models.Student.id == s.student_id).first()
        counselor = db.query(models.Counselor).filter(models.Counselor.id == s.counselor_id).first()
        session = db.query(models.CounselingSession).filter(models.CounselingSession.id == s.session_id).first()

        result.append({
            **s.__dict__,
            "student_name": student.name if student else None,
            "student_seat": student.seat_number if student else None,
            "counselor_name": counselor.name if counselor else None,
            "session_date": str(session.scheduled_date) if session else None
        })

    return result


@app.get("/counseling-surveys/student/{student_id}")
def get_student_surveys(student_id: int, db: Session = Depends(get_db)):
    """학생별 설문지 이력 조회"""
    surveys = db.query(models.CounselingSurvey).filter(
        models.CounselingSurvey.student_id == student_id
    ).order_by(models.CounselingSurvey.submitted_at.desc()).all()

    result = []
    for s in surveys:
        counselor = db.query(models.Counselor).filter(models.Counselor.id == s.counselor_id).first()
        session = db.query(models.CounselingSession).filter(models.CounselingSession.id == s.session_id).first()

        result.append({
            **s.__dict__,
            "counselor_name": counselor.name if counselor else None,
            "session_date": str(session.scheduled_date) if session else None
        })

    return result


@app.post("/counseling-surveys/submit-standalone")
def submit_standalone_survey(survey: schemas.CounselingSurveyStandaloneCreate, db: Session = Depends(get_db)):
    """독립 설문 제출 - 세션 없이 직접 제출 후 매칭되는 다이아몬드 상담 세션 자동 완료"""
    from datetime import timedelta

    # 해당 날짜가 속한 주의 시작일(월요일)과 종료일(일요일) 계산
    counseling_date = survey.counseling_date
    days_since_monday = counseling_date.weekday()  # 월요일=0
    week_start = counseling_date - timedelta(days=days_since_monday)
    week_end = week_start + timedelta(days=6)

    matched_session = None
    session_id = None

    # 매칭되는 세션 찾기 (같은 학생, 같은 상담사, 같은 주)
    matching_sessions = db.query(models.CounselingSession).filter(
        models.CounselingSession.student_id == survey.student_id,
        models.CounselingSession.counselor_id == survey.counselor_id,
        models.CounselingSession.scheduled_date >= week_start,
        models.CounselingSession.scheduled_date <= week_end,
        models.CounselingSession.status != 'completed'
    ).all()

    if matching_sessions:
        # 매칭되는 세션이 있으면 첫 번째 세션 사용
        matched_session = matching_sessions[0]
        session_id = matched_session.id

        # 해당 세션에 이미 설문이 있는지 확인
        existing_survey = db.query(models.CounselingSurvey).filter(
            models.CounselingSurvey.session_id == session_id
        ).first()

        if existing_survey:
            raise HTTPException(status_code=400, detail="해당 세션에 이미 설문이 제출되어 있습니다")

    # session_id가 없으면 새 세션을 생성하거나 오류 처리
    if not session_id:
        # 임시 세션 없이 설문만 저장 (session_id 없이)
        # 하지만 현재 모델에서 session_id가 필수이므로, 세션을 먼저 생성
        # 다이아몬드 상담이 아닌 경우에도 기록을 위해 임시 세션 생성
        new_session = models.CounselingSession(
            diamond_counseling_id=None,
            student_id=survey.student_id,
            counselor_id=survey.counselor_id,
            scheduled_date=survey.counseling_date,
            scheduled_time="00:00",  # 임시
            week_number=0,  # 임시
            status="completed",
            completed_at=datetime.now()
        )
        db.add(new_session)
        db.flush()  # ID 할당을 위해
        session_id = new_session.id
    else:
        # 매칭된 세션 완료 처리
        matched_session.status = "completed"
        matched_session.completed_at = datetime.now()

    # 설문 저장
    db_survey = models.CounselingSurvey(
        session_id=session_id,
        student_id=survey.student_id,
        counselor_id=survey.counselor_id,
        counseling_type=survey.counseling_type,
        overall_achievement=survey.overall_achievement,
        allcare_satisfaction=survey.allcare_satisfaction,
        allcare_satisfaction_reason=survey.allcare_satisfaction_reason,
        korean_notes=survey.korean_notes,
        math_notes=survey.math_notes,
        english_notes=survey.english_notes,
        inquiry_notes=survey.inquiry_notes,
        other_notes=survey.other_notes
    )
    db.add(db_survey)
    db.commit()
    db.refresh(db_survey)

    result = {
        "survey_id": db_survey.id,
        "message": "설문이 제출되었습니다"
    }

    if matched_session:
        result["matched_session"] = {
            "id": matched_session.id,
            "scheduled_date": str(matched_session.scheduled_date),
            "student_id": matched_session.student_id,
            "counselor_id": matched_session.counselor_id
        }

    return result


# --- ScheduleChangeRequest (일정 변경 요청) Endpoints ---
@app.post("/schedule-change-requests/", response_model=schemas.ScheduleChangeRequest)
def create_schedule_change_request(request: schemas.ScheduleChangeRequestCreate, db: Session = Depends(get_db)):
    """일정 변경 요청 생성"""
    # 세션 존재 확인
    session = db.query(models.CounselingSession).filter(
        models.CounselingSession.id == request.session_id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    db_request = models.ScheduleChangeRequest(**request.dict())
    db.add(db_request)
    db.commit()
    db.refresh(db_request)

    return db_request


@app.get("/schedule-change-requests/")
def read_schedule_change_requests(
    status: Optional[str] = None,
    student_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """일정 변경 요청 목록 조회"""
    query = db.query(models.ScheduleChangeRequest)

    if status:
        query = query.filter(models.ScheduleChangeRequest.status == status)
    if student_id:
        query = query.filter(models.ScheduleChangeRequest.student_id == student_id)

    requests = query.order_by(models.ScheduleChangeRequest.created_at.desc()).all()

    result = []
    for r in requests:
        student = db.query(models.Student).filter(models.Student.id == r.student_id).first()
        session = db.query(models.CounselingSession).filter(models.CounselingSession.id == r.session_id).first()
        counselor = None
        if session:
            counselor = db.query(models.Counselor).filter(models.Counselor.id == session.counselor_id).first()

        result.append({
            **r.__dict__,
            "student_name": student.name if student else None,
            "original_date": session.scheduled_date if session else None,
            "original_time": session.scheduled_time if session else None,
            "counselor_name": counselor.name if counselor else None
        })

    return result


@app.post("/schedule-change-requests/{request_id}/approve")
def approve_schedule_change(
    request_id: int,
    process_data: schemas.ScheduleChangeRequestProcess,
    db: Session = Depends(get_db)
):
    """일정 변경 요청 승인"""
    change_request = db.query(models.ScheduleChangeRequest).filter(
        models.ScheduleChangeRequest.id == request_id
    ).first()

    if not change_request:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없습니다")

    if change_request.status != "pending":
        raise HTTPException(status_code=400, detail="이미 처리된 요청입니다")

    # 요청 승인
    change_request.status = "approved"
    change_request.processed_by = process_data.processed_by
    change_request.processed_at = datetime.now()

    # 세션 일정 변경
    session = db.query(models.CounselingSession).filter(
        models.CounselingSession.id == change_request.session_id
    ).first()

    if session:
        if change_request.requested_date:
            session.scheduled_date = change_request.requested_date
        if change_request.requested_time:
            session.scheduled_time = change_request.requested_time
        session.status = "rescheduled"

    db.commit()

    return {"message": "일정 변경이 승인되었습니다"}


@app.post("/schedule-change-requests/{request_id}/reject")
def reject_schedule_change(
    request_id: int,
    process_data: schemas.ScheduleChangeRequestProcess,
    db: Session = Depends(get_db)
):
    """일정 변경 요청 거절"""
    change_request = db.query(models.ScheduleChangeRequest).filter(
        models.ScheduleChangeRequest.id == request_id
    ).first()

    if not change_request:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없습니다")

    if change_request.status != "pending":
        raise HTTPException(status_code=400, detail="이미 처리된 요청입니다")

    change_request.status = "rejected"
    change_request.processed_by = process_data.processed_by
    change_request.processed_at = datetime.now()
    change_request.rejection_reason = process_data.rejection_reason
    change_request.alternative_times = process_data.alternative_times

    db.commit()

    return {"message": "일정 변경 요청이 거절되었습니다"}


# --- 초기 데이터 생성 엔드포인트 ---
@app.post("/counselors/init")
def init_counselors(db: Session = Depends(get_db)):
    """초기 상담사 데이터 생성 (김현철, 정현재)"""
    counselors_data = [
        {"name": "김현철"},
        {"name": "정현재"}
    ]

    created = []
    for data in counselors_data:
        existing = db.query(models.Counselor).filter(models.Counselor.name == data["name"]).first()
        if not existing:
            counselor = models.Counselor(**data)
            db.add(counselor)
            created.append(data["name"])

    db.commit()

    return {"message": f"상담사 생성 완료: {created}" if created else "이미 존재하는 상담사입니다"}


# =================
# Student Portal API (학생 포털)
# =================

@app.post("/student-portal/login", response_model=schemas.StudentPortalLoginResponse)
def student_portal_login(login_data: schemas.StudentPortalLogin, db: Session = Depends(get_db)):
    """학생 포털 로그인 (이름 + 좌석번호 인증)"""
    # 학생 조회
    student = db.query(models.Student).filter(
        models.Student.name == login_data.name,
        models.Student.seat_number == login_data.seat_number,
        models.Student.status == "재원"
    ).first()

    if not student:
        raise HTTPException(status_code=401, detail="이름 또는 좌석번호가 일치하지 않습니다")

    return {
        "student_id": student.id,
        "name": student.name,
        "seat_number": student.seat_number,
        "token": None  # 필요 시 JWT 토큰 추가
    }


# =================
# Student Request API (학생 요청 시스템)
# =================

@app.post("/student-requests/", response_model=schemas.StudentRequest)
def create_student_request(request: schemas.StudentRequestCreate, db: Session = Depends(get_db)):
    """학생 요청 생성"""
    # 학생 존재 확인
    student = db.query(models.Student).filter(models.Student.id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다")

    db_request = models.StudentRequest(**request.dict())
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    return db_request


@app.get("/student-requests/my/{student_id}", response_model=List[schemas.StudentRequestWithDetails])
def get_my_requests(student_id: int, status: Optional[str] = None, db: Session = Depends(get_db)):
    """내 요청 목록 조회 (학생용)"""
    query = db.query(models.StudentRequest).filter(models.StudentRequest.student_id == student_id)

    if status:
        query = query.filter(models.StudentRequest.status == status)

    requests = query.order_by(models.StudentRequest.created_at.desc()).all()

    # 학생 정보 추가
    result = []
    for req in requests:
        req_dict = schemas.StudentRequest.model_validate(req).model_dump()
        req_dict["student_name"] = req.student.name
        req_dict["student_seat_number"] = req.student.seat_number
        result.append(schemas.StudentRequestWithDetails(**req_dict))

    return result


@app.delete("/student-requests/{request_id}")
def cancel_student_request(request_id: int, student_id: int, db: Session = Depends(get_db)):
    """학생 요청 취소 (대기 상태만 가능)"""
    request = db.query(models.StudentRequest).filter(
        models.StudentRequest.id == request_id,
        models.StudentRequest.student_id == student_id
    ).first()

    if not request:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없습니다")

    if request.status != "대기":
        raise HTTPException(status_code=400, detail="대기 상태인 요청만 취소할 수 있습니다")

    db.delete(request)
    db.commit()
    return {"message": "요청이 취소되었습니다"}


# =================
# Admin Student Request API (관리자용)
# =================

@app.get("/student-requests/", response_model=List[schemas.StudentRequestWithDetails])
def get_all_student_requests(
    status: Optional[str] = None,
    request_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """전체 학생 요청 목록 (관리자용)"""
    query = db.query(models.StudentRequest)

    if status:
        query = query.filter(models.StudentRequest.status == status)
    if request_type:
        query = query.filter(models.StudentRequest.request_type == request_type)

    requests = query.order_by(models.StudentRequest.created_at.desc()).all()

    # 학생 정보 추가
    result = []
    for req in requests:
        req_dict = schemas.StudentRequest.model_validate(req).model_dump()
        req_dict["student_name"] = req.student.name
        req_dict["student_seat_number"] = req.student.seat_number
        result.append(schemas.StudentRequestWithDetails(**req_dict))

    return result


@app.get("/student-requests/pending", response_model=List[schemas.StudentRequestWithDetails])
def get_pending_requests(db: Session = Depends(get_db)):
    """대기 중인 요청 목록"""
    requests = db.query(models.StudentRequest).filter(
        models.StudentRequest.status == "대기"
    ).order_by(
        models.StudentRequest.priority.desc(),  # 긴급 우선
        models.StudentRequest.created_at
    ).all()

    # 학생 정보 추가
    result = []
    for req in requests:
        req_dict = schemas.StudentRequest.model_validate(req).model_dump()
        req_dict["student_name"] = req.student.name
        req_dict["student_seat_number"] = req.student.seat_number
        result.append(schemas.StudentRequestWithDetails(**req_dict))

    return result


@app.put("/student-requests/{request_id}/approve")
def approve_student_request(
    request_id: int,
    update: schemas.StudentRequestUpdate,
    db: Session = Depends(get_db)
):
    """학생 요청 승인"""
    request = db.query(models.StudentRequest).filter(models.StudentRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없습니다")

    request.status = "승인"
    request.processed_at = datetime.now()
    if update.processed_by:
        request.processed_by = update.processed_by
    if update.admin_note:
        request.admin_note = update.admin_note

    db.commit()
    db.refresh(request)
    return {"message": "요청이 승인되었습니다", "request": request}


@app.put("/student-requests/{request_id}/reject")
def reject_student_request(
    request_id: int,
    update: schemas.StudentRequestUpdate,
    db: Session = Depends(get_db)
):
    """학생 요청 거부"""
    request = db.query(models.StudentRequest).filter(models.StudentRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없습니다")

    request.status = "거부"
    request.processed_at = datetime.now()
    if update.processed_by:
        request.processed_by = update.processed_by
    if update.admin_note:
        request.admin_note = update.admin_note

    db.commit()
    db.refresh(request)
    return {"message": "요청이 거부되었습니다", "request": request}


@app.put("/student-requests/{request_id}/complete")
def complete_student_request(
    request_id: int,
    update: schemas.StudentRequestUpdate,
    db: Session = Depends(get_db)
):
    """학생 요청 완료 처리"""
    request = db.query(models.StudentRequest).filter(models.StudentRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없습니다")

    request.status = "완료"
    if update.processed_by:
        request.processed_by = update.processed_by
    if update.admin_note:
        request.admin_note = update.admin_note

    db.commit()
    db.refresh(request)
    return {"message": "요청이 완료되었습니다", "request": request}


@app.put("/student-requests/{request_id}/deliver")
def deliver_student_request(
    request_id: int,
    delivered_by: str,
    item_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """학생 요청 가져다줬다 확인"""
    request = db.query(models.StudentRequest).filter(models.StudentRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없습니다")

    request.delivered = True
    request.delivered_at = datetime.now()
    request.delivered_by = delivered_by

    # 물품 ID 연결 (보조배터리 등)
    if item_id:
        item = db.query(models.Item).filter(models.Item.id == item_id).first()
        if item:
            request.item_id = item_id
            item.is_available = False  # 물품을 대여중으로 표시

    # 보조배터리인 경우 상태를 "배달완료"로 변경
    if request.request_type == "보조배터리":
        request.status = "배달완료"

    db.commit()
    db.refresh(request)
    return {"message": "가져다줬습니다", "request": request}


@app.put("/student-requests/{request_id}/return")
def return_student_request(
    request_id: int,
    db: Session = Depends(get_db)
):
    """보조배터리 반납 확인"""
    request = db.query(models.StudentRequest).filter(models.StudentRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없습니다")

    if request.request_type != "보조배터리":
        raise HTTPException(status_code=400, detail="보조배터리 요청만 반납할 수 있습니다")

    request.returned = True
    request.returned_at = datetime.now()
    request.status = "완료"

    # 물품을 다시 사용 가능하도록 표시
    if request.item_id:
        item = db.query(models.Item).filter(models.Item.id == request.item_id).first()
        if item:
            item.is_available = True

    db.commit()
    db.refresh(request)
    return {"message": "반납 완료되었습니다", "request": request}


# =================
# Item Management API (물품 관리)
# =================

@app.post("/items/", response_model=schemas.Item)
def create_item(item: schemas.ItemCreate, db: Session = Depends(get_db)):
    """물품 등록"""
    db_item = models.Item(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


@app.get("/items/", response_model=List[schemas.Item])
def get_items(
    category: Optional[str] = None,
    available_only: bool = False,
    db: Session = Depends(get_db)
):
    """물품 목록 조회"""
    query = db.query(models.Item)

    if category:
        query = query.filter(models.Item.category == category)

    if available_only:
        query = query.filter(models.Item.is_available == True)

    return query.order_by(models.Item.category, models.Item.name).all()


@app.get("/items/{item_id}", response_model=schemas.Item)
def get_item(item_id: int, db: Session = Depends(get_db)):
    """물품 상세 조회"""
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="물품을 찾을 수 없습니다")
    return item


@app.put("/items/{item_id}", response_model=schemas.Item)
def update_item(item_id: int, item_update: schemas.ItemUpdate, db: Session = Depends(get_db)):
    """물품 정보 수정"""
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="물품을 찾을 수 없습니다")

    update_data = item_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@app.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    """물품 삭제"""
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="물품을 찾을 수 없습니다")

    # 대여 중인 물품은 삭제 불가
    if not item.is_available:
        raise HTTPException(status_code=400, detail="대여 중인 물품은 삭제할 수 없습니다")

    db.delete(item)
    db.commit()
    return {"message": "물품이 삭제되었습니다"}


@app.get("/items/rentals/active")
def get_active_rentals(db: Session = Depends(get_db)):
    """현재 대여 중인 물품 목록"""
    # 배달완료 상태이면서 아직 반납되지 않은 요청들
    active_rentals = db.query(models.StudentRequest).filter(
        models.StudentRequest.status == "배달완료",
        models.StudentRequest.returned == False,
        models.StudentRequest.item_id.isnot(None)
    ).all()

    result = []
    for rental in active_rentals:
        item = db.query(models.Item).filter(models.Item.id == rental.item_id).first()
        student = db.query(models.Student).filter(models.Student.id == rental.student_id).first()

        result.append({
            "request_id": rental.id,
            "item_id": rental.item_id,
            "item_name": item.name if item else None,
            "item_category": item.category if item else None,
            "student_name": student.name if student else None,
            "student_seat": student.seat_number if student else None,
            "cable_type": rental.cable_type,
            "delivered_at": rental.delivered_at,
            "return_due_period": rental.return_due_period,
            "delivered_by": rental.delivered_by
        })

    return result


# =================
# Phone Submission API (휴대폰 제출 관리 - 교시별)
# =================

@app.post("/phone-submissions/period/bulk")
def bulk_update_phone_submissions(
    period: int,
    checked_by: str = Body(default="감독자"),
    submissions: List[schemas.PhoneSubmissionUpdate] = Body(...),
    force: bool = Query(default=False),
    db: Session = Depends(get_db)
):
    """교시별 휴대폰 제출 상태 일괄 업데이트 (시간 검증 포함)"""

    # 시간 검증 (force=False일 때만)
    if not force:
        validation = validate_period_timing(period)
        if not validation["is_current"]:
            # 경고 반환 (프론트에서 사용자 확인 후 force=True로 재요청)
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "period_mismatch",
                    "message": validation["warning_message"],
                    "current_period": validation["current_period"]
                }
            )

    today = date.today()

    for update in submissions:
        student_id = update.student_id
        is_submitted = update.is_submitted

        # 기존 레코드 찾기
        existing = db.query(models.PhoneSubmission).filter(
            models.PhoneSubmission.student_id == student_id,
            models.PhoneSubmission.date == today,
            models.PhoneSubmission.period == period
        ).first()

        if existing:
            existing.is_submitted = is_submitted
            existing.checked_by = checked_by
        else:
            new_record = models.PhoneSubmission(
                student_id=student_id,
                date=today,
                period=period,
                is_submitted=is_submitted,
                checked_by=checked_by
            )
            db.add(new_record)

    db.commit()
    return {"message": f"{period}교시 휴대폰 제출 상태가 저장되었습니다"}


@app.get("/phone-submissions/today/by-period", response_model=List[schemas.PhoneSubmissionWithDetails])
def get_today_phone_submissions_by_period(db: Session = Depends(get_db)):
    """오늘 교시별 휴대폰 제출 기록 조회 (학생별로 그룹화)"""
    today = date.today()

    # 오늘의 모든 제출 기록 조회
    submissions = db.query(models.PhoneSubmission).filter(
        models.PhoneSubmission.date == today
    ).order_by(models.PhoneSubmission.period).all()

    # 학생별로 교시 정보 구성
    student_records = {}
    for sub in submissions:
        if sub.student_id not in student_records:
            student_records[sub.student_id] = {
                "student_id": sub.student_id,
                "student_name": sub.student.name,
                "student_seat_number": sub.student.seat_number,
                "periods": {}
            }
        student_records[sub.student_id]["periods"][sub.period] = sub.is_submitted

    # 결과 변환
    result = []
    for student_id, data in student_records.items():
        result.append({
            "student_id": data["student_id"],
            "student_name": data["student_name"],
            "student_seat_number": data["student_seat_number"],
            "is_submitted": data["periods"].get(1, True)  # 기본값 True
        })

    return result


@app.delete("/phone-submissions/{submission_id}")
def delete_phone_submission(submission_id: int, db: Session = Depends(get_db)):
    """휴대폰 제출 기록 삭제"""
    submission = db.query(models.PhoneSubmission).filter(
        models.PhoneSubmission.id == submission_id
    ).first()

    if not submission:
        raise HTTPException(status_code=404, detail="제출 기록을 찾을 수 없습니다")

    db.delete(submission)
    db.commit()
    return {"message": "삭제되었습니다"}


# =================
# Statistics API (통계 및 대시보드)
# =================

@app.get("/statistics/today-summary")
def get_today_summary(db: Session = Depends(get_db)):
    """오늘의 전체 요약 통계"""
    today = date.today()

    # 전체 재원 학생 수
    total_students = db.query(models.Student).filter(
        models.Student.status == "재원"
    ).count()

    # 오늘 출석 기록
    attendance_records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.date == today
    ).all()

    # 출석 상태별 카운트
    present_count = sum(1 for r in attendance_records if r.status in ["자습중", "일정중"])
    late_count = sum(1 for r in attendance_records if r.status == "지각")
    absent_count = sum(1 for r in attendance_records if r.status == "결석")
    school_count = sum(1 for r in attendance_records if r.status == "학교")

    # 출석률 계산
    attendance_rate = round((present_count / total_students * 100), 1) if total_students > 0 else 0
    late_rate = round((late_count / total_students * 100), 1) if total_students > 0 else 0

    # 오늘 순찰 횟수
    patrol_count = db.query(models.Patrol).filter(
        models.Patrol.patrol_date == today
    ).count()

    # 진행 중인 순찰
    active_patrol = db.query(models.Patrol).filter(
        models.Patrol.patrol_date == today,
        models.Patrol.end_time == None
    ).first()

    # 오늘의 태도 체크 통계
    attitude_checks = db.query(models.StudyAttitudeCheck).join(
        models.Patrol
    ).filter(
        models.Patrol.patrol_date == today
    ).all()

    attitude_stats = {
        "정상": sum(1 for c in attitude_checks if c.attitude_type == "정상"),
        "졸음": sum(1 for c in attitude_checks if c.attitude_type == "졸음"),
        "딴짓": sum(1 for c in attitude_checks if c.attitude_type == "딴짓"),
        "이탈": sum(1 for c in attitude_checks if c.attitude_type == "이탈"),
        "기타": sum(1 for c in attitude_checks if c.attitude_type == "기타"),
    }

    return {
        "date": today,
        "total_students": total_students,
        "attendance": {
            "present": present_count,
            "late": late_count,
            "absent": absent_count,
            "school": school_count,
            "attendance_rate": attendance_rate,
            "late_rate": late_rate
        },
        "patrol": {
            "count": patrol_count,
            "active": active_patrol is not None,
            "active_id": active_patrol.id if active_patrol else None
        },
        "attitude": attitude_stats
    }


@app.get("/statistics/attendance-trend")
def get_attendance_trend(days: int = 7, db: Session = Depends(get_db)):
    """출석률 추이 (최근 N일)"""
    today = date.today()
    start_date = today - timedelta(days=days - 1)

    # 전체 재원 학생 수
    total_students = db.query(models.Student).filter(
        models.Student.status == "재원"
    ).count()

    # 날짜별 출석 데이터
    trend_data = []
    for i in range(days):
        target_date = start_date + timedelta(days=i)

        # 해당 날짜의 출석 기록
        records = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.date == target_date
        ).all()

        present = sum(1 for r in records if r.status in ["자습중", "일정중"])
        late = sum(1 for r in records if r.status == "지각")
        absent = sum(1 for r in records if r.status == "결석")

        attendance_rate = round((present / total_students * 100), 1) if total_students > 0 else 0
        late_rate = round((late / total_students * 100), 1) if total_students > 0 else 0

        trend_data.append({
            "date": target_date.isoformat(),
            "attendance_rate": attendance_rate,
            "late_rate": late_rate,
            "present_count": present,
            "late_count": late,
            "absent_count": absent
        })

    return {
        "period": f"최근 {days}일",
        "total_students": total_students,
        "trend": trend_data
    }


@app.get("/statistics/patrol-history")
def get_patrol_history(limit: int = 10, offset: int = 0, db: Session = Depends(get_db)):
    """순찰 이력 조회 (페이지네이션)"""
    # 최근 순찰 기록 조회 (최신순)
    patrols = db.query(models.Patrol).order_by(
        models.Patrol.patrol_date.desc(),
        models.Patrol.start_time.desc()
    ).offset(offset).limit(limit).all()

    result = []
    for patrol in patrols:
        # 해당 순찰의 태도 체크 통계
        attitude_checks = db.query(models.StudyAttitudeCheck).filter(
            models.StudyAttitudeCheck.patrol_id == patrol.id
        ).all()

        attitude_summary = {
            "정상": sum(1 for c in attitude_checks if c.attitude_type == "정상"),
            "졸음": sum(1 for c in attitude_checks if c.attitude_type == "졸음"),
            "딴짓": sum(1 for c in attitude_checks if c.attitude_type == "딴짓"),
            "이탈": sum(1 for c in attitude_checks if c.attitude_type == "이탈"),
            "기타": sum(1 for c in attitude_checks if c.attitude_type == "기타"),
        }

        # 순찰 소요 시간 계산
        duration_minutes = None
        if patrol.end_time and patrol.start_time:
            start_dt = datetime.combine(patrol.patrol_date, patrol.start_time)
            end_dt = datetime.combine(patrol.patrol_date, patrol.end_time)
            duration = end_dt - start_dt
            duration_minutes = int(duration.total_seconds() / 60)

        result.append({
            "id": patrol.id,
            "date": patrol.patrol_date.isoformat(),
            "start_time": patrol.start_time.strftime("%H:%M") if patrol.start_time else None,
            "end_time": patrol.end_time.strftime("%H:%M") if patrol.end_time else None,
            "duration_minutes": duration_minutes,
            "inspector_name": patrol.inspector_name,
            "notes": patrol.notes,
            "attitude_summary": attitude_summary,
            "total_checks": len(attitude_checks),
            "is_active": patrol.end_time is None
        })

    # 전체 순찰 수
    total_count = db.query(models.Patrol).count()

    return {
        "patrols": result,
        "total": total_count,
        "limit": limit,
        "offset": offset
    }


@app.get("/statistics/weekly-report")
def get_weekly_report(db: Session = Depends(get_db)):
    """주간 리포트 (최근 7일)"""
    today = date.today()
    week_start = today - timedelta(days=6)

    # 전체 재원 학생 수
    total_students = db.query(models.Student).filter(
        models.Student.status == "재원"
    ).count()

    # 주간 출석 데이터
    week_attendance = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.date >= week_start,
        models.AttendanceRecord.date <= today
    ).all()

    # 주간 순찰 데이터
    week_patrols = db.query(models.Patrol).filter(
        models.Patrol.patrol_date >= week_start,
        models.Patrol.patrol_date <= today
    ).all()

    # 주간 태도 체크
    week_attitudes = db.query(models.StudyAttitudeCheck).join(
        models.Patrol
    ).filter(
        models.Patrol.patrol_date >= week_start,
        models.Patrol.patrol_date <= today
    ).all()

    # 통계 계산
    avg_attendance_rate = 0
    avg_late_rate = 0
    if total_students > 0:
        present_avg = sum(1 for r in week_attendance if r.status in ["자습중", "일정중"]) / 7
        late_avg = sum(1 for r in week_attendance if r.status == "지각") / 7
        avg_attendance_rate = round((present_avg / total_students * 100), 1)
        avg_late_rate = round((late_avg / total_students * 100), 1)

    attitude_summary = {
        "정상": sum(1 for c in week_attitudes if c.attitude_type == "정상"),
        "졸음": sum(1 for c in week_attitudes if c.attitude_type == "졸음"),
        "딴짓": sum(1 for c in week_attitudes if c.attitude_type == "딴짓"),
        "이탈": sum(1 for c in week_attitudes if c.attitude_type == "이탈"),
        "기타": sum(1 for c in week_attitudes if c.attitude_type == "기타"),
    }

    return {
        "period": {
            "start": week_start.isoformat(),
            "end": today.isoformat()
        },
        "total_students": total_students,
        "attendance": {
            "avg_rate": avg_attendance_rate,
            "avg_late_rate": avg_late_rate,
            "total_records": len(week_attendance)
        },
        "patrol": {
            "total_count": len(week_patrols),
            "avg_per_day": round(len(week_patrols) / 7, 1)
        },
        "attitude": attitude_summary
    }


@app.get("/statistics/monthly-report")
def get_monthly_report(db: Session = Depends(get_db)):
    """월간 리포트 (최근 30일)"""
    today = date.today()
    month_start = today - timedelta(days=29)

    # 전체 재원 학생 수
    total_students = db.query(models.Student).filter(
        models.Student.status == "재원"
    ).count()

    # 월간 출석 데이터
    month_attendance = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.date >= month_start,
        models.AttendanceRecord.date <= today
    ).all()

    # 월간 순찰 데이터
    month_patrols = db.query(models.Patrol).filter(
        models.Patrol.patrol_date >= month_start,
        models.Patrol.patrol_date <= today
    ).all()

    # 월간 태도 체크
    month_attitudes = db.query(models.StudyAttitudeCheck).join(
        models.Patrol
    ).filter(
        models.Patrol.patrol_date >= month_start,
        models.Patrol.patrol_date <= today
    ).all()

    # 통계 계산
    avg_attendance_rate = 0
    avg_late_rate = 0
    if total_students > 0:
        present_avg = sum(1 for r in month_attendance if r.status in ["자습중", "일정중"]) / 30
        late_avg = sum(1 for r in month_attendance if r.status == "지각") / 30
        avg_attendance_rate = round((present_avg / total_students * 100), 1)
        avg_late_rate = round((late_avg / total_students * 100), 1)

    attitude_summary = {
        "정상": sum(1 for c in month_attitudes if c.attitude_type == "정상"),
        "졸음": sum(1 for c in month_attitudes if c.attitude_type == "졸음"),
        "딴짓": sum(1 for c in month_attitudes if c.attitude_type == "딴짓"),
        "이탈": sum(1 for c in month_attitudes if c.attitude_type == "이탈"),
        "기타": sum(1 for c in month_attitudes if c.attitude_type == "기타"),
    }

    # 주별 추이 데이터 (4주)
    weekly_trend = []
    for week_num in range(4):
        week_start_date = month_start + timedelta(days=week_num * 7)
        week_end_date = min(week_start_date + timedelta(days=6), today)

        week_records = [r for r in month_attendance
                       if week_start_date <= r.date <= week_end_date]

        present = sum(1 for r in week_records if r.status in ["자습중", "일정중"])
        late = sum(1 for r in week_records if r.status == "지각")

        week_rate = round((present / (total_students * 7) * 100), 1) if total_students > 0 else 0

        weekly_trend.append({
            "week": week_num + 1,
            "start": week_start_date.isoformat(),
            "end": week_end_date.isoformat(),
            "attendance_rate": week_rate,
            "late_count": late
        })

    return {
        "period": {
            "start": month_start.isoformat(),
            "end": today.isoformat()
        },
        "total_students": total_students,
        "attendance": {
            "avg_rate": avg_attendance_rate,
            "avg_late_rate": avg_late_rate,
            "total_records": len(month_attendance)
        },
        "patrol": {
            "total_count": len(month_patrols),
            "avg_per_day": round(len(month_patrols) / 30, 1)
        },
        "attitude": attitude_summary,
        "weekly_trend": weekly_trend
    }


# ==================== AI 분석 API ====================

# 환경 변수에서 n8n 웹훅 URL 가져오기
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "http://localhost:5678/webhook")

@app.get("/ai/student-data/{student_id}", response_model=schemas.StudentDataAggregation)
def get_student_data_for_ai(
    student_id: int,
    days: int = 60,
    db: Session = Depends(get_db)
):
    """
    AI 분석용 학생 데이터 집계
    n8n 워크플로우에서 호출하여 Claude에 전달할 데이터 생성
    """
    KST = pytz.timezone('Asia/Seoul')
    today = datetime.now(KST).date()
    start_date = today - timedelta(days=days)

    # 학생 기본 정보
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다")

    # 출석 기록 (최근 N일)
    attendance_records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.student_id == student_id,
        models.AttendanceRecord.date >= start_date
    ).order_by(models.AttendanceRecord.date.desc()).all()

    # 출석 통계 계산
    total_attendance = len(attendance_records)
    present_count = sum(1 for r in attendance_records if r.status in ["자습중", "출석", "일정중"])
    late_count = sum(1 for r in attendance_records if r.status == "지각")
    absent_count = sum(1 for r in attendance_records if r.status == "결석")

    attendance_stats = {
        "total_days": total_attendance,
        "present": present_count,
        "late": late_count,
        "absent": absent_count,
        "attendance_rate": round((present_count / total_attendance * 100), 1) if total_attendance > 0 else 0,
        "late_rate": round((late_count / total_attendance * 100), 1) if total_attendance > 0 else 0
    }

    # 학습 태도 체크 기록
    attitude_checks = db.query(models.StudyAttitudeCheck).filter(
        models.StudyAttitudeCheck.student_id == student_id,
        models.StudyAttitudeCheck.check_date >= start_date
    ).order_by(models.StudyAttitudeCheck.check_date.desc()).all()

    # 태도 통계 계산
    total_checks = len(attitude_checks)
    attitude_counts = {
        "정상": sum(1 for c in attitude_checks if c.attitude_type == "정상"),
        "졸음": sum(1 for c in attitude_checks if c.attitude_type == "졸음"),
        "딴짓": sum(1 for c in attitude_checks if c.attitude_type == "딴짓"),
        "이탈": sum(1 for c in attitude_checks if c.attitude_type == "이탈"),
        "기타": sum(1 for c in attitude_checks if c.attitude_type == "기타")
    }

    attitude_stats = {
        "total_checks": total_checks,
        **attitude_counts,
        "normal_rate": round((attitude_counts["정상"] / total_checks * 100), 1) if total_checks > 0 else 0
    }

    # 벌점 기록
    penalties = db.query(models.Penalty).filter(
        models.Penalty.student_id == student_id
    ).order_by(models.Penalty.date.desc()).all()

    total_penalty = sum(p.points for p in penalties if p.type == "벌점")
    total_merit = sum(p.points for p in penalties if p.type == "상점")

    penalty_stats = {
        "total_penalty": total_penalty,
        "total_merit": total_merit,
        "net_points": total_penalty - total_merit
    }

    # 상담 설문 기록
    counseling_surveys = db.query(models.CounselingSurvey).filter(
        models.CounselingSurvey.student_id == student_id
    ).order_by(models.CounselingSurvey.submitted_at.desc()).all()

    # 상담 유형별 통계
    counseling_by_type = {}
    achievement_counts = {"상": 0, "중": 0, "하": 0}
    for survey in counseling_surveys:
        ctype = survey.counseling_type
        if ctype not in counseling_by_type:
            counseling_by_type[ctype] = 0
        counseling_by_type[ctype] += 1
        if survey.overall_achievement in achievement_counts:
            achievement_counts[survey.overall_achievement] += 1

    counseling_stats = {
        "total_sessions": len(counseling_surveys),
        "by_type": counseling_by_type,
        "achievement": achievement_counts
    }

    # 외출 기록
    outings = db.query(models.Outing).filter(
        models.Outing.student_id == student_id,
        models.Outing.date >= start_date
    ).order_by(models.Outing.date.desc()).all()

    # 일정 기록
    schedules = db.query(models.Schedule).filter(
        models.Schedule.student_id == student_id,
        models.Schedule.date >= start_date
    ).order_by(models.Schedule.date.desc()).all()

    return schemas.StudentDataAggregation(
        student_id=student.id,
        name=student.name,
        seat_number=student.seat_number,
        status=student.status,
        student_type=student.student_type,
        attendance_stats=attendance_stats,
        attendance_records=[{
            "date": str(r.date),
            "status": r.status,
            "period": r.period,
            "check_in_time": str(r.check_in_time) if r.check_in_time else None
        } for r in attendance_records[:30]],  # 최근 30개만
        attitude_stats=attitude_stats,
        attitude_records=[{
            "date": str(c.check_date),
            "time": str(c.check_time),
            "type": c.attitude_type,
            "notes": c.notes
        } for c in attitude_checks[:30]],  # 최근 30개만
        penalty_stats=penalty_stats,
        penalties=[{
            "date": str(p.date),
            "type": p.type,
            "points": p.points,
            "reason": p.reason
        } for p in penalties[:20]],  # 최근 20개만
        counseling_stats=counseling_stats,
        counseling_surveys=[{
            "date": str(s.submitted_at),
            "type": s.counseling_type,
            "achievement": s.overall_achievement,
            "korean_notes": s.korean_notes,
            "math_notes": s.math_notes,
            "english_notes": s.english_notes,
            "inquiry_notes": s.inquiry_notes,
            "other_notes": s.other_notes
        } for s in counseling_surveys[:10]],  # 최근 10개만
        outings=[{
            "date": str(o.date),
            "start_time": o.start_time,
            "end_time": o.end_time,
            "reason": o.reason,
            "status": o.status
        } for o in outings],
        schedules=[{
            "date": str(s.date),
            "time": s.time,
            "type": s.type,
            "memo": s.memo
        } for s in schedules]
    )


@app.post("/ai/analyze", response_model=schemas.AIAnalysisResponse)
async def analyze_student_with_ai(
    request: schemas.AIAnalysisRequest,
    db: Session = Depends(get_db)
):
    """
    AI 분석 요청
    Gemini API를 직접 호출하여 분석 실행
    """
    KST = pytz.timezone('Asia/Seoul')
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyCiEIbUL74E4_vrauxv9z74qSX56lnWV2k")

    # 학생 정보 확인
    student = db.query(models.Student).filter(models.Student.id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다")

    # 학생 데이터 집계
    student_data = get_student_data_for_ai(request.student_id, days=60, db=db)

    # Gemini API 직접 호출
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"

    # 분석 프롬프트 생성
    prompt = f"""당신은 한국 학원의 학생 관리 전문가입니다. 다음 학생 데이터를 분석하고 한국어 마크다운 형식으로 상세한 보고서를 작성해주세요.

학생: {student.name}
분석 유형: {request.analysis_type}
{f"추가 질문: {request.custom_query}" if request.custom_query else ""}

데이터:
{student_data.model_dump_json(indent=2)}

다음 형식으로 작성해주세요:
## {student.name} 학생 분석 보고서

### 📊 출석 현황
- 출석률, 지각 패턴 분석, 개선 필요 사항

### 📝 학습 태도
- 태도 체크 결과 분석, 집중력 패턴

### 💬 상담 내역
- 상담 기록 요약, 주요 이슈

### ⚠️ 벌점/상점
- 벌점 현황 분석, 행동 패턴

### 🎯 종합 평가 및 권장사항
- 전체적인 평가
- 구체적인 개선 권장 사항
- 학부모 상담 시 참고사항"""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                gemini_url,
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.7,
                        "maxOutputTokens": 2048
                    }
                }
            )

            if response.status_code == 200:
                result = response.json()
                report = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")

                if not report:
                    report = generate_basic_report(student_data, request.analysis_type)

                return schemas.AIAnalysisResponse(
                    student_id=request.student_id,
                    student_name=student.name,
                    analysis_type=request.analysis_type,
                    report=report,
                    generated_at=datetime.now(KST),
                    data_period_days=60
                )
            else:
                # Gemini API 실패 시 기본 보고서 생성
                report = generate_basic_report(student_data, request.analysis_type)
                return schemas.AIAnalysisResponse(
                    student_id=request.student_id,
                    student_name=student.name,
                    analysis_type=request.analysis_type,
                    report=report,
                    generated_at=datetime.now(KST),
                    data_period_days=60
                )

    except (httpx.TimeoutException, httpx.RequestError) as e:
        # API 오류 시 기본 분석 제공
        report = generate_basic_report(student_data, request.analysis_type)
        return schemas.AIAnalysisResponse(
            student_id=request.student_id,
            student_name=student.name,
            analysis_type=request.analysis_type,
            report=report,
            generated_at=datetime.now(KST),
            data_period_days=60
        )


def generate_basic_report(data: schemas.StudentDataAggregation, analysis_type: str) -> str:
    """
    n8n/AI 연결 전 기본 통계 리포트 생성
    """
    report = f"## {data.name} 학생 분석 보고서\n\n"
    report += f"**좌석:** {data.seat_number} | **상태:** {data.status}\n\n"

    if analysis_type in ["comprehensive", "attendance"]:
        report += "### 📊 출석 현황 (최근 60일)\n"
        stats = data.attendance_stats
        report += f"- **출석률:** {stats.get('attendance_rate', 0)}%\n"
        report += f"- **지각률:** {stats.get('late_rate', 0)}%\n"
        report += f"- **출석:** {stats.get('present', 0)}일 | **지각:** {stats.get('late', 0)}일 | **결석:** {stats.get('absent', 0)}일\n\n"

    if analysis_type in ["comprehensive", "attitude"]:
        report += "### 📝 학습 태도 현황\n"
        stats = data.attitude_stats
        report += f"- **정상:** {stats.get('정상', 0)}회 ({stats.get('normal_rate', 0)}%)\n"
        report += f"- **졸음:** {stats.get('졸음', 0)}회\n"
        report += f"- **딴짓:** {stats.get('딴짓', 0)}회\n"
        report += f"- **이탈:** {stats.get('이탈', 0)}회\n\n"

    if analysis_type in ["comprehensive", "counseling"]:
        report += "### 💬 상담 현황\n"
        stats = data.counseling_stats
        report += f"- **총 상담 횟수:** {stats.get('total_sessions', 0)}회\n"
        achievement = stats.get('achievement', {})
        report += f"- **성취도:** 상 {achievement.get('상', 0)}회 | 중 {achievement.get('중', 0)}회 | 하 {achievement.get('하', 0)}회\n\n"

    report += "### ⚠️ 벌점/상점 현황\n"
    stats = data.penalty_stats
    report += f"- **벌점:** {stats.get('total_penalty', 0)}점\n"
    report += f"- **상점:** {stats.get('total_merit', 0)}점\n"
    report += f"- **순 벌점:** {stats.get('net_points', 0)}점\n\n"

    report += "---\n"
    report += "*💡 AI 분석을 위해 n8n 워크플로우를 연결해주세요.*"

    return report


@app.post("/webhooks/n8n/event")
async def receive_n8n_event(
    payload: schemas.WebhookEventPayload,
    db: Session = Depends(get_db)
):
    """
    n8n에서 보내는 이벤트 수신
    Discord 알림 등의 후처리에 사용
    """
    event_type = payload.event_type
    data = payload.data

    # 이벤트 타입별 처리
    if event_type == "analysis.completed":
        # AI 분석 완료 알림 처리
        pass
    elif event_type == "alert.sent":
        # 알림 발송 기록
        pass

    return {"status": "received", "event_type": event_type}


@app.post("/webhooks/n8n/trigger/{event_type}")
async def trigger_n8n_webhook(
    event_type: str,
    data: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    n8n 웹훅 트리거
    특정 이벤트 발생 시 n8n 워크플로우 실행
    """
    KST = pytz.timezone('Asia/Seoul')

    webhook_url = f"{N8N_WEBHOOK_URL}/{event_type}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                webhook_url,
                json={
                    "event_type": event_type,
                    "timestamp": datetime.now(KST).isoformat(),
                    "data": data
                }
            )
            return {
                "status": "triggered",
                "webhook_status": response.status_code
            }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


# ==================== Discord 알림 API ====================

DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")

async def send_discord_notification(title: str, message: str, color: int = 0x5865F2, fields: list = None):
    """Discord 웹훅으로 알림 전송"""
    if not DISCORD_WEBHOOK_URL:
        return {"status": "error", "message": "Discord 웹훅 URL이 설정되지 않았습니다."}

    embed = {
        "title": title,
        "description": message,
        "color": color,
        "timestamp": datetime.now(pytz.timezone('Asia/Seoul')).isoformat()
    }

    if fields:
        embed["fields"] = fields

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                DISCORD_WEBHOOK_URL,
                json={"embeds": [embed]}
            )
            return {"status": "success", "code": response.status_code}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/discord/notify")
async def send_custom_notification(
    title: str = Body(...),
    message: str = Body(...),
    color: int = Body(0x5865F2)
):
    """커스텀 Discord 알림 전송"""
    result = await send_discord_notification(title, message, color)
    return result


@app.post("/discord/patrol-reminder")
async def send_patrol_reminder(db: Session = Depends(get_db)):
    """순찰 리마인더 알림 전송"""
    KST = pytz.timezone('Asia/Seoul')
    now = datetime.now(KST)
    today = now.date()

    # 마지막 순찰 기록 조회
    last_patrol = db.query(models.Patrol).filter(
        models.Patrol.patrol_date == today
    ).order_by(models.Patrol.end_time.desc()).first()

    if last_patrol and last_patrol.end_time:
        last_time = datetime.combine(today, last_patrol.end_time)
        last_time = KST.localize(last_time)
        elapsed = (now - last_time).total_seconds() / 60

        if elapsed >= 25:
            result = await send_discord_notification(
                "⚠️ 순찰 지연 경고",
                f"마지막 순찰 후 **{int(elapsed)}분**이 경과했습니다!\n순찰을 즉시 진행해주세요.",
                color=0xFF0000,  # 빨간색
                fields=[
                    {"name": "마지막 순찰", "value": last_patrol.end_time.strftime("%H:%M"), "inline": True},
                    {"name": "경과 시간", "value": f"{int(elapsed)}분", "inline": True}
                ]
            )
            return {"status": "warning_sent", "elapsed_minutes": int(elapsed), "result": result}
        elif elapsed >= 15:
            result = await send_discord_notification(
                "🔔 순찰 리마인더",
                f"마지막 순찰 후 **{int(elapsed)}분**이 경과했습니다.\n순찰을 돌아주세요!",
                color=0xFFA500,  # 주황색
                fields=[
                    {"name": "마지막 순찰", "value": last_patrol.end_time.strftime("%H:%M"), "inline": True},
                    {"name": "경과 시간", "value": f"{int(elapsed)}분", "inline": True}
                ]
            )
            return {"status": "reminder_sent", "elapsed_minutes": int(elapsed), "result": result}
        else:
            return {"status": "ok", "elapsed_minutes": int(elapsed), "message": "순찰 시간 정상"}
    else:
        # 오늘 순찰 기록이 없는 경우
        result = await send_discord_notification(
            "📋 순찰 시작 알림",
            "오늘 첫 순찰을 시작해주세요!",
            color=0x5865F2
        )
        return {"status": "first_patrol_needed", "result": result}


@app.post("/discord/late-notification")
async def send_late_notification(
    student_name: str = Body(...),
    seat_number: str = Body(...),
    minutes_late: int = Body(...),
    db: Session = Depends(get_db)
):
    """지각 알림 전송"""
    result = await send_discord_notification(
        "⏰ 지각 알림",
        f"**{student_name}** 학생({seat_number})이 **{minutes_late}분** 지각했습니다.",
        color=0xFFA500,
        fields=[
            {"name": "학생", "value": student_name, "inline": True},
            {"name": "좌석", "value": seat_number, "inline": True},
            {"name": "지각 시간", "value": f"{minutes_late}분", "inline": True}
        ]
    )
    return result


@app.post("/discord/penalty-alert")
async def send_penalty_alert(
    student_name: str = Body(...),
    seat_number: str = Body(...),
    total_penalty: int = Body(...),
    reason: str = Body(None),
    db: Session = Depends(get_db)
):
    """벌점 경고 알림 전송 (10점 이상)"""
    if total_penalty >= 10:
        result = await send_discord_notification(
            "🚨 벌점 경고",
            f"**{student_name}** 학생({seat_number})의 누적 벌점이 **{total_penalty}점**입니다!",
            color=0xFF0000,
            fields=[
                {"name": "학생", "value": student_name, "inline": True},
                {"name": "좌석", "value": seat_number, "inline": True},
                {"name": "누적 벌점", "value": f"{total_penalty}점", "inline": True},
                {"name": "최근 사유", "value": reason or "없음", "inline": False}
            ]
        )
        return result
    return {"status": "ok", "message": "벌점이 10점 미만입니다."}


@app.post("/discord/attendance-check-reminder")
async def send_attendance_check_reminder(
    period: int = Body(...),
    db: Session = Depends(get_db)
):
    """출석 체크 리마인더 (교시 시작 후 10분 이내 출석확인이 없을 때)"""
    KST = pytz.timezone('Asia/Seoul')
    today = datetime.now(KST).date()

    # 해당 교시 출석 기록 확인
    attendance_count = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.date == today,
        models.AttendanceRecord.period == period
    ).count()

    if attendance_count == 0:
        result = await send_discord_notification(
            "📢 출석 체크 리마인더",
            f"**{period}교시** 출석 체크가 아직 진행되지 않았습니다!\n출석 확인을 진행해주세요.",
            color=0xFFA500,
            fields=[
                {"name": "교시", "value": f"{period}교시", "inline": True},
                {"name": "상태", "value": "미확인", "inline": True}
            ]
        )
        return {"status": "reminder_sent", "period": period, "result": result}

    return {"status": "ok", "period": period, "attendance_count": attendance_count}


@app.get("/discord/test")
async def test_discord_webhook():
    """Discord 웹훅 테스트"""
    result = await send_discord_notification(
        "✅ 테스트 알림",
        "Discord 웹훅이 정상적으로 연결되었습니다!",
        color=0x00FF00
    )
    return result


# ============ Phase 5: 일일 리포트 자동 생성 ============

@app.get("/reports/daily")
async def generate_daily_report(db: Session = Depends(get_db)):
    """일일 리포트 생성 - 오늘의 출결, 순찰, 벌점 현황 요약"""
    KST = pytz.timezone('Asia/Seoul')
    today = datetime.now(KST).date()
    today_str = today.strftime("%Y년 %m월 %d일")

    # 1. 재원 학생 수
    total_students = db.query(models.Student).filter(
        models.Student.status == "재원"
    ).count()

    # 2. 오늘 출석 현황
    attendance_records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.date == today
    ).all()

    attendance_stats = {
        "자습중": 0,
        "지각": 0,
        "결석": 0,
        "일정중": 0,
        "학교": 0,
        "조퇴": 0
    }
    for record in attendance_records:
        if record.status in attendance_stats:
            attendance_stats[record.status] += 1

    # 3. 오늘 순찰 현황
    patrols_today = db.query(models.Patrol).filter(
        models.Patrol.patrol_date == today
    ).all()
    patrol_count = len(patrols_today)

    # 4. 오늘 학습 태도 체크
    attitude_checks = db.query(models.StudyAttitudeCheck).filter(
        models.StudyAttitudeCheck.check_date == today
    ).all()

    attitude_stats = {
        "정상": 0,
        "졸음": 0,
        "딴짓": 0,
        "이탈": 0,
        "기타": 0
    }
    for check in attitude_checks:
        if check.attitude_type in attitude_stats:
            attitude_stats[check.attitude_type] += 1

    # 5. 오늘 벌점 부여
    penalties_today = db.query(models.Penalty).filter(
        models.Penalty.date == today
    ).all()
    penalty_count = len(penalties_today)
    penalty_total = sum(p.points for p in penalties_today)

    # 6. 벌점 10점 이상 학생
    high_penalty_students = db.query(
        models.Student.name,
        models.Student.seat_number,
        func.sum(models.Penalty.points).label('total')
    ).join(models.Penalty).group_by(
        models.Student.id
    ).having(
        func.sum(models.Penalty.points) >= 10
    ).all()

    # 리포트 데이터 구성
    report = {
        "date": today_str,
        "total_students": total_students,
        "attendance": attendance_stats,
        "patrol_count": patrol_count,
        "attitude": attitude_stats,
        "penalty_count": penalty_count,
        "penalty_total_points": penalty_total,
        "high_penalty_students": [
            {"name": s.name, "seat": s.seat_number, "points": s.total}
            for s in high_penalty_students
        ]
    }

    return report


@app.post("/reports/daily/discord")
async def send_daily_report_to_discord(db: Session = Depends(get_db)):
    """일일 리포트를 Discord로 전송"""
    KST = pytz.timezone('Asia/Seoul')
    today = datetime.now(KST).date()
    today_str = today.strftime("%Y년 %m월 %d일")
    weekday_names = ["월", "화", "수", "목", "금", "토", "일"]
    weekday = weekday_names[today.weekday()]

    # 1. 재원 학생 수
    total_students = db.query(models.Student).filter(
        models.Student.status == "재원"
    ).count()

    # 2. 오늘 출석 현황
    attendance_records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.date == today
    ).all()

    attendance_stats = {"자습중": 0, "지각": 0, "결석": 0, "일정중": 0, "학교": 0, "조퇴": 0}
    for record in attendance_records:
        if record.status in attendance_stats:
            attendance_stats[record.status] += 1

    # 3. 오늘 순찰 현황
    patrols_today = db.query(models.Patrol).filter(
        models.Patrol.patrol_date == today
    ).all()
    patrol_count = len(patrols_today)

    # 4. 오늘 학습 태도 체크
    attitude_checks = db.query(models.StudyAttitudeCheck).filter(
        models.StudyAttitudeCheck.check_date == today
    ).all()

    attitude_stats = {"정상": 0, "졸음": 0, "딴짓": 0, "이탈": 0, "기타": 0}
    for check in attitude_checks:
        if check.attitude_type in attitude_stats:
            attitude_stats[check.attitude_type] += 1

    # 5. 오늘 벌점
    penalties_today = db.query(models.Penalty).filter(
        models.Penalty.date == today
    ).all()
    penalty_count = len(penalties_today)
    penalty_total = sum(p.points for p in penalties_today)

    # 문제 학생 목록 (태도 불량)
    problem_students = db.query(models.StudyAttitudeCheck).filter(
        models.StudyAttitudeCheck.check_date == today,
        models.StudyAttitudeCheck.attitude_type.in_(["졸음", "딴짓", "이탈"])
    ).all()

    # Discord 메시지 구성
    attendance_text = f"✅ 자습중: {attendance_stats['자습중']}명\n"
    attendance_text += f"⏰ 지각: {attendance_stats['지각']}명\n"
    attendance_text += f"❌ 결석: {attendance_stats['결석']}명\n"
    attendance_text += f"📅 일정중: {attendance_stats['일정중']}명\n"
    attendance_text += f"🏫 학교: {attendance_stats['학교']}명"

    attitude_text = f"✅ 정상: {attitude_stats['정상']}명\n"
    attitude_text += f"😴 졸음: {attitude_stats['졸음']}명\n"
    attitude_text += f"📱 딴짓: {attitude_stats['딴짓']}명\n"
    attitude_text += f"🚶 이탈: {attitude_stats['이탈']}명"

    # 문제 학생 텍스트
    problem_text = "없음"
    if problem_students:
        problem_list = []
        for check in problem_students[:5]:  # 최대 5명만 표시
            student = db.query(models.Student).filter(
                models.Student.id == check.student_id
            ).first()
            if student:
                problem_list.append(f"• {student.name}({student.seat_number}): {check.attitude_type}")
        if problem_list:
            problem_text = "\n".join(problem_list)
            if len(problem_students) > 5:
                problem_text += f"\n... 외 {len(problem_students) - 5}명"

    fields = [
        {"name": "📊 출석 현황", "value": attendance_text, "inline": True},
        {"name": "👀 학습 태도", "value": attitude_text, "inline": True},
        {"name": "📋 운영 정보", "value": f"순찰 횟수: {patrol_count}회\n벌점 부여: {penalty_count}건 ({penalty_total}점)", "inline": False},
        {"name": "⚠️ 주의 학생", "value": problem_text, "inline": False}
    ]

    result = await send_discord_notification(
        f"📈 {today_str} ({weekday}) 일일 리포트",
        f"오늘 하루의 디턴독학재수학원 운영 현황입니다.\n총 재원생: **{total_students}명**",
        color=0x5865F2,
        fields=fields
    )

    return {"status": "success", "report_date": today_str, "discord_result": result}


# ==================== 문자/카카오톡 발송 API (Solapi) ====================

@app.get("/messages/status")
def get_message_service_status():
    """Solapi 서비스 상태 확인"""
    return {
        "available": message_service.is_available(),
        "message": "Solapi 서비스가 정상적으로 연결되었습니다." if message_service.is_available() else "Solapi 서비스를 사용할 수 없습니다. API 키를 확인해주세요."
    }


@app.get("/messages/balance")
def get_message_balance():
    """잔액 조회"""
    return message_service.get_balance()


@app.post("/messages/send-sms")
def send_sms_message(
    to: str = Body(..., description="수신번호 (01012345678)"),
    text: str = Body(..., description="메시지 내용"),
    from_number: str = Body(None, description="발신번호 (등록된 번호)")
):
    """
    SMS 발송 (80바이트 이하)
    - to: 수신번호 (하이픈 없이)
    - text: 메시지 내용
    - from_number: 발신번호 (Solapi에 등록된 번호, 선택)
    """
    result = message_service.send_sms(to, text, from_number)
    return result


@app.post("/messages/send-lms")
def send_lms_message(
    to: str = Body(..., description="수신번호"),
    text: str = Body(..., description="메시지 내용 (장문)"),
    subject: str = Body(None, description="제목"),
    from_number: str = Body(None, description="발신번호")
):
    """
    LMS 발송 (장문, 2000바이트까지)
    """
    result = message_service.send_lms(to, text, subject, from_number)
    return result


@app.post("/messages/send-to-parent")
def send_message_to_parent(
    student_id: int = Body(..., description="학생 ID"),
    text: str = Body(..., description="메시지 내용"),
    from_number: str = Body(None, description="발신번호"),
    db: Session = Depends(get_db)
):
    """
    학생의 학부모에게 문자 발송
    학생 정보에서 parent_phone 조회 후 발송
    """
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다")

    if not student.parent_phone:
        raise HTTPException(status_code=400, detail="학부모 연락처가 등록되어 있지 않습니다")

    # 메시지에 학생 이름 추가
    full_text = f"[디턴독학재수학원] {student.name} 학생 학부모님께,\n\n{text}"

    # 80바이트 초과 시 LMS로 발송
    if len(full_text.encode('utf-8')) > 80:
        result = message_service.send_lms(student.parent_phone, full_text, "디턴독학재수학원 알림", from_number)
    else:
        result = message_service.send_sms(student.parent_phone, full_text, from_number)

    return {
        "student_name": student.name,
        "parent_phone": student.parent_phone[:3] + "****" + student.parent_phone[-4:],  # 번호 마스킹
        "result": result
    }


@app.post("/messages/send-bulk-to-parents")
def send_bulk_messages_to_parents(
    student_ids: List[int] = Body(..., description="학생 ID 목록"),
    text: str = Body(..., description="메시지 내용"),
    from_number: str = Body(None, description="발신번호"),
    db: Session = Depends(get_db)
):
    """
    여러 학생의 학부모에게 일괄 문자 발송
    """
    students = db.query(models.Student).filter(models.Student.id.in_(student_ids)).all()

    if not students:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다")

    messages = []
    skipped = []

    for student in students:
        if not student.parent_phone:
            skipped.append({"id": student.id, "name": student.name, "reason": "학부모 연락처 없음"})
            continue

        full_text = f"[디턴독학재수학원] {student.name} 학생 학부모님께,\n\n{text}"
        msg = {
            "to": student.parent_phone.replace('-', ''),
            "text": full_text
        }
        if from_number:
            msg["from"] = from_number.replace('-', '')

        # 장문 여부 체크
        if len(full_text.encode('utf-8')) > 80:
            msg["type"] = "LMS"
            msg["subject"] = "디턴독학재수학원 알림"

        messages.append(msg)

    if not messages:
        raise HTTPException(status_code=400, detail="발송할 대상이 없습니다")

    result = message_service.send_bulk(messages)

    return {
        "sent_count": len(messages),
        "skipped": skipped,
        "result": result
    }


@app.post("/messages/send-friendtalk")
def send_kakao_friendtalk(
    to: str = Body(..., description="수신번호 (01012345678)"),
    text: str = Body(..., description="메시지 내용"),
    image_url: str = Body(None, description="이미지 URL (선택)"),
    from_number: str = Body(None, description="발신번호 (친구톡 실패 시 SMS 대체 발송용)")
):
    """
    카카오 친구톡 발송 (채널 친구에게만 발송 가능, 템플릿 불필요)
    """
    return message_service.send_kakao_friendtalk(
        to=to,
        text=text,
        image_url=image_url,
        from_number=from_number
    )


@app.post("/messages/send-friendtalk-to-parent")
def send_friendtalk_to_parent(
    student_id: int = Body(..., description="학생 ID"),
    text: str = Body(..., description="메시지 내용"),
    image_url: str = Body(None, description="이미지 URL (선택)"),
    from_number: str = Body(None, description="발신번호"),
    db: Session = Depends(get_db)
):
    """
    학생의 학부모에게 카카오 친구톡 발송
    """
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다")
    if not student.parent_phone:
        raise HTTPException(status_code=400, detail="학부모 연락처가 등록되어 있지 않습니다")

    full_text = f"[디턴독학재수학원] {student.name} 학생 학부모님께,\n\n{text}"

    result = message_service.send_kakao_friendtalk(
        to=student.parent_phone,
        text=full_text,
        image_url=image_url,
        from_number=from_number
    )

    return {
        "student_name": student.name,
        "parent_phone": student.parent_phone,
        "result": result
    }
