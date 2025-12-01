import { useState, useEffect } from 'react'
import api from '../api/axios'

// 시간 포맷 함수 (HH:MM 형태로 - 분단위까지만)
const formatTime = (timeStr) => {
    if (!timeStr) return '-'
    // "16:10:24.872172" -> "16:10"
    const cleanTime = timeStr.split('.')[0]
    const parts = cleanTime.split(':')
    return `${parts[0]}:${parts[1]}`
}

// 소요 시간 계산 (분 단위)
const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return null

    const parseTime = (timeStr) => {
        const cleanTime = timeStr.split('.')[0]
        const [h, m, s] = cleanTime.split(':').map(Number)
        return h * 60 + m
    }

    const startMinutes = parseTime(startTime)
    const endMinutes = parseTime(endTime)
    return endMinutes - startMinutes
}

function Patrols() {
    const [patrols, setPatrols] = useState([])
    const [attendanceRecords, setAttendanceRecords] = useState([])
    const [attitudeChecks, setAttitudeChecks] = useState([])
    const [students, setStudents] = useState([]) // 학생 목록 (이름 표시용)
    const [loading, setLoading] = useState(true)

    // 필터 상태
    const [dateFilter, setDateFilter] = useState('')
    const [activeTab, setActiveTab] = useState('patrols') // 'patrols' | 'attendance' | 'attitudes'

    // 확장된 순찰 상세 보기
    const [expandedPatrolId, setExpandedPatrolId] = useState(null)

    useEffect(() => {
        fetchAllData()
    }, [])

    const fetchAllData = async () => {
        setLoading(true)
        try {
            const [patrolsRes, attendanceRes, attitudesRes, studentsRes] = await Promise.all([
                api.get('/patrols/'),
                api.get('/attendance-records/today'),
                api.get('/study-attitude-checks/today'),
                api.get('/students/')
            ])

            // 최신순 정렬
            const sortedPatrols = patrolsRes.data.sort((a, b) => {
                // 날짜 비교
                const dateCompare = new Date(b.patrol_date) - new Date(a.patrol_date)
                if (dateCompare !== 0) return dateCompare
                // 같은 날짜면 시간 비교
                return b.start_time.localeCompare(a.start_time)
            })

            setPatrols(sortedPatrols)
            setAttendanceRecords(attendanceRes.data)
            setAttitudeChecks(attitudesRes.data)
            setStudents(studentsRes.data)
        } catch (error) {
            console.error('Error fetching data:', error)
        }
        setLoading(false)
    }

    // 학생 ID로 이름 가져오기
    const getStudentName = (studentId) => {
        const student = students.find(s => s.id === studentId)
        return student ? student.name : `ID:${studentId}`
    }

    // 순찰별 체크 수 가져오기
    const getPatrolCheckCount = (patrolId) => {
        return attitudeChecks.filter(check => check.patrol_id === patrolId).length
    }

    // 순찰별 체크 목록 가져오기
    const getPatrolChecks = (patrolId) => {
        return attitudeChecks.filter(check => check.patrol_id === patrolId)
    }

    // 필터된 순찰 목록
    const filteredPatrols = dateFilter
        ? patrols.filter(p => p.patrol_date === dateFilter)
        : patrols

    // 유니크한 날짜 목록 (필터 옵션용)
    const uniqueDates = [...new Set(patrols.map(p => p.patrol_date))].sort().reverse()

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-xl">로딩 중...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">순찰 · 출석 관리</h1>
                        <p className="text-sm text-gray-600 mt-1">운영진 전용 - 순찰 및 출석 기록 조회</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchAllData}
                            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                        >
                            🔄 새로고침
                        </button>
                        <a href="/" className="text-blue-600 hover:underline">← 홈</a>
                    </div>
                </div>

                {/* 탭 선택 */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setActiveTab('patrols')}
                        className={`px-4 py-2 rounded-lg font-bold ${
                            activeTab === 'patrols'
                                ? 'bg-purple-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        순찰 기록 ({patrols.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('attendance')}
                        className={`px-4 py-2 rounded-lg font-bold ${
                            activeTab === 'attendance'
                                ? 'bg-cyan-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        출석 기록 ({attendanceRecords.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('attitudes')}
                        className={`px-4 py-2 rounded-lg font-bold ${
                            activeTab === 'attitudes'
                                ? 'bg-orange-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        태도 체크 ({attitudeChecks.length})
                    </button>
                </div>

                {/* 순찰 기록 탭 */}
                {activeTab === 'patrols' && (
                    <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
                        {/* 날짜 필터 */}
                        <div className="flex items-center gap-3 mb-4">
                            <label className="text-gray-700 font-medium">날짜 필터:</label>
                            <select
                                value={dateFilter}
                                onChange={e => setDateFilter(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2"
                            >
                                <option value="">전체 보기</option>
                                {uniqueDates.map(date => (
                                    <option key={date} value={date}>
                                        {new Date(date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                                    </option>
                                ))}
                            </select>
                            {dateFilter && (
                                <button
                                    onClick={() => setDateFilter('')}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    ✕ 초기화
                                </button>
                            )}
                        </div>

                        <p className="text-gray-600 mb-3">총 {filteredPatrols.length}건</p>

                        {/* 순찰 목록 */}
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">시작</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">종료</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">소요시간</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">체크</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">순찰자</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">메모</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredPatrols.map(patrol => {
                                        const duration = calculateDuration(patrol.start_time, patrol.end_time)
                                        const checkCount = getPatrolCheckCount(patrol.id)
                                        const isExpanded = expandedPatrolId === patrol.id

                                        return (
                                            <>
                                                <tr
                                                    key={patrol.id}
                                                    className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-purple-50' : ''}`}
                                                    onClick={() => setExpandedPatrolId(isExpanded ? null : patrol.id)}
                                                >
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                        {new Date(patrol.patrol_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono">
                                                        {formatTime(patrol.start_time)}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono">
                                                        {patrol.end_time ? formatTime(patrol.end_time) : (
                                                            <span className="text-green-600 font-medium">진행중</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                        {duration !== null ? (
                                                            <span className="font-medium">{duration}분</span>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                            checkCount > 0 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                            {checkCount}건
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                        {patrol.inspector_name || <span className="text-gray-400">-</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm max-w-xs truncate">
                                                        {patrol.notes || <span className="text-gray-400">-</span>}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                        {patrol.notes?.includes('강제종료') ? (
                                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">강제종료</span>
                                                        ) : patrol.end_time ? (
                                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">완료</span>
                                                        ) : (
                                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">진행중</span>
                                                        )}
                                                    </td>
                                                </tr>
                                                {/* 확장된 체크 상세 */}
                                                {isExpanded && checkCount > 0 && (
                                                    <tr key={`${patrol.id}-detail`}>
                                                        <td colSpan="8" className="px-4 py-3 bg-purple-50">
                                                            <div className="text-sm">
                                                                <p className="font-medium text-purple-800 mb-2">📋 태도 체크 상세 ({checkCount}건)</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {getPatrolChecks(patrol.id).map(check => (
                                                                        <div
                                                                            key={check.id}
                                                                            className="px-2 py-1 bg-white rounded border text-xs"
                                                                        >
                                                                            <span className="font-medium">{formatTime(check.check_time)}</span>
                                                                            {' - '}
                                                                            <span className={`px-1 rounded ${
                                                                                check.attitude_type === '정상' ? 'bg-green-200' :
                                                                                check.attitude_type === '졸음' ? 'bg-yellow-200' :
                                                                                check.attitude_type === '딴짓' ? 'bg-orange-200' :
                                                                                check.attitude_type === '이탈' ? 'bg-red-200' : 'bg-gray-200'
                                                                            }`}>{check.attitude_type}</span>
                                                                            {check.checker_name && <span className="text-gray-500"> ({check.checker_name})</span>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {filteredPatrols.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                {dateFilter ? '해당 날짜의 순찰 기록이 없습니다.' : '순찰 기록이 없습니다.'}
                            </div>
                        )}
                    </div>
                )}

                {/* 출석 기록 탭 */}
                {activeTab === 'attendance' && (
                    <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
                        <p className="text-gray-600 mb-3">오늘 출석 기록: {attendanceRecords.length}건</p>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">학생</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">교시</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">메모</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {attendanceRecords.map(record => (
                                        <tr key={record.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                {new Date(record.date).toLocaleDateString('ko-KR')}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                                {getStudentName(record.student_id)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                {record.period ? `${record.period}교시` : '일일'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    record.status === '자습중' ? 'bg-green-100 text-green-800' :
                                                    record.status === '지각' ? 'bg-orange-100 text-orange-800' :
                                                    record.status === '결석' ? 'bg-red-100 text-red-800' :
                                                    record.status === '학교' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {record.notes || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {attendanceRecords.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                오늘 출석 기록이 없습니다.
                            </div>
                        )}
                    </div>
                )}

                {/* 태도 체크 탭 */}
                {activeTab === 'attitudes' && (
                    <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
                        <p className="text-gray-600 mb-3">오늘 태도 체크: {attitudeChecks.length}건</p>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">학생</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">태도</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">체크자</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">메모</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {attitudeChecks.map(check => (
                                        <tr key={check.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-mono">
                                                {formatTime(check.check_time)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                                {getStudentName(check.student_id)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    check.attitude_type === '정상' ? 'bg-green-100 text-green-800' :
                                                    check.attitude_type === '졸음' ? 'bg-yellow-100 text-yellow-800' :
                                                    check.attitude_type === '딴짓' ? 'bg-orange-100 text-orange-800' :
                                                    check.attitude_type === '이탈' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {check.attitude_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                {check.checker_name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {check.notes || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {attitudeChecks.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                오늘 태도 체크 기록이 없습니다.
                            </div>
                        )}
                    </div>
                )}

                {/* 안내 문구 */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                        💡 이 페이지는 운영진 전용입니다. 순찰 및 출석 확인은 <a href="/supervision" className="underline font-medium">학습 감독 페이지</a>에서 진행하세요.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Patrols
