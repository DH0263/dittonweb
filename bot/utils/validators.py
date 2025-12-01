"""
입력 검증 유틸리티
"""
import re
from enum import Enum


class InputType(Enum):
    """입력 타입"""
    SEAT = "seat"      # 좌석번호
    NAME = "name"      # 이름


# 좌석번호 패턴: A1~A42, B1~B23
SEAT_PATTERN = re.compile(r'^[ABab]\d{1,2}$')


def detect_input_type(query: str) -> InputType:
    """
    입력값이 좌석번호인지 이름인지 자동 감지

    Args:
        query: 사용자 입력값

    Returns:
        InputType.SEAT 또는 InputType.NAME
    """
    query = query.strip()

    if SEAT_PATTERN.match(query):
        prefix = query[0].upper()
        try:
            number = int(query[1:])

            # A1~A42 또는 B1~B23 범위 확인
            if prefix == 'A' and 1 <= number <= 42:
                return InputType.SEAT
            elif prefix == 'B' and 1 <= number <= 23:
                return InputType.SEAT
        except ValueError:
            pass

    return InputType.NAME


def normalize_seat_number(seat: str) -> str:
    """좌석번호 정규화 (대문자로 변환)"""
    return seat.strip().upper()


def is_valid_seat_number(seat: str) -> bool:
    """좌석번호 유효성 검사"""
    return detect_input_type(seat) == InputType.SEAT
