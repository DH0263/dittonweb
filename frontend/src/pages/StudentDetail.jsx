import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/axios'
import AIAnalysisTab from '../components/ai/AIAnalysisTab'

function StudentDetail() {
    const { id } = useParams()
    const [student, setStudent] = useState(null)
    const [activeTab, setActiveTab] = useState('overview')
    const [counselingSurveys, setCounselingSurveys] = useState([])
    const [counselingTypeFilter, setCounselingTypeFilter] = useState('all')

    const counselingTypes = [
        '다이아몬드',
        '국어상담',
        '수학상담',
        '영어상담',
        '탐구상담',
        '멘탈상담',
        '진단평가상담'
    ]

    useEffect(() => {
        fetchStudent()
        fetchCounselingSurveys()
    }, [id])

    const fetchStudent = async () => {
        try {
            const response = await api.get(`/students/${id}`)
            setStudent(response.data)
        } catch (error) {
            console.error('Error fetching student:', error)
        }
    }

    const fetchCounselingSurveys = async () => {
        try {
            const response = await api.get(`/counseling-surveys/student/${id}`)
            setCounselingSurveys(response.data)
        } catch (error) {
            console.error('Error fetching counseling surveys:', error)
        }
    }

    const filteredSurveys = counselingTypeFilter === 'all'
        ? counselingSurveys
        : counselingSurveys.filter(s => s.counseling_type === counselingTypeFilter)

    if (!student) return <div className="p-8">Loading...</div>

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <Link to="/students" className="text-blue-500 hover:underline mb-4 block">&larr; 목록으로 돌아가기</Link>
                    <h1 className="text-3xl font-bold text-gray-800">{student.name}</h1>
                    <div className="flex space-x-4 mt-2 text-gray-600">
                        <span>좌석: {student.seat_number}</span>
                        <span>상태: {student.status}</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-4 mb-6 border-b border-gray-300 overflow-x-auto">
                    {[
                        { key: 'overview', label: '요약' },
                        { key: 'penalties', label: '상벌점' },
                        { key: 'counseling', label: '상담일지' },
                        { key: 'schedules', label: '일정' },
                        { key: 'outings', label: '외출' },
                        { key: 'ai-analysis', label: '🤖 AI 분석' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`pb-2 px-4 ${activeTab === tab.key ? 'border-b-2 border-blue-500 text-blue-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {tab.label}
                            {tab.key === 'counseling' && counselingSurveys.length > 0 && (
                                <span className="ml-1 text-xs bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-full">{counselingSurveys.length}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    {activeTab === 'overview' && (
                        <div>
                            <h2 className="text-xl font-semibold mb-4">요약</h2>
                            <p>총 벌점: {student.penalties.filter(p => p.type === '벌점').reduce((acc, p) => acc + p.points, 0)}점</p>
                            <p>총 상점: {student.penalties.filter(p => p.type === '상점').reduce((acc, p) => acc + p.points, 0)}점</p>
                            <p>메모: {student.memo || '없음'}</p>
                        </div>
                    )}

                    {activeTab === 'penalties' && (
                        <div>
                            <h2 className="text-xl font-semibold mb-4">상벌점 내역</h2>
                            <ul className="space-y-2">
                                {student.penalties.map(p => (
                                    <li key={p.id} className="border-b pb-2">
                                        <span className={`font-bold ${p.type === '벌점' ? 'text-red-600' : 'text-green-600'}`}>[{p.type}]</span> {p.reason} ({p.points}점) - {new Date(p.date).toLocaleDateString()}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {activeTab === 'counseling' && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold">상담 내역</h2>
                                <select
                                    value={counselingTypeFilter}
                                    onChange={(e) => setCounselingTypeFilter(e.target.value)}
                                    className="rounded-md border-gray-300 shadow-sm p-2 border text-sm"
                                >
                                    <option value="all">전체 유형</option>
                                    {counselingTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            {filteredSurveys.length === 0 ? (
                                <p className="text-gray-500">상담 기록이 없습니다.</p>
                            ) : (
                                <div className="space-y-4">
                                    {filteredSurveys.map(survey => (
                                        <div key={survey.id} className="border rounded-lg p-4 hover:bg-gray-50">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-1 text-xs rounded font-medium ${
                                                        survey.counseling_type === '다이아몬드' ? 'bg-indigo-100 text-indigo-800' :
                                                        survey.counseling_type === '국어상담' ? 'bg-red-100 text-red-800' :
                                                        survey.counseling_type === '수학상담' ? 'bg-blue-100 text-blue-800' :
                                                        survey.counseling_type === '영어상담' ? 'bg-green-100 text-green-800' :
                                                        survey.counseling_type === '탐구상담' ? 'bg-yellow-100 text-yellow-800' :
                                                        survey.counseling_type === '멘탈상담' ? 'bg-purple-100 text-purple-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {survey.counseling_type}
                                                    </span>
                                                    <span className="text-sm text-gray-600">
                                                        {survey.counselor_name || '상담사'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 text-xs rounded ${
                                                        survey.overall_achievement === '상' ? 'bg-green-100 text-green-800' :
                                                        survey.overall_achievement === '중' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                        성취도: {survey.overall_achievement}
                                                    </span>
                                                    <span className="text-sm text-gray-500">
                                                        {survey.session_date || new Date(survey.submitted_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 상담 내용 */}
                                            <div className="mt-3 space-y-2 text-sm">
                                                {survey.korean_notes && (
                                                    <div className="bg-red-50 p-2 rounded">
                                                        <span className="font-medium text-red-700">국어:</span>
                                                        <span className="ml-2 text-gray-700">{survey.korean_notes}</span>
                                                    </div>
                                                )}
                                                {survey.math_notes && (
                                                    <div className="bg-blue-50 p-2 rounded">
                                                        <span className="font-medium text-blue-700">수학:</span>
                                                        <span className="ml-2 text-gray-700">{survey.math_notes}</span>
                                                    </div>
                                                )}
                                                {survey.english_notes && (
                                                    <div className="bg-green-50 p-2 rounded">
                                                        <span className="font-medium text-green-700">영어:</span>
                                                        <span className="ml-2 text-gray-700">{survey.english_notes}</span>
                                                    </div>
                                                )}
                                                {survey.inquiry_notes && (
                                                    <div className="bg-yellow-50 p-2 rounded">
                                                        <span className="font-medium text-yellow-700">탐구:</span>
                                                        <span className="ml-2 text-gray-700">{survey.inquiry_notes}</span>
                                                    </div>
                                                )}
                                                {survey.other_notes && (
                                                    <div className="bg-gray-50 p-2 rounded">
                                                        <span className="font-medium text-gray-700">기타:</span>
                                                        <span className="ml-2 text-gray-700">{survey.other_notes}</span>
                                                    </div>
                                                )}
                                                {survey.allcare_satisfaction && (
                                                    <div className="bg-purple-50 p-2 rounded">
                                                        <span className="font-medium text-purple-700">올케어 만족도:</span>
                                                        <span className="ml-2 text-gray-700">{survey.allcare_satisfaction}</span>
                                                        {survey.allcare_satisfaction_reason && (
                                                            <span className="ml-1 text-gray-500">({survey.allcare_satisfaction_reason})</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'schedules' && (
                        <div>
                            <h2 className="text-xl font-semibold mb-4">수업/상담 일정</h2>
                            {student.schedules.length === 0 ? <p className="text-gray-500">일정이 없습니다.</p> : (
                                <ul className="space-y-2">
                                    {student.schedules.map(s => (
                                        <li key={s.id} className="border-b pb-2">
                                            {new Date(s.date).toLocaleDateString()} {s.time} - {s.type}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {activeTab === 'outings' && (
                        <div>
                            <h2 className="text-xl font-semibold mb-4">외출 내역</h2>
                            {student.outings.length === 0 ? <p className="text-gray-500">외출 기록이 없습니다.</p> : (
                                <ul className="space-y-2">
                                    {student.outings.map(o => (
                                        <li key={o.id} className="border-b pb-2">
                                            {new Date(o.date).toLocaleDateString()} {o.start_time}~{o.end_time} - {o.reason} ({o.status})
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {activeTab === 'ai-analysis' && (
                        <AIAnalysisTab studentId={parseInt(id)} studentName={student.name} />
                    )}
                </div>
            </div>
        </div>
    )
}

export default StudentDetail
