import { useState, useEffect } from 'react'
import api from '../api/axios'

function ClassUpSettings() {
    const [status, setStatus] = useState(null)
    const [todaySummary, setTodaySummary] = useState(null)
    const [recentRecords, setRecentRecords] = useState([])
    const [syncLogs, setSyncLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    // 로그인 상태
    const [loginStep, setLoginStep] = useState(null) // null, 'phone', 'code'
    const [phoneNumber, setPhoneNumber] = useState('')
    const [verificationCode, setVerificationCode] = useState('')
    const [loginLoading, setLoginLoading] = useState(false)
    const [loginMessage, setLoginMessage] = useState('')

    const fetchData = async () => {
        try {
            const [statusRes, summaryRes, recordsRes, logsRes] = await Promise.all([
                api.get('/classup/status'),
                api.get('/classup/today-summary'),
                api.get('/classup/records?limit=10'),
                api.get('/classup/logs?limit=5')
            ])
            setStatus(statusRes.data)
            setTodaySummary(summaryRes.data)
            setRecentRecords(recordsRes.data)
            setSyncLogs(logsRes.data)
        } catch (error) {
            console.error('데이터 로드 실패:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => clearInterval(interval)
    }, [])

    const handleStartSync = async () => {
        setActionLoading(true)
        try {
            const res = await api.post('/classup/start')
            alert(res.data.message)
            fetchData()
        } catch (error) {
            alert('동기화 시작 실패: ' + (error.response?.data?.detail || error.message))
        } finally {
            setActionLoading(false)
        }
    }

    const handleStopSync = async () => {
        setActionLoading(true)
        try {
            const res = await api.post('/classup/stop')
            alert(res.data.message)
            fetchData()
        } catch (error) {
            alert('동기화 중지 실패: ' + (error.response?.data?.detail || error.message))
        } finally {
            setActionLoading(false)
        }
    }

    const handleSyncOnce = async () => {
        setActionLoading(true)
        try {
            const res = await api.post('/classup/sync-once')
            alert(`동기화 완료: ${res.data.fetched}개 조회, ${res.data.new}개 신규`)
            fetchData()
        } catch (error) {
            alert('동기화 실패: ' + (error.response?.data?.detail || error.message))
        } finally {
            setActionLoading(false)
        }
    }

    const handleClearSession = async () => {
        if (!confirm('세션을 삭제하시겠습니까? 다시 로그인이 필요합니다.')) return
        setActionLoading(true)
        try {
            const res = await api.delete('/classup/session')
            alert(res.data.message)
            fetchData()
        } catch (error) {
            alert('세션 삭제 실패: ' + (error.response?.data?.detail || error.message))
        } finally {
            setActionLoading(false)
        }
    }

    // 로그인 함수들
    const handleStartLogin = () => {
        setLoginStep('phone')
        setLoginMessage('')
        setPhoneNumber('')
        setVerificationCode('')
    }

    const handleSendCode = async () => {
        if (!phoneNumber.trim()) {
            alert('전화번호를 입력해주세요.')
            return
        }

        setLoginLoading(true)
        setLoginMessage('인증번호 전송 중...')

        try {
            const res = await api.post(`/classup/login/send-code?phone_number=${encodeURIComponent(phoneNumber)}`)
            if (res.data.status === 'success') {
                setLoginStep('code')
                setLoginMessage('인증번호가 전송되었습니다. SMS를 확인해주세요.')
            } else {
                setLoginMessage(`오류: ${res.data.message}`)
            }
        } catch (error) {
            setLoginMessage(`오류: ${error.response?.data?.detail || error.message}`)
        } finally {
            setLoginLoading(false)
        }
    }

    const handleVerifyCode = async () => {
        if (!verificationCode.trim()) {
            alert('인증번호를 입력해주세요.')
            return
        }

        setLoginLoading(true)
        setLoginMessage('인증번호 확인 중...')

        try {
            const res = await api.post(`/classup/login/verify?verification_code=${encodeURIComponent(verificationCode)}`)
            if (res.data.status === 'success') {
                setLoginMessage('로그인 성공!')
                setLoginStep(null)
                fetchData()
                alert('로그인이 완료되었습니다! 이제 동기화를 시작할 수 있습니다.')
            } else {
                setLoginMessage(`오류: ${res.data.message}`)
            }
        } catch (error) {
            setLoginMessage(`오류: ${error.response?.data?.detail || error.message}`)
        } finally {
            setLoginLoading(false)
        }
    }

    const handleCancelLogin = async () => {
        try {
            await api.post('/classup/login/cancel')
        } catch (e) {
            // ignore
        }
        setLoginStep(null)
        setLoginMessage('')
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-xl text-gray-600">로딩 중...</div>
            </div>
        )
    }

    const isConnected = status?.session_saved && status?.logged_in
    const isRunning = status?.running

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto">
                {/* 헤더 */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">ClassUp 연동 관리</h1>
                        <p className="text-gray-600 mt-1">출입 기록 자동 동기화 설정</p>
                    </div>
                    <a href="/" className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <span>대시보드로 돌아가기</span>
                    </a>
                </div>

                {/* 연동 상태 카드 */}
                <div className={`rounded-xl shadow-lg p-6 mb-6 ${isConnected ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${isConnected ? 'bg-green-200' : 'bg-red-200'}`}>
                                {isConnected ? '✅' : '❌'}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">
                                    연동 상태: {isConnected ? '정상 연결됨' : '연결 안됨'}
                                </h2>
                                <p className="text-gray-600">
                                    {isConnected
                                        ? (isRunning ? '자동 동기화 실행 중' : '자동 동기화 중지됨')
                                        : '세션이 만료되었거나 로그인이 필요합니다'
                                    }
                                </p>
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-full text-sm font-bold ${isRunning ? 'bg-green-500 text-white animate-pulse' : 'bg-gray-300 text-gray-700'}`}>
                            {isRunning ? '실행 중' : '중지됨'}
                        </div>
                    </div>

                    {/* 로그인 필요 시 로그인 UI */}
                    {!isConnected && (
                        <div className="mt-4 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
                            <h3 className="font-bold text-yellow-800 mb-3">ClassUp 로그인</h3>

                            {loginStep === null && (
                                <button
                                    onClick={handleStartLogin}
                                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
                                >
                                    전화번호로 로그인
                                </button>
                            )}

                            {loginStep === 'phone' && (
                                <div className="space-y-3">
                                    <p className="text-yellow-700 text-sm">
                                        ClassUp에 등록된 전화번호를 입력해주세요.
                                    </p>
                                    <div className="flex gap-2">
                                        <input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            placeholder="010-1234-5678"
                                            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            disabled={loginLoading}
                                        />
                                        <button
                                            onClick={handleSendCode}
                                            disabled={loginLoading}
                                            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium"
                                        >
                                            {loginLoading ? '전송 중...' : '인증번호 받기'}
                                        </button>
                                        <button
                                            onClick={handleCancelLogin}
                                            disabled={loginLoading}
                                            className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:opacity-50"
                                        >
                                            취소
                                        </button>
                                    </div>
                                </div>
                            )}

                            {loginStep === 'code' && (
                                <div className="space-y-3">
                                    <p className="text-yellow-700 text-sm">
                                        SMS로 받은 인증번호 6자리를 입력해주세요.
                                    </p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={verificationCode}
                                            onChange={(e) => setVerificationCode(e.target.value)}
                                            placeholder="인증번호 6자리"
                                            maxLength={6}
                                            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl tracking-widest"
                                            disabled={loginLoading}
                                        />
                                        <button
                                            onClick={handleVerifyCode}
                                            disabled={loginLoading}
                                            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium"
                                        >
                                            {loginLoading ? '확인 중...' : '로그인 완료'}
                                        </button>
                                        <button
                                            onClick={handleCancelLogin}
                                            disabled={loginLoading}
                                            className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:opacity-50"
                                        >
                                            취소
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setLoginStep('phone')}
                                        className="text-sm text-blue-600 hover:text-blue-800"
                                    >
                                        ← 전화번호 다시 입력
                                    </button>
                                </div>
                            )}

                            {loginMessage && (
                                <p className={`mt-3 text-sm ${loginMessage.includes('오류') ? 'text-red-600' : 'text-green-600'}`}>
                                    {loginMessage}
                                </p>
                            )}

                            <div className="mt-4 pt-4 border-t border-yellow-200">
                                <p className="text-yellow-700 text-xs">
                                    ※ 터미널에서 로그인하려면: <code className="bg-gray-100 px-1 rounded">cd c:\Dittonweb\backend && python -m classup.scraper</code>
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 제어 버튼 */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">동기화 제어</h2>
                    <div className="flex flex-wrap gap-3">
                        {isRunning ? (
                            <button
                                onClick={handleStopSync}
                                disabled={actionLoading}
                                className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-medium"
                            >
                                {actionLoading ? '처리 중...' : '자동 동기화 중지'}
                            </button>
                        ) : (
                            <button
                                onClick={handleStartSync}
                                disabled={actionLoading || !isConnected}
                                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium"
                            >
                                {actionLoading ? '처리 중...' : '자동 동기화 시작'}
                            </button>
                        )}
                        <button
                            onClick={handleSyncOnce}
                            disabled={actionLoading || !isConnected}
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium"
                        >
                            {actionLoading ? '처리 중...' : '수동 1회 동기화'}
                        </button>
                        <button
                            onClick={handleClearSession}
                            disabled={actionLoading}
                            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 font-medium"
                        >
                            세션 삭제
                        </button>
                    </div>
                </div>

                {/* 오늘 요약 */}
                {todaySummary && (
                    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">오늘 출입 요약 ({todaySummary.date})</h2>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                                <div className="text-3xl font-bold text-green-600">{todaySummary.entry_count}</div>
                                <div className="text-sm text-gray-600">입장</div>
                            </div>
                            <div className="text-center p-4 bg-orange-50 rounded-lg">
                                <div className="text-3xl font-bold text-orange-600">{todaySummary.exit_count}</div>
                                <div className="text-sm text-gray-600">퇴장</div>
                            </div>
                            <div className="text-center p-4 bg-red-50 rounded-lg">
                                <div className="text-3xl font-bold text-red-600">{todaySummary.late_count}</div>
                                <div className="text-sm text-gray-600">지각</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 최근 출입 기록 */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">최근 출입 기록</h2>
                    {recentRecords.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="px-4 py-2 text-left">학생</th>
                                        <th className="px-4 py-2 text-left">상태</th>
                                        <th className="px-4 py-2 text-left">시간</th>
                                        <th className="px-4 py-2 text-left">지각</th>
                                        <th className="px-4 py-2 text-left">연동</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentRecords.map((record, idx) => (
                                        <tr key={idx} className="border-t hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium">{record.student_name}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    record.status === '입장' ? 'bg-green-100 text-green-700' :
                                                    record.status.includes('퇴장') ? 'bg-orange-100 text-orange-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {new Date(record.record_time).toLocaleString('ko-KR')}
                                            </td>
                                            <td className="px-4 py-3">
                                                {record.is_late ? <span className="text-red-600 font-bold">지각</span> : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {record.synced ? <span className="text-green-600">연동됨</span> : <span className="text-gray-400">-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8">출입 기록이 없습니다.</p>
                    )}
                </div>

                {/* 동기화 로그 */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">최근 동기화 로그</h2>
                    {syncLogs.length > 0 ? (
                        <div className="space-y-2">
                            {syncLogs.map((log, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        <span className="text-sm text-gray-600">
                                            {new Date(log.sync_time).toLocaleString('ko-KR')}
                                        </span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-gray-600">조회: {log.records_fetched}</span>
                                        <span className="mx-2 text-gray-300">|</span>
                                        <span className="text-green-600">신규: {log.new_records}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-4">동기화 로그가 없습니다.</p>
                    )}
                </div>

                {/* 설정 정보 */}
                <div className="mt-6 p-4 bg-gray-200 rounded-lg text-sm text-gray-600">
                    <p><strong>폴링 간격:</strong> 약 5-7초 (브라우저 유지 + 페이지 새로고침)</p>
                    <p><strong>지각 기준:</strong> 08:00 이후 입장</p>
                    <p><strong>Discord 알림:</strong> 입장/퇴장/지각 시 자동 전송</p>
                    <p><strong>브라우저 상태:</strong> {status?.browser_active ? '활성화됨 (빠른 모드)' : '비활성화'}</p>
                    {status?.session_file && <p><strong>세션 파일:</strong> {status.session_file}</p>}
                </div>
            </div>
        </div>
    )
}

export default ClassUpSettings
