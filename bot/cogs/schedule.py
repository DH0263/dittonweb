"""
일정 조회 명령어 Cog
"""
import discord
from discord import app_commands
from discord.ext import commands
from datetime import date, timedelta

from bot.core.permissions import PermissionLevel, requires_permission
from bot.services.student_service import StudentService
from bot.services.schedule_service import ScheduleService
from bot.utils.formatters import build_schedule_embed, build_not_found_embed


class ScheduleCog(commands.Cog):
    """일정 조회 명령어"""

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.student_service = StudentService()
        self.schedule_service = ScheduleService()

    @app_commands.command(
        name="일정확인",
        description="학생의 향후 7일 일정을 확인합니다"
    )
    @app_commands.describe(
        이름="학생 이름"
    )
    @requires_permission(PermissionLevel.TEAM_MEMBER)
    async def check_schedule(self, interaction: discord.Interaction, 이름: str):
        """
        학생 일정 확인 명령어

        실행일 기준으로 다음 주 같은 요일까지의 일정을 표시합니다.
        (예: 월요일에 실행하면 다음 주 월요일까지 7일간)

        Args:
            interaction: Discord 상호작용 객체
            이름: 학생 이름
        """
        await interaction.response.defer(thinking=True)

        try:
            # 학생 검색
            students = self.student_service.search_by_name(이름)

            if len(students) == 0:
                embed = build_not_found_embed(이름)
                await interaction.followup.send(embed=embed)
                return

            elif len(students) > 1:
                # 여러 명 검색됨 - 선택 메뉴 표시
                await self._show_student_selection(interaction, students, 이름)
                return

            student = students[0]

            # 일정 조회 (오늘부터 7일)
            today = date.today()
            end_date = today + timedelta(days=7)

            schedules = self.schedule_service.get_weekly_schedule(
                student_id=student.id,
                start_date=today,
                days=7
            )

            # Embed 생성 및 전송
            embed = build_schedule_embed(
                student_name=student.name,
                schedules=schedules,
                start_date=today,
                end_date=end_date
            )

            await interaction.followup.send(embed=embed)

        except Exception as e:
            await interaction.followup.send(
                f"오류가 발생했습니다: {str(e)}",
                ephemeral=True
            )

    async def _show_student_selection(
        self,
        interaction: discord.Interaction,
        students: list,
        query: str
    ):
        """
        여러 학생 검색 시 선택 메뉴 표시

        Args:
            interaction: Discord 상호작용 객체
            students: 검색된 학생 리스트
            query: 원래 검색어
        """
        embed = discord.Embed(
            title=f"'{query}' 검색 결과",
            description="여러 학생이 검색되었습니다. 아래에서 선택해주세요.",
            color=discord.Color.blue()
        )

        # 학생 목록 표시 (최대 10명)
        student_list = []
        for i, student in enumerate(students[:10], 1):
            student_list.append(
                f"{i}. **{student.name}** ({student.seat_number})"
            )

        embed.add_field(
            name="검색된 학생",
            value="\n".join(student_list),
            inline=False
        )

        # 선택 메뉴 생성
        view = ScheduleSelectView(students[:10], self.schedule_service)
        await interaction.followup.send(embed=embed, view=view)


class ScheduleSelectView(discord.ui.View):
    """일정 조회용 학생 선택 드롭다운 뷰"""

    def __init__(self, students: list, schedule_service: ScheduleService):
        super().__init__(timeout=60)
        self.students = students
        self.schedule_service = schedule_service

        # 드롭다운 메뉴 추가
        options = [
            discord.SelectOption(
                label=f"{s.name} ({s.seat_number})",
                value=str(s.id),
                description=f"상태: {s.status}"
            )
            for s in students
        ]

        select = discord.ui.Select(
            placeholder="학생을 선택하세요",
            options=options
        )
        select.callback = self.select_callback
        self.add_item(select)

    async def select_callback(self, interaction: discord.Interaction):
        """드롭다운 선택 콜백"""
        selected_id = int(interaction.data['values'][0])

        # 선택된 학생 찾기
        student = next((s for s in self.students if s.id == selected_id), None)

        if student:
            # 일정 조회
            today = date.today()
            end_date = today + timedelta(days=7)

            schedules = self.schedule_service.get_weekly_schedule(
                student_id=student.id,
                start_date=today,
                days=7
            )

            embed = build_schedule_embed(
                student_name=student.name,
                schedules=schedules,
                start_date=today,
                end_date=end_date
            )

            await interaction.response.edit_message(embed=embed, view=None)
        else:
            await interaction.response.send_message(
                "학생 정보를 불러올 수 없습니다.",
                ephemeral=True
            )


async def setup(bot: commands.Bot):
    """Cog 설정"""
    await bot.add_cog(ScheduleCog(bot))
