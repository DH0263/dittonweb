import { useState, useEffect } from 'react'
import api from '../api/axios'

// 운영진 목록 (counselor DB의 이름과 매칭)
const STAFF_LIST = [
    { id: 'kim', name: '김현철', displayName: '김현철 선생님', color: 'blue' },
    { id: 'jung', name: '정현재', displayName: '정현재 선생님', color: 'purple' },
    { id: 'jeon', name: '전동현', displayName: '전동현 선생님', color: 'green' }
]

// 주차 계산 함수
const getWeekOfMonth = (date) => {
    const d = new Date(date)
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1)
    const firstDayOfWeek = firstDay.getDay()
    const offsetDate = d.getDate() + firstDayOfWeek - 1
    return Math.floor(offsetDate / 7) + 1
}

// 요일 한글
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

function StaffSchedule() {
    const [selectedStaff, setSelectedStaff] = useState('kim')
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
    const [viewMode, setViewMode] = useState('week') // week, day
    const [loading, setLoading] = useState(true)

    // 데이터
    const [diamondCounselings, setDiamondCounselings] = useState([])
    const [counselingSessions, setCounselingSessions] = useState([])
    const [schedules, setSchedules] = useState([]) // 일회성 일정 (Schedule 테이블)
    const [students, setStudents] = useState([])
    const [counselors, setCounselors] = useState([])

    // 다이아몬드 상담 추가 모달
    const [showAddModal, setShowAddModal] = useState(false)
    const [newDiamondForm, setNewDiamondForm] = useState({
        student_id: '',
        counselor_id: '',
        week_pattern: '1_3',
        day_of_week: 1,
        start_time: '14:00'
    })

    useEffect(() => {
        fetchAllData()
    }, [])

    const fetchAllData = async () => {
        setLoading(true)
        try {
            const [diamondRes, sessionsRes, schedulesRes, studentsRes, counselorsRes] = await Promise.all([
                api.get('/diamond-counselings/'),
                api.get('/counseling-sessions/'),
                api.get('/schedules/'),
                api.get('/students/'),
                api.get('/counselors/')
            ])

            setDiamondCounselings(diamondRes.data)
            setCounselingSessions(sessionsRes.data)
            setSchedules(schedulesRes.data)
            setStudents(studentsRes.data)
            setCounselors(counselorsRes.data)
            setLoading(false)
        } catch (error) {
            console.error('Error fetching data:', error)
            setLoading(false)
        }
    }

    // 선택된 선생님의 다이아몬드 상담 필터링
    const getStaffDiamondCounselings = () => {
        const staffName = STAFF_LIST.find(s => s.id === selectedStaff)?.name || ''
        return diamondCounselings.filter(dc => {
            // API returns counselor_name directly, not nested
            const counselorName = dc.counselor_name || ''
            return counselorName.includes(staffName)
        })
    }

    // 선택된 선생님의 상담 세션 필터링
    const getStaffSessions = () => {
        const staffName = STAFF_LIST.find(s => s.id === selectedStaff)?.name || ''
        return counselingSessions.filter(cs => {
            // API returns counselor_name directly, not nested
            const counselorName = cs.counselor_name || ''
            return counselorName.includes(staffName)
        })
    }

    // 선택된 선생님의 일회성 일정 필터링 (memo에 선생님 이름 포함 또는 상담 타입)
    const getStaffSchedules = () => {
        const staff = STAFF_LIST.find(s => s.id === selectedStaff)
        const staffName = staff?.name || ''
        const displayName = staff?.displayName || ''
        return schedules.filter(s => {
            const memo = s.memo || ''
            const scheduleType = s.type || ''
            // 메모나 타입에 선생님 이름이 포함된 경우
            return memo.includes(staffName) || memo.includes(displayName) ||
                   (scheduleType === '상담' && memo.includes(staffName))
        })
    }

    // 이미 다이아몬드 상담이 배정된 학생 ID 목록
    const getAssignedStudentIds = () => {
        return diamondCounselings
            .filter(dc => dc.is_active)
            .map(dc => dc.student_id)
    }

    // 다이아몬드 상담 미배정 학생만 필터링
    const getUnassignedStudents = () => {
        const assignedIds = getAssignedStudentIds()
        return students.filter(s =>
            s.status === '재원' && !assignedIds.includes(s.id)
        )
    }

    // 주간 날짜 계산
    const getWeekDates = () => {
        const d = new Date(selectedDate)
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) // 월요일 시작
        const monday = new Date(d.setDate(diff))

        const dates = []
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday)
            date.setDate(monday.getDate() + i)
            dates.push(date.toISOString().slice(0, 10))
        }
        return dates
    }

    // 특정 날짜의 이벤트 가져오기
    const getEventsForDate = (dateStr) => {
        const events = []
        const d = new Date(dateStr)
        const dayOfWeek = d.getDay()
        const weekOfMonth = getWeekOfMonth(d)

        // 다이아몬드 상담 (정기)
        const staffDiamond = getStaffDiamondCounselings()
        staffDiamond.forEach(dc => {
            if (dc.day_of_week === dayOfWeek && dc.week_number === weekOfMonth && dc.is_active) {
                // API returns student_name directly
                const student = students.find(s => s.id === dc.student_id)
                events.push({
                    type: 'diamond',
                    id: dc.id,
                    time: dc.start_time,
                    studentName: dc.student_name || student?.name || `학생 #${dc.student_id}`,
                    seatNumber: student?.seat_number || '',
                    color: 'bg-cyan-100 border-cyan-500 text-cyan-800'
                })
            }
        })

        // 상담 세션 (실제 일정)
        const staffSessions = getStaffSessions()
        staffSessions.forEach(cs => {
            if (cs.scheduled_date === dateStr) {
                // API returns student_name directly
                const student = students.find(s => s.id === cs.student_id)
                events.push({
                    type: 'session',
                    id: cs.id,
                    time: cs.scheduled_time,
                    studentName: cs.student_name || student?.name || `학생 #${cs.student_id}`,
                    seatNumber: student?.seat_number || '',
                    status: cs.status,
                    color: cs.status === 'completed'
                        ? 'bg-green-100 border-green-500 text-green-800'
                        : cs.status === 'cancelled'
                            ? 'bg-red-100 border-red-500 text-red-800 line-through'
                            : 'bg-purple-100 border-purple-500 text-purple-800'
                })
            }
        })

        // 일회성 일정
        const staffSchedules = getStaffSchedules()
        staffSchedules.forEach(s => {
            const scheduleDate = s.date?.slice(0, 10)
            if (scheduleDate === dateStr) {
                const student = students.find(st => st.id === s.student_id)
                events.push({
                    type: 'schedule',
                    id: s.id,
                    time: s.time,
                    studentName: student?.name || `학생 #${s.student_id}`,
                    seatNumber: student?.seat_number || '',
                    scheduleType: s.type,
                    memo: s.memo,
                    color: 'bg-yellow-100 border-yellow-500 text-yellow-800'
                })
            }
        })

        // 시간순 정렬
        return events.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    }

    const deleteSchedule = async (scheduleId) => {
        if (!window.confirm('이 일정을 삭제하시겠습니까?')) return

        try {
            await api.delete(`/schedules/${scheduleId}`)
            alert('삭제되었습니다.')
            fetchAllData()
        } catch (error) {
            console.error('Error deleting schedule:', error)
            alert('삭제 실패')
        }
    }

    const updateSessionStatus = async (sessionId, status) => {
        try {
            await api.put(`/counseling-sessions/${sessionId}`, { status })
            alert(status === 'completed' ? '완료 처리되었습니다.' : '상태가 변경되었습니다.')
            fetchAllData()
        } catch (error) {
            console.error('Error updating session:', error)
            alert('상태 변경 실패')
        }
    }

    // 다이아몬드 상담 추가
    const handleAddDiamondCounseling = async () => {
        if (!newDiamondForm.student_id || !newDiamondForm.counselor_id) {
            alert('학생과 상담사를 선택해주세요.')
            return
        }

        try {
            await api.post('/diamond-counselings/', newDiamondForm)
            alert('다이아몬드 상담이 추가되었습니다.')
            setShowAddModal(false)
            setNewDiamondForm({
                student_id: '',
                counselor_id: '',
                week_pattern: '1_3',
                day_of_week: 1,
                start_time: '14:00'
            })
            fetchAllData()
        } catch (error) {
            console.error('Error adding diamond counseling:', error)
            alert('추가 실패: ' + (error.response?.data?.detail || error.message))
        }
    }

    // 다이아몬드 상담 삭제/비활성화
    const deleteDiamondCounseling = async (counselingId) => {
        if (!window.confirm('이 다이아몬드 상담을 삭제하시겠습니까?')) return

        try {
            await api.delete(`/diamond-counselings/${counselingId}`)
            alert('삭제되었습니다.')
            fetchAllData()
        } catch (error) {
            console.error('Error deleting diamond counseling:', error)
            alert('삭제 실패')
        }
    }

    const moveToWeek = (direction) => {
        const d = new Date(selectedDate)
        d.setDate(d.getDate() + (direction * 7))
        setSelectedDate(d.toISOString().slice(0, 10))
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-xl">로딩 중...</div>
            </div>
        )
    }

    const weekDates = getWeekDates()
    const staffInfo = STAFF_LIST.find(s => s.id === selectedStaff)
    const staffDiamond = getStaffDiamondCounselings()

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">운영진 스케줄</h1>
                            <p className="text-sm text-gray-600 mt-1">
                                다이아몬드 상담 및 일회성 상담 일정을 관리합니다
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {(selectedStaff === 'kim' || selectedStaff === 'jung') && (
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700"
                                >
                                    다이아몬드 상담 추가
                                </button>
                            )}
                            <button
                                onClick={fetchAllData}
                                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                            >
                                새로고침
                            </button>
                            <a href="/" className="text-blue-600 hover:underline">
                                홈
                            </a>
                        </div>
                    </div>

                    {/* 선생님 선택 */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {STAFF_LIST.map(staff => (
                            <button
                                key={staff.id}
                                onClick={() => setSelectedStaff(staff.id)}
                                className={`px-4 py-2 rounded-lg font-medium ${
                                    selectedStaff === staff.id
                                        ? `bg-${staff.color}-600 text-white`
                                        : `bg-${staff.color}-100 text-${staff.color}-700 hover:bg-${staff.color}-200`
                                }`}
                                style={{
                                    backgroundColor: selectedStaff === staff.id
                                        ? (staff.color === 'blue' ? '#2563eb' : staff.color === 'purple' ? '#9333ea' : '#16a34a')
                                        : undefined,
                                    color: selectedStaff === staff.id ? 'white' : undefined
                                }}
                            >
                                {staff.displayName}
                            </button>
                        ))}
                    </div>

                    {/* 주간 네비게이션 */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => moveToWeek(-1)}
                            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                        >
                            이전 주
                        </button>
                        <div className="flex items-center gap-4">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="px-4 py-2 border rounded-lg"
                            />
                            <button
                                onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                            >
                                오늘
                            </button>
                        </div>
                        <button
                            onClick={() => moveToWeek(1)}
                            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                        >
                            다음 주
                        </button>
                    </div>
                </div>

                {/* 다이아몬드 상담 요약 (김현철, 정현재만) */}
                {(selectedStaff === 'kim' || selectedStaff === 'jung') && staffDiamond.length > 0 && (
                    <div className="bg-cyan-50 border border-cyan-300 rounded-lg p-4 mb-4">
                        <h3 className="font-bold text-cyan-800 mb-2">다이아몬드 상담 정기 일정</h3>
                        <div className="flex flex-wrap gap-2">
                            {staffDiamond.filter(dc => dc.is_active).map(dc => {
                                // API returns student_name directly
                                const studentName = dc.student_name || students.find(s => s.id === dc.student_id)?.name || `#${dc.student_id}`
                                return (
                                    <span
                                        key={dc.id}
                                        className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded-lg text-sm inline-flex items-center gap-2"
                                    >
                                        {dc.week_number}주차 {DAY_NAMES[dc.day_of_week]} {dc.start_time} - {studentName}
                                        <button
                                            onClick={() => deleteDiamondCounseling(dc.id)}
                                            className="text-red-600 hover:text-red-800 font-bold"
                                            title="삭제"
                                        >
                                            ×
                                        </button>
                                    </span>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* 주간 캘린더 */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="grid grid-cols-7 border-b">
                        {weekDates.map((dateStr, idx) => {
                            const d = new Date(dateStr)
                            const isToday = dateStr === new Date().toISOString().slice(0, 10)
                            const events = getEventsForDate(dateStr)

                            return (
                                <div
                                    key={dateStr}
                                    className={`border-r last:border-r-0 ${isToday ? 'bg-blue-50' : ''}`}
                                >
                                    {/* 날짜 헤더 */}
                                    <div className={`p-2 text-center border-b ${isToday ? 'bg-blue-100' : 'bg-gray-50'}`}>
                                        <div className={`text-sm font-medium ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : ''}`}>
                                            {DAY_NAMES[d.getDay()]}
                                        </div>
                                        <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : ''}`}>
                                            {d.getDate()}
                                        </div>
                                    </div>

                                    {/* 이벤트 목록 */}
                                    <div className="min-h-[200px] p-1 space-y-1">
                                        {events.length === 0 ? (
                                            <div className="text-xs text-gray-400 text-center py-2">
                                                일정 없음
                                            </div>
                                        ) : (
                                            events.map((event, eventIdx) => (
                                                <div
                                                    key={`${event.type}-${event.id}-${eventIdx}`}
                                                    className={`p-2 rounded border-l-4 ${event.color} text-xs`}
                                                >
                                                    <div className="font-bold">
                                                        {event.time}
                                                    </div>
                                                    <div className="font-medium">
                                                        {event.seatNumber} {event.studentName}
                                                    </div>
                                                    <div className="flex gap-1 mt-1">
                                                        {event.type === 'diamond' && (
                                                            <span className="px-1 bg-cyan-200 rounded">다이아몬드</span>
                                                        )}
                                                        {event.type === 'session' && (
                                                            <>
                                                                <span className="px-1 bg-purple-200 rounded">상담세션</span>
                                                                {event.status === 'scheduled' && (
                                                                    <button
                                                                        onClick={() => updateSessionStatus(event.id, 'completed')}
                                                                        className="px-1 bg-green-200 rounded hover:bg-green-300"
                                                                    >
                                                                        완료
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        {event.type === 'schedule' && (
                                                            <>
                                                                <span className="px-1 bg-yellow-200 rounded">{event.scheduleType}</span>
                                                                <button
                                                                    onClick={() => deleteSchedule(event.id)}
                                                                    className="px-1 bg-red-200 rounded hover:bg-red-300"
                                                                >
                                                                    삭제
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                    {event.memo && (
                                                        <div className="text-gray-600 mt-1 truncate" title={event.memo}>
                                                            {event.memo}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* 범례 */}
                <div className="mt-4 bg-white rounded-lg shadow-md p-4">
                    <h3 className="font-bold text-gray-700 mb-2">범례</h3>
                    <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-cyan-100 border-l-4 border-cyan-500 rounded"></div>
                            <span>다이아몬드 상담 (정기)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-purple-100 border-l-4 border-purple-500 rounded"></div>
                            <span>상담 세션</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-yellow-100 border-l-4 border-yellow-500 rounded"></div>
                            <span>일회성 일정</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-100 border-l-4 border-green-500 rounded"></div>
                            <span>완료됨</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-red-100 border-l-4 border-red-500 rounded"></div>
                            <span>취소됨</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 다이아몬드 상담 추가 모달 */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">다이아몬드 상담 추가</h2>

                        {/* 학생 선택 (배정 안된 학생만) */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                학생 선택 <span className="text-xs text-gray-500">(미배정 학생만 표시)</span>
                            </label>
                            <select
                                value={newDiamondForm.student_id}
                                onChange={(e) => setNewDiamondForm({...newDiamondForm, student_id: parseInt(e.target.value)})}
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <option value="">학생을 선택하세요</option>
                                {getUnassignedStudents().map(student => (
                                    <option key={student.id} value={student.id}>
                                        {student.seat_number} {student.name}
                                    </option>
                                ))}
                            </select>
                            {getUnassignedStudents().length === 0 && (
                                <p className="text-xs text-orange-600 mt-1">모든 학생이 이미 배정되어 있습니다.</p>
                            )}
                        </div>

                        {/* 상담사 선택 */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">상담사</label>
                            <select
                                value={newDiamondForm.counselor_id}
                                onChange={(e) => setNewDiamondForm({...newDiamondForm, counselor_id: parseInt(e.target.value)})}
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <option value="">상담사를 선택하세요</option>
                                {counselors.filter(c => c.is_active).map(counselor => (
                                    <option key={counselor.id} value={counselor.id}>
                                        {counselor.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 주차 패턴 */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">주차 패턴</label>
                            <select
                                value={newDiamondForm.week_pattern}
                                onChange={(e) => setNewDiamondForm({...newDiamondForm, week_pattern: e.target.value})}
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <option value="1_3">1주차 & 3주차</option>
                                <option value="2_4">2주차 & 4주차</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                선택한 선생님이 첫 번째 주차, 다른 선생님이 두 번째 주차 담당
                            </p>
                        </div>

                        {/* 요일 */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">요일</label>
                            <select
                                value={newDiamondForm.day_of_week}
                                onChange={(e) => setNewDiamondForm({...newDiamondForm, day_of_week: parseInt(e.target.value)})}
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                {DAY_NAMES.map((day, idx) => (
                                    <option key={idx} value={idx}>{day}요일</option>
                                ))}
                            </select>
                        </div>

                        {/* 시작 시간 */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1">시작 시간</label>
                            <input
                                type="time"
                                value={newDiamondForm.start_time}
                                onChange={(e) => setNewDiamondForm({...newDiamondForm, start_time: e.target.value})}
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>

                        {/* 버튼 */}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleAddDiamondCounseling}
                                disabled={!newDiamondForm.student_id || !newDiamondForm.counselor_id}
                                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default StaffSchedule
