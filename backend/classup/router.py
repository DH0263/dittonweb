"""ClassUp API 라우터 및 스케줄러"""
import asyncio
import os
import logging
from datetime import datetime, date, time as time_type
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
import pytz
import httpx

from database import get_db
import models
from .scraper import ClassUpScraper, AttendanceRecord, has_saved_session, delete_session, SESSION_FILE
from .models import ClassUpAttendance, ClassUpSyncLog
from . import attendance_handler as handler

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/classup", tags=["ClassUp 연동"])

KST = pytz.timezone('Asia/Seoul')
LATE_THRESHOLD = time_type(8, 0)  # 08:00 지각 기준

# 전역 상태 관리
_scraper_instance: Optional[ClassUpScraper] = None
_sync_running = False
_sync_task: Optional[asyncio.Task] = None

# Discord 웹훅 URL (채널 분리)
# 경고 알림 전용 (외출 미복귀, 비정상 외출, 강제퇴장 다음날 알림 등)
DISCORD_WEBHOOK_ALERT = os.getenv(
    "DISCORD_WEBHOOK_ALERT",
    "https://discord.com/api/webhooks/1442370603003809892/xSDV1tl1iQ3omxzOzGjOHTDeJ9669x4qqGqbYSrqQ4NgsdZvHTygu7V7S6rCjfvu8PkU"
)
# 일반 출입 알림 (입장, 외출, 이동 등 - 테스트용, 나중에 삭제 예정)
DISCORD_WEBHOOK_GENERAL = os.getenv(
    "DISCORD_WEBHOOK_GENERAL",
    "https://discord.com/api/webhooks/1444878484995571764/nFgHFYzLRzNf8heFIuxdN-J_gfdjv3CRG-MnqrTMKUlwuLO6lhWOEgOrRcq48y_XnVG_"
)

# 기존 호환성 유지
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", DISCORD_WEBHOOK_ALERT)


async def send_discord_notification(title: str, message: str, color: int = 0x5865F2, fields: list = None, webhook_url: str = None):
    """Discord 웹훅으로 알림 전송

    Args:
        webhook_url: 사용할 웹훅 URL. None이면 기본값(DISCORD_WEBHOOK_ALERT) 사용
    """
    url = webhook_url or DISCORD_WEBHOOK_ALERT
    if not url:
        logger.warning("Discord 웹훅 URL이 설정되지 않았습니다.")
        return None

    embed = {
        "title": title,
        "description": message,
        "color": color,
        "timestamp": datetime.now(KST).isoformat()
    }
    if fields:
        embed["fields"] = fields

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json={"embeds": [embed]}
            )
            return {"status": "success" if response.status_code == 204 else "error", "code": response.status_code}
    except Exception as e:
        logger.error(f"Discord 알림 전송 실패: {e}")
        return {"status": "error", "message": str(e)}


async def process_attendance_record(record: AttendanceRecord, db: Session) -> Optional[ClassUpAttendance]:
    """출입 기록 처리 및 Dittonweb 연동 (전체 상태 타입 지원)"""

    # 상태 파싱 (예: "외출(점심식사)" -> status="외출", detail="점심식사")
    main_status, status_detail = handler.parse_status(record.status)

    # 입장 2회 이상시 재입장으로 처리
    if main_status == "입장":
        today_date = record.record_time.date() if record.record_time else datetime.now(KST).date()
        if handler.has_entry_today(record.student_name, today_date, db):
            main_status = "재입장"
            logger.info(f"{record.student_name}: 오늘 입장 기록 있음 -> 재입장으로 변경")

    # 중복 체크 (같은 학생, 같은 상태, 같은 시간)
    existing = db.query(ClassUpAttendance).filter(
        ClassUpAttendance.student_name == record.student_name,
        ClassUpAttendance.status == main_status,
        ClassUpAttendance.record_time == record.record_time
    ).first()

    if existing:
        return None  # 이미 존재하는 기록

    # 이름으로 Dittonweb 학생 매칭
    student = db.query(models.Student).filter(
        models.Student.name == record.student_name,
        models.Student.status == "재원"
    ).first()
    student_id = student.id if student else None

    # 지각 여부 판단 (입장만)
    is_late = False
    if main_status == "입장":
        record_time = record.record_time
        if record_time.tzinfo is None:
            record_time = KST.localize(record_time)
        is_late = record_time.time() > LATE_THRESHOLD

    # 예상 복귀 시간 계산 (외출/이동)
    expected_return = handler.calculate_expected_return(
        record.record_time, main_status, status_detail, student_id, db
    )

    # 일정 유효성 검증
    is_schedule_valid = None
    validation_reason = ""
    if main_status == "외출":
        is_schedule_valid, validation_reason = handler.validate_outing_schedule(
            record.record_time, status_detail, student_id, db
        )
    elif main_status == "퇴장":
        is_schedule_valid, validation_reason = handler.validate_exit(
            record.record_time, student_id, db
        )

    # ClassUp 기록 저장
    classup_record = ClassUpAttendance(
        student_name=record.student_name,
        phone_number=record.phone_number,
        available_time=record.available_time,
        status=main_status,
        status_detail=status_detail,
        record_time=record.record_time,
        local_student_id=student_id,
        is_late=is_late,
        synced_to_attendance=False,
        discord_notified=False,
        expected_return_time=expected_return,
        is_schedule_valid=is_schedule_valid
    )
    db.add(classup_record)
    db.commit()
    db.refresh(classup_record)

    # Dittonweb 출석 기록 연동
    today = datetime.now(KST).date()

    if student:
        existing_attendance = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.student_id == student.id,
            models.AttendanceRecord.date == today
        ).first()

        if main_status == "입장":
            # 첫 입장: 출석 기록 생성
            if not existing_attendance:
                attendance_status = "지각" if is_late else "자습중"
                new_attendance = models.AttendanceRecord(
                    student_id=student.id,
                    date=today,
                    status=attendance_status,
                    check_in_time=record.record_time.time() if record.record_time else None
                )
                db.add(new_attendance)
                classup_record.synced_to_attendance = True
                db.commit()

        elif main_status == "재입장":
            # 재입장: 상태를 "자습중"으로 변경, 외출 기록과 연결
            outing_record = handler.link_return_to_outing(classup_record, db)

            # 늦게 복귀했는지 체크
            if outing_record and outing_record.expected_return_time:
                return_time = record.record_time
                if return_time.tzinfo is None:
                    return_time = KST.localize(return_time)
                expected_time = outing_record.expected_return_time
                if expected_time.tzinfo is None:
                    expected_time = KST.localize(expected_time)

                if return_time > expected_time:
                    # 늦게 복귀 - 지연 시간 계산
                    delay_minutes = int((return_time - expected_time).total_seconds() / 60)
                    classup_record.is_late = True  # 복귀 지각 표시

                    # 늦은 복귀 알림 전송
                    await send_discord_notification(
                        title="⏰ 늦은 복귀 알림",
                        message=f"**{record.student_name}** ({student.seat_number if student else '미등록'}) 학생이 예정보다 늦게 복귀했습니다.",
                        color=0xFFA500,  # 주황색
                        fields=[
                            {"name": "학생", "value": record.student_name, "inline": True},
                            {"name": "외출 유형", "value": outing_record.status_detail or outing_record.status, "inline": True},
                            {"name": "예상 복귀", "value": expected_time.strftime("%H:%M"), "inline": True},
                            {"name": "실제 복귀", "value": return_time.strftime("%H:%M"), "inline": True},
                            {"name": "지연 시간", "value": f"{delay_minutes}분", "inline": True}
                        ],
                        webhook_url=DISCORD_WEBHOOK_ALERT
                    )
                    db.commit()

            if existing_attendance and existing_attendance.status in ["외출", "이동", "일정중"]:
                existing_attendance.status = "자습중"
                db.commit()

        elif main_status in ["외출", "이동"]:
            # 외출/이동: 상태 변경
            if existing_attendance:
                existing_attendance.status = "일정중"
                db.commit()

        elif main_status in ["퇴장", "강제퇴장"]:
            # 퇴장: 하원 처리
            if existing_attendance:
                existing_attendance.check_out_time = record.record_time.time() if record.record_time else None
                db.commit()

    # Discord 알림 전송 (확장된 버전)
    await send_discord_alert_extended(classup_record, student, validation_reason, db)

    return classup_record


async def send_discord_alert(record: ClassUpAttendance, student, db: Session):
    """출입 기록에 대한 Discord 알림"""
    if record.discord_notified:
        return

    student_name = record.student_name
    seat_number = student.seat_number if student else "미등록"

    if record.status == "입장":
        if record.is_late:
            # 지각 알림 (빨간색)
            record_time = record.record_time
            if record_time.tzinfo is None:
                record_time = KST.localize(record_time)
            late_minutes = (record_time.hour * 60 + record_time.minute) - (8 * 60)  # 08:00 기준

            await send_discord_notification(
                title="지각 알림",
                message=f"**{student_name}** ({seat_number}) 학생이 **{late_minutes}분** 지각했습니다.",
                color=0xFF0000,  # 빨간색
                fields=[
                    {"name": "학생", "value": student_name, "inline": True},
                    {"name": "좌석", "value": seat_number, "inline": True},
                    {"name": "입장 시간", "value": record_time.strftime("%H:%M:%S"), "inline": True}
                ]
            )
        else:
            # 정상 입장 알림 (녹색)
            await send_discord_notification(
                title="입장 알림",
                message=f"**{student_name}** ({seat_number}) 학생이 입장했습니다.",
                color=0x00FF00,  # 녹색
                fields=[
                    {"name": "학생", "value": student_name, "inline": True},
                    {"name": "좌석", "value": seat_number, "inline": True},
                    {"name": "입장 시간", "value": record.record_time.strftime("%H:%M:%S"), "inline": True}
                ]
            )

    elif record.status in ["퇴장", "강제퇴장"]:
        # 퇴장 알림 (주황색)
        color = 0xFFA500 if record.status == "퇴장" else 0xFF4500
        await send_discord_notification(
            title="퇴장 알림",
            message=f"**{student_name}** ({seat_number}) 학생이 {record.status}했습니다.",
            color=color,
            fields=[
                {"name": "학생", "value": student_name, "inline": True},
                {"name": "좌석", "value": seat_number, "inline": True},
                {"name": "퇴장 시간", "value": record.record_time.strftime("%H:%M:%S"), "inline": True}
            ]
        )

    # 알림 전송 완료 표시
    record.discord_notified = True
    db.commit()


async def send_discord_alert_extended(record: ClassUpAttendance, student, validation_reason: str, db: Session):
    """확장된 Discord 알림 - 모든 상태 타입 지원

    웹훅 채널 분리:
    - DISCORD_WEBHOOK_ALERT (경고): 지각, 조기퇴장, 비정상 외출, 미복귀 등
    - DISCORD_WEBHOOK_GENERAL (일반): 입장, 정상 외출/이동 (테스트용)
    - 강제퇴장: 즉시 알림 생략 (다음날 오전 8시에만 알림)
    """
    if record.discord_notified:
        return

    student_name = record.student_name
    seat_number = student.seat_number if student else "미등록"
    record_time = record.record_time
    if record_time.tzinfo is None:
        record_time = KST.localize(record_time)
    time_str = record_time.strftime("%H:%M:%S")

    status = record.status
    detail = record.status_detail or ""

    # 색상 정의
    COLORS = {
        "success": 0x00FF00,   # 녹색
        "warning": 0xFFA500,   # 주황색
        "danger": 0xFF0000,    # 빨간색
        "info": 0x5865F2,      # 파란색
        "purple": 0x9B59B6,    # 보라색
    }

    # ===== 입장 =====
    if status == "입장":
        if record.is_late:
            # 지각 -> 경고 채널
            late_minutes = (record_time.hour * 60 + record_time.minute) - (8 * 60)
            await send_discord_notification(
                title="⚠️ 지각 알림",
                message=f"**{student_name}** ({seat_number}) 학생이 **{late_minutes}분** 지각했습니다.",
                color=COLORS["danger"],
                fields=[
                    {"name": "학생", "value": student_name, "inline": True},
                    {"name": "좌석", "value": seat_number, "inline": True},
                    {"name": "입장 시간", "value": time_str, "inline": True}
                ],
                webhook_url=DISCORD_WEBHOOK_ALERT
            )
        else:
            # 정상 입장 -> 일반 채널
            await send_discord_notification(
                title="✅ 입장 알림",
                message=f"**{student_name}** ({seat_number}) 학생이 입장했습니다.",
                color=COLORS["success"],
                fields=[
                    {"name": "학생", "value": student_name, "inline": True},
                    {"name": "좌석", "value": seat_number, "inline": True},
                    {"name": "입장 시간", "value": time_str, "inline": True}
                ],
                webhook_url=DISCORD_WEBHOOK_GENERAL
            )

    # ===== 재입장 =====
    elif status == "재입장":
        # 재입장 -> 일반 채널
        await send_discord_notification(
            title="🔄 재입장 알림",
            message=f"**{student_name}** ({seat_number}) 학생이 복귀했습니다.",
            color=COLORS["info"],
            fields=[
                {"name": "학생", "value": student_name, "inline": True},
                {"name": "좌석", "value": seat_number, "inline": True},
                {"name": "복귀 시간", "value": time_str, "inline": True}
            ],
            webhook_url=DISCORD_WEBHOOK_GENERAL
        )

    # ===== 퇴장 =====
    elif status == "퇴장":
        # 정기외출 없이 22시 전 퇴장 = 경고 채널
        if record.is_schedule_valid is False:
            await send_discord_notification(
                title="🚨 조기 퇴장 경고",
                message=f"**{student_name}** ({seat_number}) 학생이 정규 시간 전에 퇴장했습니다!",
                color=COLORS["danger"],
                fields=[
                    {"name": "학생", "value": student_name, "inline": True},
                    {"name": "좌석", "value": seat_number, "inline": True},
                    {"name": "퇴장 시간", "value": time_str, "inline": True},
                    {"name": "⚠️ 사유", "value": validation_reason, "inline": False}
                ],
                webhook_url=DISCORD_WEBHOOK_ALERT
            )
        else:
            # 정상 퇴장 -> 일반 채널
            await send_discord_notification(
                title="👋 퇴장 알림",
                message=f"**{student_name}** ({seat_number}) 학생이 퇴장했습니다.",
                color=COLORS["warning"],
                fields=[
                    {"name": "학생", "value": student_name, "inline": True},
                    {"name": "좌석", "value": seat_number, "inline": True},
                    {"name": "퇴장 시간", "value": time_str, "inline": True}
                ],
                webhook_url=DISCORD_WEBHOOK_GENERAL
            )

    # ===== 강제퇴장 =====
    elif status == "강제퇴장":
        # 강제퇴장: 즉시 알림 생략, 다음날 오전 8시에만 알림
        # (send_forced_exit_morning_alert 함수에서 처리)
        logger.info(f"강제퇴장 기록: {student_name} - 다음날 오전 알림 예정")
        pass  # 즉시 알림 생략

    # ===== 외출 =====
    elif status == "외출":
        # 일정 유효하지 않으면 경고 채널
        if record.is_schedule_valid is False:
            await send_discord_notification(
                title="⚠️ 비정상 외출 알림",
                message=f"**{student_name}** ({seat_number}) 학생이 비정상 외출했습니다!",
                color=COLORS["danger"],
                fields=[
                    {"name": "학생", "value": student_name, "inline": True},
                    {"name": "외출 유형", "value": detail, "inline": True},
                    {"name": "외출 시간", "value": time_str, "inline": True},
                    {"name": "⚠️ 사유", "value": validation_reason, "inline": False}
                ],
                webhook_url=DISCORD_WEBHOOK_ALERT
            )
        else:
            # 정상 외출 -> 일반 채널
            expected_return = record.expected_return_time
            return_str = expected_return.strftime("%H:%M") if expected_return else "미정"
            await send_discord_notification(
                title="🚶 외출 알림",
                message=f"**{student_name}** ({seat_number}) 학생이 외출했습니다.",
                color=COLORS["info"],
                fields=[
                    {"name": "학생", "value": student_name, "inline": True},
                    {"name": "외출 유형", "value": detail, "inline": True},
                    {"name": "외출 시간", "value": time_str, "inline": True},
                    {"name": "복귀 예정", "value": return_str, "inline": True}
                ],
                webhook_url=DISCORD_WEBHOOK_GENERAL
            )

    # ===== 이동 =====
    elif status == "이동":
        # 이동 -> 일반 채널
        expected_return = record.expected_return_time
        return_str = expected_return.strftime("%H:%M") if expected_return else "미정"
        await send_discord_notification(
            title="🏢 이동 알림",
            message=f"**{student_name}** ({seat_number}) 학생이 다른 층으로 이동했습니다.",
            color=COLORS["purple"],
            fields=[
                {"name": "학생", "value": student_name, "inline": True},
                {"name": "이동 목적", "value": detail, "inline": True},
                {"name": "이동 시간", "value": time_str, "inline": True},
                {"name": "복귀 예정", "value": return_str, "inline": True}
            ],
            webhook_url=DISCORD_WEBHOOK_GENERAL
        )

    # 알림 전송 완료 표시
    record.discord_notified = True
    db.commit()


async def check_missing_returns(db: Session):
    """복귀 미확인 학생 체크 및 알림 (경고 채널)"""
    now = datetime.now(KST)

    # 오늘 날짜의 외출/이동 기록 중 복귀 안 된 것 조회
    pending_returns = db.query(ClassUpAttendance).filter(
        ClassUpAttendance.status.in_(["외출", "이동"]),
        ClassUpAttendance.return_record_id == None,  # 복귀 안됨
        ClassUpAttendance.return_alert_sent == False,  # 알림 안 보냄
        ClassUpAttendance.expected_return_time != None,  # 예상 복귀 시간 있음
        ClassUpAttendance.expected_return_time < now  # 예상 시간 지남
    ).all()

    for record in pending_returns:
        student = db.query(models.Student).filter(
            models.Student.id == record.local_student_id
        ).first() if record.local_student_id else None

        student_name = record.student_name
        seat_number = student.seat_number if student else "미등록"
        detail = record.status_detail or record.status

        # 지연 시간 계산
        delay_minutes = int((now - record.expected_return_time).total_seconds() / 60)

        # 미복귀 알림 -> 경고 채널
        await send_discord_notification(
            title="🚨 복귀 미확인 알림",
            message=f"**{student_name}** ({seat_number}) 학생이 아직 복귀하지 않았습니다!",
            color=0xFF0000,
            fields=[
                {"name": "학생", "value": student_name, "inline": True},
                {"name": "외출/이동 유형", "value": detail, "inline": True},
                {"name": "예상 복귀 시간", "value": record.expected_return_time.strftime("%H:%M"), "inline": True},
                {"name": "지연 시간", "value": f"{delay_minutes}분", "inline": True}
            ],
            webhook_url=DISCORD_WEBHOOK_ALERT
        )

        # 알림 전송 완료 표시
        record.return_alert_sent = True
        db.commit()

    return len(pending_returns)


async def send_forced_exit_morning_alert(db: Session):
    """강제퇴장 다음날 아침 알림 - 매일 09:00에 실행 (경고 채널)"""
    from datetime import timedelta

    yesterday = (datetime.now(KST) - timedelta(days=1)).date()
    start_of_yesterday = datetime.combine(yesterday, time_type(0, 0)).replace(tzinfo=KST)
    end_of_yesterday = datetime.combine(yesterday, time_type(23, 59, 59)).replace(tzinfo=KST)

    # 어제의 강제퇴장 기록 조회
    forced_exits = db.query(ClassUpAttendance).filter(
        ClassUpAttendance.status == "강제퇴장",
        ClassUpAttendance.record_time >= start_of_yesterday,
        ClassUpAttendance.record_time <= end_of_yesterday
    ).all()

    if not forced_exits:
        return 0

    # 학생 목록 생성
    student_list = []
    for record in forced_exits:
        student = db.query(models.Student).filter(
            models.Student.id == record.local_student_id
        ).first() if record.local_student_id else None

        seat_number = student.seat_number if student else "미등록"
        student_list.append(f"• {record.student_name} ({seat_number})")

    # Discord 알림 전송 (경고 채널)
    await send_discord_notification(
        title="📋 어제 강제퇴장 학생 목록",
        message=f"어제({yesterday.strftime('%Y-%m-%d')}) 강제퇴장 처리된 학생들입니다.\n**경고 조치가 필요합니다.**",
        color=0xFF4500,
        fields=[
            {"name": f"총 {len(forced_exits)}명", "value": "\n".join(student_list), "inline": False},
            {"name": "⚠️ 조치 사항", "value": "퇴장 버튼 미클릭으로 인한 강제퇴장입니다.\n해당 학생들에게 경고를 전달해주세요.", "inline": False}
        ],
        webhook_url=DISCORD_WEBHOOK_ALERT
    )

    return len(forced_exits)


def send_forced_exit_morning_alert_sync():
    """강제퇴장 알림 동기 버전 (스케줄러용)"""
    import asyncio
    from database import SessionLocal

    db = SessionLocal()
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        count = loop.run_until_complete(send_forced_exit_morning_alert(db))
        if count > 0:
            logger.info(f"강제퇴장 아침 알림 전송: {count}명")
    except Exception as e:
        logger.error(f"강제퇴장 알림 오류: {e}")
    finally:
        db.close()


def convert_late_to_studying_sync():
    """지각 학생을 자습중으로 변경 (교시 시작 시 실행)

    지각 처리 규칙:
    - 지각은 해당 교시 동안만 "지각"으로 표시
    - 다음 교시가 시작되면 "자습중"으로 자동 변경
    """
    from database import SessionLocal

    db = SessionLocal()
    try:
        today = datetime.now(KST).date()

        # 오늘 지각 상태인 출석 기록 조회
        late_records = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.date == today,
            models.AttendanceRecord.status == "지각"
        ).all()

        count = 0
        for record in late_records:
            record.status = "자습중"
            count += 1

        if count > 0:
            db.commit()
            logger.info(f"지각 → 자습중 변환: {count}명")

    except Exception as e:
        logger.error(f"지각 상태 변환 오류: {e}")
    finally:
        db.close()


async def sync_classup_data_fast(db: Session):
    """클래스업 데이터 동기화 (Worker 결과 파일 읽기 - 빠름)"""
    import json
    from pathlib import Path

    result_file = Path(__file__).parent / "scrape_result.json"

    # Worker가 저장한 결과 파일 읽기
    if not result_file.exists():
        raise Exception("Worker 결과 파일 없음 - Worker가 실행 중인지 확인하세요")

    with open(result_file, 'r', encoding='utf-8') as f:
        result = json.load(f)

    if not result.get("success"):
        raise Exception(result.get("error", "스크래핑 실패"))

    # AttendanceRecord 객체로 변환
    new_count = 0
    for r in result["records"]:
        record = AttendanceRecord(
            student_name=r["student_name"],
            phone_number=r.get("phone_number", ""),
            available_time=r.get("available_time", ""),
            status=r["status"],
            record_time=datetime.fromisoformat(r["record_time"]) if r.get("record_time") else None
        )
        processed = await process_attendance_record(record, db)
        if processed:
            new_count += 1

    # 동기화 로그 저장
    sync_log = ClassUpSyncLog(
        records_fetched=len(result["records"]),
        new_records=new_count,
        status="success"
    )
    db.add(sync_log)
    db.commit()

    return {"fetched": len(result["records"]), "new": new_count}


async def sync_classup_data(db: Session):
    """클래스업 데이터 동기화 (호환성 유지)"""
    return await sync_classup_data_fast(db)


_worker_process = None

async def continuous_sync_loop(db_session_factory):
    """3초 간격 연속 동기화 루프 (Worker 프로세스 - 매우 빠름)"""
    global _sync_running, _worker_process
    import subprocess
    import sys
    from pathlib import Path
    import json

    logger.info("클래스업 연속 동기화 시작 (Worker 모드)...")

    # Worker 프로세스 시작
    script_path = Path(__file__).parent / "_fast_worker.py"
    status_file = Path(__file__).parent / "worker_status.json"
    command_file = Path(__file__).parent / "worker_command.json"

    try:
        _worker_process = subprocess.Popen(
            [sys.executable, str(script_path)],
            cwd=str(Path(__file__).parent),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
        )
        logger.info(f"Worker 프로세스 시작됨 (PID: {_worker_process.pid})")

        # Worker가 준비될 때까지 대기
        for _ in range(30):  # 최대 30초 대기
            await asyncio.sleep(1)
            if status_file.exists():
                with open(status_file, 'r', encoding='utf-8') as f:
                    status = json.load(f)
                if status.get("status") == "running":
                    logger.info("Worker 준비 완료")
                    break
                elif status.get("status") == "error":
                    raise Exception(status.get("message", "Worker 시작 실패"))
        else:
            raise Exception("Worker 시작 타임아웃")

    except Exception as e:
        logger.error(f"Worker 시작 실패: {e}")
        _sync_running = False
        return

    # 메인 동기화 루프 - Worker가 2초마다 스크래핑, 우리는 3초마다 DB 저장
    while _sync_running:
        try:
            # Worker 프로세스 상태 확인
            if _worker_process.poll() is not None:
                logger.error("Worker 프로세스 종료됨")
                break

            # DB에 새 데이터 저장
            db = db_session_factory()
            try:
                result = await sync_classup_data_fast(db)
                logger.info(f"동기화 완료: {result}")

                # 복귀 미확인 학생 체크 (30초마다 한 번씩)
                missing_count = await check_missing_returns(db)
                if missing_count > 0:
                    logger.info(f"복귀 미확인 알림 전송: {missing_count}명")
            finally:
                db.close()

        except Exception as e:
            logger.error(f"동기화 오류: {e}")

        # 3초 대기 (Worker가 2초마다 스크래핑하므로 충분)
        await asyncio.sleep(3)

    # Worker 종료
    if _worker_process and _worker_process.poll() is None:
        # 종료 명령 전송
        with open(command_file, 'w', encoding='utf-8') as f:
            json.dump({"action": "stop"}, f)
        await asyncio.sleep(2)

        # 강제 종료
        if _worker_process.poll() is None:
            _worker_process.terminate()
            await asyncio.sleep(1)
            if _worker_process.poll() is None:
                _worker_process.kill()

    logger.info("클래스업 연속 동기화 종료")


# ============ API 엔드포인트 ============

@router.get("/status")
async def get_sync_status():
    """동기화 상태 확인"""
    import json
    from pathlib import Path

    status_file = Path(__file__).parent / "worker_status.json"
    worker_active = False

    if status_file.exists():
        try:
            with open(status_file, 'r', encoding='utf-8') as f:
                worker_status = json.load(f)
            worker_active = worker_status.get("status") == "running"
        except:
            pass

    return {
        "running": _sync_running,
        "logged_in": worker_active or has_saved_session(),
        "browser_active": worker_active,
        "session_saved": has_saved_session(),
        "session_file": str(SESSION_FILE) if has_saved_session() else None
    }


@router.post("/manual-login")
async def trigger_manual_login():
    """
    수동 로그인 시작 (브라우저 창 열림)
    터미널에서 실행: cd backend && python -m classup.scraper
    """
    return {
        "status": "info",
        "message": "수동 로그인은 터미널에서 실행해주세요.",
        "command": "cd c:\\Dittonweb\\backend && python -m classup.scraper",
        "description": "브라우저 창이 열리면 전화번호로 로그인하세요. 로그인 완료 후 세션이 자동 저장됩니다."
    }


@router.delete("/session")
async def clear_session():
    """저장된 세션 삭제"""
    if delete_session():
        return {"status": "success", "message": "세션이 삭제되었습니다."}
    return {"status": "not_found", "message": "저장된 세션이 없습니다."}


@router.post("/start")
async def start_sync(background_tasks: BackgroundTasks):
    """클래스업 동기화 시작"""
    global _sync_running, _sync_task

    if _sync_running:
        return {"status": "already_running", "message": "동기화가 이미 실행 중입니다."}

    # 세션 확인
    if not has_saved_session():
        return {
            "status": "error",
            "message": "저장된 로그인 세션이 없습니다. 아래에서 로그인해주세요.",
        }

    _sync_running = True

    # 백그라운드에서 동기화 루프 시작
    from database import SessionLocal
    _sync_task = asyncio.create_task(continuous_sync_loop(SessionLocal))

    return {"status": "started", "message": "클래스업 동기화가 시작되었습니다."}


@router.post("/stop")
async def stop_sync():
    """클래스업 동기화 중지"""
    global _sync_running, _sync_task, _worker_process
    import json
    from pathlib import Path

    if not _sync_running:
        return {"status": "not_running", "message": "동기화가 실행 중이 아닙니다."}

    _sync_running = False

    if _sync_task:
        _sync_task.cancel()
        _sync_task = None

    # Worker 프로세스 종료
    command_file = Path(__file__).parent / "worker_command.json"
    if _worker_process and _worker_process.poll() is None:
        # 종료 명령 전송
        with open(command_file, 'w', encoding='utf-8') as f:
            json.dump({"action": "stop"}, f)
        await asyncio.sleep(2)

        # 강제 종료
        if _worker_process.poll() is None:
            _worker_process.terminate()

    return {"status": "stopped", "message": "클래스업 동기화가 중지되었습니다."}


@router.post("/sync-once")
async def sync_once(db: Session = Depends(get_db)):
    """수동으로 1회 동기화"""
    try:
        result = await sync_classup_data(db)
        return {"status": "success", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/records")
async def get_records(
    target_date: date = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """클래스업 출입 기록 조회"""
    query = db.query(ClassUpAttendance)

    if target_date:
        query = query.filter(func.date(ClassUpAttendance.record_time) == target_date)

    records = query.order_by(ClassUpAttendance.record_time.desc()).limit(limit).all()

    return [{
        "id": r.id,
        "student_name": r.student_name,
        "phone_number": r.phone_number,
        "status": r.status,
        "record_time": r.record_time.isoformat() if r.record_time else None,
        "is_late": r.is_late,
        "synced": r.synced_to_attendance,
        "local_student_id": r.local_student_id
    } for r in records]


@router.get("/logs")
async def get_sync_logs(limit: int = 20, db: Session = Depends(get_db)):
    """동기화 로그 조회"""
    logs = db.query(ClassUpSyncLog).order_by(
        ClassUpSyncLog.sync_time.desc()
    ).limit(limit).all()

    return [{
        "id": l.id,
        "sync_time": l.sync_time.isoformat() if l.sync_time else None,
        "records_fetched": l.records_fetched,
        "new_records": l.new_records,
        "status": l.status,
        "errors": l.errors
    } for l in logs]


@router.get("/today-summary")
async def get_today_summary(db: Session = Depends(get_db)):
    """오늘 출입 요약"""
    today = datetime.now(KST).date()

    # 오늘 입장 기록
    entry_count = db.query(ClassUpAttendance).filter(
        func.date(ClassUpAttendance.record_time) == today,
        ClassUpAttendance.status == "입장"
    ).count()

    # 오늘 퇴장 기록
    exit_count = db.query(ClassUpAttendance).filter(
        func.date(ClassUpAttendance.record_time) == today,
        ClassUpAttendance.status.in_(["퇴장", "강제퇴장"])
    ).count()

    # 오늘 지각 학생
    late_count = db.query(ClassUpAttendance).filter(
        func.date(ClassUpAttendance.record_time) == today,
        ClassUpAttendance.status == "입장",
        ClassUpAttendance.is_late == True
    ).count()

    return {
        "date": today.isoformat(),
        "entry_count": entry_count,
        "exit_count": exit_count,
        "late_count": late_count
    }


# ============ 웹 로그인 API ============

LOGIN_STATE_FILE = SESSION_FILE.parent / "login_state.json"


def get_login_state():
    """현재 로그인 진행 상태 조회"""
    if LOGIN_STATE_FILE.exists():
        with open(LOGIN_STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None


def clear_login_state():
    """로그인 상태 초기화"""
    if LOGIN_STATE_FILE.exists():
        LOGIN_STATE_FILE.unlink()


import json
import concurrent.futures
import subprocess
import sys
from pathlib import Path


async def run_login_worker(action: str, param: str):
    """로그인 워커를 ThreadPoolExecutor로 실행"""
    script_path = Path(__file__).parent / "_login_worker.py"
    python_exe = sys.executable
    cwd = str(Path(__file__).parent)

    def run_worker():
        result = subprocess.run(
            [python_exe, str(script_path), action, param],
            capture_output=True,
            cwd=cwd,
            timeout=60
        )
        return result

    loop = asyncio.get_event_loop()
    with concurrent.futures.ThreadPoolExecutor() as executor:
        result = await loop.run_in_executor(executor, run_worker)

    stdout_str = result.stdout.decode('utf-8', errors='ignore')
    stderr_str = result.stderr.decode('utf-8', errors='ignore')

    logger.info(f"Login worker stdout: {stdout_str[:500]}")
    if stderr_str:
        logger.info(f"Login worker stderr: {stderr_str[:500]}")

    return result.returncode == 0, stdout_str, stderr_str


@router.get("/login/status")
async def get_login_status():
    """웹 로그인 진행 상태 확인"""
    state = get_login_state()
    session_exists = has_saved_session()

    if session_exists:
        return {
            "logged_in": True,
            "login_step": None,
            "message": "로그인되어 있습니다."
        }

    if state:
        return {
            "logged_in": False,
            "login_step": state.get("step"),
            "status": state.get("status"),
            "message": state.get("message")
        }

    return {
        "logged_in": False,
        "login_step": None,
        "message": "로그인이 필요합니다."
    }


@router.post("/login/send-code")
async def send_verification_code(phone_number: str):
    """전화번호로 인증번호 전송"""
    # 기존 로그인 상태 초기화
    clear_login_state()

    # 전화번호 정제
    phone_number = phone_number.replace("-", "").replace(" ", "")

    logger.info(f"인증번호 전송 요청: {phone_number}")

    success, stdout, stderr = await run_login_worker("start", phone_number)

    state = get_login_state()

    if success and state and state.get("status") == "awaiting_code":
        return {
            "status": "success",
            "message": "인증번호가 전송되었습니다. SMS를 확인해주세요.",
            "next_step": "verify_code"
        }
    else:
        error_msg = state.get("message") if state else "인증번호 전송에 실패했습니다."
        return {
            "status": "error",
            "message": error_msg,
            "details": stderr[:200] if stderr else None
        }


@router.post("/login/verify")
async def verify_login_code(verification_code: str):
    """인증번호 확인 및 로그인 완료"""
    state = get_login_state()

    if not state or state.get("status") != "awaiting_code":
        return {
            "status": "error",
            "message": "먼저 전화번호를 입력하고 인증번호를 요청해주세요."
        }

    logger.info(f"인증번호 확인 요청: {verification_code}")

    success, stdout, stderr = await run_login_worker("verify", verification_code)

    # 결과 확인
    if has_saved_session():
        clear_login_state()
        return {
            "status": "success",
            "message": "로그인이 완료되었습니다! 이제 동기화를 시작할 수 있습니다.",
            "logged_in": True
        }
    else:
        state = get_login_state()
        error_msg = state.get("message") if state else "로그인에 실패했습니다."
        return {
            "status": "error",
            "message": error_msg,
            "logged_in": False
        }


@router.post("/login/cancel")
async def cancel_login():
    """로그인 프로세스 취소"""
    clear_login_state()
    return {"status": "success", "message": "로그인이 취소되었습니다."}
