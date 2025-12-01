import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'

function DiamondCounseling() {
    const [counselors, setCounselors] = useState([])
    const [students, setStudents] = useState([])
    const [counselings, setCounselings] = useState([])
    const [sessions, setSessions] = useState([])
    const [changeRequests, setChangeRequests] = useState([])
    const [loading, setLoading] = useState(true)

    const [activeTab, setActiveTab] = useState('schedule') // 'schedule', 'calendar', 'students'
    const [selectedWeek, setSelectedWeek] = useState(1)
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [showRequestsModal, setShowRequestsModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [editingCounseling, setEditingCounseling] = useState(null)

    const [editForm, setEditForm] = useState({
        counselor_id: '',
        day_of_week: 0,
        start_time: '14:00'
    })

    const [assignForm, setAssignForm] = useState({
        student_id: '',
        counselor_id: '',
        week_pattern: '1_3',
        day_of_week: 0,
        start_time: '14:00'
    })

    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [calendarFilter, setCalendarFilter] = useState('all') // 'all', counselor_id

    const dayNames = ['월', '화', '수', '목', '금', '토', '일']
    const weekPatterns = [
        { value: '1_3', label: '1주차 & 3주차' },
        { value: '2_4', label: '2주차 & 4주차' }
    ]

    useEffect(() => {
        fetchData()
    }, [])

    useEffect(() => {
        // 스케줄 탭에서도 완료 여부 확인을 위해 세션 데이터 필요
        if (activeTab === 'calendar' || activeTab === 'schedule') {
            fetchMonthSessions()
        }
    }, [activeTab, currentMonth])

    const fetchData = async () => {
        setLoading(true)
        try {
            await api.post('/counselors/init')

            const [counselorsRes, studentsRes, counselingsRes, requestsRes] = await Promise.all([
                api.get('/counselors/'),
                api.get('/students/'),
                api.get('/diamond-counselings/'),
                api.get('/schedule-change-requests/', { params: { status: 'pending' } })
            ])

            setCounselors(counselorsRes.data)
            setStudents(studentsRes.data.filter(s => s.status === '재원'))
            setCounselings(counselingsRes.data)
            setChangeRequests(requestsRes.data)
        } catch (error) {
            console.error('Error fetching data:', error)
        }
        setLoading(false)
    }

    const fetchMonthSessions = async () => {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth() + 1
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

        try {
            const res = await api.get('/counseling-sessions/', {
                params: { start_date: startDate, end_date: endDate }
            })
            setSessions(res.data)
        } catch (error) {
            console.error('Error fetching sessions:', error)
        }
    }

    const handleAssign = async (e) => {
        e.preventDefault()
        try {
            const res = await api.post('/diamond-counselings/', assignForm)
            const otherCounselor = counselors.find(c => c.id !== parseInt(assignForm.counselor_id))
            alert(`상담이 배정되었습니다!\n\n` +
                `${assignForm.week_pattern === '1_3' ? '1주차' : '2주차'}: ${getCounselorName(parseInt(assignForm.counselor_id))}\n` +
                `${assignForm.week_pattern === '1_3' ? '3주차' : '4주차'}: ${otherCounselor?.name || '미배정'}`)
            setShowAssignModal(false)
            setAssignForm({
                student_id: '',
                counselor_id: '',
                week_pattern: '1_3',
                day_of_week: 0,
                start_time: '14:00'
            })
            fetchData()
            fetchMonthSessions()
        } catch (error) {
            console.error('Error assigning counseling:', error)
            alert('배정 실패')
        }
    }

    const handleGenerateSessions = async () => {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth() + 1

        // 다음달도 계산
        const nextMonth = new Date(currentMonth)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        const nextYear = nextMonth.getFullYear()
        const nextMonthNum = nextMonth.getMonth() + 1

        try {
            // 현재 달 + 다음 달 모두 생성
            const [res1, res2] = await Promise.all([
                api.post('/counseling-sessions/generate-monthly', { year, month }),
                api.post('/counseling-sessions/generate-monthly', { year: nextYear, month: nextMonthNum })
            ])
            const totalCreated = (res1.data.created_count || 0) + (res2.data.created_count || 0)
            alert(`세션이 생성되었습니다!\n${month}월: ${res1.data.created_count || 0}개\n${nextMonthNum}월: ${res2.data.created_count || 0}개`)
            fetchMonthSessions()
        } catch (error) {
            console.error('Error generating sessions:', error)
            alert('세션 생성 실패')
        }
    }

    const handleApproveRequest = async (requestId) => {
        const processedBy = prompt('처리자 이름을 입력하세요:')
        if (!processedBy) return

        try {
            await api.post(`/schedule-change-requests/${requestId}/approve`, {
                status: 'approved',
                processed_by: processedBy
            })
            alert('요청이 승인되었습니다')
            fetchData()
            fetchMonthSessions()
        } catch (error) {
            console.error('Error approving request:', error)
            alert('승인 실패')
        }
    }

    const handleRejectRequest = async (requestId) => {
        const processedBy = prompt('처리자 이름을 입력하세요:')
        if (!processedBy) return

        const rejectionReason = prompt('거절 사유를 입력하세요:')
        const alternativeTimes = prompt('대안 시간을 입력하세요 (선택사항):')

        try {
            await api.post(`/schedule-change-requests/${requestId}/reject`, {
                status: 'rejected',
                processed_by: processedBy,
                rejection_reason: rejectionReason || null,
                alternative_times: alternativeTimes || null
            })
            alert('요청이 거절되었습니다')
            fetchData()
            fetchMonthSessions()
        } catch (error) {
            console.error('Error rejecting request:', error)
            alert('거절 실패')
        }
    }

    const handleDeleteCounseling = async (counselingId) => {
        if (!confirm('이 상담 스케줄을 삭제하시겠습니까? (페어도 함께 삭제됩니다)')) return

        try {
            await api.delete(`/diamond-counselings/${counselingId}`)
            alert('삭제되었습니다')
            fetchData()
            fetchMonthSessions()
        } catch (error) {
            console.error('Error deleting counseling:', error)
            alert('삭제 실패')
        }
    }

    const openEditModal = (counseling) => {
        setEditingCounseling(counseling)
        setEditForm({
            counselor_id: counseling.counselor_id,
            day_of_week: counseling.day_of_week,
            start_time: counseling.start_time
        })
        setShowEditModal(true)
    }

    const handleEdit = async (e) => {
        e.preventDefault()
        if (!editingCounseling) return

        try {
            await api.put(`/diamond-counselings/${editingCounseling.id}`, {
                counselor_id: editForm.counselor_id,
                day_of_week: editForm.day_of_week,
                start_time: editForm.start_time
            })
            alert('수정되었습니다')
            setShowEditModal(false)
            setEditingCounseling(null)
            fetchData()
            fetchMonthSessions()
        } catch (error) {
            console.error('Error updating counseling:', error)
            alert('수정 실패')
        }
    }

    const getCounselorName = (id) => {
        const counselor = counselors.find(c => c.id === id)
        return counselor ? counselor.name : '-'
    }

    // 월 변경
    const changeMonth = (delta) => {
        setCurrentMonth(prev => {
            const newDate = new Date(prev)
            newDate.setMonth(newDate.getMonth() + delta)
            return newDate
        })
    }

    // 캘린더 데이터 생성 (특정 월 기준)
    const generateCalendarDays = (targetMonth) => {
        const year = targetMonth.getFullYear()
        const month = targetMonth.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1 // 월요일 시작

        const days = []

        // 이전 달 빈칸
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(null)
        }

        // 현재 달 날짜
        for (let d = 1; d <= lastDay.getDate(); d++) {
            days.push(d)
        }

        return days
    }

    // 특정 날짜의 세션 가져오기 (필터 적용)
    const getSessionsForDate = (day, targetMonth) => {
        if (!day) return []
        const year = targetMonth.getFullYear()
        const month = targetMonth.getMonth() + 1
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        let filtered = sessions.filter(s => s.scheduled_date === dateStr)

        // 상담사 필터 적용
        if (calendarFilter !== 'all') {
            filtered = filtered.filter(s => s.counselor_id === parseInt(calendarFilter))
        }

        return filtered
    }

    // 주차 계산
    const getWeekNumber = (day, targetMonth) => {
        if (!day) return null
        const year = targetMonth.getFullYear()
        const month = targetMonth.getMonth()
        const date = new Date(year, month, day)
        const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1 // 월요일 = 0
        let weekCount = 0
        for (let d = 1; d <= day; d++) {
            const checkDate = new Date(year, month, d)
            const checkDayOfWeek = checkDate.getDay() === 0 ? 6 : checkDate.getDay() - 1
            if (checkDayOfWeek === dayOfWeek) {
                weekCount++
            }
        }
        return weekCount
    }

    // 다음 달 계산
    const getNextMonth = () => {
        const nextMonth = new Date(currentMonth)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        return nextMonth
    }

    // 학생별 상담 정보 (학생 탭용)
    const getStudentCounselings = (studentId) => {
        return counselings.filter(c => c.student_id === studentId)
    }

    // 해당 상담의 이번달 세션 완료 여부 확인
    const getCompletionStatus = (counseling) => {
        // 이번 달 세션 중 해당 상담과 매칭되는 세션 찾기
        const matchingSession = sessions.find(s =>
            s.student_id === counseling.student_id &&
            s.counselor_id === counseling.counselor_id &&
            s.diamond_counseling_id === counseling.id
        )
        if (!matchingSession) return null
        return matchingSession.status === 'completed' ? 'completed' : 'pending'
    }

    // 통계 계산
    const stats = {
        totalStudents: students.length,
        assignedStudents: new Set(counselings.map(c => c.student_id)).size,
        totalCounselings: counselings.length,
        pendingRequests: changeRequests.length,
        thisMonthSessions: sessions.length,
        completedSessions: sessions.filter(s => s.status === 'completed').length
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-xl text-gray-600">로딩 중...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <Link to="/" className="text-blue-500 hover:underline mb-2 block">&larr; 대시보드로 돌아가기</Link>
                        <h1 className="text-3xl font-bold text-gray-800">다이아몬드 상담 관리</h1>
                        <p className="text-gray-600 mt-1">월 2회 상담 (각 선생님별 1회씩)</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setShowAssignModal(true)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                        >
                            + 학생 배정
                        </button>
                        <button
                            onClick={() => setShowRequestsModal(true)}
                            className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 relative"
                        >
                            일정 변경 요청
                            {changeRequests.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                    {changeRequests.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-2xl font-bold text-blue-600">{stats.assignedStudents}</div>
                        <div className="text-sm text-gray-500">배정된 학생</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-2xl font-bold text-green-600">{stats.totalCounselings}</div>
                        <div className="text-sm text-gray-500">총 상담 스케줄</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-2xl font-bold text-purple-600">{stats.thisMonthSessions}</div>
                        <div className="text-sm text-gray-500">이번달 세션</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-2xl font-bold text-teal-600">{stats.completedSessions}</div>
                        <div className="text-sm text-gray-500">완료된 세션</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-2xl font-bold text-orange-600">{stats.pendingRequests}</div>
                        <div className="text-sm text-gray-500">변경 요청</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-2xl font-bold text-gray-600">{stats.totalStudents - stats.assignedStudents}</div>
                        <div className="text-sm text-gray-500">미배정 학생</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-lg shadow mb-6">
                    <div className="flex border-b">
                        <button
                            onClick={() => setActiveTab('schedule')}
                            className={`flex-1 px-4 py-3 text-sm font-medium ${
                                activeTab === 'schedule'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            주차별 스케줄
                        </button>
                        <button
                            onClick={() => setActiveTab('calendar')}
                            className={`flex-1 px-4 py-3 text-sm font-medium ${
                                activeTab === 'calendar'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            월별 캘린더
                        </button>
                        <button
                            onClick={() => setActiveTab('students')}
                            className={`flex-1 px-4 py-3 text-sm font-medium ${
                                activeTab === 'students'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            학생별 현황
                        </button>
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'schedule' && (
                    <>
                        {/* Week Selector */}
                        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex space-x-2">
                                    {[1, 2, 3, 4].map(week => (
                                        <button
                                            key={week}
                                            onClick={() => setSelectedWeek(week)}
                                            className={`px-4 py-2 rounded-lg font-medium ${
                                                selectedWeek === week
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                        >
                                            {week}주차
                                        </button>
                                    ))}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {selectedWeek === 1 || selectedWeek === 3
                                        ? '1&3주차 패턴'
                                        : '2&4주차 패턴'}
                                </div>
                            </div>
                        </div>

                        {/* Counselor Schedule Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {counselors.map(counselor => (
                                <div key={counselor.id} className="bg-white rounded-lg shadow-md p-6">
                                    <h2 className="text-xl font-semibold mb-4 text-indigo-600 flex items-center gap-2">
                                        <span className="w-3 h-3 bg-indigo-500 rounded-full"></span>
                                        {counselor.name} 선생님
                                    </h2>

                                    <div className="space-y-3">
                                        {dayNames.map((day, dayIndex) => {
                                            const dayCounselings = counselings.filter(
                                                c => c.counselor_id === counselor.id &&
                                                    c.day_of_week === dayIndex &&
                                                    c.week_number === selectedWeek
                                            )

                                            return (
                                                <div key={dayIndex} className="border-l-4 border-indigo-400 pl-3 py-1">
                                                    <div className="font-medium text-gray-700">{day}요일</div>
                                                    {dayCounselings.length > 0 ? (
                                                        <div className="ml-2 space-y-1">
                                                            {dayCounselings.sort((a, b) => a.start_time.localeCompare(b.start_time)).map(c => {
                                                                const status = getCompletionStatus(c)
                                                                return (
                                                                    <div key={c.id} className={`flex items-center justify-between p-2 rounded group ${
                                                                        status === 'completed' ? 'bg-green-50' : 'bg-indigo-50'
                                                                    }`}>
                                                                        <span className="flex items-center gap-2">
                                                                            <span className="font-mono font-medium">{c.start_time}</span>
                                                                            <span>-</span>
                                                                            <span className={`font-medium ${status === 'completed' ? 'text-green-700' : 'text-indigo-700'}`}>{c.student_name}</span>
                                                                            {status === 'completed' && (
                                                                                <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded font-medium">완료</span>
                                                                            )}
                                                                            {status === 'pending' && (
                                                                                <span className="text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded font-medium">대기</span>
                                                                            )}
                                                                            {status === null && (
                                                                                <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">세션없음</span>
                                                                            )}
                                                                        </span>
                                                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <button
                                                                                onClick={() => openEditModal(c)}
                                                                                className="text-blue-500 hover:text-blue-700 text-sm"
                                                                            >
                                                                                수정
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteCounseling(c.id)}
                                                                                className="text-red-500 hover:text-red-700 text-sm"
                                                                            >
                                                                                삭제
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="ml-2 text-gray-400 text-sm">상담 없음</div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {activeTab === 'calendar' && (
                    <div className="bg-white rounded-lg shadow-md p-6">
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between mb-6">
                            <button
                                onClick={() => changeMonth(-1)}
                                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                &lt; 이전
                            </button>
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-semibold">
                                    {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
                                </h2>
                                {/* Counselor Filter */}
                                <select
                                    value={calendarFilter}
                                    onChange={(e) => setCalendarFilter(e.target.value)}
                                    className="rounded-md border-gray-300 shadow-sm p-2 border text-sm"
                                >
                                    <option value="all">통합 (전체)</option>
                                    {counselors.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleGenerateSessions}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
                                >
                                    세션 생성 (이번달+다음달)
                                </button>
                            </div>
                            <button
                                onClick={() => changeMonth(1)}
                                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                다음 &gt;
                            </button>
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {/* Header */}
                            {dayNames.map(day => (
                                <div key={day} className="text-center font-medium text-gray-600 py-2 bg-gray-50">
                                    {day}
                                </div>
                            ))}

                            {/* Days */}
                            {generateCalendarDays(currentMonth).map((day, index) => {
                                const daySessions = getSessionsForDate(day, currentMonth)
                                const weekNum = getWeekNumber(day, currentMonth)

                                return (
                                    <div
                                        key={index}
                                        className={`min-h-24 border p-1 ${
                                            day ? 'bg-white' : 'bg-gray-50'
                                        }`}
                                    >
                                        {day && (
                                            <>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-medium">{day}</span>
                                                    {weekNum && (
                                                        <span className="text-xs bg-gray-200 px-1 rounded">
                                                            {weekNum}주
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="space-y-0.5">
                                                    {daySessions.slice(0, 3).map(s => {
                                                        // 상담사별 색상: 김현철=파란색, 정현재=보라색
                                                        const getCounselorColor = () => {
                                                            if (s.status === 'completed') return 'bg-green-100 text-green-800'
                                                            if (s.status === 'cancelled') return 'bg-red-100 text-red-800'
                                                            // 통합 보기에서 상담사별 색상 구분
                                                            if (calendarFilter === 'all') {
                                                                if (s.counselor_name === '김현철') return 'bg-blue-100 text-blue-800'
                                                                if (s.counselor_name === '정현재') return 'bg-purple-100 text-purple-800'
                                                            }
                                                            return 'bg-blue-100 text-blue-800'
                                                        }

                                                        return (
                                                            <Link
                                                                key={s.id}
                                                                to={`/counseling/survey/${s.id}`}
                                                                className={`block text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 ${getCounselorColor()}`}
                                                                title={`${s.student_name} - ${s.counselor_name} (${s.scheduled_time}) - 클릭시 설문지로 이동`}
                                                            >
                                                                {s.scheduled_time?.slice(0,5)} {s.student_name}
                                                            </Link>
                                                        )
                                                    })}
                                                    {daySessions.length > 3 && (
                                                        <div className="text-xs text-gray-500 text-center">
                                                            +{daySessions.length - 3}건
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-4 mt-4 text-sm justify-center">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-blue-100 rounded"></div>
                                <span>김현철</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-purple-100 rounded"></div>
                                <span>정현재</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-green-100 rounded"></div>
                                <span>완료</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-red-100 rounded"></div>
                                <span>취소</span>
                            </div>
                            <div className="text-gray-500 text-xs ml-4">
                                * 상담 클릭시 설문지로 이동
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'students' && (
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold mb-4">학생별 상담 현황</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">학생</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">좌석</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">1주차</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">2주차</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">3주차</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">4주차</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {students.map(student => {
                                        const studentCounselings = getStudentCounselings(student.id)
                                        const weekMap = {}
                                        studentCounselings.forEach(c => {
                                            weekMap[c.week_number] = c
                                        })

                                        return (
                                            <tr key={student.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {student.name}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                    {student.seat_number}
                                                </td>
                                                {[1, 2, 3, 4].map(week => {
                                                    const c = weekMap[week]
                                                    return (
                                                        <td key={week} className="px-4 py-3 whitespace-nowrap text-center">
                                                            {c ? (
                                                                <div className="text-xs">
                                                                    <div className={`font-medium ${
                                                                        c.counselor_name === '김현철'
                                                                            ? 'text-blue-600'
                                                                            : 'text-purple-600'
                                                                    }`}>
                                                                        {c.counselor_name}
                                                                    </div>
                                                                    <div className="text-gray-500">
                                                                        {dayNames[c.day_of_week]} {c.start_time}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-300">-</span>
                                                            )}
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Assign Modal */}
                {showAssignModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg p-6 w-full max-w-md">
                            <h2 className="text-xl font-semibold mb-4">학생 상담 배정</h2>
                            <form onSubmit={handleAssign} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">학생</label>
                                    <select
                                        value={assignForm.student_id || ''}
                                        onChange={(e) => setAssignForm({...assignForm, student_id: e.target.value ? parseInt(e.target.value) : ''})}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                        required
                                    >
                                        <option value="">학생 선택</option>
                                        {students.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.seat_number})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">주차 패턴</label>
                                    <select
                                        value={assignForm.week_pattern}
                                        onChange={(e) => setAssignForm({...assignForm, week_pattern: e.target.value})}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                    >
                                        {weekPatterns.map(p => (
                                            <option key={p.value} value={p.value}>{p.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        {assignForm.week_pattern === '1_3' ? '1주차' : '2주차'} 담당 선생님
                                    </label>
                                    <select
                                        value={assignForm.counselor_id || ''}
                                        onChange={(e) => setAssignForm({...assignForm, counselor_id: e.target.value ? parseInt(e.target.value) : ''})}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                        required
                                    >
                                        <option value="">상담사 선택</option>
                                        {counselors.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-gray-500">
                                        * {assignForm.week_pattern === '1_3' ? '3주차' : '4주차'}에는 자동으로 다른 선생님이 배정됩니다
                                    </p>
                                </div>

                                {/* Preview */}
                                {assignForm.counselor_id && (
                                    <div className="bg-indigo-50 p-3 rounded-lg text-sm">
                                        <div className="font-medium text-indigo-700 mb-1">배정 미리보기:</div>
                                        <div>
                                            {assignForm.week_pattern === '1_3' ? '1주차' : '2주차'}: {getCounselorName(parseInt(assignForm.counselor_id))}
                                        </div>
                                        <div>
                                            {assignForm.week_pattern === '1_3' ? '3주차' : '4주차'}: {
                                                counselors.find(c => c.id !== parseInt(assignForm.counselor_id))?.name || '?'
                                            }
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">요일</label>
                                    <select
                                        value={assignForm.day_of_week}
                                        onChange={(e) => setAssignForm({...assignForm, day_of_week: parseInt(e.target.value)})}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                    >
                                        {dayNames.map((day, index) => (
                                            <option key={index} value={index}>{day}요일</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">시작 시간</label>
                                    <input
                                        type="time"
                                        value={assignForm.start_time}
                                        onChange={(e) => setAssignForm({...assignForm, start_time: e.target.value})}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end space-x-2 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAssignModal(false)}
                                        className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        배정하기
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Change Requests Modal */}
                {showRequestsModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">일정 변경 요청 ({changeRequests.length}건)</h2>
                                <button
                                    onClick={() => setShowRequestsModal(false)}
                                    className="text-gray-500 hover:text-gray-700 text-2xl"
                                >
                                    &times;
                                </button>
                            </div>

                            {changeRequests.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">대기 중인 요청이 없습니다</p>
                            ) : (
                                <div className="space-y-4">
                                    {changeRequests.map(req => (
                                        <div key={req.id} className="border rounded-lg p-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-medium text-lg">{req.student_name}</div>
                                                    <div className="text-sm text-gray-500">
                                                        기존: {req.original_date} {req.original_time}
                                                    </div>
                                                    {req.requested_date && (
                                                        <div className="text-sm text-blue-600">
                                                            요청: {req.requested_date} {req.requested_time || ''}
                                                        </div>
                                                    )}
                                                    <div className="text-sm mt-2 bg-gray-50 p-2 rounded">
                                                        <span className="font-medium">사유:</span> {req.reason}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col space-y-2">
                                                    <button
                                                        onClick={() => handleApproveRequest(req.id)}
                                                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                                                    >
                                                        승인
                                                    </button>
                                                    <button
                                                        onClick={() => handleRejectRequest(req.id)}
                                                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                                                    >
                                                        거절
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {showEditModal && editingCounseling && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg p-6 w-full max-w-md">
                            <h2 className="text-xl font-semibold mb-4">상담 스케줄 수정</h2>
                            <div className="mb-4 p-3 bg-gray-50 rounded">
                                <div className="text-sm text-gray-600">학생: <span className="font-medium text-gray-900">{editingCounseling.student_name}</span></div>
                                <div className="text-sm text-gray-600">주차: <span className="font-medium text-gray-900">{editingCounseling.week_number}주차</span></div>
                            </div>
                            <form onSubmit={handleEdit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">담당 선생님</label>
                                    <select
                                        value={editForm.counselor_id || ''}
                                        onChange={(e) => setEditForm({...editForm, counselor_id: e.target.value ? parseInt(e.target.value) : ''})}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                        required
                                    >
                                        {counselors.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">요일</label>
                                    <select
                                        value={editForm.day_of_week}
                                        onChange={(e) => setEditForm({...editForm, day_of_week: parseInt(e.target.value)})}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                    >
                                        {dayNames.map((day, index) => (
                                            <option key={index} value={index}>{day}요일</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">시작 시간</label>
                                    <input
                                        type="time"
                                        value={editForm.start_time}
                                        onChange={(e) => setEditForm({...editForm, start_time: e.target.value})}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end space-x-2 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowEditModal(false)
                                            setEditingCounseling(null)
                                        }}
                                        className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        저장
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default DiamondCounseling
