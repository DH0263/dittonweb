import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import Penalties from './pages/Penalties'
import StudentDetail from './pages/StudentDetail'
import Schedules from './pages/Schedules'
import Patrols from './pages/Patrols'
import RecurringSchedules from './pages/RecurringSchedules'
import Inquiries from './pages/Inquiries'
import Registrations from './pages/Registrations'
import RegistrationForm from './pages/RegistrationForm'
import Supervision from './pages/Supervision'
import DiamondCounseling from './pages/DiamondCounseling'
import CounselingSurveyForm from './pages/CounselingSurveyForm'
import CounselingSubmit from './pages/CounselingSubmit'
import CounselingRecords from './pages/CounselingRecords'
import StudentPortalLogin from './pages/StudentPortalLogin'
import StudentPortalDashboard from './pages/StudentPortalDashboard'
import StudentMyRequests from './pages/StudentMyRequests'
import StudentRequestsAdmin from './pages/StudentRequestsAdmin'
import RequestApproval from './pages/RequestApproval'
import StaffSchedule from './pages/StaffSchedule'
import PhoneSubmissions from './pages/PhoneSubmissions'
import KioskTest from './pages/kiosk/KioskTest'
import KioskAttendance from './pages/kiosk/KioskAttendance'
import KioskEntrance from './pages/kiosk/KioskEntrance'
import KioskInternal from './pages/kiosk/KioskInternal'
import Statistics from './pages/Statistics'
import MessageTest from './pages/MessageTest'
import ClassUpSettings from './pages/ClassUpSettings'
import MathTutor from './pages/MathTutor'

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/students" element={<Students />} />
                <Route path="/students/:id" element={<StudentDetail />} />
                <Route path="/penalties" element={<Penalties />} />
                <Route path="/schedules" element={<Schedules />} />
                <Route path="/recurring-schedules" element={<RecurringSchedules />} />
                <Route path="/patrols" element={<Patrols />} />
                <Route path="/inquiries" element={<Inquiries />} />
                <Route path="/registrations" element={<Registrations />} />
                <Route path="/supervision" element={<Supervision />} />
                <Route path="/diamond-counseling" element={<DiamondCounseling />} />
                <Route path="/counseling/survey/:sessionId" element={<CounselingSurveyForm />} />
                <Route path="/counseling/submit" element={<CounselingSubmit />} />
                <Route path="/counseling/records" element={<CounselingRecords />} />
                <Route path="/public/registration-form" element={<RegistrationForm />} />

                {/* 학생 포털 */}
                <Route path="/student-portal/login" element={<StudentPortalLogin />} />
                <Route path="/student-portal/dashboard" element={<StudentPortalDashboard />} />
                <Route path="/student-portal/my-requests" element={<StudentMyRequests />} />

                {/* 관리자 - 학생 요청 및 물품 관리 */}
                <Route path="/admin/student-requests" element={<StudentRequestsAdmin />} />
                <Route path="/admin/request-approval" element={<RequestApproval />} />
                <Route path="/admin/staff-schedule" element={<StaffSchedule />} />

                {/* 휴대폰 제출 관리 */}
                <Route path="/phone-submissions" element={<PhoneSubmissions />} />

                {/* 통계 대시보드 */}
                <Route path="/statistics" element={<Statistics />} />

                {/* 문자 발송 테스트 */}
                <Route path="/admin/message-test" element={<MessageTest />} />

                {/* 키오스크 웹훅 테스트 */}
                <Route path="/kiosk-test" element={<KioskTest />} />
                <Route path="/kiosk/attendance" element={<KioskAttendance />} />
                <Route path="/kiosk/entrance" element={<KioskEntrance />} />
                <Route path="/kiosk/internal" element={<KioskInternal />} />

                {/* ClassUp 연동 설정 (운영진 전용) */}
                <Route path="/admin/classup-settings" element={<ClassUpSettings />} />

                {/* AI 수학 튜터 */}
                <Route path="/math-tutor" element={<MathTutor />} />
            </Routes>
        </Router>
    )
}

export default App
