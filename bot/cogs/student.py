"""
학생 조회 명령어 Cog
"""
import discord
from discord import app_commands
from discord.ext import commands

from bot.core.permissions import PermissionLevel, requires_permission
from bot.services.student_service import StudentService
from bot.utils.validators import detect_input_type, InputType
from bot.utils.formatters import build_student_embed, build_not_found_embed


class StudentCog(commands.Cog):
    """학생 정보 조회 명령어"""

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.student_service = StudentService()

    @app_commands.command(
        name="학생조회",
        description="학생 정보를 조회합니다 (이름 또는 좌석번호)"
    )
    @app_commands.describe(
        검색어="학생 이름 또는 좌석번호 (예: 홍길동, A15)"
    )
    @requires_permission(PermissionLevel.TEAM_MEMBER)
    async def student_lookup(self, interaction: discord.Interaction, 검색어: str):
        """
        학생 정보 조회 명령어

        Args:
            interaction: Discord 상호작용 객체
            검색어: 학생 이름 또는 좌석번호
        """
        await interaction.response.defer(thinking=True)

        try:
            # 입력 타입 감지
            input_type = detect_input_type(검색어)

            if input_type == InputType.SEAT:
                # 좌석번호로 검색
                student = self.student_service.get_by_seat_number(검색어)

                if student:
                    embed = build_student_embed(student)
                    await interaction.followup.send(embed=embed)
                else:
                    embed = build_not_found_embed(검색어)
                    await interaction.followup.send(embed=embed)

            else:
                # 이름으로 검색
                students = self.student_service.search_by_name(검색어)

                if len(students) == 0:
                    embed = build_not_found_embed(검색어)
                    await interaction.followup.send(embed=embed)

                elif len(students) == 1:
                    embed = build_student_embed(students[0])
                    await interaction.followup.send(embed=embed)

                else:
                    # 여러 명 검색됨 - 선택 메뉴 표시
                    await self._show_student_selection(interaction, students, 검색어)

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
                f"{i}. **{student.name}** ({student.seat_number}) - {student.status}"
            )

        embed.add_field(
            name="검색된 학생",
            value="\n".join(student_list),
            inline=False
        )

        if len(students) > 10:
            embed.set_footer(text=f"외 {len(students) - 10}명 더 있습니다. 검색어를 더 구체적으로 입력해주세요.")

        # 선택 메뉴 생성
        view = StudentSelectView(students[:10], self.student_service)
        await interaction.followup.send(embed=embed, view=view)


class StudentSelectView(discord.ui.View):
    """학생 선택 드롭다운 뷰"""

    def __init__(self, students: list, student_service: StudentService):
        super().__init__(timeout=60)
        self.students = students
        self.student_service = student_service

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
            embed = build_student_embed(student)
            await interaction.response.edit_message(embed=embed, view=None)
        else:
            await interaction.response.send_message(
                "학생 정보를 불러올 수 없습니다.",
                ephemeral=True
            )


async def setup(bot: commands.Bot):
    """Cog 설정"""
    await bot.add_cog(StudentCog(bot))
