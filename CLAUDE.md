# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dittonweb is a student management system for a Korean study center ("Deton Bot"). It consists of:
- **Backend**: FastAPI REST API with SQLite database
- **Frontend**: React + Vite SPA with TailwindCSS
- **Discord Integration**: Discord bot configuration (tokens in .env)
- **Notion Integration**: Notion API for database sync (tokens in .env)

The system manages students, penalties, schedules, patrols, attendance, inquiries, and registrations.

## Development Commands

### Backend (FastAPI)
```bash
# Install dependencies
pip install -r requirements.txt

# Run development server
cd backend
uvicorn main:app --reload --port 8000

# The API will be available at http://127.0.0.1:8000
# API docs at http://127.0.0.1:8000/docs
```

### Frontend (React + Vite)
```bash
# Install dependencies
cd frontend
npm install

# Run development server
npm run dev
# Default port: http://localhost:5173

# Build for production
npm run build

# Preview production build
npm preview

# Lint code
npm run lint
```

### Database Management
The SQLite database is located at:
- Root: `deton_bot.db` (legacy)
- Backend: `backend/deton_bot.db` (active)

Database migrations are handled by SQLAlchemy's `create_all()` in `backend/main.py:8`.

## Architecture

### Backend Structure
- **main.py**: FastAPI application with all API endpoints
- **models.py**: SQLAlchemy ORM models defining database schema
- **schemas.py**: Pydantic models for request/response validation
- **database.py**: Database connection configuration (SQLite)
- **main_new.py**: Alternative/experimental version (not in use)

### Frontend Structure
- **src/App.jsx**: Main router component defining all routes
- **src/pages/**: Page components for each feature
  - Dashboard.jsx: Main landing page with navigation cards
  - Students.jsx: Student list and management
  - StudentDetail.jsx: Individual student details
  - Penalties.jsx: Penalty records
  - Schedules.jsx: Schedule management
  - RecurringSchedules.jsx: Recurring schedules (outings, counseling)
  - Patrols.jsx: Patrol records
  - Supervision.jsx: Real-time supervision dashboard
  - Inquiries.jsx: New inquiry management
  - Registrations.jsx: Student registration processing
  - RegistrationForm.jsx: Public registration form
- **src/api/axios.js**: Axios instance configured for backend API

### Database Schema
Core models and their relationships:
- **Student**: Central entity with seat_number, status, contact info, academic info
  - Has many: Penalty, Schedule, Outing, AttendanceRecord, StudyAttitudeCheck
  - Has many: RecurringOuting, RecurringCounseling
- **Penalty**: Student penalties with points, reason, type
- **Schedule**: One-time schedules (counseling, etc.)
- **Outing**: One-time outings with date, time range, reason
- **RecurringOuting**: Weekly recurring outings (day_of_week, time range)
- **RecurringCounseling**: Monthly recurring counseling (week_of_month, day_of_week)
- **Patrol**: Patrol sessions with start_time, end_time
- **AttendanceRecord**: Daily attendance status (출석/지각/결석/조퇴)
- **StudyAttitudeCheck**: Patrol-based attitude checks (정상/졸음/딴짓/이탈/기타)
- **Inquiry**: New student inquiries with visit_date, status, program
- **StudentRegistration**: Registration form submissions (processed → Student)

### API Patterns
All endpoints follow RESTful conventions:
- POST `/resource/`: Create
- GET `/resource/`: List all
- GET `/resource/{id}`: Get by ID
- PUT `/resource/{id}`: Update
- DELETE `/resource/{id}`: Delete

Special endpoints:
- `/patrols/start`: Start a new patrol session
- `/patrols/{patrol_id}/end`: End patrol session
- `/patrols/current`: Get active patrol
- `/supervision/current-status`: Real-time supervision dashboard data
- `/attendance-records/today`: Today's attendance
- `/study-attitude-checks/today`: Today's attitude checks
- `/student-registrations/{id}/process`: Convert registration to student

## Key Business Logic

### Supervision Dashboard (`/supervision/current-status`)
Returns real-time student status by combining:
1. **Attendance**: Today's check-in status
2. **Current Schedule**: Active counseling/outing based on time
3. **Attitude Checks**: Recent patrol observations
4. **Status Priority**: absent > late > on_schedule > attitude_warning > studying
5. **Color Coding**: red (absent), orange (late), yellow (schedule), purple (warning), green (studying)

### Patrol System
- Patrol sessions track start_time and end_time
- StudyAttitudeCheck records are linked to patrol_id
- Only one active patrol per day (end_time = NULL)
- Attitude types: 정상, 졸음, 딴짓, 이탈, 기타

### Recurring Schedules
- **RecurringOuting**: day_of_week (0=Mon, 6=Sun), time range
- **RecurringCounseling**: week_of_month (1-4), day_of_week, time
- Both have is_active flag for soft delete

### Student Registration Flow
1. Public form submission → StudentRegistration (is_processed=False)
2. Admin reviews in /registrations
3. Process endpoint creates Student + RecurringOutings
4. StudentRegistration.is_processed = True

## External Integrations

### Discord Bot
Tokens and channel IDs in `config.py`:
- MANAGER_CHANNEL_ID: Late reports, patrol notifications
- ATTENDANCE_CHANNEL_ID: Attendance and patrol input
- COUNSEL_CHANNEL_ID: Counseling notifications
- SUPPLY_COMPLETE_CHANNEL_ID: Supply purchase alerts

Thresholds:
- Patrol warnings: 15min, 30min
- Penalty alert: 10 points

### Notion API
Database IDs in `config.py`:
- PENALTY_DB_ID, PATROL_DB_ID, SEAT_DB_ID
- COUNSEL_DB_ID, STUDENT_DB_ID
- SCHEDULE_DB_ID, OUTING_DB_ID

### Configuration
- **Timezone**: Asia/Seoul (KST)
- **Seats**: A1-A42, B1-B23 (defined in config.py)
- **Times**: Attendance alarm 08:10, Daily briefing 09:00

## Important Notes

### CORS Configuration
Frontend runs on port 5173, backend on 8000. CORS is configured in `backend/main.py:14` to allow localhost:5173.

### Korean Language
All user-facing text and database content is in Korean. Model fields, API responses, and UI components use Korean for status values, types, and descriptions.

### Database Models Issue
Note: `models.py:309` and `models.py:343` have duplicate `patrol_id` field definitions in StudyAttitudeCheck and AttendanceRecord. This should be consolidated.

### DateTime Handling
- **Date**: Uses SQLAlchemy Date type (date only)
- **Time**: Uses SQLAlchemy Time type (time only)
- **DateTime**: Uses SQLAlchemy DateTime type (full timestamp)
- Time strings are stored as "HH:MM:SS" format

### Status Enums (implicit, not enforced)
- Student.status: "재원", "휴원", "퇴원"
- AttendanceRecord.status: "자습중", "지각", "결석", "일정중", "학교"
- StudyAttitudeCheck.attitude_type: "정상", "졸음", "딴짓", "이탈", "기타"
- Inquiry.status: "방문예약", "등록완료", etc.
- Outing.status: "승인", "대기", "거부"

## Deployment (배포 시 필수 사항)

### Railway/Docker 배포 시 Playwright 설치 필요
ClassUp 연동 기능은 Playwright(headless 브라우저)를 사용합니다. 배포 시 반드시 다음을 포함해야 합니다:

**Dockerfile 예시:**
```dockerfile
FROM python:3.11-slim

# Playwright 의존성 설치
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

# Playwright 브라우저 설치
RUN pip install playwright
RUN playwright install chromium
RUN playwright install-deps chromium

COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Railway 배포 시:**
1. `railway.json` 또는 `Dockerfile` 사용
2. Playwright chromium 브라우저 설치 필수
3. 메모리 최소 512MB 이상 권장

**환경 변수 (배포 시 설정 필요):**
- `DISCORD_WEBHOOK_ALERT`: 경고 알림용 Discord 웹훅
- `DISCORD_WEBHOOK_GENERAL`: 일반 알림용 Discord 웹훅
- `GEMINI_API_KEY`: AI 채팅용 Gemini API 키 (선택)

### ClassUp 로그인 방식
- 웹 UI에서 `/classup/login/send-code` → `/classup/login/verify` API로 로그인
- headless 브라우저가 백그라운드에서 ClassUp에 로그인
- 세션은 `classup_session.json`에 저장됨
- 배포 서버에서도 웹 UI로 로그인 가능

## Future Implementation (TODO)

### 1. 시간표 기반 교시 제한
각 교시에 맞는 시간에만 출석 체크 가능하도록 제한:
```
~오전 8:00             등원
오전 8:00 ~ 10:00      1교시 (120분)
오전 10:00 ~ 10:20     1교시 쉬는시간 (20분)
오전 10:20 ~ 12:00     2교시 (100분)
오후 12:00 ~ 1:00      점심시간 (60분)
오후 1:00 ~ 3:00       3교시 (120분)
오후 3:00 ~ 3:20       3교시 쉬는시간 (20분)
오후 3:20 ~ 4:40       4교시 (80분)
오후 4:40 ~ 4:50       쉬는시간 (10분)
오후 4:50 ~ 6:00       5교시 (70분)
오후 6:00 ~ 7:00       저녁시간 (60분)
오후 7:00 ~ 8:20       6교시 (80분)
오후 8:20 ~ 8:30       6교시 쉬는시간 (10분)
오후 8:30 ~ 10:00      7교시 (90분)
```

### 2. 디스코드 출석 확인 알림
- 각 교시 시작 후 10분 이내 출석확인이 이루어지지 않으면 운영진에게 알림
- MANAGER_CHANNEL_ID로 알림 전송

### 3. 고등학생 학교 등원 관리
- 학생 타입: "예비고1", "고1", "고2", "고3"
- 학교 등원 체크 시 오후 6시까지 "학교" 상태로 표시
- 학교 등원 여부는 일별로 저장 필요

### 4. 순찰 자동 알림 (Discord Bot)
- **15분 경과**: 마지막 순찰 제출 후 15분이 지나면 학습관리팀에게 "순찰을 돌아주세요" 알림
  - 대상 채널: MANAGER_CHANNEL_ID 또는 별도 학습관리팀 채널
- **25분 경과**: 마지막 순찰 제출 후 25분이 지나도 제출이 없으면 경고 알림
  - 대상: 운영진 + 학습관리팀 모두에게 경고
  - 내용: "순찰이 25분 이상 지연되고 있습니다!"
- 구현 방식:
  - Discord 봇에서 마지막 순찰 end_time 기준으로 타이머 체크
  - 교시 시간 중에만 알림 발송 (쉬는시간, 점심/저녁시간 제외)
  - 봇 개발 시 `/patrols/` API에서 최근 순찰 기록 조회하여 구현
