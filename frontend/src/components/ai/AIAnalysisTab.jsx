import { useState } from 'react'
import api from '../../api/axios'

function AIAnalysisTab({ studentId, studentName }) {
    const [loading, setLoading] = useState(false)
    const [report, setReport] = useState(null)
    const [error, setError] = useState(null)
    const [selectedType, setSelectedType] = useState(null)
    const [customQuery, setCustomQuery] = useState('')

    const analysisTypes = [
        { key: 'comprehensive', label: '종합 리포트', icon: '📋', color: 'from-indigo-500 to-purple-500' },
        { key: 'attendance', label: '출석 패턴', icon: '📊', color: 'from-blue-500 to-cyan-500' },
        { key: 'attitude', label: '학습 태도', icon: '📝', color: 'from-green-500 to-teal-500' },
        { key: 'counseling', label: '상담 요약', icon: '💬', color: 'from-orange-500 to-amber-500' },
    ]

    const handleAnalyze = async (type) => {
        setLoading(true)
        setError(null)
        setSelectedType(type)

        try {
            const response = await api.post('/ai/analyze', {
                student_id: studentId,
                analysis_type: type,
                custom_query: type === 'custom' ? customQuery : null
            })
            setReport(response.data)
        } catch (err) {
            console.error('AI 분석 실패:', err)
            setError(err.response?.data?.detail || 'AI 분석 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    const handleCustomQuery = async (e) => {
        e.preventDefault()
        if (!customQuery.trim()) return

        setLoading(true)
        setError(null)
        setSelectedType('custom')

        try {
            const response = await api.post('/ai/analyze', {
                student_id: studentId,
                analysis_type: 'comprehensive',
                custom_query: customQuery
            })
            setReport(response.data)
        } catch (err) {
            console.error('AI 분석 실패:', err)
            setError(err.response?.data?.detail || 'AI 분석 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    // 마크다운을 간단한 HTML로 변환
    const renderMarkdown = (text) => {
        if (!text) return null

        return text.split('\n').map((line, index) => {
            // 헤더
            if (line.startsWith('## ')) {
                return <h2 key={index} className="text-xl font-bold text-gray-800 mt-4 mb-2">{line.slice(3)}</h2>
            }
            if (line.startsWith('### ')) {
                return <h3 key={index} className="text-lg font-semibold text-gray-700 mt-3 mb-2">{line.slice(4)}</h3>
            }
            // 볼드 텍스트와 리스트
            if (line.startsWith('- ')) {
                const content = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                return (
                    <li key={index} className="ml-4 text-gray-600" dangerouslySetInnerHTML={{ __html: content }} />
                )
            }
            // 구분선
            if (line.startsWith('---')) {
                return <hr key={index} className="my-4 border-gray-300" />
            }
            // 일반 텍스트
            if (line.trim()) {
                const content = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                return (
                    <p key={index} className="text-gray-600 my-1" dangerouslySetInnerHTML={{ __html: content }} />
                )
            }
            return <br key={index} />
        })
    }

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">🤖</span>
                AI 분석
            </h2>

            {/* 빠른 분석 버튼 */}
            <div className="mb-6">
                <p className="text-sm text-gray-500 mb-3">빠른 분석:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {analysisTypes.map((type) => (
                        <button
                            key={type.key}
                            onClick={() => handleAnalyze(type.key)}
                            disabled={loading}
                            className={`
                                p-4 rounded-lg border-2 transition-all duration-200
                                ${selectedType === type.key && loading
                                    ? 'border-gray-300 bg-gray-100'
                                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                                }
                                ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                            `}
                        >
                            <span className="text-3xl block mb-2">{type.icon}</span>
                            <span className="text-sm font-medium text-gray-700">{type.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 커스텀 질문 입력 */}
            <div className="mb-6">
                <p className="text-sm text-gray-500 mb-2">직접 질문하기:</p>
                <form onSubmit={handleCustomQuery} className="flex gap-2">
                    <input
                        type="text"
                        value={customQuery}
                        onChange={(e) => setCustomQuery(e.target.value)}
                        placeholder="예: 이 학생의 최근 2개월 학습 태도 변화를 분석해줘"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading || !customQuery.trim()}
                        className={`
                            px-6 py-2 rounded-lg font-medium transition-colors
                            ${loading || !customQuery.trim()
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }
                        `}
                    >
                        전송
                    </button>
                </form>
            </div>

            {/* 로딩 상태 */}
            {loading && (
                <div className="bg-indigo-50 rounded-lg p-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mb-4"></div>
                    <p className="text-indigo-600 font-medium">AI가 분석 중입니다...</p>
                    <p className="text-sm text-indigo-400 mt-1">잠시만 기다려주세요</p>
                </div>
            )}

            {/* 에러 표시 */}
            {error && !loading && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600 font-medium">분석 실패</p>
                    <p className="text-sm text-red-500 mt-1">{error}</p>
                </div>
            )}

            {/* 분석 결과 */}
            {report && !loading && (
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🤖</span>
                            <span className="font-medium text-gray-700">AI 분석 결과</span>
                        </div>
                        <span className="text-xs text-gray-400">
                            {new Date(report.generated_at).toLocaleString('ko-KR')}
                        </span>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-100">
                        {renderMarkdown(report.report)}
                    </div>
                    <p className="text-xs text-gray-400 mt-3 text-right">
                        분석 기간: 최근 {report.data_period_days}일
                    </p>
                </div>
            )}

            {/* 초기 상태 안내 */}
            {!report && !loading && !error && (
                <div className="bg-gray-50 rounded-lg p-8 text-center border-2 border-dashed border-gray-200">
                    <span className="text-5xl block mb-4">🔍</span>
                    <p className="text-gray-500">
                        위의 분석 버튼을 클릭하거나 질문을 입력하여<br />
                        <strong>{studentName}</strong> 학생의 AI 분석을 시작하세요
                    </p>
                </div>
            )}
        </div>
    )
}

export default AIAnalysisTab
