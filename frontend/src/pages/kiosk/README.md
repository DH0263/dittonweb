# 키오스크 페이지 가이드

디턴 학원 지문인식 키오스크 시스템 페이지들

## 페이지 목록

### 1. KioskEntrance.jsx - 외부용 키오스크
**경로:** `/kiosk/entrance`

**용도:** 건물 출입구에 설치
**기능:**
- 🚪 **등원**: 아침에 학생이 건물에 들어올 때 사용
- 👋 **퇴장**: 저녁에 학생이 건물을 나갈 때 사용

**화면 구성:**
- 큰 버튼 2개 (등원/퇴장)
- 지문 스캔 후 자동으로 출석 기록
- 학생 정보 표시

---

### 2. KioskInternal.jsx - 내부용 키오스크
**경로:** `/kiosk/internal`

**용도:** 건물 내부 (복도, 출입구 앞)에 설치
**기능:**
- 🚶 **외출**: 학생이 잠시 밖에 나갈 때 사용
- 🔙 **복귀**: 외출 후 돌아왔을 때 사용

**화면 구성:**
- 큰 버튼 2개 (외출/복귀)
- 지문 스캔 후 외출 기록
- 학생 정보 표시

---

### 3. KioskAttendance.jsx - 통합 키오스크 (테스트용)
**경로:** `/kiosk/attendance`

**용도:** 개발/테스트용 통합 페이지
**기능:**
- 모든 기능을 하나의 페이지에서 테스트
- 프로토타입 및 초기 버전

---

### 4. KioskTest.jsx - 웹훅 테스트
**경로:** `/kiosk-test`

**용도:** API 연동 테스트 대시보드
**기능:**
- 키오스크 API 엔드포인트 테스트
- 통계 조회
- 테스트 데이터 전송

---

## 실행 방법

### 서버 시작

```bash
# 1. 지문인식 서버 (Mock 모드)
cd c:\키오스크\python-server
python app.py

# 2. Dittonweb 백엔드
cd c:\Dittonweb\backend
uvicorn main:app --reload --port 8000

# 3. Dittonweb 프론트엔드
cd c:\Dittonweb\frontend
npm run dev
```

### 페이지 접속

- 외부용 키오스크: http://localhost:5173/kiosk/entrance
- 내부용 키오스크: http://localhost:5173/kiosk/internal
- 테스트 대시보드: http://localhost:5173/kiosk-test

---

## 설치 시나리오

### 시나리오 1: 건물에 키오스크 1대만 설치
**외부용 키오스크만 사용**
- 위치: 현관 출입구
- URL: `/kiosk/entrance`
- 기능: 등원/퇴장

### 시나리오 2: 건물에 키오스크 2대 설치 (권장)
**외부용 + 내부용 각 1대**
- 외부용: 현관 출입구 (`/kiosk/entrance`)
  - 기능: 등원/퇴장
- 내부용: 복도 또는 내부 출입구 (`/kiosk/internal`)
  - 기능: 외출/복귀

---

## 키오스크 PC 설정

### 전체 화면 모드로 실행

**Windows에서 브라우저 전체 화면:**
1. 브라우저에서 페이지 접속
2. `F11` 키로 전체 화면 전환
3. 또는 브라우저 키오스크 모드 사용

**Chrome 키오스크 모드:**
```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --app=http://localhost:5173/kiosk/entrance
```

### 자동 시작 설정

**방법 1: Windows 시작 프로그램**
1. `Win + R` → `shell:startup`
2. 바로가기 생성: Chrome 키오스크 모드 명령어

**방법 2: 배치 파일**
```batch
@echo off
cd c:\키오스크\python-server
start python app.py

timeout /t 5

start chrome --kiosk --app=http://localhost:5173/kiosk/entrance
```

---

## API 연동

모든 키오스크 페이지는 다음 API를 사용합니다:

### 지문 인식
```
POST http://localhost:5000/fingerprint/identify
```

### 학생 정보 조회
```
GET http://localhost:8000/students/{id}
```

### 출석 기록 (등원/퇴장)
```
POST http://localhost:8000/attendance-records/
```

### 외출 기록 (외출/복귀)
```
POST http://localhost:8000/outings/
```

---

## 문제 해결

### 지문인식이 안 됨
1. 지문인식 서버 실행 확인: `http://localhost:5000`
2. Mock 모드 확인: `.env` 파일에서 `MOCK_MODE=true`
3. 실제 하드웨어 사용 시: UniFingerUI 설치 및 DLL 확인

### 출석 기록이 안 됨
1. 백엔드 서버 실행 확인: `http://localhost:8000`
2. 학생 ID가 데이터베이스에 존재하는지 확인
3. 브라우저 콘솔에서 에러 메시지 확인

### 화면이 자동으로 리셋 안 됨
- 정상입니다. 3초 후 자동 리셋됩니다.
- 에러 발생 시 5초 후 리셋됩니다.

---

## 디자인 특징

- **큰 버튼**: 터치스크린 최적화 (48px × 32px padding)
- **큰 글씨**: 가독성 향상 (28px~48px)
- **명확한 색상**:
  - 등원: 초록색 (#10b981)
  - 퇴장: 빨간색 (#ef4444)
  - 외출: 노란색 (#f59e0b)
  - 복귀: 파란색 (#3b82f6)
- **실시간 피드백**: 스캔 중, 성공, 실패 상태 표시
- **자동 리셋**: 3초 후 자동으로 초기 화면으로 복귀

---

## 다음 개발 단계

- [ ] 오프라인 모드 지원
- [ ] 지문 이미지 캡처 및 저장
- [ ] 관리자 원격 모니터링
- [ ] 음성 안내 추가
- [ ] 학생 사진 표시
- [ ] 통계 대시보드
