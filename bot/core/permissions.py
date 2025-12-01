"""
역할 기반 권한 시스템
"""
from enum import IntEnum
from functools import wraps
from typing import Callable
import discord
from discord import Interaction


class PermissionLevel(IntEnum):
    """권한 레벨 정의"""
    NONE = 0
    TEAM_MEMBER = 10     # 학습관리팀, 올케어팀
    OPERATIONS = 20      # 운영진 (정현재, 김현철)
    ADMIN = 100          # 관리자 (전동현)


# 디스코드 역할 이름 -> 권한 레벨 매핑
ROLE_PERMISSIONS: dict[str, PermissionLevel] = {
    "관리자": PermissionLevel.ADMIN,
    "운영진": PermissionLevel.OPERATIONS,
    "학습관리팀": PermissionLevel.TEAM_MEMBER,
    "올케어팀": PermissionLevel.TEAM_MEMBER,
}


def get_user_permission_level(interaction: Interaction) -> PermissionLevel:
    """사용자의 최고 권한 레벨 계산"""
    if interaction.guild is None:
        return PermissionLevel.NONE

    member = interaction.guild.get_member(interaction.user.id)
    if member is None:
        return PermissionLevel.NONE

    max_level = PermissionLevel.NONE
    for role in member.roles:
        level = ROLE_PERMISSIONS.get(role.name, PermissionLevel.NONE)
        if level > max_level:
            max_level = level

    return max_level


def requires_permission(level: PermissionLevel):
    """
    권한 확인 데코레이터

    사용 예:
        @requires_permission(PermissionLevel.TEAM_MEMBER)
        async def my_command(self, interaction, ...):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(self, interaction: Interaction, *args, **kwargs):
            user_level = get_user_permission_level(interaction)

            if user_level < level:
                await interaction.response.send_message(
                    "이 명령어를 사용할 권한이 없습니다.",
                    ephemeral=True
                )
                return

            return await func(self, interaction, *args, **kwargs)
        return wrapper
    return decorator


# 편의 데코레이터
def admin_only(func: Callable):
    """관리자 전용 명령어"""
    return requires_permission(PermissionLevel.ADMIN)(func)


def operations_or_above(func: Callable):
    """운영진 이상 명령어"""
    return requires_permission(PermissionLevel.OPERATIONS)(func)


def team_member_or_above(func: Callable):
    """팀원 이상 명령어 (학습관리팀, 올케어팀 포함)"""
    return requires_permission(PermissionLevel.TEAM_MEMBER)(func)
