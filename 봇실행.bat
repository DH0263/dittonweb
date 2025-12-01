@echo off
chcp 65001 >nul
echo ========================================
echo         디턴봇 실행
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] 가상환경 확인 중...
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    echo   가상환경 활성화됨
) else (
    echo   가상환경 없음 - 시스템 Python 사용
)

echo.
echo [2/2] 디턴봇 시작...
echo.

python -m bot.main

echo.
echo 봇이 종료되었습니다.
pause
