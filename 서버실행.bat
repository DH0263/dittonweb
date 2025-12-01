@echo off
chcp 65001
echo ========================================
echo Dittonweb 서버 시작
echo ========================================

echo.
echo [0/2] 기존 서버 종료 중...

REM 포트 8000 사용하는 프로세스 종료 (백엔드)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM 포트 5173 사용하는 프로세스 종료 (프론트엔드)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo 기존 서버 종료 완료!
echo.
echo [1/2] 백엔드 서버 시작 중...
cd /d c:\Dittonweb\backend
start /b uvicorn main:app --reload --port 8000

echo [2/2] 프론트엔드 서버 시작 중...
cd /d c:\Dittonweb\frontend
echo.
echo ========================================
echo 서버가 시작되었습니다!
echo.
echo - 백엔드: http://127.0.0.1:8000
echo - 프론트엔드: http://localhost:5173
echo.
echo 종료하려면 Ctrl+C를 누르세요
echo ========================================
echo.
npm run dev
