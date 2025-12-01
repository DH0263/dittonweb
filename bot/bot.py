"""
디턴봇 메인 Bot 클래스
"""
import discord
from discord.ext import commands

from bot.config import BOT_NAME, BOT_DESCRIPTION, COMMAND_PREFIX


class DetonBot(commands.Bot):
    """디턴봇 - 디턴 학습관 관리 봇"""

    def __init__(self):
        # Intents 설정
        intents = discord.Intents.default()
        intents.message_content = True
        intents.members = True  # 역할 확인을 위해 필요

        super().__init__(
            command_prefix=COMMAND_PREFIX,
            intents=intents,
            description=BOT_DESCRIPTION
        )

    async def setup_hook(self):
        """봇 시작 시 Cog 로드"""
        cogs_list = [
            "bot.cogs.student",
            "bot.cogs.schedule",
            "bot.cogs.notifications",  # 순찰/출석 알림
        ]

        print("[디턴봇] Cog 로딩 중...")

        for cog in cogs_list:
            try:
                await self.load_extension(cog)
                print(f"  [OK] {cog}")
            except Exception as e:
                print(f"  [ERROR] {cog}: {e}")

        # 기존 명령어 모두 제거 후 새로 동기화
        print("[디턴봇] 기존 명령어 정리 및 동기화 중...")
        try:
            # 글로벌 명령어 초기화
            self.tree.clear_commands(guild=None)

            # Cog에서 등록된 명령어만 다시 추가
            for cog in self.cogs.values():
                for command in cog.get_app_commands():
                    self.tree.add_command(command)

            # 동기화
            synced = await self.tree.sync()
            print(f"  [OK] {len(synced)}개 명령어 동기화 완료")

            for cmd in synced:
                print(f"      - /{cmd.name}")

        except Exception as e:
            print(f"  [ERROR] 명령어 동기화 실패: {e}")

    async def on_ready(self):
        """봇 준비 완료 이벤트"""
        print(f"\n{'='*50}")
        print(f"[디턴봇] {self.user} 온라인!")
        print(f"[디턴봇] 연결된 서버: {len(self.guilds)}개")
        print(f"{'='*50}")

        # 상태 메시지 설정
        await self.change_presence(
            activity=discord.Activity(
                type=discord.ActivityType.watching,
                name="디턴 학습관"
            )
        )

    async def on_command_error(self, ctx, error):
        """명령어 에러 핸들러"""
        if isinstance(error, commands.MissingPermissions):
            await ctx.send("이 명령어를 사용할 권한이 없습니다.")
        elif isinstance(error, commands.CommandNotFound):
            pass  # 존재하지 않는 명령어는 무시
        else:
            print(f"[ERROR] 명령어 에러: {error}")

    async def on_app_command_error(self, interaction: discord.Interaction, error):
        """앱 명령어 (슬래시 명령어) 에러 핸들러"""
        if isinstance(error, discord.app_commands.errors.CheckFailure):
            if not interaction.response.is_done():
                await interaction.response.send_message(
                    "이 명령어를 사용할 권한이 없습니다.",
                    ephemeral=True
                )
        else:
            print(f"[ERROR] 앱 명령어 에러: {error}")
            if not interaction.response.is_done():
                await interaction.response.send_message(
                    "명령어 실행 중 오류가 발생했습니다.",
                    ephemeral=True
                )
