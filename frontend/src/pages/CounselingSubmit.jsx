import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'

function CounselingSubmit() {
    const navigate = useNavigate()
    const [students, setStudents] = useState([])
    const [counselors, setCounselors] = useState([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    // Search state
    const [studentSearch, setStudentSearch] = useState('')
    const [showStudentDropdown, setShowStudentDropdown] = useState(false)

    const [formData, setFormData] = useState({
        student_id: '',
        counselor_id: '',
        counseling_date: new Date().toISOString().split('T')[0],
        counseling_type: '다이아몬드',
        overall_achievement: '중',
        allcare_satisfaction: '',
        allcare_satisfaction_reason: '',
        korean_notes: '',
        math_notes: '',
        english_notes: '',
        inquiry_notes: '',
        other_notes: ''
    })

    const counselingTypes = [
        '다이아몬드',
        '국어상담',
        '수학상담',
        '영어상담',
        '탐구상담',
        '멘탈상담',
        '진단평가상담'
    ]

    const achievementLevels = ['상', '중', '하']
    const satisfactionLevels = ['매우만족', '만족', '보통', '불만족', '매우불만족']

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [studentsRes, counselorsRes] = await Promise.all([
                api.get('/students/'),
                api.get('/counselors/')
            ])
            setStudents(studentsRes.data.filter(s => s.status === '재원'))
            setCounselors(counselorsRes.data)
        } catch (error) {
            console.error('Error fetching data:', error)
        }
        setLoading(false)
    }

    const filteredStudents = students.filter(s =>
        s.name.includes(studentSearch) || s.seat_number.includes(studentSearch)
    )

    const selectStudent = (student) => {
        setFormData({ ...formData, student_id: student.id })
        setStudentSearch(`${student.name} (${student.seat_number})`)
        setShowStudentDropdown(false)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!formData.student_id) {
            alert('학생을 선택해주세요.')
            return
        }

        if (!formData.counselor_id) {
            alert('상담사를 선택해주세요.')
            return
        }

        setSubmitting(true)

        try {
            // 새로운 독립 설문 제출 API 호출
            const response = await api.post('/counseling-surveys/submit-standalone', {
                student_id: parseInt(formData.student_id),
                counselor_id: parseInt(formData.counselor_id),
                counseling_date: formData.counseling_date,
                counseling_type: formData.counseling_type,
                overall_achievement: formData.overall_achievement,
                allcare_satisfaction: formData.allcare_satisfaction || null,
                allcare_satisfaction_reason: formData.allcare_satisfaction_reason || null,
                korean_notes: formData.korean_notes || null,
                math_notes: formData.math_notes || null,
                english_notes: formData.english_notes || null,
                inquiry_notes: formData.inquiry_notes || null,
                other_notes: formData.other_notes || null
            })

            if (response.data.matched_session) {
                alert(`설문이 제출되었습니다!\n\n다이아몬드 상담 세션이 자동으로 완료 처리되었습니다.\n(${response.data.matched_session.scheduled_date})`)
            } else {
                alert('설문이 제출되었습니다!')
            }

            navigate('/diamond-counseling')
        } catch (error) {
            console.error('Error submitting survey:', error)
            alert('설문 제출 실패: ' + (error.response?.data?.detail || '오류 발생'))
        } finally {
            setSubmitting(false)
        }
    }

    // Determine which fields to show based on counseling type
    const showAllSubjects = formData.counseling_type === '다이아몬드'
    const showKorean = showAllSubjects || formData.counseling_type === '국어상담'
    const showMath = showAllSubjects || formData.counseling_type === '수학상담'
    const showEnglish = showAllSubjects || formData.counseling_type === '영어상담'
    const showInquiry = showAllSubjects || formData.counseling_type === '탐구상담'
    const showOtherOnly = ['멘탈상담', '진단평가상담'].includes(formData.counseling_type)

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
                <div className="text-gray-500">로딩 중...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-2xl mx-auto">
                <Link to="/diamond-counseling" className="text-blue-500 hover:underline mb-4 block">
                    &larr; 다이아몬드 상담으로 돌아가기
                </Link>

                <div className="bg-white rounded-lg shadow-md p-6">
                    <h1 className="text-2xl font-bold mb-2">상담 설문지 제출</h1>
                    <p className="text-gray-500 text-sm mb-6">
                        모든 종류의 상담 설문을 제출할 수 있습니다. 다이아몬드 상담의 경우 해당 주의 세션이 자동으로 완료 처리됩니다.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Student Selection */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                학생 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={studentSearch}
                                onChange={e => { setStudentSearch(e.target.value); setShowStudentDropdown(true); }}
                                onFocus={() => setShowStudentDropdown(true)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                placeholder="이름 또는 좌석번호 검색"
                            />
                            {showStudentDropdown && studentSearch && (
                                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto mt-1">
                                    {filteredStudents.map(s => (
                                        <li
                                            key={s.id}
                                            onClick={() => selectStudent(s)}
                                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                        >
                                            {s.name} ({s.seat_number})
                                        </li>
                                    ))}
                                    {filteredStudents.length === 0 && (
                                        <li className="px-4 py-2 text-gray-500">검색 결과 없음</li>
                                    )}
                                </ul>
                            )}
                        </div>

                        {/* Counselor Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                상담사 <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.counselor_id}
                                onChange={(e) => setFormData({...formData, counselor_id: e.target.value})}
                                className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                required
                            >
                                <option value="">상담사 선택</option>
                                {counselors.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Counseling Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                상담 날짜 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.counseling_date}
                                onChange={(e) => setFormData({...formData, counseling_date: e.target.value})}
                                className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                required
                            />
                        </div>

                        {/* Counseling Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                상담 유형 <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.counseling_type}
                                onChange={(e) => setFormData({...formData, counseling_type: e.target.value})}
                                className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                required
                            >
                                {counselingTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        {/* Overall Achievement */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                전반적 성취도 <span className="text-red-500">*</span>
                            </label>
                            <div className="flex space-x-4">
                                {achievementLevels.map(level => (
                                    <label key={level} className="flex items-center">
                                        <input
                                            type="radio"
                                            name="achievement"
                                            value={level}
                                            checked={formData.overall_achievement === level}
                                            onChange={(e) => setFormData({...formData, overall_achievement: e.target.value})}
                                            className="mr-2"
                                        />
                                        {level}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Allcare Satisfaction */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                올케어 만족도 (선택)
                            </label>
                            <select
                                value={formData.allcare_satisfaction}
                                onChange={(e) => setFormData({...formData, allcare_satisfaction: e.target.value})}
                                className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                            >
                                <option value="">선택 안함</option>
                                {satisfactionLevels.map(level => (
                                    <option key={level} value={level}>{level}</option>
                                ))}
                            </select>
                        </div>

                        {formData.allcare_satisfaction && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    만족도 이유
                                </label>
                                <textarea
                                    value={formData.allcare_satisfaction_reason}
                                    onChange={(e) => setFormData({...formData, allcare_satisfaction_reason: e.target.value})}
                                    className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                    rows={2}
                                    placeholder="만족/불만족 이유를 작성해주세요"
                                />
                            </div>
                        )}

                        {/* Subject Notes - Conditional */}
                        {showKorean && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    국어 상담 내용
                                </label>
                                <textarea
                                    value={formData.korean_notes}
                                    onChange={(e) => setFormData({...formData, korean_notes: e.target.value})}
                                    className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                    rows={3}
                                    placeholder="국어 과목 관련 상담 내용"
                                />
                            </div>
                        )}

                        {showMath && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    수학 상담 내용
                                </label>
                                <textarea
                                    value={formData.math_notes}
                                    onChange={(e) => setFormData({...formData, math_notes: e.target.value})}
                                    className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                    rows={3}
                                    placeholder="수학 과목 관련 상담 내용"
                                />
                            </div>
                        )}

                        {showEnglish && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    영어 상담 내용
                                </label>
                                <textarea
                                    value={formData.english_notes}
                                    onChange={(e) => setFormData({...formData, english_notes: e.target.value})}
                                    className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                    rows={3}
                                    placeholder="영어 과목 관련 상담 내용"
                                />
                            </div>
                        )}

                        {showInquiry && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    탐구 상담 내용
                                </label>
                                <textarea
                                    value={formData.inquiry_notes}
                                    onChange={(e) => setFormData({...formData, inquiry_notes: e.target.value})}
                                    className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                    rows={3}
                                    placeholder="탐구 과목 관련 상담 내용"
                                />
                            </div>
                        )}

                        {/* Other Notes - Always show for some types */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {showOtherOnly ? '상담 내용' : '기타 상담 내용'}
                                {showOtherOnly && <span className="text-red-500"> *</span>}
                            </label>
                            <textarea
                                value={formData.other_notes}
                                onChange={(e) => setFormData({...formData, other_notes: e.target.value})}
                                className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                rows={4}
                                placeholder={showOtherOnly ? '상담 내용을 작성해주세요' : '기타 특이사항이나 추가 내용'}
                                required={showOtherOnly}
                            />
                        </div>

                        {/* Info Box */}
                        {formData.counseling_type === '다이아몬드' && (
                            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                                <strong>안내:</strong> 다이아몬드 상담의 경우, 선택한 학생/상담사/날짜가 해당 주의 다이아몬드 상담 세션과 일치하면 자동으로 완료 처리됩니다.
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={submitting}
                                className={`w-full py-3 rounded-lg font-medium ${
                                    submitting
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700'
                                } text-white`}
                            >
                                {submitting ? '제출 중...' : '설문 제출'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default CounselingSubmit
