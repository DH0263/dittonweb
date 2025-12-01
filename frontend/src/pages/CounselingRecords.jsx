import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'

function CounselingRecords() {
    const [surveys, setSurveys] = useState([])
    const [counselors, setCounselors] = useState([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState(null)

    // Filters
    const [typeFilter, setTypeFilter] = useState('all')
    const [counselorFilter, setCounselorFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')

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
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [surveysRes, counselorsRes] = await Promise.all([
                api.get('/counseling-surveys/'),
                api.get('/counselors/')
            ])
            setSurveys(surveysRes.data)
            setCounselors(counselorsRes.data)
        } catch (error) {
            console.error('Error fetching data:', error)
        }
        setLoading(false)
    }

    // Apply filters
    const filteredSurveys = surveys.filter(s => {
        if (typeFilter !== 'all' && s.counseling_type !== typeFilter) return false
        if (counselorFilter !== 'all' && s.counselor_id !== parseInt(counselorFilter)) return false
        if (searchTerm && !s.student_name?.includes(searchTerm) && !s.student_seat?.includes(searchTerm)) return false
        return true
    })

    // Statistics
    const stats = {
        total: surveys.length,
        byType: counselingTypes.reduce((acc, type) => {
            acc[type] = surveys.filter(s => s.counseling_type === type).length
            return acc
        }, {}),
        byCounselor: counselors.reduce((acc, c) => {
            acc[c.name] = surveys.filter(s => s.counselor_id === c.id).length
            return acc
        }, {})
    }

    const getTypeColor = (type) => {
        switch (type) {
            case '다이아몬드': return 'bg-indigo-100 text-indigo-800'
            case '국어상담': return 'bg-red-100 text-red-800'
            case '수학상담': return 'bg-blue-100 text-blue-800'
            case '영어상담': return 'bg-green-100 text-green-800'
            case '탐구상담': return 'bg-yellow-100 text-yellow-800'
            case '멘탈상담': return 'bg-purple-100 text-purple-800'
            default: return 'bg-gray-100 text-gray-800'
        }
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
                        <h1 className="text-3xl font-bold text-gray-800">상담 기록 관리</h1>
                        <p className="text-gray-600 mt-1">모든 상담 설문 기록 조회</p>
                    </div>
                    <Link
                        to="/counseling/submit"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                        + 새 상담 기록
                    </Link>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
                    <div className="bg-white rounded-lg shadow p-3">
                        <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                        <div className="text-xs text-gray-500">전체</div>
                    </div>
                    {counselingTypes.map(type => (
                        <div key={type} className="bg-white rounded-lg shadow p-3">
                            <div className={`text-2xl font-bold ${
                                type === '다이아몬드' ? 'text-indigo-600' :
                                type === '국어상담' ? 'text-red-600' :
                                type === '수학상담' ? 'text-blue-600' :
                                type === '영어상담' ? 'text-green-600' :
                                type === '탐구상담' ? 'text-yellow-600' :
                                type === '멘탈상담' ? 'text-purple-600' :
                                'text-gray-600'
                            }`}>{stats.byType[type] || 0}</div>
                            <div className="text-xs text-gray-500 truncate">{type}</div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">학생 검색</label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="이름 또는 좌석번호"
                                className="w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">상담 유형</label>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm"
                            >
                                <option value="all">전체 유형</option>
                                {counselingTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">상담사</label>
                            <select
                                value={counselorFilter}
                                onChange={(e) => setCounselorFilter(e.target.value)}
                                className="w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm"
                            >
                                <option value="all">전체 상담사</option>
                                {counselors.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    setTypeFilter('all')
                                    setCounselorFilter('all')
                                    setSearchTerm('')
                                }}
                                className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 text-sm"
                            >
                                필터 초기화
                            </button>
                        </div>
                    </div>
                </div>

                {/* Records Table */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="px-4 py-3 border-b bg-gray-50">
                        <span className="font-medium">{filteredSurveys.length}개</span>
                        <span className="text-gray-500 text-sm ml-2">의 상담 기록</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">학생</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상담사</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">성취도</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">상세</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredSurveys.map(survey => (
                                    <>
                                        <tr key={survey.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {survey.session_date || new Date(survey.submitted_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <Link
                                                    to={`/students/${survey.student_id}`}
                                                    className="text-blue-600 hover:underline font-medium text-sm"
                                                >
                                                    {survey.student_name}
                                                </Link>
                                                <span className="text-gray-400 text-xs ml-1">({survey.student_seat})</span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`px-2 py-1 text-xs rounded font-medium ${getTypeColor(survey.counseling_type)}`}>
                                                    {survey.counseling_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                {survey.counselor_name}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 text-xs rounded ${
                                                    survey.overall_achievement === '상' ? 'bg-green-100 text-green-800' :
                                                    survey.overall_achievement === '중' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                    {survey.overall_achievement}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => setExpandedId(expandedId === survey.id ? null : survey.id)}
                                                    className="text-indigo-600 hover:text-indigo-900 text-sm"
                                                >
                                                    {expandedId === survey.id ? '접기' : '펼치기'}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedId === survey.id && (
                                            <tr key={`${survey.id}-detail`}>
                                                <td colSpan="6" className="px-4 py-4 bg-gray-50">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                        {survey.korean_notes && (
                                                            <div className="bg-red-50 p-3 rounded">
                                                                <span className="font-medium text-red-700">국어:</span>
                                                                <p className="mt-1 text-gray-700">{survey.korean_notes}</p>
                                                            </div>
                                                        )}
                                                        {survey.math_notes && (
                                                            <div className="bg-blue-50 p-3 rounded">
                                                                <span className="font-medium text-blue-700">수학:</span>
                                                                <p className="mt-1 text-gray-700">{survey.math_notes}</p>
                                                            </div>
                                                        )}
                                                        {survey.english_notes && (
                                                            <div className="bg-green-50 p-3 rounded">
                                                                <span className="font-medium text-green-700">영어:</span>
                                                                <p className="mt-1 text-gray-700">{survey.english_notes}</p>
                                                            </div>
                                                        )}
                                                        {survey.inquiry_notes && (
                                                            <div className="bg-yellow-50 p-3 rounded">
                                                                <span className="font-medium text-yellow-700">탐구:</span>
                                                                <p className="mt-1 text-gray-700">{survey.inquiry_notes}</p>
                                                            </div>
                                                        )}
                                                        {survey.other_notes && (
                                                            <div className="bg-gray-100 p-3 rounded">
                                                                <span className="font-medium text-gray-700">기타:</span>
                                                                <p className="mt-1 text-gray-700">{survey.other_notes}</p>
                                                            </div>
                                                        )}
                                                        {survey.allcare_satisfaction && (
                                                            <div className="bg-purple-50 p-3 rounded">
                                                                <span className="font-medium text-purple-700">올케어 만족도:</span>
                                                                <p className="mt-1 text-gray-700">
                                                                    {survey.allcare_satisfaction}
                                                                    {survey.allcare_satisfaction_reason && (
                                                                        <span className="text-gray-500"> - {survey.allcare_satisfaction_reason}</span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {!survey.korean_notes && !survey.math_notes && !survey.english_notes &&
                                                         !survey.inquiry_notes && !survey.other_notes && !survey.allcare_satisfaction && (
                                                            <div className="text-gray-500 col-span-2">상세 내용이 없습니다.</div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                                {filteredSurveys.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                                            상담 기록이 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CounselingRecords
