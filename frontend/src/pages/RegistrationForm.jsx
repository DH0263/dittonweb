import { useState } from 'react'
import api from '../api/axios'

const DAYS_OF_WEEK = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

const INQUIRY_SUBJECTS = {
    '사회탐구': ['한국지리', '생활과윤리', '윤리와사상', '세계사', '동아시아사', '세계지리', '사회문화', '정치와 법', '경제'],
    '과학탐구 I': ['물리1', '화학1', '생명과학1', '지구과학1'],
    '과학탐구 II': ['물리2', '화학2', '생명과학2', '지구과학2']
}

function RegistrationForm() {
    const [submitted, setSubmitted] = useState(false)
    const [form, setForm] = useState({
        student_name: '',
        student_phone: '',
        parent_phone: '',
        pre_attendance_status: '신청',
        pre_attendance_date: '',
        first_attendance_date: '',
        gender: '남',
        student_type: '고3',
        korean_subject: '언매',
        math_subject: '확통',
        inquiry_subjects: [],
        recent_grade: {
            exam_name: '',
            korean: '',
            math: '',
            english: '',
            inquiry1: '',
            inquiry2: ''
        },
        special_notes: '',
        seat_type: '독서실형',
        school_name: ''
    })

    // 정기 외출: 요일별로 배열로 관리 (여러 개 가능)
    const [recurringOutings, setRecurringOutings] = useState({
        0: [],
        1: [],
        2: [],
        3: [],
        4: [],
        5: []
    })

    const formatPhoneNumber = (value) => {
        const numbers = value.replace(/[^\d]/g, '')
        if (numbers.length <= 3) return numbers
        if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
    }

    const handlePhoneChange = (field, value) => {
        const formatted = formatPhoneNumber(value)
        setForm({ ...form, [field]: formatted })
    }

    const handleSubjectToggle = (subject) => {
        if (form.inquiry_subjects.includes(subject)) {
            setForm({ ...form, inquiry_subjects: form.inquiry_subjects.filter(s => s !== subject) })
        } else {
            if (form.inquiry_subjects.length < 2) {
                setForm({ ...form, inquiry_subjects: [...form.inquiry_subjects, subject] })
            } else {
                alert('탐구 과목은 최대 2개까지 선택 가능합니다.')
            }
        }
    }

    const addRecurringOuting = (dayIndex) => {
        setRecurringOutings({
            ...recurringOutings,
            [dayIndex]: [...recurringOutings[dayIndex], { start_time: '', end_time: '', reason: '' }]
        })
    }

    const removeRecurringOuting = (dayIndex, outingIndex) => {
        setRecurringOutings({
            ...recurringOutings,
            [dayIndex]: recurringOutings[dayIndex].filter((_, i) => i !== outingIndex)
        })
    }

    const updateRecurringOuting = (dayIndex, outingIndex, field, value) => {
        const updated = [...recurringOutings[dayIndex]]
        updated[outingIndex] = { ...updated[outingIndex], [field]: value }
        setRecurringOutings({
            ...recurringOutings,
            [dayIndex]: updated
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (form.inquiry_subjects.length !== 2) {
            alert('탐구 과목을 정확히 2개 선택해주세요.')
            return
        }

        // 성적 검증
        const grades = [form.recent_grade.korean, form.recent_grade.math, form.recent_grade.english, form.recent_grade.inquiry1, form.recent_grade.inquiry2]
        if (grades.some(g => !g || isNaN(g) || g < 1 || g > 9)) {
            alert('모든 등급을 1-9 사이의 숫자로 입력해주세요.')
            return
        }

        try {
            // 정기 외출 데이터 변환
            const outingsData = {}
            Object.keys(recurringOutings).forEach(dayIndex => {
                if (recurringOutings[dayIndex].length > 0) {
                    outingsData[dayIndex] = recurringOutings[dayIndex].map(o => ({
                        enabled: true,
                        ...o
                    }))
                }
            })

            // 성적 문자열 생성
            const gradeString = `${form.recent_grade.exam_name} ${form.recent_grade.korean}/${form.recent_grade.math}/${form.recent_grade.english}/${form.recent_grade.inquiry1}/${form.recent_grade.inquiry2}`

            const submitData = {
                ...form,
                recent_grade: gradeString,
                pre_attendance_date: form.pre_attendance_date ? new Date(form.pre_attendance_date).toISOString() : null,
                first_attendance_date: new Date(form.first_attendance_date).toISOString(),
                recurring_outings_data: outingsData
            }

            await api.post('/student-registrations/', submitData)
            setSubmitted(true)
            window.scrollTo(0, 0)
        } catch (error) {
            console.error('Error submitting registration:', error)
            alert('제출 실패. 다시 시도해주세요.')
        }
    }

    const shouldShowSchoolName = ['예비고1', '고1', '고2', '고3'].includes(form.student_type)

    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
                <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
                    <div className="text-6xl mb-4">✅</div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">제출 완료!</h1>
                    <p className="text-gray-600 mb-6">
                        신입생 기초조사가 성공적으로 제출되었습니다.<br />
                        학원에서 곧 연락드리겠습니다.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700"
                    >
                        다시 작성하기
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-xl p-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">디턴 신입생 기초조사 및 예비등원 신청</h1>
                <p className="text-gray-600 mb-6">
                    학원 등원에 필요한 정보를 상세하게 기입 부탁드립니다!<br />
                    <span className="text-sm text-gray-500">(예상 소요시간 3분)</span>
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* 1. 학생 이름 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            1. 학생 이름 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.student_name}
                            onChange={e => setForm({ ...form, student_name: e.target.value })}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            required
                        />
                    </div>

                    {/* 2. 본인 연락처 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            2. 본인 연락처 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            value={form.student_phone}
                            onChange={e => handlePhoneChange('student_phone', e.target.value)}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            placeholder="010-1234-5678"
                            required
                        />
                    </div>

                    {/* 3. 학부모 연락처 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            3. 학부모 연락처 <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-2">연락을 받을 수 있는 학부모님 연락처로 기재 부탁드립니다</p>
                        <input
                            type="tel"
                            value={form.parent_phone}
                            onChange={e => handlePhoneChange('parent_phone', e.target.value)}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            placeholder="010-1234-5678"
                            required
                        />
                    </div>

                    {/* 4. 예비등원 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            4. 예비등원 <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                            예비등원이란? 학생이 학원에 본 등원을 하기 전 지문등록, 자리선정, 학원 규정소개를 받는 시간입니다.
                            예비등원을 원하지 않는 학생은 자리가 랜덤배정 됨을 유의해 주시기 바랍니다. 좌석 선정은 선착순입니다.
                        </p>
                        <select
                            value={form.pre_attendance_status}
                            onChange={e => setForm({ ...form, pre_attendance_status: e.target.value })}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            required
                        >
                            <option value="완료">완료</option>
                            <option value="미신청(좌석 즉시 신청)">미신청(좌석 즉시 신청)</option>
                            <option value="신청">신청</option>
                        </select>
                    </div>

                    {/* 5. 등원일 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            5. 등원일 <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-2">첫 등원일 또는 첫등원 희망일을 기재해 주세요</p>
                        <input
                            type="date"
                            value={form.first_attendance_date}
                            onChange={e => setForm({ ...form, first_attendance_date: e.target.value })}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            required
                        />
                    </div>

                    {/* 6. 성별 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            6. 성별 <span className="text-red-500">*</span>
                        </label>
                        <div className="flex space-x-4">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    value="남"
                                    checked={form.gender === '남'}
                                    onChange={e => setForm({ ...form, gender: e.target.value })}
                                    className="mr-2"
                                />
                                남
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    value="여"
                                    checked={form.gender === '여'}
                                    onChange={e => setForm({ ...form, gender: e.target.value })}
                                    className="mr-2"
                                />
                                여
                            </label>
                        </div>
                    </div>

                    {/* 7. 신분 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            7. 신분 <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={form.student_type}
                            onChange={e => setForm({ ...form, student_type: e.target.value })}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            required
                        >
                            <option value="자퇴생">자퇴생</option>
                            <option value="N수생">N수생</option>
                            <option value="고1">고1</option>
                            <option value="고2">고2</option>
                            <option value="고3">고3</option>
                            <option value="예비고1">예비고1</option>
                        </select>
                    </div>

                    {/* 8. 국어 선택과목 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            8. 국어 선택과목 <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={form.korean_subject}
                            onChange={e => setForm({ ...form, korean_subject: e.target.value })}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            required
                        >
                            <option value="언매">언매</option>
                            <option value="화작">화작</option>
                            <option value="미정">미정</option>
                        </select>
                    </div>

                    {/* 9. 수학 선택과목 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            9. 수학 선택과목 <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={form.math_subject}
                            onChange={e => setForm({ ...form, math_subject: e.target.value })}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            required
                        >
                            <option value="확통">확통</option>
                            <option value="미적분">미적분</option>
                            <option value="기하">기하</option>
                            <option value="미정">미정</option>
                        </select>
                    </div>

                    {/* 10. 탐구 선택 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            10. 탐구 선택 <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-2">수능 선택 응시과목 2개 모두 필수 체크 부탁드립니다</p>
                        <div className="space-y-3">
                            {Object.entries(INQUIRY_SUBJECTS).map(([category, subjects]) => (
                                <div key={category}>
                                    <p className="font-medium text-sm text-gray-700 mb-2">{category}</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {subjects.map(subject => (
                                            <label key={subject} className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={form.inquiry_subjects.includes(subject)}
                                                    onChange={() => handleSubjectToggle(subject)}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">{subject}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={form.inquiry_subjects.includes('미정')}
                                    onChange={() => handleSubjectToggle('미정')}
                                    className="mr-2"
                                />
                                <span className="text-sm">미정</span>
                            </label>
                        </div>
                        <p className="text-xs text-blue-600 mt-2">선택된 과목: {form.inquiry_subjects.join(', ') || '없음'} ({form.inquiry_subjects.length}/2)</p>
                    </div>

                    {/* 11. 최근 성적 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            11. 최근 성적 <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-2">최근 평가원 모의고사/수능 성적을 알려주세요</p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">시험 이름</label>
                                <input
                                    type="text"
                                    value={form.recent_grade.exam_name}
                                    onChange={e => setForm({ ...form, recent_grade: { ...form.recent_grade, exam_name: e.target.value } })}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-sm"
                                    placeholder="예: 2025수능, 2024년 9월 모의고사"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">국어</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="9"
                                        value={form.recent_grade.korean}
                                        onChange={e => setForm({ ...form, recent_grade: { ...form.recent_grade, korean: e.target.value } })}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-sm"
                                        placeholder="1-9"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">수학</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="9"
                                        value={form.recent_grade.math}
                                        onChange={e => setForm({ ...form, recent_grade: { ...form.recent_grade, math: e.target.value } })}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-sm"
                                        placeholder="1-9"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">영어</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="9"
                                        value={form.recent_grade.english}
                                        onChange={e => setForm({ ...form, recent_grade: { ...form.recent_grade, english: e.target.value } })}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-sm"
                                        placeholder="1-9"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">탐구1</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="9"
                                        value={form.recent_grade.inquiry1}
                                        onChange={e => setForm({ ...form, recent_grade: { ...form.recent_grade, inquiry1: e.target.value } })}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-sm"
                                        placeholder="1-9"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">탐구2</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="9"
                                        value={form.recent_grade.inquiry2}
                                        onChange={e => setForm({ ...form, recent_grade: { ...form.recent_grade, inquiry2: e.target.value } })}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-sm"
                                        placeholder="1-9"
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 12. 특이사항 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            12. 특이사항 및 부탁사항
                        </label>
                        <textarea
                            value={form.special_notes}
                            onChange={e => setForm({ ...form, special_notes: e.target.value })}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            rows="3"
                        />
                    </div>

                    {/* 13. 좌석 (미신청일 때만) */}
                    {form.pre_attendance_status === '미신청(좌석 즉시 신청)' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                13. 좌석 <span className="text-red-500">*</span>
                            </label>
                            <div className="flex space-x-4">
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        value="독서실형"
                                        checked={form.seat_type === '독서실형'}
                                        onChange={e => setForm({ ...form, seat_type: e.target.value })}
                                        className="mr-2"
                                    />
                                    독서실형
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        value="오픈형"
                                        checked={form.seat_type === '오픈형'}
                                        onChange={e => setForm({ ...form, seat_type: e.target.value })}
                                        className="mr-2"
                                    />
                                    오픈형
                                </label>
                            </div>
                        </div>
                    )}

                    {/* 14. 재원학교명 (예비고1/고1/고2/고3만) */}
                    {shouldShowSchoolName && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                14. 재원학교명 <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-gray-500 mb-2">OO고등학교 전체 이름을 기재해주세요</p>
                            <input
                                type="text"
                                value={form.school_name}
                                onChange={e => setForm({ ...form, school_name: e.target.value })}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                placeholder="예: 서울고등학교"
                                required
                            />
                        </div>
                    )}

                    {/* 15. 예비등원 예약날짜 (신청일 때만) */}
                    {form.pre_attendance_status === '신청' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                15. 예비등원 예약날짜 <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-gray-500 mb-2">상세 시간을 포함한 날짜를 선택하면 학원측에서 확정 문자를 보내드립니다</p>
                            <input
                                type="datetime-local"
                                value={form.pre_attendance_date}
                                onChange={e => setForm({ ...form, pre_attendance_date: e.target.value })}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                required
                            />
                        </div>
                    )}

                    {/* 정기 외출 일정 */}
                    <div className="border-t pt-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">정기 외출 일정</h3>
                        <p className="text-sm text-gray-600 mb-4">매주 정기적으로 외출하는 일정이 있다면 기재해주세요 (같은 요일에 여러 개 추가 가능)</p>

                        {DAYS_OF_WEEK.map((day, dayIndex) => (
                            <div key={dayIndex} className="mb-4 p-4 bg-gray-50 rounded-md">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium">{day}</span>
                                    <button
                                        type="button"
                                        onClick={() => addRecurringOuting(dayIndex)}
                                        className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                                    >
                                        + 외출 추가
                                    </button>
                                </div>

                                {recurringOutings[dayIndex].map((outing, outingIndex) => (
                                    <div key={outingIndex} className="ml-4 mb-3 p-3 bg-white rounded border">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-medium text-gray-700">외출 #{outingIndex + 1}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeRecurringOuting(dayIndex, outingIndex)}
                                                className="text-xs text-red-600 hover:text-red-800"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs text-gray-600">시작 시간</label>
                                                    <input
                                                        type="time"
                                                        value={outing.start_time}
                                                        onChange={e => updateRecurringOuting(dayIndex, outingIndex, 'start_time', e.target.value)}
                                                        className="w-full rounded-md border-gray-300 shadow-sm p-1 border text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600">종료 시간</label>
                                                    <input
                                                        type="time"
                                                        value={outing.end_time}
                                                        onChange={e => updateRecurringOuting(dayIndex, outingIndex, 'end_time', e.target.value)}
                                                        className="w-full rounded-md border-gray-300 shadow-sm p-1 border text-sm"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600">사유</label>
                                                <input
                                                    type="text"
                                                    value={outing.reason}
                                                    onChange={e => updateRecurringOuting(dayIndex, outingIndex, 'reason', e.target.value)}
                                                    className="w-full rounded-md border-gray-300 shadow-sm p-1 border text-sm"
                                                    placeholder="예: 학원, 병원"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {recurringOutings[dayIndex].length === 0 && (
                                    <p className="text-xs text-gray-400 ml-4">등록된 외출 일정이 없습니다</p>
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 font-semibold text-lg"
                    >
                        제출하기
                    </button>
                </form>
            </div>
        </div>
    )
}

export default RegistrationForm
