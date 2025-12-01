"""
Discord Embed 포맷터
"""
import discord
from datetime import date, datetime
from typing import Optional, List, Dict, Any


# 요일 이름
DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"]


def format_date(d: date) -> str:
    """날짜를 'M/D (요일)' 형식으로 포맷"""
    day_name = DAY_NAMES[d.weekday()]
    return f"{d.month}/{d.day} ({day_name})"


def format_time(time_str: str) -> str:
    """시간 문자열을 'HH:MM' 형식으로 포맷 (초 제거)"""
    if time_str and len(time_str) >= 5:
        return time_str[:5]
    return time_str or "-"


def build_student_embed(student) -> discord.Embed:
    """
    학생 정보 Embed 생성

    Args:
        student: Student 모델 객체

    Returns:
        discord.Embed
    """
    # 상태에 따른 색상
    status_colors = {
        "재원": discord.Color.green(),
        "휴원": discord.Color.orange(),
        "퇴원": discord.Color.red(),
    }
    color = status_colors.get(student.status, discord.Color.blue())

    embed = discord.Embed(
        title=f"학생 정보: {student.name}",
        color=color
    )

    # 기본 정보
    embed.add_field(name="좌석번호", value=student.seat_number or "-", inline=True)
    embed.add_field(name="상태", value=student.status or "-", inline=True)
    embed.add_field(name="학년", value=student.student_type or "-", inline=True)

    # 학교 정보
    if student.school_name:
        embed.add_field(name="학교", value=student.school_name, inline=True)

    # 좌석 유형
    if student.seat_type:
        embed.add_field(name="좌석유형", value=student.seat_type, inline=True)

    # 연락처 정보
    if student.student_phone:
        embed.add_field(name="학생 연락처", value=student.student_phone, inline=True)
    if student.parent_phone:
        embed.add_field(name="학부모 연락처", value=student.parent_phone, inline=True)

    # 벌점 정보 (관계가 로드된 경우)
    if hasattr(student, 'penalties') and student.penalties:
        total_points = sum(p.points for p in student.penalties if p.points)
        embed.add_field(name="누적 벌점", value=f"{total_points}점", inline=True)

    return embed


def build_schedule_embed(
    student_name: str,
    schedules: Dict[date, List[Dict[str, Any]]],
    start_date: date,
    end_date: date
) -> discord.Embed:
    """
    주간 일정 Embed 생성

    Args:
        student_name: 학생 이름
        schedules: 날짜별 일정 딕셔너리
        start_date: 시작 날짜
        end_date: 종료 날짜

    Returns:
        discord.Embed
    """
    embed = discord.Embed(
        title=f"{student_name}님의 일정",
        description=f"{format_date(start_date)} ~ {format_date(end_date)}",
        color=discord.Color.blue()
    )

    # 날짜순으로 정렬
    current = start_date
    from datetime import timedelta

    while current <= end_date:
        date_str = format_date(current)
        day_schedules = schedules.get(current, [])

        if day_schedules:
            # 일정이 있는 경우
            schedule_lines = []
            for s in day_schedules:
                time_str = format_time(s.get('time', ''))
                schedule_type = s.get('type', '')
                reason = s.get('reason', '')

                if reason:
                    schedule_lines.append(f"- {time_str} {schedule_type}: {reason}")
                else:
                    schedule_lines.append(f"- {time_str} {schedule_type}")

            embed.add_field(
                name=date_str,
                value="\n".join(schedule_lines),
                inline=False
            )
        else:
            # 일정이 없는 경우
            embed.add_field(
                name=date_str,
                value="일정 없음",
                inline=False
            )

        current += timedelta(days=1)

    return embed


def build_error_embed(message: str) -> discord.Embed:
    """에러 메시지 Embed 생성"""
    return discord.Embed(
        title="오류",
        description=message,
        color=discord.Color.red()
    )


def build_not_found_embed(query: str) -> discord.Embed:
    """검색 결과 없음 Embed 생성"""
    return discord.Embed(
        title="검색 결과 없음",
        description=f"'{query}'에 해당하는 학생을 찾을 수 없습니다.",
        color=discord.Color.orange()
    )
