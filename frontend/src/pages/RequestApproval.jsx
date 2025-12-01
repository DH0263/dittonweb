import { useState, useEffect } from 'react'
import api from '../api/axios'

function RequestApproval() {
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('대기') // 대기, 승인, 거부, 전체
    const [typeFilter, setTypeFilter] = useState('전체') // 전체, 외출신청, 상담신청

    useEffect(() => {
        fetchRequests()
    }, [])

    const fetchRequests = async () => {
        try {
            const res = await api.get('/student-requests/')
            // 외출신청, 상담신청만 필터링
            const filtered = res.data.filter(r =>
                r.request_type === '외출신청' || r.request_type === '상담신청'
            )
            setRequests(filtered)
            setLoading(false)
        } catch (error) {
            console.error('Error fetching requests:', error)
            setLoading(false)
        }
    }

    const approveRequest = async (request) => {
        if (!window.confirm(`${request.student?.name || '학생'}의 ${request.request_type}을 승인하시겠습니까?\n\n승인 시 일정에 자동으로 추가됩니다.`)) {
            return
        }

        try {
            // 요청 승인
            await api.put(`/student-requests/${request.id}`, {
                status: '승인',
                processed_by: '관리자'
            })

            // content에서 정보 추출
            const lines = request.content?.split('\n') || []
            let dateStr = ''
            let startTime = ''
            let endTime = ''
            let reason = ''
            let counselorName = ''

            for (const line of lines) {
                if (line.startsWith('날짜:')) {
                    dateStr = line.replace('날짜:', '').trim()
                }
                if (line.startsWith('시간:')) {
                    const timePart = line.replace('시간:', '').trim()
                    if (timePart.includes('~')) {
                        const [start, end] = timePart.split('~').map(t => t.trim())
                        startTime = start
                        endTime = end
                    } else {
                        startTime = timePart
                    }
                }
                if (line.startsWith('사유:')) {
                    reason = line.replace('사유:', '').trim()
                }
                if (line.startsWith('상담 선생님:')) {
                    counselorName = line.replace('상담 선생님:', '').trim()
                }
            }

            // 외출 신청인 경우 일회성 외출 일정 추가
            if (request.request_type === '외출신청' && dateStr && startTime && endTime) {
                await api.post('/outings/', {
                    student_id: request.student_id,
                    date: dateStr,
                    start_time: startTime,
                    end_time: endTime,
                    reason: reason || '학생 신청',
                    status: '승인'
                })
            }

            // 상담 신청인 경우 일회성 상담 일정 추가
            if (request.request_type === '상담신청' && dateStr && startTime) {
                await api.post('/schedules/', {
                    student_id: request.student_id,
                    date: dateStr,
                    time: startTime,
                    type: '상담',
                    memo: `${counselorName} - ${reason || '학생 신청'}`
                })
            }

            alert('승인되었습니다. 일정이 추가되었습니다.')
            fetchRequests()
        } catch (error) {
            console.error('Error approving request:', error)
            alert('승인 처리 실패: ' + (error.response?.data?.detail || error.message))
        }
    }

    const rejectRequest = async (request) => {
        const reason = window.prompt(`${request.student?.name || '학생'}의 ${request.request_type}을 거부하시겠습니까?\n\n거부 사유를 입력하세요:`)
        if (reason === null) return

        try {
            await api.put(`/student-requests/${request.id}`, {
                status: '거부',
                processed_by: '관리자',
                admin_note: reason || '사유 없음'
            })
            alert('거부되었습니다.')
            fetchRequests()
        } catch (error) {
            console.error('Error rejecting request:', error)
            alert('거부 처리 실패')
        }
    }

    const getFilteredRequests = () => {
        return requests.filter(r => {
            const statusMatch = filter === '전체' || r.status === filter
            const typeMatch = typeFilter === '전체' || r.request_type === typeFilter
            return statusMatch && typeMatch
        })
    }

    const getStatusBadge = (status) => {
        const styles = {
            '대기': 'bg-yellow-100 text-yellow-800',
            '승인': 'bg-green-100 text-green-800',
            '거부': 'bg-red-100 text-red-800',
            '완료': 'bg-gray-100 text-gray-800'
        }
        return styles[status] || 'bg-gray-100 text-gray-800'
    }

    const getTypeBadge = (type) => {
        const styles = {
            '외출신청': 'bg-blue-100 text-blue-800',
            '상담신청': 'bg-purple-100 text-purple-800'
        }
        return styles[type] || 'bg-gray-100 text-gray-800'
    }

    const formatDateTime = (dateTimeStr) => {
        if (!dateTimeStr) return '-'
        const dt = new Date(dateTimeStr)
        return dt.toLocaleString('ko-KR', {
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
                <div className="text-xl">로딩 중...</div>
            </div>
        )
    }

    const filteredRequests = getFilteredRequests()
    const pendingCount = requests.filter(r => r.status === '대기').length

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-6">
            <div className="max-w-6xl mx-auto">
                {/* 헤더 */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">외출/상담 승인</h1>
                            <p className="text-sm text-gray-600 mt-1">
                                학생 요청을 확인하고 승인/거부할 수 있습니다
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {pendingCount > 0 && (
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                                    대기 {pendingCount}건
                                </span>
                            )}
                            <button
                                onClick={fetchRequests}
                                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                            >
                                새로고침
                            </button>
                            <a href="/" className="text-blue-600 hover:underline">
                                홈
                            </a>
                        </div>
                    </div>

                    {/* 필터 */}
                    <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">상태:</span>
                            {['대기', '승인', '거부', '전체'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilter(status)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                                        filter === status
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                            <span className="text-sm text-gray-600">유형:</span>
                            {['전체', '외출신청', '상담신청'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setTypeFilter(type)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                                        typeFilter === type
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 요청 목록 */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    {filteredRequests.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            {filter === '대기' ? '대기 중인 요청이 없습니다' : '해당하는 요청이 없습니다'}
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {filteredRequests.map(request => (
                                <div key={request.id} className="p-4 hover:bg-gray-50">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadge(request.request_type)}`}>
                                                    {request.request_type}
                                                </span>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                                                    {request.status}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {formatDateTime(request.created_at)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 mb-2">
                                                <span className="font-bold text-lg">
                                                    {request.student?.seat_number} {request.student?.name}
                                                </span>
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded-lg text-sm whitespace-pre-wrap">
                                                {request.content || request.title}
                                            </div>
                                            {request.admin_note && (
                                                <div className="mt-2 text-sm text-red-600">
                                                    관리자 메모: {request.admin_note}
                                                </div>
                                            )}
                                        </div>

                                        {request.status === '대기' && (
                                            <div className="flex gap-2 ml-4">
                                                <button
                                                    onClick={() => approveRequest(request)}
                                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                                                >
                                                    승인
                                                </button>
                                                <button
                                                    onClick={() => rejectRequest(request)}
                                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                                                >
                                                    거부
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default RequestApproval
