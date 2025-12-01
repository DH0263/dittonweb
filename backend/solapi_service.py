"""
Solapi 문자/카카오톡 발송 서비스
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Solapi SDK import (설치 필요: pip install solapi)
try:
    from solapi import SolapiMessageService
    from solapi.model.request.message import Message, KakaoOption
    SOLAPI_AVAILABLE = True
except ImportError:
    SOLAPI_AVAILABLE = False
    SolapiMessageService = None
    Message = None
    KakaoOption = None


class MessageService:
    """문자/카카오톡 발송 서비스"""

    def __init__(self):
        self.api_key = os.getenv('SOLAPI_API_KEY')
        self.api_secret = os.getenv('SOLAPI_API_SECRET')
        self.sender_number = os.getenv('SOLAPI_SENDER_NUMBER', '')  # 등록된 발신번호
        self.kakao_pfid = os.getenv('SOLAPI_KAKAO_PFID', '')  # 카카오 채널 ID
        self.service = None

        if SOLAPI_AVAILABLE and self.api_key and self.api_secret:
            self.service = SolapiMessageService(
                api_key=self.api_key,
                api_secret=self.api_secret
            )

    def is_available(self) -> bool:
        """서비스 사용 가능 여부"""
        return self.service is not None

    def send_sms(self, to: str, text: str, from_number: str = None) -> dict:
        """
        SMS 발송 (80바이트 이하)

        Args:
            to: 수신번호 (01012345678 형식)
            text: 메시지 내용
            from_number: 발신번호 (등록된 번호만 가능)

        Returns:
            발송 결과
        """
        if not self.is_available():
            return {"success": False, "error": "Solapi 서비스를 사용할 수 없습니다"}

        try:
            # 발신번호 결정 (파라미터 > 환경변수 기본값)
            sender = from_number.replace('-', '') if from_number else self.sender_number.replace('-', '')

            if not sender:
                return {"success": False, "error": "발신번호가 설정되지 않았습니다. .env에 SOLAPI_SENDER_NUMBER를 설정하세요."}

            # Message 객체 생성
            message = Message(
                to=to.replace('-', ''),
                from_=sender,
                text=text
            )

            result = self.service.send(message)
            return {"success": True, "result": result.model_dump()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def send_lms(self, to: str, text: str, subject: str = None, from_number: str = None) -> dict:
        """
        LMS 발송 (장문, 2000바이트까지)

        Args:
            to: 수신번호
            text: 메시지 내용
            subject: 제목 (선택)
            from_number: 발신번호

        Returns:
            발송 결과
        """
        if not self.is_available():
            return {"success": False, "error": "Solapi 서비스를 사용할 수 없습니다"}

        try:
            # 발신번호 결정 (파라미터 > 환경변수 기본값)
            sender = from_number.replace('-', '') if from_number else self.sender_number.replace('-', '')

            if not sender:
                return {"success": False, "error": "발신번호가 설정되지 않았습니다. .env에 SOLAPI_SENDER_NUMBER를 설정하세요."}

            # Message 객체 생성 (LMS)
            message = Message(
                to=to.replace('-', ''),
                from_=sender,
                text=text,
                type='LMS',
                subject=subject
            )

            result = self.service.send(message)
            return {"success": True, "result": result.model_dump()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def send_kakao_friendtalk(self, to: str, text: str, image_url: str = None,
                               buttons: list = None, from_number: str = None) -> dict:
        """
        카카오 친구톡 발송 (채널 친구에게 자유롭게 발송, 템플릿 불필요)

        Args:
            to: 수신번호
            text: 메시지 내용
            image_url: 이미지 URL (선택)
            buttons: 버튼 목록 (선택)
            from_number: 발신번호 (친구톡 실패 시 SMS 대체 발송용)

        Returns:
            발송 결과
        """
        if not self.is_available():
            return {"success": False, "error": "Solapi 서비스를 사용할 수 없습니다"}

        if not self.kakao_pfid:
            return {"success": False, "error": "카카오 채널 ID가 설정되지 않았습니다. .env에 SOLAPI_KAKAO_PFID를 설정하세요."}

        try:
            # 발신번호 결정 (친구톡 실패 시 SMS 대체 발송용)
            sender = from_number.replace('-', '') if from_number else self.sender_number.replace('-', '')

            # KakaoOption 생성
            kakao_opt = KakaoOption(
                pf_id=self.kakao_pfid
            )

            # Message 객체 생성 (친구톡)
            message = Message(
                to=to.replace('-', ''),
                text=text,
                kakao_options=kakao_opt
            )

            # SMS 대체 발송 설정
            if sender:
                message.from_ = sender

            result = self.service.send(message)
            return {"success": True, "result": result.model_dump()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def send_kakao_alimtalk(self, to: str, template_id: str, variables: dict = None,
                            pf_id: str = None, from_number: str = None) -> dict:
        """
        카카오 알림톡 발송 (템플릿 승인 필요)

        Args:
            to: 수신번호
            template_id: 승인된 템플릿 ID
            variables: 템플릿 변수 (#{변수명}: 값)
            pf_id: 카카오 채널 ID (없으면 환경변수 사용)
            from_number: 발신번호 (알림톡 실패 시 SMS 대체 발송용)

        Returns:
            발송 결과
        """
        if not self.is_available():
            return {"success": False, "error": "Solapi 서비스를 사용할 수 없습니다"}

        # 카카오 채널 ID 결정
        kakao_pf = pf_id or self.kakao_pfid
        if not kakao_pf:
            return {"success": False, "error": "카카오 채널 ID가 설정되지 않았습니다."}

        try:
            # 발신번호 결정
            sender = from_number.replace('-', '') if from_number else self.sender_number.replace('-', '')

            # KakaoOption 생성 (알림톡)
            kakao_opt = KakaoOption(
                pf_id=kakao_pf,
                template_id=template_id,
                variables=variables
            )

            # Message 객체 생성
            message = Message(
                to=to.replace('-', ''),
                kakao_options=kakao_opt
            )

            if sender:
                message.from_ = sender

            result = self.service.send(message)
            return {"success": True, "result": result.model_dump()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def send_bulk(self, messages: list) -> dict:
        """
        대량 발송

        Args:
            messages: 메시지 목록 [{"to": "010...", "text": "내용"}, ...]

        Returns:
            발송 결과
        """
        if not self.is_available():
            return {"success": False, "error": "Solapi 서비스를 사용할 수 없습니다"}

        if not self.sender_number:
            return {"success": False, "error": "발신번호가 설정되지 않았습니다. .env에 SOLAPI_SENDER_NUMBER를 설정하세요."}

        try:
            # Message 객체 리스트 생성
            sender = self.sender_number.replace('-', '')
            message_objects = []

            for msg in messages:
                message_obj = Message(
                    to=msg['to'].replace('-', ''),
                    from_=msg.get('from', sender).replace('-', ''),
                    text=msg['text'],
                    type=msg.get('type'),
                    subject=msg.get('subject')
                )
                message_objects.append(message_obj)

            result = self.service.send(message_objects)
            return {"success": True, "result": result.model_dump()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_balance(self) -> dict:
        """
        잔액 조회

        Returns:
            잔액 정보
        """
        if not self.is_available():
            return {"success": False, "error": "Solapi 서비스를 사용할 수 없습니다"}

        try:
            result = self.service.get_balance()
            return {"success": True, "balance": result}
        except Exception as e:
            return {"success": False, "error": str(e)}


# 싱글톤 인스턴스
message_service = MessageService()
