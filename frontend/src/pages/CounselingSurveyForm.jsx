import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'

function CounselingSurveyForm() {
    const { sessionId } = useParams()
    const navigate = useNavigate()

    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)
    const [existingSurvey, setExistingSurvey] = useState(null)

    const [formData, setFormData] = useState({
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
        fetchSessionData()
    }, [sessionId])

    const fetchSessionData = async () => {
        try {
            // Get all sessions and find the one we need
            const sessionsRes = await api.get('/counseling-sessions/')
            const foundSession = sessionsRes.data.find(s => s.id === parseInt(sessionId))

            if (foundSession) {
                setSession(foundSession)

                // Check if survey already exists
                try {
                    const surveyRes = await api.get(`/counseling-surveys/session/${sessionId}`)
                    setExistingSurvey(surveyRes.data)
                } catch (err) {
                    // Survey doesn't exist yet, that's fine
                }
            }
        } catch (error) {
            console.error('Error fetching session:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!session) return

        try {
            await api.post('/counseling-surveys/', {
                ...formData,
                session_id: parseInt(sessionId),
                student_id: session.student_id,
                counselor_id: session.counselor_id
            })

            alert('설문이 제출되었습니다')
            navigate('/diamond-counseling')
        } catch (error) {
            console.error('Error submitting survey:', error)
            alert('설문 제출 실패: ' + (error.response?.data?.detail || '오류 발생'))
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

    if (!session) {
        return (
            <div className="min-h-screen bg-gray-100 p-8">
                <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
                    <p className="text-red-500">세션을 찾을 수 없습니다</p>
                    <Link to="/diamond-counseling" className="text-blue-500 hover:underline mt-4 block">
                        &larr; 돌아가기
                    </Link>
                </div>
            </div>
        )
    }

    if (existingSurvey) {
        return (
            <div className="min-h-screen bg-gray-100 p-8">
                <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
                    <h1 className="text-2xl font-bold mb-4">설문 제출 완료</h1>
                    <p className="text-gray-600 mb-4">이 세션의 설문은 이미 제출되었습니다.</p>

                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="font-medium">학생:</span> {session.student_name}
                            </div>
                            <div>
                                <span className="font-medium">상담사:</span> {session.counselor_name}
                            </div>
                            <div>
                                <span className="font-medium">상담 유형:</span> {existingSurvey.counseling_type}
                            </div>
                            <div>
                                <span className="font-medium">성취도:</span> {existingSurvey.overall_achievement}
                            </div>
                        </div>
                    </div>

                    <Link to="/diamond-counseling" className="text-blue-500 hover:underline mt-6 block">
                        &larr; 다이아몬드 상담으로 돌아가기
                    </Link>
                </div>
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
                    <h1 className="text-2xl font-bold mb-2">상담 설문지</h1>

                    {/* Session Info */}
                    <div className="bg-blue-50 p-4 rounded-lg mb-6">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="font-medium">학생:</span> {session.student_name}
                            </div>
                            <div>
                                <span className="font-medium">상담사:</span> {session.counselor_name}
                            </div>
                            <div>
                                <span className="font-medium">날짜:</span> {session.scheduled_date}
                            </div>
                            <div>
                                <span className="font-medium">시간:</span> {session.scheduled_time}
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Counseling Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">
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

                        {/* Submit Button */}
                        <div className="pt-4">
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium"
                            >
                                설문 제출 (상담 완료 처리)
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default CounselingSurveyForm
