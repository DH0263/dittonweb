import { useState, useEffect } from 'react'
import api from '../api/axios'

// A자습실 (오픈형)
const SEAT_LAYOUT_A = {
    name: 'A자습실 (오픈형)',
    rows: [
        { seats: [35, 36, 37, 38, 39, null, 40, 41, 42] },
        { seats: [26, 27, 28, 29, 30, 31, 32, 33, 34] },
        { seats: [18, 19, 20, 21, 22, 23, 24, 25] },
        { seats: [11, 12, 13, 14, null, null, 15, 16] },
        { seats: [6, 7, 8, 9, 10] },
        { seats: [1, 2, 3, 4, 5] }
    ]
}

// B자습실 (독서실형)
const SEAT_LAYOUT_B = {
    name: 'B자습실 (독서실형)',
    rows: [
        { seats: [null, null, null, null, 22, 23] },
        { seats: [18, 19, 20, 21] },
        { seats: [10, 11, 12, 13, 14] },
        { seats: ['door', 1, 2, 3, 4, 5, null, null, 15, 16, 17] },
        { seats: [null, null, null, null, null, null, 6, 7, 8, 9] }
    ]
}

// 고등학생 타입 목록
const HIGH_SCHOOL_TYPES = ['예비고1', '고1', '고2', '고3']

const STATUS_COLORS = {
    studying: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-800', label: '자습중' },
    absent: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-800', label: '결석' },
    late: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-800', label: '지각' },
    on_schedule: { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-800', label: '일정중' },
    school: { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-800', label: '학교' },
    attitude_warning: { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-800', label: '태도주의' },
    empty: { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-500', label: '빈좌석' }
}

// 출석 상태 매핑
const ATTENDANCE_STATUS_MAP = {
    '자습중': 'studying',
    '결석': 'absent',
    '지각': 'late',
    '일정중': 'on_schedule',
    '학교': 'school'
}

// 교시 시간표 (백엔드와 동기화)
const PERIOD_SCHEDULE = {
    1: { start: "08:00", end: "10:00" },   // 1교시
    2: { start: "10:20", end: "12:00" },   // 2교시
    3: { start: "13:00", end: "15:00" },   // 3교시
    4: { start: "15:20", end: "16:40" },   // 4교시
    5: { start: "16:50", end: "18:00" },   // 5교시
    6: { start: "19:00", end: "20:20" },   // 6교시
    7: { start: "20:30", end: "22:00" },   // 7교시
}

// 현재 교시 계산
const getCurrentPeriod = () => {
    const now = new Date()
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' +
                       now.getMinutes().toString().padStart(2, '0')

    for (const [period, { start, end }] of Object.entries(PERIOD_SCHEDULE)) {
        if (currentTime >= start && currentTime <= end) {
            return parseInt(period)
        }
    }
    return null // 쉬는시간/점심/저녁시간
}

// 시간 포맷 함수 (HH:MM:SS 형태로)
const formatTime = (timeStr) => {
    if (!timeStr) return ''
    // "16:10:24.872172" -> "16:10:24"
    return timeStr.split('.')[0]
}

function Supervision() {
    const [supervisionData, setSupervisionData] = useState(null)
    const [selectedStudent, setSelectedStudent] = useState(null)
    const [loading, setLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [activeRoom, setActiveRoom] = useState('A')

    // 모드: 'view' | 'patrol' | 'attendance' | 'phone'
    const [mode, setMode] = useState('view')

    // 순찰 상태
    const [currentPatrol, setCurrentPatrol] = useState(null)
    const [patrolNotes, setPatrolNotes] = useState('')
    const [checkerName, setCheckerName] = useState('') // 체크자 이름 (일괄)

    // 휴대폰 제출 관리 (출석 확인과 동일한 방식)
    const [phonePeriod, setPhonePeriod] = useState(1) // 현재 교시
    const [phoneData, setPhoneData] = useState([]) // 오늘의 제출 기록
    const [phoneChanges, setPhoneChanges] = useState({}) // 변경사항 (student_id: is_submitted)

    // 순찰 태도 체크 (정상은 기록하지 않음 - 문제 있는 학생만 체크)
    const [attitudeType, setAttitudeType] = useState('졸음')
    const [attitudeNotes, setAttitudeNotes] = useState('')
    const [currentPatrolChecks, setCurrentPatrolChecks] = useState([]) // 현재 순찰 체크 목록

    // 교시별 출석 상태
    const [currentPeriod, setCurrentPeriod] = useState(1)
    const [attendanceData, setAttendanceData] = useState([])
    const [attendanceChanges, setAttendanceChanges] = useState({})

    // 시스템 현재 교시 (서버에서 조회)
    const [currentSystemPeriod, setCurrentSystemPeriod] = useState(null)

    // 1교시 지각 일괄 모드
    const [lateMode, setLateMode] = useState(false)

    // 지각→자습중 전환 모드
    const [lateToStudyingMode, setLateToStudyingMode] = useState(false)

    // 고등학생 학교 등원 체크 목록
    const [schoolAttendance, setSchoolAttendance] = useState({})

    // 강제종료 경고 상태
    const [showForceEndWarning, setShowForceEndWarning] = useState(false)

    useEffect(() => {
        fetchSupervisionData()
        checkCurrentPatrol()
        fetchSchoolAttendance()
        checkCurrentPeriod()

        // 이전 강제종료 기록 확인
        const lastForceEnd = localStorage.getItem('patrol_force_ended')
        if (lastForceEnd) {
            setShowForceEndWarning(true)
        }

        const interval = setInterval(() => {
            fetchSupervisionData()
            setCurrentTime(new Date())
            checkCurrentPeriod()  // 1분마다 현재 교시 체크
        }, 60000)  // 1분마다

        return () => clearInterval(interval)
    }, [])

    // 순찰 중 페이지 이탈 시 강제종료 처리
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (currentPatrol && mode === 'patrol') {
                e.preventDefault()
                e.returnValue = '순찰이 진행 중입니다. 페이지를 벗어나면 강제종료됩니다.'
                return e.returnValue
            }
        }

        const handleUnload = () => {
            if (currentPatrol && mode === 'patrol') {
                // 강제종료 기록 저장
                localStorage.setItem('patrol_force_ended', JSON.stringify({
                    patrol_id: currentPatrol.patrol_id,
                    timestamp: new Date().toISOString()
                }))
                // 비동기 API 호출 (sendBeacon 사용)
                // VITE_API_URL 환경변수 사용 (프로덕션 배포 지원)
                const API_URL = import.meta.env.VITE_API_URL || ''
                const formData = new FormData()
                formData.append('notes', '강제종료 - 페이지 이탈')
                navigator.sendBeacon(`${API_URL}/patrols/${currentPatrol.patrol_id}/force-end`, formData)
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        window.addEventListener('unload', handleUnload)

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            window.removeEventListener('unload', handleUnload)
        }
    }, [currentPatrol, mode])

    useEffect(() => {
        if (mode === 'attendance') {
            fetchAttendanceData()
            initializeAttendance()
        } else if (mode === 'phone') {
            fetchPhoneData()
            initializePhoneSubmissions()
        }
    }, [mode, currentPeriod, phonePeriod])

    const fetchSupervisionData = async () => {
        try {
            const res = await api.get('/supervision/current-status')
            setSupervisionData(res.data)
            setLoading(false)
        } catch (error) {
            console.error('Error fetching supervision data:', error)
            setLoading(false)
        }
    }

    const fetchAttendanceData = async () => {
        try {
            const res = await api.get('/attendance-records/today/by-period')
            setAttendanceData(res.data)
        } catch (error) {
            console.error('Error fetching attendance data:', error)
        }
    }

    const fetchSchoolAttendance = async () => {
        try {
            const res = await api.get('/school-attendance/today')
            const schoolMap = {}
            res.data.student_ids.forEach(id => {
                schoolMap[id] = true
            })
            setSchoolAttendance(schoolMap)
        } catch (error) {
            console.error('Error fetching school attendance:', error)
        }
    }

    const fetchPhoneData = async () => {
        try {
            const res = await api.get('/phone-submissions/today/by-period')
            setPhoneData(res.data)
        } catch (error) {
            console.error('Error fetching phone data:', error)
        }
    }

    // 현재 교시 조회 (서버에서)
    const checkCurrentPeriod = async () => {
        try {
            const res = await api.get('/system/current-period')
            setCurrentSystemPeriod(res.data.current_period)
        } catch (error) {
            console.error('Error checking current period:', error)
        }
    }

    // 휴대폰 제출 초기화 (기본값: 모두 제출)
    const initializePhoneSubmissions = () => {
        if (supervisionData) {
            const initialChanges = {}
            supervisionData.students.forEach(student => {
                // 기존 기록이 없으면 기본값 true (제출)로 초기화
                const phoneStudent = phoneData.find(p => p.student_id === student.id)
                if (!phoneStudent) {
                    initialChanges[student.id] = true
                }
            })
            setPhoneChanges(initialChanges)
        }
    }

    // 1교시 시작 시 모든 학생을 자습중으로 초기화
    const initializeAttendance = () => {
        if (currentPeriod === 1 && supervisionData) {
            const initialChanges = {}
            supervisionData.students.forEach(student => {
                // 고등학생이고 학교 등원 체크된 경우 제외
                const isHighSchool = HIGH_SCHOOL_TYPES.includes(student.student_type)
                const isAtSchool = schoolAttendance[student.id]

                if (!(isHighSchool && isAtSchool)) {
                    // 기존 출석 기록이 없으면 자습중으로 초기화
                    const attStudent = attendanceData.find(a => a.student_id === student.id)
                    if (!attStudent?.periods?.[1]) {
                        initialChanges[student.id] = '자습중'
                    }
                }
            })
            setAttendanceChanges(initialChanges)
        } else {
            setAttendanceChanges({})
        }
    }

    const checkCurrentPatrol = async () => {
        try {
            const res = await api.get('/patrols/current')
            if (res.data.is_active) {
                setCurrentPatrol(res.data)
                // 자동으로 patrol 모드로 전환하지 않음 - 사용자가 직접 선택
            }
        } catch (error) {
            console.error('Error checking current patrol:', error)
        }
    }

    const dismissForceEndWarning = () => {
        localStorage.removeItem('patrol_force_ended')
        setShowForceEndWarning(false)
    }

    const startPatrol = async () => {
        // 강제종료 경고가 있으면 확인
        if (showForceEndWarning) {
            const forceEndData = JSON.parse(localStorage.getItem('patrol_force_ended') || '{}')
            const warningTime = forceEndData.timestamp ? new Date(forceEndData.timestamp).toLocaleString('ko-KR') : '알 수 없음'
            if (!window.confirm(`이전 순찰이 ${warningTime}에 강제종료되었습니다.\n\n새 순찰을 시작하시겠습니까?`)) {
                return
            }
            dismissForceEndWarning()
        }

        try {
            const res = await api.post('/patrols/start')
            setCurrentPatrol(res.data)
            setCurrentPatrolChecks([])
            setMode('patrol')
            alert('순찰이 시작되었습니다.')
        } catch (error) {
            console.error('Error starting patrol:', error)
            alert('순찰 시작 실패: ' + (error.response?.data?.detail || error.message))
        }
    }

    // 기존 순찰 계속하기
    const resumePatrol = () => {
        if (currentPatrol) {
            setMode('patrol')
            fetchPatrolChecks(currentPatrol.patrol_id)
        }
    }

    // 순찰 제출 (정상 완료)
    const submitPatrol = async () => {
        if (!currentPatrol) return

        try {
            const res = await api.post(`/patrols/${currentPatrol.patrol_id}/end`, null, {
                params: { notes: patrolNotes, inspector_name: checkerName }
            })

            // 진행 시간 계산
            const startTime = currentPatrol.start_time.split('.')[0]
            const [h, m, s] = startTime.split(':').map(Number)
            const startMinutes = h * 60 + m
            const now = new Date()
            const nowMinutes = now.getHours() * 60 + now.getMinutes()
            const duration = nowMinutes - startMinutes

            alert(`제출 완료!\n진행시간: ${duration}분\n체크 수: ${res.data.attitude_checks_count}개`)
            setCurrentPatrol(null)
            setCurrentPatrolChecks([])
            setMode('view')
            setPatrolNotes('')
            setCheckerName('')
        } catch (error) {
            console.error('Error submitting patrol:', error)
            alert('순찰 제출 실패')
        }
    }

    // 순찰 취소 (제출 없이 종료)
    const cancelPatrol = async () => {
        if (!currentPatrol) return

        if (!confirm('순찰을 취소하시겠습니까? 기록된 태도 체크는 유지됩니다.')) return

        setCurrentPatrol(null)
        setCurrentPatrolChecks([])
        setMode('view')
        setPatrolNotes('')
        setCheckerName('')
    }

    // 현재 순찰의 체크 목록 가져오기
    const fetchPatrolChecks = async (patrolId) => {
        if (!patrolId) return
        try {
            const res = await api.get(`/study-attitude-checks/patrol/${patrolId}`)
            setCurrentPatrolChecks(res.data)
        } catch (error) {
            console.error('Error fetching patrol checks:', error)
        }
    }

    // 태도 체크 삭제
    const deleteAttitudeCheck = async (checkId) => {
        if (!confirm('이 태도 체크를 삭제하시겠습니까?')) return

        try {
            await api.delete(`/study-attitude-checks/${checkId}`)
            // 목록 갱신
            if (currentPatrol) {
                fetchPatrolChecks(currentPatrol.patrol_id)
                checkCurrentPatrol()
            }
            fetchSupervisionData()
        } catch (error) {
            console.error('Error deleting attitude check:', error)
            alert('삭제 실패: ' + (error.response?.data?.detail || error.message))
        }
    }

    const getStudentBySeat = (room, seatNumber) => {
        if (!supervisionData) return null
        const seatId = `${room}${seatNumber}`
        return supervisionData.students.find(s => s.seat_number === seatId)
    }

    const getAttendanceStudentBySeat = (room, seatNumber) => {
        const seatId = `${room}${seatNumber}`
        return attendanceData.find(s => s.seat_number === seatId)
    }

    // 학생의 현재 출석 상태 결정 (순찰 모드에서 사용)
    const getStudentCurrentStatus = (student) => {
        if (!student) return 'empty'

        // 고등학생이고 학교 등원 체크된 경우 (오후 6시 이전)
        const isHighSchool = HIGH_SCHOOL_TYPES.includes(student.student_type)
        const isAtSchool = schoolAttendance[student.id]
        const currentHour = new Date().getHours()

        if (isHighSchool && isAtSchool && currentHour < 18) {
            return 'school'
        }

        // 오늘 출석 기록 확인
        const attStudent = attendanceData.find(a => a.student_id === student.id)
        if (attStudent) {
            // 현재 교시 또는 가장 최근 교시의 상태 반환
            for (let p = 7; p >= 1; p--) {
                if (attStudent.periods?.[p]) {
                    const status = attStudent.periods[p]
                    return ATTENDANCE_STATUS_MAP[status] || 'studying'
                }
            }
        }

        // 기본값은 supervision API의 상태 사용
        return student.current_status || 'studying'
    }

    const getStatusLabel = (status) => {
        const labels = {
            studying: '자습중',
            absent: '결석',
            late: '지각',
            on_schedule: '일정중',
            school: '학교',
            attitude_warning: '태도주의'
        }
        return labels[status] || '자습중'
    }

    const handleSeatClick = (room, seatNumber) => {
        const student = getStudentBySeat(room, seatNumber)
        if (!student) return

        if (mode === 'phone') {
            // Phone submission mode - 토글 (제출 ↔ 미제출)
            const currentStatus = getDisplayPhoneStatus(student)
            handlePhoneChange(student.id, !currentStatus)
            return
        } else if (mode === 'patrol') {
            setSelectedStudent(student)
            setAttitudeType('졸음')
            setAttitudeNotes('')
        } else if (mode === 'attendance') {
            // 지각 일괄 모드 (1교시 한정) - 토글 기능
            if (lateMode && currentPeriod === 1) {
                const currentStatus = attendanceChanges[student.id]
                if (currentStatus === '지각') {
                    // 이미 지각이면 자습중으로 되돌림
                    handleAttendanceChange(student.id, '자습중')
                } else {
                    handleAttendanceChange(student.id, '지각')
                }
                return
            }

            // 지각→자습중 전환 모드 - 지각 학생 터치시 자습중으로 전환
            if (lateToStudyingMode) {
                const attStudent = getAttendanceStudentBySeat(room, seatNumber)
                const currentStatus = attendanceChanges[student.id] || attStudent?.periods?.[currentPeriod]
                if (currentStatus === '지각') {
                    handleAttendanceChange(student.id, '자습중')
                }
                return
            }

            // 일반 모드 - 모달 열기
            const attStudent = getAttendanceStudentBySeat(room, seatNumber)
            setSelectedStudent({
                student_id: student.id,
                name: student.name,
                seat_number: student.seat_number,
                student_type: student.student_type,
                periods: attStudent?.periods || {}
            })
        }
    }

    const handleAttitudeCheck = async () => {
        if (!selectedStudent) return

        if (!checkerName) {
            alert('체크자 이름을 상단에 입력해주세요.')
            return
        }

        if (!currentPatrol) {
            alert('순찰이 시작되지 않았습니다.')
            return
        }

        try {
            const now = new Date()
            await api.post('/study-attitude-checks/', {
                student_id: selectedStudent.id,
                patrol_id: currentPatrol.patrol_id,
                check_date: now.toISOString().slice(0, 10),
                check_time: now.toTimeString().slice(0, 8),
                attitude_type: attitudeType,
                notes: attitudeNotes,
                checker_name: checkerName
            })

            // alert 없이 빠르게 진행
            fetchSupervisionData()
            checkCurrentPatrol()
            fetchPatrolChecks(currentPatrol.patrol_id) // 체크 목록 갱신
            setSelectedStudent(null)
        } catch (error) {
            console.error('Error recording attitude check:', error)
            alert('태도 체크 기록 실패')
        }
    }

    const handleAttendanceChange = (studentId, status) => {
        setAttendanceChanges({
            ...attendanceChanges,
            [studentId]: status
        })
    }

    const getDisplayAttendanceStatus = (student) => {
        const studentId = student.student_id || student.id
        if (attendanceChanges[studentId] !== undefined) {
            return attendanceChanges[studentId]
        }
        return student.periods?.[currentPeriod] || null
    }

    // 출석 제출 (저장 후 자동 종료)
    const submitAttendance = async () => {
        if (Object.keys(attendanceChanges).length === 0) {
            alert('변경 사항이 없습니다.')
            return
        }

        const updates = Object.entries(attendanceChanges).map(([student_id, status]) => ({
            student_id: parseInt(student_id),
            status: status
        }))

        try {
            // 첫 시도 (force=false)
            await api.post(`/attendance-records/period/bulk?period=${currentPeriod}&force=false`, updates)
            alert(`${currentPeriod}교시 출석이 제출되었습니다.`)

            // 자동으로 출석 확인 모드 종료
            setMode('view')
            setAttendanceChanges({})
            setLateMode(false)
            setLateToStudyingMode(false)
            setSelectedStudent(null)

            // 데이터 새로고침
            fetchSupervisionData()
            fetchAttendanceData()
        } catch (error) {
            // 시간 불일치 경고 처리
            if (error.response?.data?.detail?.type === 'period_mismatch') {
                const detail = error.response.data.detail
                const confirmed = confirm(
                    `⚠️ 시간 확인\n\n${detail.message}\n\n그래도 저장하시겠습니까?`
                )

                if (confirmed) {
                    // force=true로 재시도
                    try {
                        await api.post(`/attendance-records/period/bulk?period=${currentPeriod}&force=true`, updates)
                        alert(`${currentPeriod}교시 출석이 제출되었습니다.`)

                        setMode('view')
                        setAttendanceChanges({})
                        setLateMode(false)
                        setLateToStudyingMode(false)
                        setSelectedStudent(null)

                        fetchSupervisionData()
                        fetchAttendanceData()
                    } catch (retryError) {
                        console.error('Error on forced save:', retryError)
                        alert('저장 실패: ' + (retryError.response?.data?.detail || retryError.message))
                    }
                }
            } else {
                // 다른 에러
                console.error('Error submitting attendance:', error)
                alert('출석 제출 실패: ' + (error.response?.data?.detail || error.message))
            }
        }
    }

    // 고등학생 학교 등원 토글 (API 연동)
    const toggleSchoolAttendance = async (studentId) => {
        const isCurrentlyAtSchool = schoolAttendance[studentId]

        try {
            if (isCurrentlyAtSchool) {
                await api.delete(`/school-attendance/${studentId}`)
            } else {
                await api.post(`/school-attendance/${studentId}`)
            }

            setSchoolAttendance({
                ...schoolAttendance,
                [studentId]: !isCurrentlyAtSchool
            })
        } catch (error) {
            console.error('Error toggling school attendance:', error)
            alert('학교 등원 상태 변경 실패')
        }
    }

    // 휴대폰 제출 상태 변경 (토글)
    const handlePhoneChange = (studentId, isSubmitted) => {
        setPhoneChanges({
            ...phoneChanges,
            [studentId]: isSubmitted
        })
    }

    // 학생의 현재 휴대폰 제출 상태 결정
    const getDisplayPhoneStatus = (student) => {
        const studentId = student.student_id || student.id
        if (phoneChanges[studentId] !== undefined) {
            return phoneChanges[studentId]
        }
        // 기존 데이터에서 찾기
        const phoneStudent = phoneData.find(p => p.student_id === studentId)
        if (phoneStudent) {
            return phoneStudent.is_submitted
        }
        // 기본값: true (제출)
        return true
    }

    // 휴대폰 제출 상태 일괄 저장
    const submitPhoneSubmissions = async () => {
        if (Object.keys(phoneChanges).length === 0) {
            alert('변경 사항이 없습니다.')
            return
        }

        const updates = Object.entries(phoneChanges).map(([student_id, is_submitted]) => ({
            student_id: parseInt(student_id),
            is_submitted: is_submitted
        }))

        try {
            // 첫 시도 (force=false)
            await api.post(`/phone-submissions/period/bulk?period=${phonePeriod}&force=false`, updates, {
                params: { checked_by: '감독자' }
            })
            alert(`${phonePeriod}교시 휴대폰 제출 상태가 저장되었습니다.`)

            // 자동으로 휴대폰 제출 모드 종료
            setMode('view')
            setPhoneChanges({})

            // 데이터 새로고침
            fetchSupervisionData()
            fetchPhoneData()
        } catch (error) {
            // 시간 불일치 경고 처리
            if (error.response?.data?.detail?.type === 'period_mismatch') {
                const detail = error.response.data.detail
                const confirmed = confirm(
                    `⚠️ 시간 확인\n\n${detail.message}\n\n그래도 저장하시겠습니까?`
                )

                if (confirmed) {
                    // force=true로 재시도
                    try {
                        await api.post(`/phone-submissions/period/bulk?period=${phonePeriod}&force=true`, updates, {
                            params: { checked_by: '감독자' }
                        })
                        alert(`${phonePeriod}교시 휴대폰 제출 상태가 저장되었습니다.`)

                        setMode('view')
                        setPhoneChanges({})

                        fetchSupervisionData()
                        fetchPhoneData()
                    } catch (retryError) {
                        console.error('Error on forced save:', retryError)
                        alert('저장 실패: ' + (retryError.response?.data?.detail || retryError.message))
                    }
                }
            } else {
                // 다른 에러
                console.error('Error submitting phone data:', error)
                alert('제출 저장 실패: ' + (error.response?.data?.detail || error.message))
            }
        }
    }

    const renderSeatCard = (room, seatNum) => {
        if (seatNum === null) {
            return <div className="w-28 h-28 md:w-24 md:h-24"></div>
        }

        if (seatNum === 'door') {
            return (
                <div className="w-28 h-28 md:w-24 md:h-24 bg-gray-200 border-2 border-gray-400 rounded flex items-center justify-center">
                    <span className="text-sm font-bold text-gray-600">출입문</span>
                </div>
            )
        }

        const student = getStudentBySeat(room, seatNum)

        // 휴대폰 제출 모드 (출석 확인과 유사)
        if (mode === 'phone') {
            if (!student) {
                return (
                    <div className="w-28 h-28 md:w-24 md:h-24 bg-gray-50 border-2 border-gray-300 rounded-lg opacity-50 flex items-center justify-center">
                        <div className="text-sm text-center text-gray-500">빈 좌석</div>
                    </div>
                )
            }

            const isSubmitted = getDisplayPhoneStatus(student)
            const hasChanged = phoneChanges[student.id] !== undefined

            return (
                <div
                    onClick={() => handleSeatClick(room, seatNum)}
                    className={`
                        ${isSubmitted ? 'bg-green-100 border-green-500' : 'bg-red-100 border-red-500'}
                        border-2 rounded-lg p-2 transition-all relative
                        flex flex-col items-center justify-center
                        w-28 h-28 md:w-24 md:h-24 cursor-pointer hover:scale-105 active:scale-95
                        ${hasChanged ? 'ring-2 ring-blue-500' : ''}
                        touch-manipulation
                    `}
                >
                    <div className="absolute top-1 right-1 text-xs font-bold opacity-60">
                        {room}{seatNum}
                    </div>
                    {hasChanged && (
                        <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                            ✓
                        </div>
                    )}
                    {isSubmitted ? (
                        <div className="absolute bottom-1 left-1 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                            📱✓
                        </div>
                    ) : (
                        <div className="absolute bottom-1 left-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                            ✗
                        </div>
                    )}
                    <div className={`font-bold text-base mb-1 text-center ${isSubmitted ? 'text-green-800' : 'text-red-800'}`}>
                        {student.name}
                    </div>
                    <div className={`text-sm font-semibold text-center ${isSubmitted ? 'text-green-700' : 'text-red-700'}`}>
                        {isSubmitted ? '제출' : '미제출'}
                    </div>
                </div>
            )
        }

        // 출석 모드
        if (mode === 'attendance') {
            if (!student) {
                return (
                    <div className="w-28 h-28 md:w-24 md:h-24 bg-gray-50 border-2 border-gray-300 rounded-lg opacity-50 flex items-center justify-center">
                        <div className="text-sm text-center text-gray-500">빈 좌석</div>
                    </div>
                )
            }

            // 고등학생이고 학교 등원 체크된 경우
            const isHighSchool = HIGH_SCHOOL_TYPES.includes(student.student_type)
            const isAtSchool = schoolAttendance[student.id]
            const currentHour = new Date().getHours()

            if (isHighSchool && isAtSchool && currentHour < 18) {
                const statusInfo = STATUS_COLORS.school
                return (
                    <div
                        onClick={() => toggleSchoolAttendance(student.id)}
                        className={`
                            ${statusInfo.bg} ${statusInfo.border} ${statusInfo.text}
                            border-2 rounded-lg p-2 transition-all relative
                            flex flex-col items-center justify-center
                            w-28 h-28 md:w-24 md:h-24 cursor-pointer hover:scale-105 active:scale-95
                            touch-manipulation
                        `}
                    >
                        <div className="absolute top-1 right-1 text-xs font-bold opacity-60">
                            {room}{seatNum}
                        </div>
                        <div className="font-bold text-base mb-1 text-center">{student.name}</div>
                        <div className="text-sm font-semibold text-center">학교</div>
                    </div>
                )
            }

            const attStudent = getAttendanceStudentBySeat(room, seatNum)
            const displayStatus = attStudent
                ? getDisplayAttendanceStatus(attStudent)
                : (attendanceChanges[student.id] || (currentPeriod === 1 ? '자습중' : null))
            const statusKey = ATTENDANCE_STATUS_MAP[displayStatus] || 'studying'
            const statusInfo = STATUS_COLORS[statusKey] || STATUS_COLORS.empty
            const hasChanged = attendanceChanges[student.id] !== undefined

            return (
                <div
                    onClick={() => handleSeatClick(room, seatNum)}
                    className={`
                        ${statusInfo.bg} ${statusInfo.border} ${statusInfo.text}
                        border-2 rounded-lg p-2 transition-all relative
                        flex flex-col items-center justify-center
                        w-28 h-28 md:w-24 md:h-24 cursor-pointer hover:scale-105 active:scale-95
                        ${hasChanged ? 'ring-2 ring-blue-500' : ''}
                        ${lateMode && currentPeriod === 1 ? 'ring-2 ring-orange-400' : ''}
                        ${lateToStudyingMode && displayStatus === '지각' ? 'ring-4 ring-green-500 animate-pulse' : ''}
                        touch-manipulation
                    `}
                >
                    <div className="absolute top-1 right-1 text-xs font-bold opacity-60">
                        {room}{seatNum}
                    </div>
                    {hasChanged && (
                        <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                            ✓
                        </div>
                    )}
                    {isHighSchool && (
                        <div className="absolute bottom-1 left-1 bg-blue-500 text-white text-xs px-1 py-0.5 rounded font-bold">
                            {student.student_type}
                        </div>
                    )}
                    <div className="font-bold text-base mb-1 text-center">{student.name}</div>
                    <div className="text-sm font-semibold text-center">{displayStatus || '미확인'}</div>
                </div>
            )
        }

        // 일반/순찰 모드 - 출석 데이터 연동
        const currentStatus = getStudentCurrentStatus(student)
        const baseStatus = currentStatus === 'attitude_warning' ? 'studying' : currentStatus
        const statusInfo = STATUS_COLORS[baseStatus] || STATUS_COLORS.empty
        const hasAttitudeWarning = student && student.current_status === 'attitude_warning'

        return (
            <div
                onClick={() => handleSeatClick(room, seatNum)}
                className={`
                    ${statusInfo.bg} ${statusInfo.border} ${statusInfo.text}
                    border-2 rounded-lg p-2 transition-all relative
                    flex flex-col items-center justify-center
                    w-28 h-28 md:w-24 md:h-24
                    ${student && mode === 'patrol' ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}
                    ${!student ? 'opacity-50' : ''}
                    touch-manipulation
                `}
            >
                <div className="absolute top-1 right-1 text-xs font-bold opacity-60">
                    {room}{seatNum}
                </div>
                {hasAttitudeWarning && (
                    <div className="absolute top-1 left-1 bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                        ⚠
                    </div>
                )}
                {student ? (
                    <>
                        <div className="font-bold text-base mb-1 text-center">{student.name}</div>
                        <div className="text-sm font-semibold text-center">
                            {hasAttitudeWarning ? '자습중' : getStatusLabel(currentStatus)}
                        </div>
                        {student.current_schedule && (
                            <div className="text-xs mt-1 px-1 py-0.5 bg-white rounded">
                                {student.current_schedule.type === 'counseling' ? '상담' : '외출'}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-sm text-center">빈 좌석</div>
                )}
            </div>
        )
    }

    const renderRoom = (layout, room) => {
        return (
            <div className="flex flex-col items-start">
                {layout.rows.map((row, rowIdx) => (
                    <div key={rowIdx} className="mb-4 md:mb-6">
                        <div className="flex gap-1 md:gap-2">
                            {row.seats.map((seatNum, seatIdx) => (
                                <div key={`${rowIdx}-${seatIdx}`}>
                                    {renderSeatCard(room, seatNum)}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    // 고등학생 목록 (학교 등원 체크용)
    const getHighSchoolStudents = () => {
        if (!supervisionData) return []
        return supervisionData.students.filter(s => HIGH_SCHOOL_TYPES.includes(s.student_type))
    }

    if (loading) {
        return <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="text-xl">로딩 중...</div>
        </div>
    }

    const currentLayout = activeRoom === 'A' ? SEAT_LAYOUT_A : SEAT_LAYOUT_B
    const highSchoolStudents = getHighSchoolStudents()

    return (
        <div className="min-h-screen bg-gray-100 p-2 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* 강제종료 경고 배너 */}
                {showForceEndWarning && (
                    <div className="bg-red-100 border-2 border-red-500 rounded-lg p-4 mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">&#9888;</span>
                            <div>
                                <p className="font-bold text-red-800">이전 순찰이 강제종료되었습니다</p>
                                <p className="text-sm text-red-600">페이지를 벗어나 순찰이 자동으로 종료되었습니다.</p>
                            </div>
                        </div>
                        <button
                            onClick={dismissForceEndWarning}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                        >
                            확인
                        </button>
                    </div>
                )}

                {/* 헤더 */}
                <div className="bg-white rounded-lg shadow-md p-3 md:p-4 mb-3">
                    <div className="flex justify-between items-center mb-3">
                        <div>
                            <h1 className="text-xl md:text-3xl font-bold text-gray-800">학습 감독</h1>
                            <p className="text-sm text-gray-600 mt-1">
                                {currentTime.toLocaleTimeString('ko-KR')}
                            </p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => { fetchSupervisionData(); fetchAttendanceData(); }}
                                className="bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 text-sm touch-manipulation"
                            >
                                🔄
                            </button>
                            <a href="/" className="text-blue-600 hover:underline text-sm">
                                ← 홈
                            </a>
                        </div>
                    </div>

                    {/* 모드 선택 버튼 */}
                    <div className="flex flex-wrap gap-2 mb-3">
                        {/* 순찰 버튼 */}
                        {mode !== 'patrol' ? (
                            currentPatrol ? (
                                // 이미 활성 순찰이 있으면 "순찰 계속" 버튼
                                <button
                                    onClick={resumePatrol}
                                    disabled={mode === 'attendance' || mode === 'phone'}
                                    className={`px-4 py-3 rounded-lg font-bold text-sm touch-manipulation ${
                                        mode === 'attendance' || mode === 'phone'
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-purple-600 text-white hover:bg-purple-700'
                                    }`}
                                >
                                    순찰 계속
                                </button>
                            ) : (
                                // 활성 순찰이 없으면 "순찰 시작" 버튼
                                <button
                                    onClick={startPatrol}
                                    disabled={mode === 'attendance' || mode === 'phone'}
                                    className={`px-4 py-3 rounded-lg font-bold text-sm touch-manipulation ${
                                        mode === 'attendance' || mode === 'phone'
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-purple-600 text-white hover:bg-purple-700'
                                    }`}
                                >
                                    순찰 시작
                                </button>
                            )
                        ) : (
                            <>
                                <button
                                    onClick={submitPatrol}
                                    className="bg-green-600 text-white px-4 py-3 rounded-lg font-bold text-sm touch-manipulation hover:bg-green-700"
                                >
                                    순찰 제출
                                </button>
                                <button
                                    onClick={cancelPatrol}
                                    className="bg-gray-500 text-white px-4 py-3 rounded-lg font-bold text-sm touch-manipulation hover:bg-gray-600"
                                >
                                    취소
                                </button>
                            </>
                        )}

                        {/* 출석 확인 버튼 */}
                        {mode !== 'attendance' ? (
                            <button
                                onClick={() => {
                                    // 현재 교시 자동 선택
                                    const period = getCurrentPeriod()
                                    if (period) {
                                        setCurrentPeriod(period)
                                    }
                                    setMode('attendance')
                                }}
                                disabled={mode === 'patrol' || mode === 'phone'}
                                className={`px-4 py-3 rounded-lg font-bold text-sm touch-manipulation ${
                                    mode === 'patrol' || mode === 'phone'
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-cyan-600 text-white hover:bg-cyan-700'
                                }`}
                            >
                                출석 확인 {getCurrentPeriod() ? `(${getCurrentPeriod()}교시)` : ''}
                            </button>
                        ) : (
                            <button
                                onClick={() => { setMode('view'); setAttendanceChanges({}); setLateMode(false); setLateToStudyingMode(false); }}
                                className="bg-gray-600 text-white px-4 py-3 rounded-lg font-bold text-sm touch-manipulation hover:bg-gray-700"
                            >
                                취소
                            </button>
                        )}

                        {/* 휴대폰 제출 버튼 */}
                        {mode !== 'phone' ? (
                            <button
                                onClick={() => {
                                    // 현재 교시 자동 선택
                                    const period = getCurrentPeriod()
                                    if (period) {
                                        setPhonePeriod(period)
                                    }
                                    setMode('phone')
                                }}
                                disabled={mode === 'patrol' || mode === 'attendance'}
                                className={`px-4 py-3 rounded-lg font-bold text-sm touch-manipulation ${
                                    mode === 'patrol' || mode === 'attendance'
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-rose-600 text-white hover:bg-rose-700'
                                }`}
                            >
                                📱 휴대폰 제출 {getCurrentPeriod() ? `(${getCurrentPeriod()}교시)` : ''}
                            </button>
                        ) : (
                            <button
                                onClick={() => { setMode('view'); setPhoneChanges({}); }}
                                className="bg-gray-600 text-white px-4 py-3 rounded-lg font-bold text-sm touch-manipulation hover:bg-gray-700"
                            >
                                취소
                            </button>
                        )}
                    </div>

                    {/* 순찰 모드 안내 */}
                    {mode === 'patrol' && currentPatrol && (
                        <div className="mb-3 p-3 bg-purple-50 border-2 border-purple-300 rounded-lg">
                            <div className="flex flex-col md:flex-row gap-3">
                                <div className="flex-1">
                                    <p className="text-purple-800 font-semibold text-lg">
                                        📝 순찰 진행중 (시작: {formatTime(currentPatrol.start_time)})
                                    </p>
                                    <p className="text-sm text-purple-600 mt-1">
                                        체크 수: {currentPatrolChecks.length}개 | 학생 터치하여 태도 체크
                                    </p>
                                </div>
                                <div className="flex flex-col md:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={checkerName}
                                        onChange={e => setCheckerName(e.target.value)}
                                        placeholder="체크자 이름 (필수)"
                                        className="p-2 border-2 border-purple-300 rounded-lg text-sm w-full md:w-40"
                                    />
                                    <input
                                        type="text"
                                        value={patrolNotes}
                                        onChange={e => setPatrolNotes(e.target.value)}
                                        placeholder="순찰 메모"
                                        className="p-2 border rounded-lg text-sm w-full md:w-48"
                                    />
                                </div>
                            </div>

                            {/* 현재 순찰 체크 목록 (삭제 가능) */}
                            {currentPatrolChecks.length > 0 && (
                                <div className="mt-3 p-2 bg-white rounded-lg">
                                    <p className="text-purple-800 font-semibold text-sm mb-2">📋 이번 순찰 체크 ({currentPatrolChecks.length}건) - 제출 전 삭제 가능</p>
                                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                        {currentPatrolChecks.map(check => {
                                            const student = supervisionData?.students.find(s => s.id === check.student_id)
                                            return (
                                                <div
                                                    key={check.id}
                                                    className="flex items-center gap-1 px-2 py-1 bg-purple-100 rounded text-sm"
                                                >
                                                    <span className="font-medium">{student?.name || `ID:${check.student_id}`}</span>
                                                    <span className={`px-1 rounded text-xs ${
                                                        check.attitude_type === '정상' ? 'bg-green-200' :
                                                        check.attitude_type === '졸음' ? 'bg-yellow-200' :
                                                        check.attitude_type === '딴짓' ? 'bg-orange-200' :
                                                        check.attitude_type === '이탈' ? 'bg-red-200' : 'bg-gray-200'
                                                    }`}>{check.attitude_type}</span>
                                                    <button
                                                        onClick={() => deleteAttitudeCheck(check.id)}
                                                        className="ml-1 text-red-500 hover:text-red-700 font-bold touch-manipulation"
                                                        title="삭제"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 출석 확인 모드 안내 */}
                    {mode === 'attendance' && (
                        <div className="mb-3 p-3 bg-cyan-50 border-2 border-cyan-300 rounded-lg">
                            {/* 교시 선택 */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className="text-cyan-800 font-semibold">📋 교시:</span>
                                {[1, 2, 3, 4, 5, 6, 7].map(period => {
                                    const isActive = period === currentSystemPeriod
                                    const isSelected = currentPeriod === period
                                    return (
                                        <button
                                            key={period}
                                            onClick={() => { setCurrentPeriod(period); setLateMode(false); }}
                                            className={`px-4 py-2 rounded-lg font-bold text-sm touch-manipulation relative ${
                                                isSelected
                                                    ? 'bg-cyan-600 text-white'
                                                    : isActive
                                                        ? 'bg-cyan-100 text-cyan-700 border-2 border-cyan-500 ring-2 ring-green-500'
                                                        : 'bg-white text-cyan-700 border-2 border-cyan-400'
                                            }`}
                                        >
                                            {period}
                                            {isActive && <span className="absolute -top-1 -right-1 text-xs">⏰</span>}
                                        </button>
                                    )
                                })}
                            </div>

                            {/* 1교시 지각 일괄 모드 + 지각→자습중 전환 + 제출 버튼 */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    {currentPeriod === 1 && (
                                        <button
                                            onClick={() => { setLateMode(!lateMode); setLateToStudyingMode(false); }}
                                            className={`px-4 py-2 rounded-lg font-bold text-sm touch-manipulation ${
                                                lateMode
                                                    ? 'bg-orange-500 text-white ring-2 ring-orange-300'
                                                    : 'bg-orange-100 text-orange-700 border-2 border-orange-400'
                                            }`}
                                        >
                                            {lateMode ? '🔥 지각 모드 ON' : '지각 일괄'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { setLateToStudyingMode(!lateToStudyingMode); setLateMode(false); }}
                                        className={`px-4 py-2 rounded-lg font-bold text-sm touch-manipulation ${
                                            lateToStudyingMode
                                                ? 'bg-green-500 text-white ring-2 ring-green-300'
                                                : 'bg-green-100 text-green-700 border-2 border-green-400'
                                        }`}
                                    >
                                        {lateToStudyingMode ? '✓ 지각→출석 ON' : '지각→출석'}
                                    </button>
                                </div>
                                <button
                                    onClick={submitAttendance}
                                    disabled={Object.keys(attendanceChanges).length === 0}
                                    className={`px-6 py-3 rounded-lg font-bold text-base touch-manipulation ${
                                        Object.keys(attendanceChanges).length === 0
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
                                    }`}
                                >
                                    제출 ({Object.keys(attendanceChanges).length}건)
                                </button>
                            </div>

                            {/* 고등학생 학교 등원 체크 */}
                            {highSchoolStudents.length > 0 && (
                                <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                                    <p className="text-blue-800 font-semibold text-sm mb-2">🏫 고등학생 학교 등원 체크:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {highSchoolStudents.map(student => (
                                            <button
                                                key={student.id}
                                                onClick={() => toggleSchoolAttendance(student.id)}
                                                className={`px-3 py-1 rounded-lg text-sm font-semibold touch-manipulation ${
                                                    schoolAttendance[student.id]
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-white text-blue-700 border border-blue-400'
                                                }`}
                                            >
                                                {student.name} ({student.student_type})
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <p className="text-sm text-cyan-600 mt-2">
                                {currentPeriod === 1
                                    ? '1교시: 모든 학생이 자습중으로 시작 | 지각/결석만 체크하세요'
                                    : '학생 터치하여 출석 상태 변경'}
                            </p>
                        </div>
                    )}

                    {/* 휴대폰 제출 모드 안내 */}
                    {mode === 'phone' && (
                        <div className="mb-3 p-3 bg-rose-50 border-2 border-rose-300 rounded-lg">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className="text-rose-800 font-semibold">📱 교시:</span>
                                {[1, 2, 3, 4, 5, 6, 7].map(period => {
                                    const isActive = period === currentSystemPeriod
                                    const isSelected = phonePeriod === period
                                    return (
                                        <button
                                            key={period}
                                            onClick={() => { setPhonePeriod(period); }}
                                            className={`px-4 py-2 rounded-lg font-bold text-sm touch-manipulation relative ${
                                                isSelected
                                                    ? 'bg-rose-600 text-white'
                                                    : isActive
                                                        ? 'bg-rose-100 text-rose-700 border-2 border-rose-500 ring-2 ring-green-500'
                                                        : 'bg-white text-rose-700 border-2 border-rose-400'
                                            }`}
                                        >
                                            {period}
                                            {isActive && <span className="absolute -top-1 -right-1 text-xs">⏰</span>}
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-rose-600">
                                        기본: 모두 제출 | 안낸 학생만 터치하여 미제출 표시
                                    </p>
                                    <p className="text-xs text-rose-500 mt-1">
                                        • 녹색: 제출 | 빨간색: 미제출
                                    </p>
                                </div>
                                <button
                                    onClick={submitPhoneSubmissions}
                                    disabled={Object.keys(phoneChanges).length === 0}
                                    className={`px-6 py-3 rounded-lg font-bold text-base touch-manipulation ${
                                        Object.keys(phoneChanges).length === 0
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95'
                                    }`}
                                >
                                    제출 ({Object.keys(phoneChanges).length}건)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 통계 */}
                    {supervisionData && mode !== 'attendance' && (
                        <div className="grid grid-cols-4 gap-2 mb-3">
                            <div className="bg-blue-50 p-2 rounded text-center">
                                <div className="text-xs text-gray-600">전체</div>
                                <div className="text-lg font-bold">{supervisionData.total_students}</div>
                            </div>
                            <div className="bg-green-50 p-2 rounded text-center">
                                <div className="text-xs text-gray-600">출석</div>
                                <div className="text-lg font-bold text-green-600">{supervisionData.present_count}</div>
                            </div>
                            <div className="bg-red-50 p-2 rounded text-center">
                                <div className="text-xs text-gray-600">결석</div>
                                <div className="text-lg font-bold text-red-600">{supervisionData.absent_count}</div>
                            </div>
                            <div className="bg-yellow-50 p-2 rounded text-center">
                                <div className="text-xs text-gray-600">일정중</div>
                                <div className="text-lg font-bold text-yellow-600">{supervisionData.on_schedule_count}</div>
                            </div>
                        </div>
                    )}

                    {/* 범례 */}
                    <div className="flex flex-wrap gap-2 text-xs">
                        {Object.entries(STATUS_COLORS).filter(([key]) => key !== 'empty').map(([key, value]) => (
                            <div key={key} className="flex items-center space-x-1">
                                <div className={`w-3 h-3 ${value.bg} ${value.border} border-2 rounded`}></div>
                                <span>{value.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 자습실 선택 탭 */}
                <div className="flex space-x-2 mb-3">
                    <button
                        onClick={() => setActiveRoom('A')}
                        className={`flex-1 py-3 rounded-lg font-bold text-lg touch-manipulation ${activeRoom === 'A'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 border-2 border-gray-300'
                        }`}
                    >
                        A자습실
                    </button>
                    <button
                        onClick={() => setActiveRoom('B')}
                        className={`flex-1 py-3 rounded-lg font-bold text-lg touch-manipulation ${activeRoom === 'B'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 border-2 border-gray-300'
                        }`}
                    >
                        B자습실
                    </button>
                </div>

                {/* 좌석 배치도 */}
                <div className="bg-white rounded-lg shadow-md p-3 md:p-6 overflow-x-auto">
                    <h2 className="text-lg font-bold mb-4 text-center">{currentLayout.name}</h2>
                    {renderRoom(currentLayout, activeRoom)}
                </div>
            </div>

            {/* 순찰 모드 - 태도 체크 모달 */}
            {selectedStudent && mode === 'patrol' && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 md:p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">
                                {selectedStudent.seat_number} - {selectedStudent.name}
                            </h2>
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="text-3xl w-12 h-12 flex items-center justify-center hover:bg-gray-100 rounded-lg touch-manipulation"
                            >
                                ×
                            </button>
                        </div>

                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <p className="text-lg">
                                현재 상태: <span className="font-bold">{getStatusLabel(selectedStudent.current_status)}</span>
                            </p>
                            {/* 지각 학생인 경우 자습중 전환 버튼 */}
                            {selectedStudent.current_status === 'late' && (
                                <button
                                    onClick={async () => {
                                        try {
                                            // 현재 교시 결정 (PERIOD_SCHEDULE 기반)
                                            const period = getCurrentPeriod() || currentPeriod || 1

                                            await api.post(`/attendance-records/period/bulk?period=${period}`, [{
                                                student_id: selectedStudent.id,
                                                status: '자습중'
                                            }])
                                            alert(`${selectedStudent.name} 학생이 ${period}교시 자습중으로 변경되었습니다.`)
                                            fetchSupervisionData()
                                            setSelectedStudent(null)
                                        } catch (error) {
                                            console.error('Error:', error)
                                            alert('상태 변경 실패')
                                        }
                                    }}
                                    className="mt-2 w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold text-base touch-manipulation active:scale-95"
                                >
                                    ✓ 지각 → 자습중 전환
                                </button>
                            )}
                        </div>

                        <div className="mb-4">
                            <h3 className="font-semibold mb-3 text-lg">자습 태도 선택</h3>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {['졸음', '딴짓', '이탈', '기타'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setAttitudeType(type)}
                                        className={`py-4 px-3 rounded-lg font-bold text-lg ${attitudeType === type
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white border-2 border-gray-300'
                                        } touch-manipulation active:scale-95`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={attitudeNotes}
                                onChange={e => setAttitudeNotes(e.target.value)}
                                placeholder="메모 (선택사항)"
                                className="w-full p-3 border-2 rounded-lg mb-3 text-lg"
                                rows="2"
                            />
                            <button
                                onClick={handleAttitudeCheck}
                                className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 font-bold text-lg touch-manipulation active:scale-95"
                            >
                                태도 체크 기록
                            </button>
                        </div>

                        {selectedStudent.recent_attitude_checks && selectedStudent.recent_attitude_checks.length > 0 && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <h3 className="font-semibold mb-2">오늘 체크 이력</h3>
                                {selectedStudent.recent_attitude_checks.map((check, idx) => (
                                    <div key={idx} className="text-sm mb-1 p-2 bg-white rounded">
                                        • {formatTime(check.check_time)} - <span className="font-bold">{check.attitude_type}</span>
                                        {check.checker_name && ` (${check.checker_name})`}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 출석 모드 - 상태 변경 모달 */}
            {selectedStudent && mode === 'attendance' && !lateMode && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 md:p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">
                                {selectedStudent.seat_number} - {selectedStudent.name}
                            </h2>
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="text-3xl w-12 h-12 flex items-center justify-center hover:bg-gray-100 rounded-lg touch-manipulation"
                            >
                                ×
                            </button>
                        </div>

                        <p className="text-gray-600 mb-4 text-center text-lg">{currentPeriod}교시 출석 상태</p>

                        <div className="grid grid-cols-2 gap-3">
                            {['자습중', '결석', '지각', '일정중'].map(status => {
                                const currentStatus = getDisplayAttendanceStatus(selectedStudent)
                                const isSelected = currentStatus === status
                                const statusKey = ATTENDANCE_STATUS_MAP[status]
                                const statusInfo = STATUS_COLORS[statusKey]

                                return (
                                    <button
                                        key={status}
                                        onClick={() => {
                                            handleAttendanceChange(selectedStudent.student_id, status)
                                            setSelectedStudent(null)
                                        }}
                                        className={`py-5 px-4 rounded-lg font-bold text-xl border-2 ${
                                            isSelected
                                                ? `${statusInfo.bg} ${statusInfo.border} ${statusInfo.text}`
                                                : 'bg-white border-gray-300 hover:border-gray-400'
                                        } touch-manipulation active:scale-95`}
                                    >
                                        {status}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Supervision
