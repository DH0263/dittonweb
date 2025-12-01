"""AI 채팅 API 라우터"""
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
import pytz
import json

from database import get_db
import models
from .models import ChatSession, ChatMessage, DailyUsage
from .gemini_client import gemini_client

router = APIRouter(prefix="/ai", tags=["AI Chat"])
KST = pytz.timezone('Asia/Seoul')

# 일일 질문 제한
DAILY_QUESTION_LIMIT = 10


# === Pydantic 스키마 ===

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[int] = None
    student_id: Optional[int] = None  # 나중에 로그인 연동
    image_base64: Optional[str] = None  # Base64 이미지


class ChatResponse(BaseModel):
    session_id: int
    message_id: int
    response: str
    remaining_questions: int


class SessionInfo(BaseModel):
    id: int
    title: str
    created_at: datetime
    message_count: int


class MessageInfo(BaseModel):
    id: int
    role: str
    content: str
    has_image: bool
    created_at: datetime


# === 헬퍼 함수 ===

def get_or_create_daily_usage(db: Session, student_id: Optional[int], today: date) -> DailyUsage:
    """일일 사용량 조회 또는 생성"""
    usage = db.query(DailyUsage).filter(
        DailyUsage.student_id == student_id,
        DailyUsage.date == today
    ).first()

    if not usage:
        usage = DailyUsage(student_id=student_id, date=today, question_count=0)
        db.add(usage)
        db.commit()
        db.refresh(usage)

    return usage


def check_daily_limit(db: Session, student_id: Optional[int]) -> tuple[bool, int]:
    """일일 제한 확인 - (허용 여부, 남은 횟수)"""
    today = datetime.now(KST).date()
    usage = get_or_create_daily_usage(db, student_id, today)
    remaining = DAILY_QUESTION_LIMIT - usage.question_count
    return remaining > 0, max(0, remaining)


def increment_usage(db: Session, student_id: Optional[int]):
    """사용량 증가"""
    today = datetime.now(KST).date()
    usage = get_or_create_daily_usage(db, student_id, today)
    usage.question_count += 1
    db.commit()


def get_session_history(db: Session, session_id: int, limit: int = 20) -> List[dict]:
    """세션의 대화 히스토리 조회 (최근 N개)"""
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.desc()).limit(limit).all()

    # 시간순으로 정렬
    messages = list(reversed(messages))

    return [
        {"role": msg.role, "content": msg.content}
        for msg in messages
    ]


def generate_session_title(message: str) -> str:
    """첫 메시지에서 세션 제목 생성"""
    # 이미지 관련 요청이면
    if "이미지" in message or "사진" in message or "문제" in message:
        return "수학 문제 질문"

    # 메시지가 너무 길면 자르기
    if len(message) > 30:
        return message[:30] + "..."

    return message or "새 대화"


# === API 엔드포인트 ===

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """
    AI 채팅 (수학 문제 질의응답)

    - 새 세션: session_id 없이 호출
    - 기존 세션: session_id 포함하여 호출
    - 이미지 첨부: image_base64에 Base64 인코딩된 이미지 포함
    """
    student_id = request.student_id

    # 일일 제한 확인
    allowed, remaining = check_daily_limit(db, student_id)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"오늘의 질문 횟수를 모두 사용했습니다. (일일 {DAILY_QUESTION_LIMIT}회 제한)"
        )

    # 세션 조회 또는 생성
    if request.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == request.session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
    else:
        # 새 세션 생성
        title = generate_session_title(request.message)
        session = ChatSession(student_id=student_id, title=title)
        db.add(session)
        db.commit()
        db.refresh(session)

    # 대화 히스토리 조회
    history = get_session_history(db, session.id)

    # 사용자 메시지 저장
    user_message = ChatMessage(
        session_id=session.id,
        role="user",
        content=request.message,
        image_data=request.image_base64[:100] if request.image_base64 else None  # 미리보기만 저장
    )
    db.add(user_message)
    db.commit()

    # AI 응답 생성
    ai_response = await gemini_client.chat(
        message=request.message,
        history=history,
        image_base64=request.image_base64
    )

    # AI 응답 저장
    assistant_message = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=ai_response
    )
    db.add(assistant_message)

    # 세션 업데이트 시간 갱신
    session.updated_at = datetime.now(KST)

    # 사용량 증가
    increment_usage(db, student_id)
    _, remaining = check_daily_limit(db, student_id)

    db.commit()
    db.refresh(assistant_message)

    return ChatResponse(
        session_id=session.id,
        message_id=assistant_message.id,
        response=ai_response,
        remaining_questions=remaining
    )


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest, db: Session = Depends(get_db)):
    """
    스트리밍 AI 채팅 (타이핑 효과)

    Server-Sent Events (SSE) 형식으로 응답
    """
    student_id = request.student_id

    # 일일 제한 확인
    allowed, remaining = check_daily_limit(db, student_id)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"오늘의 질문 횟수를 모두 사용했습니다."
        )

    # 세션 처리
    if request.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == request.session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
    else:
        title = generate_session_title(request.message)
        session = ChatSession(student_id=student_id, title=title)
        db.add(session)
        db.commit()
        db.refresh(session)

    # 대화 히스토리
    history = get_session_history(db, session.id)

    # 사용자 메시지 저장
    user_message = ChatMessage(
        session_id=session.id,
        role="user",
        content=request.message,
        image_data=request.image_base64[:100] if request.image_base64 else None
    )
    db.add(user_message)
    db.commit()

    async def generate():
        full_response = ""

        # 세션 ID 먼저 전송
        yield f"data: {json.dumps({'type': 'session', 'session_id': session.id})}\n\n"

        async for chunk in gemini_client.chat_stream(
            message=request.message,
            history=history,
            image_base64=request.image_base64
        ):
            full_response += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

        # 완료 후 메시지 저장
        assistant_message = ChatMessage(
            session_id=session.id,
            role="assistant",
            content=full_response
        )
        db.add(assistant_message)
        increment_usage(db, student_id)
        session.updated_at = datetime.now(KST)
        db.commit()

        # 완료 신호
        _, remaining = check_daily_limit(db, student_id)
        yield f"data: {json.dumps({'type': 'done', 'remaining': remaining})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.get("/sessions", response_model=List[SessionInfo])
async def get_sessions(
    student_id: Optional[int] = None,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """학생의 채팅 세션 목록 조회"""
    query = db.query(ChatSession)

    if student_id:
        query = query.filter(ChatSession.student_id == student_id)

    sessions = query.order_by(ChatSession.updated_at.desc()).limit(limit).all()

    result = []
    for session in sessions:
        message_count = db.query(ChatMessage).filter(
            ChatMessage.session_id == session.id
        ).count()
        result.append(SessionInfo(
            id=session.id,
            title=session.title,
            created_at=session.created_at,
            message_count=message_count
        ))

    return result


@router.get("/sessions/{session_id}/messages", response_model=List[MessageInfo])
async def get_session_messages(
    session_id: int,
    db: Session = Depends(get_db)
):
    """세션의 메시지 목록 조회"""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).all()

    return [
        MessageInfo(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            has_image=bool(msg.image_data),
            created_at=msg.created_at
        )
        for msg in messages
    ]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, db: Session = Depends(get_db)):
    """채팅 세션 삭제"""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    db.delete(session)
    db.commit()

    return {"status": "success", "message": "세션이 삭제되었습니다."}


@router.get("/usage")
async def get_usage(student_id: Optional[int] = None, db: Session = Depends(get_db)):
    """오늘의 사용량 조회"""
    today = datetime.now(KST).date()
    usage = get_or_create_daily_usage(db, student_id, today)

    return {
        "date": str(today),
        "question_count": usage.question_count,
        "limit": DAILY_QUESTION_LIMIT,
        "remaining": max(0, DAILY_QUESTION_LIMIT - usage.question_count)
    }


@router.get("/health")
async def health_check():
    """AI 서비스 상태 확인"""
    is_configured = gemini_client.model is not None
    return {
        "status": "ok" if is_configured else "not_configured",
        "model": "gemini-1.5-flash" if is_configured else None,
        "message": "AI 서비스가 준비되었습니다." if is_configured else "GEMINI_API_KEY가 설정되지 않았습니다."
    }
