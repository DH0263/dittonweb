"""
디턴봇 진입점
"""
import sys

from bot.config import DISCORD_TOKEN, BOT_NAME
from bot.bot import DetonBot


def main():
    """봇 실행"""
    if not DISCORD_TOKEN:
        print(f"[{BOT_NAME}] ERROR: DISCORD_TOKEN이 설정되지 않았습니다.")
        print("  .env 파일에 DISCORD_TOKEN을 설정해주세요.")
        sys.exit(1)

    print(f"[{BOT_NAME}] 시작 중...")
    bot = DetonBot()
    bot.run(DISCORD_TOKEN)


if __name__ == "__main__":
    main()
