import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

const StudentMyRequests = () => {
    const navigate = useNavigate()
    const [requests, setRequests] = useState([])
    const [filteredRequests, setFilteredRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('전체')
    const [studentInfo, setStudentInfo] = useState(null)

    const STATUS_OPTIONS = ['전체', '대기', '승인', '거부', '완료']
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

        setStudentInfo({ id: studentId, name: studentName, seat: studentSeat })
        fetchRequests(studentId)
    }, [navigate])

    useEffect(() => {
        if (statusFilter === '전체') {
            setFilteredRequests(requests)
        } else {
            setFilteredRequests(requests.filter(req => req.status === statusFilter))
        }
    }, [statusFilter, requests])

    const fetchRequests = async (studentId) => {
        try {
            const response = await api.get(`/student-requests/my/${studentId}`)
            setRequests(response.data)
            setFilteredRequests(response.data)
        } catch (error) {
            console.error('Failed to fetch requests:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleCancelRequest = async (requestId) => {
        if (!confirm('정말 이 요청을 취소하시겠습니까?')) {
            return
        }

        try {
            await api.delete(`/student-requests/${requestId}`, {
                params: { student_id: studentInfo.id }
            })
            alert('요청이 취소되었습니다')
            fetchRequests(studentInfo.id)
        } catch (error) {
            console.error('Failed to cancel request:', error)
            alert('요청 취소에 실패했습니다')
        }
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
                <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <button
                                onClick={() => navigate('/student-portal/dashboard')}
                                className="text-blue-600 hover:text-blue-800 text-sm mb-2"
                            >
                                ← 대시보드로 돌아가기
                            </button>
                            <h1 className="text-2xl font-bold text-gray-800">내 요청 현황</h1>
                            <p className="text-sm text-gray-600">{studentInfo?.name} ({studentInfo?.seat})</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6">
                {/* 필터 탭 */}
                <div className="mb-6 bg-white rounded-lg shadow-sm p-2 flex space-x-2 overflow-x-auto">
                    {STATUS_OPTIONS.map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                                statusFilter === status
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            {status}
                            {status !== '전체' && (
                                <span className="ml-2 text-xs">
                                    ({requests.filter(r => r.status === status).length})
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* 요청 목록 */}
                {filteredRequests.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <p className="text-gray-500 text-lg">
                            {statusFilter === '전체'
                                ? '아직 요청 내역이 없습니다'
                                : `${statusFilter} 상태의 요청이 없습니다`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredRequests.map(request => (
                            <div
                                key={request.id}
                                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                            >
                                {/* 헤더 */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <h3 className="text-lg font-semibold text-gray-800">
                                                {request.request_type}
                                            </h3>
                                            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[request.status]}`}>
                                                {request.status}
                                            </span>
                                            {request.priority === '긴급' && (
                                                <span className="px-3 py-1 bg-red-500 text-white rounded-full text-sm font-medium">
                                                    긴급
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xl font-medium text-gray-700">{request.title}</p>
                                    </div>
                                    {request.status === '대기' && (
                                        <button
                                            onClick={() => handleCancelRequest(request.id)}
                                            className="ml-4 px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                                        >
                                            취소
                                        </button>
                                    )}
                                </div>

                                {/* 내용 */}
                                {request.content && (
                                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                        <p className="text-gray-700">{request.content}</p>
                                    </div>
                                )}

                                {/* 프린트 정보 */}
                                {request.request_type === '프린트' && request.print_file_link && (
                                    <div className="mb-4 p-3 bg-blue-50 rounded-lg space-y-1 text-sm">
                                        <p className="text-gray-700">
                                            <span className="font-medium">파일 링크:</span>{' '}
                                            <a href={request.print_file_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                {request.print_file_link}
                                            </a>
                                        </p>
                                        <p className="text-gray-700">
                                            <span className="font-medium">매수:</span> {request.print_copies}장
                                            {request.print_color && <span className="ml-2 text-red-600">(컬러)</span>}
                                        </p>
                                    </div>
                                )}

                                {/* 희망 시간 */}
                                {request.preferred_datetime && (
                                    <div className="mb-4 p-3 bg-purple-50 rounded-lg text-sm">
                                        <p className="text-gray-700">
                                            <span className="font-medium">희망 시간:</span> {formatDateTime(request.preferred_datetime)}
                                        </p>
                                    </div>
                                )}

                                {/* 관리자 메모 */}
                                {request.admin_note && (
                                    <div className="mb-4 p-3 bg-green-50 rounded-lg">
                                        <p className="text-sm font-medium text-gray-700 mb-1">관리자 메모:</p>
                                        <p className="text-gray-700">{request.admin_note}</p>
                                    </div>
                                )}

                                {/* 하단 정보 */}
                                <div className="flex justify-between items-center text-sm text-gray-500 pt-3 border-t border-gray-200">
                                    <span>요청 시간: {formatDateTime(request.created_at)}</span>
                                    {request.processed_at && (
                                        <span>처리 시간: {formatDateTime(request.processed_at)}</span>
                                    )}
                                    {request.processed_by && (
                                        <span>처리자: {request.processed_by}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default StudentMyRequests
