import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import StudentRequestForm from '../components/StudentRequestForm'

const StudentPortalDashboard = () => {
    const navigate = useNavigate()
    const [studentInfo, setStudentInfo] = useState(null)
    const [recentRequests, setRecentRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [showRequestModal, setShowRequestModal] = useState(false)
    const [selectedRequestType, setSelectedRequestType] = useState(null)

    // 요청 타입 정의
    const REQUEST_TYPES = [
        { type: '보조배터리', icon: '🔋', color: 'bg-green-500', hoverColor: 'hover:bg-green-600' },
        { type: '프린트', icon: '🖨️', color: 'bg-blue-500', hoverColor: 'hover:bg-blue-600' },
        { type: '학관호출', icon: '🆘', color: 'bg-red-500', hoverColor: 'hover:bg-red-600' },
        { type: '외출신청', icon: '🚶', color: 'bg-yellow-500', hoverColor: 'hover:bg-yellow-600' },
        { type: '상담신청', icon: '💬', color: 'bg-purple-500', hoverColor: 'hover:bg-purple-600' }
    ]

    // 상태 색상 매핑
    const STATUS_COLORS = {
        '대기': 'bg-yellow-100 text-yellow-800 border-yellow-300',
        '승인': 'bg-green-100 text-green-800 border-green-300',
        '거부': 'bg-red-100 text-red-800 border-red-300',
        '완료': 'bg-gray-100 text-gray-800 border-gray-300'
    }

    useEffect(() => {
        const studentId = localStorage.getItem('student_id')
        const studentName = localStorage.getItem('student_name')
        const studentSeat = localStorage.getItem('student_seat')

        if (!studentId) {
            navigate('/student-portal/login')
            return
        }

        setStudentInfo({
            id: studentId,
            name: studentName,
            seat: studentSeat
        })

        fetchRecentRequests(studentId)
    }, [navigate])

    const fetchRecentRequests = async (studentId) => {
        try {
            const response = await api.get(`/student-requests/my/${studentId}`)
            // 최근 5개만 표시
            setRecentRequests(response.data.slice(0, 5))
        } catch (error) {
            console.error('Failed to fetch requests:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('student_id')
        localStorage.removeItem('student_name')
        localStorage.removeItem('student_seat')
        navigate('/student-portal/login')
    }

    const handleRequestClick = (requestType) => {
        setSelectedRequestType(requestType)
        setShowRequestModal(true)
    }

    const formatDateTime = (dateString) => {
        const date = new Date(dateString)
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-gray-600">로딩 중...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100 pb-20">
            {/* 헤더 */}
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">
                                {studentInfo?.name}님
                            </h1>
                            <p className="text-sm text-gray-600">좌석: {studentInfo?.seat}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            로그아웃
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
                {/* 요청 카드 그리드 */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">무엇을 도와드릴까요?</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {REQUEST_TYPES.map((item) => (
                            <button
                                key={item.type}
                                onClick={() => handleRequestClick(item.type)}
                                className={`${item.color} ${item.hoverColor} text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex flex-col items-center justify-center space-y-2 min-h-[140px]`}
                            >
                                <span className="text-4xl">{item.icon}</span>
                                <span className="font-medium text-sm sm:text-base">{item.type}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 최근 요청 현황 */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-gray-800">최근 요청 현황</h2>
                        <button
                            onClick={() => navigate('/student-portal/my-requests')}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            전체 보기 &rarr;
                        </button>
                    </div>

                    {recentRequests.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            아직 요청 내역이 없습니다
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentRequests.map((request) => (
                                <div
                                    key={request.id}
                                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <span className="font-medium text-gray-800">
                                                    {request.request_type}
                                                </span>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[request.status]}`}>
                                                    {request.status}
                                                </span>
                                                {request.priority === '긴급' && (
                                                    <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-medium">
                                                        긴급
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600">{request.title}</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-gray-500">
                                        <span>{formatDateTime(request.created_at)}</span>
                                        {request.processed_by && (
                                            <span>처리: {request.processed_by}</span>
                                        )}
                                    </div>
                                    {request.admin_note && (
                                        <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-gray-700">
                                            <span className="font-medium">관리자 메모: </span>
                                            {request.admin_note}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 요청 폼 모달 */}
            {showRequestModal && selectedRequestType && (
                <StudentRequestForm
                    requestType={selectedRequestType}
                    onClose={() => setShowRequestModal(false)}
                    onSuccess={() => {
                        const studentId = localStorage.getItem('student_id')
                        fetchRecentRequests(studentId)
                    }}
                />
            )}
        </div>
    )
}

export default StudentPortalDashboard
