"""
알림 Cog - 순찰 경고 및 출석 미확인 알림
"""
import discord
from discord.ext import commands, tasks
from datetime import datetime

from bot.config import (
    MANAGER_CHANNEL_ID,
    ATTENDANCE_CHANNEL_ID,
    PATROL_WARNING_MINUTES_1,
    PATROL_WARNING_MINUTES_2,
)
from bot.services.notification_service import NotificationService


class NotificationsCog(commands.Cog):
    """자동 알림 Cog"""

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.notification_service = NotificationService()

        # 알림 발송 기록 (중복 방지)
        self.patrol_warnings_sent = set()  # {(patrol_id, warning_minutes), ...}
        self.attendance_alerts_sent = set()  # {(date, period), ...}

    def cog_load(self):
        """Cog 로드 시 태스크 시작"""
        self.patrol_check_task.start()
        self.attendance_check_task.start()
        print("[알림] 순찰 체크 태스크 시작")
        print("[알림] 출석 체크 태스크 시작")

    def cog_unload(self):
        """Cog 언로드 시 태스크 중지"""
        self.patrol_check_task.cancel()
        self.attendance_check_task.cancel()

    @tasks.loop(minutes=1)
    async def patrol_check_task(self):
        """
        순찰 경과 시간 체크 (1분마다)
        15분, 25분 경과 시 알림 발송
        """
        try:
            patrol = self.notification_service.get_current_patrol()

            if not patrol:
                return

            patrol_id = patrol["id"]
            elapsed = patrol["elapsed_minutes"]

            # 15분 경고
            if elapsed >= PATROL_WARNING_MINUTES_1:
                warning_key = (patrol_id, PATROL_WARNING_MINUTES_1)
                if warning_key not in self.patrol_warnings_sent:
                    await self._send_patrol_warning(patrol, PATROL_WARNING_MINUTES_1)
                    self.patrol_warnings_sent.add(warning_key)

            # 25분 경고
            if elapsed >= PATROL_WARNING_MINUTES_2:
                warning_key = (patrol_id, PATROL_WARNING_MINUTES_2)
                if warning_key not in self.patrol_warnings_sent:
                    await self._send_patrol_warning(patrol, PATROL_WARNING_MINUTES_2)
                    self.patrol_warnings_sent.add(warning_key)

        except Exception as e:
            print(f"[알림 오류] 순찰 체크: {e}")

    @patrol_check_task.before_loop
    async def before_patrol_check(self):
        """봇 준비 대기"""
        await self.bot.wait_until_ready()

    @tasks.loop(minutes=1)
    async def attendance_check_task(self):
        """
        출석 미확인 체크 (1분마다)
        교시 시작 10분 후 출석 확인이 안 된 경우 알림
        """
        try:
            # 출석 확인 알림 체크 (교시 시작 후 10분 경과)
            alert = self.notification_service.check_attendance_alert()

            if not alert:
                return

            # 오늘 해당 교시 알림 이미 발송했는지 확인
            today = datetime.now().date()
            alert_key = (today, alert["period"])

            if alert_key in self.attendance_alerts_sent:
                return

            # 알림 발송
            await self._send_attendance_completion_alert(alert)
            self.attendance_alerts_sent.add(alert_key)

        except Exception as e:
            print(f"[알림 오류] 출석 체크: {e}")

    @attendance_check_task.before_loop
    async def before_attendance_check(self):
        """봇 준비 대기"""
        await self.bot.wait_until_ready()

    async def _send_patrol_warning(self, patrol: dict, warning_minutes: int):
        """순찰 경고 알림 발송"""
        channel = self.bot.get_channel(MANAGER_CHANNEL_ID)

        if not channel:
            print(f"[알림 오류] 채널을 찾을 수 없음: {MANAGER_CHANNEL_ID}")
            return

        # 경고 레벨에 따른 색상
        if warning_minutes == PATROL_WARNING_MINUTES_1:
            color = discord.Color.yellow()
            title = f"순찰 {warning_minutes}분 경과"
        else:
            color = discord.Color.orange()
            title = f"순찰 {warning_minutes}분 경과"

        embed = discord.Embed(
            title=title,
            description=f"순찰이 시작된 지 **{patrol['elapsed_minutes']}분**이 경과했습니다.",
            color=color,
            timestamp=datetime.now()
        )

        start_time_str = patrol['start_time'].strftime("%H:%M") if hasattr(patrol['start_time'], 'strftime') else str(patrol['start_time'])[:5]
        embed.add_field(name="시작 시간", value=start_time_str, inline=True)
        embed.add_field(name="경과 시간", value=f"{patrol['elapsed_minutes']}분", inline=True)

        if patrol.get('inspector_name'):
            embed.add_field(name="순찰자", value=patrol['inspector_name'], inline=True)

        embed.set_footer(text="순찰 종료를 잊지 마세요!")

        await channel.send(embed=embed)
        print(f"[알림] 순찰 {warning_minutes}분 경고 발송")

    async def _send_attendance_alert(self, period: int, unconfirmed: list):
        """출석 미확인 알림 발송 (레거시)"""
        channel = self.bot.get_channel(ATTENDANCE_CHANNEL_ID)

        if not channel:
            print(f"[알림 오류] 채널을 찾을 수 없음: {ATTENDANCE_CHANNEL_ID}")
            return

        embed = discord.Embed(
            title=f"{period}교시 출석 미확인",
            description=f"**{len(unconfirmed)}명**의 학생 출석이 확인되지 않았습니다.",
            color=discord.Color.red(),
            timestamp=datetime.now()
        )

        # 학생 목록 (최대 20명까지 표시)
        student_list = []
        for student in unconfirmed[:20]:
            student_list.append(f"• {student['seat_number']} {student['name']}")

        if student_list:
            embed.add_field(
                name="미확인 학생",
                value="\n".join(student_list),
                inline=False
            )

        if len(unconfirmed) > 20:
            embed.set_footer(text=f"외 {len(unconfirmed) - 20}명")

        await channel.send(embed=embed)
        print(f"[알림] {period}교시 출석 미확인 알림 발송 ({len(unconfirmed)}명)")

    async def _send_attendance_completion_alert(self, alert: dict):
        """출석 확인 완료 여부 알림 발송"""
        channel = self.bot.get_channel(MANAGER_CHANNEL_ID)

        if not channel:
            print(f"[알림 오류] 채널을 찾을 수 없음: {MANAGER_CHANNEL_ID}")
            return

        embed = discord.Embed(
            title=f"⚠️ {alert['period']}교시 출석 확인 필요",
            description=alert['message'],
            color=discord.Color.orange(),
            timestamp=datetime.now()
        )

        embed.add_field(name="교시", value=f"{alert['period']}교시", inline=True)
        embed.add_field(name="시작 시간", value=alert['start_time'], inline=True)
        embed.add_field(name="경과 시간", value=f"{alert['elapsed_minutes']}분", inline=True)

        embed.set_footer(text="출석 확인을 진행해주세요!")

        await channel.send(embed=embed)
        print(f"[알림] {alert['period']}교시 출석 확인 알림 발송 (경과: {alert['elapsed_minutes']}분)")

    @commands.Cog.listener()
    async def on_ready(self):
        """봇 준비 완료 시 알림 기록 초기화"""
        # 날짜가 바뀌면 기록 초기화
        today = datetime.now().date()
        self.attendance_alerts_sent = {
            (d, p) for d, p in self.attendance_alerts_sent if d == today
        }


async def setup(bot: commands.Bot):
    """Cog 설정"""
    await bot.add_cog(NotificationsCog(bot))
