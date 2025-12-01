"""AI 채팅 데이터베이스 모델"""
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Date
from sqlalchemy.orm import relationship
from datetime import datetime
import pytz

from database import Base

KST = pytz.timezone('Asia/Seoul')


class ChatSession(Base):
    """채팅 세션 (학생별 대화 묶음)"""
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)  # 나중에 로그인 연동
    title = Column(String, default="새 대화")  # 대화 제목 (첫 질문 요약)
    created_at = Column(DateTime, default=lambda: datetime.now(KST))
    updated_at = Column(DateTime, default=lambda: datetime.now(KST), onupdate=lambda: datetime.now(KST))

    # 관계
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    student = relationship("Student", backref="chat_sessions")

    def __repr__(self):
        return f"<ChatSession {self.id} - {self.title}>"


class ChatMessage(Base):
    """채팅 메시지"""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)  # 메시지 내용
    image_data = Column(Text, nullable=True)  # Base64 이미지 (선택)
    created_at = Column(DateTime, default=lambda: datetime.now(KST))

    # 관계
    session = relationship("ChatSession", back_populates="messages")

    def __repr__(self):
        return f"<ChatMessage {self.id} - {self.role}>"


class DailyUsage(Base):
    """일일 사용량 추적 (학생당 10회 제한)"""
    __tablename__ = "daily_usage"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    date = Column(Date, nullable=False)
    question_count = Column(Integer, default=0)

    # 복합 유니크 제약 (student_id + date)
    __table_args__ = (
        # SQLite에서는 아래 방식 대신 코드에서 처리
    )

    def __repr__(self):
        return f"<DailyUsage student={self.student_id} date={self.date} count={self.question_count}>"
