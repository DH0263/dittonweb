"""Google Gemini API 클라이언트"""
import os
import base64
import io
from dotenv import load_dotenv
import google.generativeai as genai
from PIL import Image
from typing import Optional, List, Dict, AsyncGenerator
import logging

# .env 파일 로드
load_dotenv()

logger = logging.getLogger(__name__)

# 시스템 프롬프트
MATH_TUTOR_PROMPT = """당신은 수능 수학 전문 튜터입니다.

## 규칙:
1. 한국어로 친절하게 설명합니다
2. 수식은 LaTeX 형식으로 작성합니다 (예: $x^2 + 2x + 1$, $$\\frac{a}{b}$$)
3. 단계별로 풀이 과정을 설명합니다
4. 학생이 이해할 수 있도록 쉬운 용어를 사용합니다
5. 관련 개념이나 공식도 함께 설명합니다
6. 이미지로 문제가 주어지면 문제를 정확히 파악하고 풀이합니다

## 수능 수학 영역:
- 공통: 수학I, 수학II
- 선택: 미적분, 확률과통계, 기하

## 응답 형식:
- 문제 유형 파악
- 핵심 개념 설명
- 단계별 풀이
- 정답 및 검산
- 관련 팁 (있을 경우)
"""


class GeminiClient:
    """Gemini API 래퍼"""

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning("GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.")
            self.model = None
            return

        genai.configure(api_key=api_key)

        # Gemini 2.0 Flash 모델 사용 (Vision 지원)
        self.model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=MATH_TUTOR_PROMPT,
            generation_config={
                "temperature": 0.7,
                "top_p": 0.95,
                "max_output_tokens": 4096,
            }
        )
        logger.info("Gemini 클라이언트 초기화 완료")

    def _build_history(self, messages: List[Dict]) -> List[Dict]:
        """대화 히스토리를 Gemini 형식으로 변환"""
        history = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            history.append({
                "role": role,
                "parts": [msg["content"]]
            })
        return history

    async def chat(
        self,
        message: str,
        history: List[Dict] = None,
        image_base64: Optional[str] = None
    ) -> str:
        """
        채팅 메시지 전송 및 응답 받기

        Args:
            message: 사용자 메시지
            history: 이전 대화 히스토리 [{"role": "user/assistant", "content": "..."}]
            image_base64: Base64 인코딩된 이미지 (선택)

        Returns:
            AI 응답 텍스트
        """
        if not self.model:
            return "⚠️ AI 서비스가 설정되지 않았습니다. 관리자에게 문의하세요."

        try:
            # 대화 히스토리가 있으면 채팅 세션 생성
            if history:
                chat_history = self._build_history(history)
                chat = self.model.start_chat(history=chat_history)
            else:
                chat = self.model.start_chat()

            # 메시지 구성 (이미지 포함 여부)
            if image_base64:
                # Base64 디코딩 후 PIL Image로 변환
                image_data = base64.b64decode(image_base64)
                image = Image.open(io.BytesIO(image_data))

                # 이미지와 텍스트 함께 전송
                response = await chat.send_message_async([
                    image,
                    message or "이 수학 문제를 풀어주세요."
                ])
            else:
                response = await chat.send_message_async(message)

            return response.text

        except Exception as e:
            logger.error(f"Gemini API 오류: {e}")
            return f"⚠️ AI 응답 오류: {str(e)}"

    async def chat_stream(
        self,
        message: str,
        history: List[Dict] = None,
        image_base64: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        스트리밍 응답 (타이핑 효과)
        """
        if not self.model:
            yield "⚠️ AI 서비스가 설정되지 않았습니다."
            return

        try:
            if history:
                chat_history = self._build_history(history)
                chat = self.model.start_chat(history=chat_history)
            else:
                chat = self.model.start_chat()

            if image_base64:
                image_data = base64.b64decode(image_base64)
                image = Image.open(io.BytesIO(image_data))
                response = await chat.send_message_async(
                    [image, message or "이 수학 문제를 풀어주세요."],
                    stream=True
                )
            else:
                response = await chat.send_message_async(message, stream=True)

            async for chunk in response:
                if chunk.text:
                    yield chunk.text

        except Exception as e:
            logger.error(f"Gemini 스트리밍 오류: {e}")
            yield f"⚠️ AI 응답 오류: {str(e)}"


# 싱글톤 인스턴스
gemini_client = GeminiClient()
