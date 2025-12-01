@echo off
chcp 65001
echo ========================================
echo Dittonweb 종 시스템 시작
echo ========================================
echo.

cd /d c:\Dittonweb\종소리

REM 필요한 라이브러리 설치 확인
pip show schedule >nul 2>&1
if errorlevel 1 (
    echo [설치] schedule 라이브러리 설치 중...
    pip install schedule
)

pip show playsound >nul 2>&1
if errorlevel 1 (
    echo [설치] playsound 라이브러리 설치 중...
    pip install playsound==1.2.2
)

echo.
python bell_scheduler.py
pause
