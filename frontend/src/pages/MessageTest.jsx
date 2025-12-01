import { useState, useEffect } from 'react'
import api from '../api/axios'

function MessageTest() {
    const [loading, setLoading] = useState(true)
    const [students, setStudents] = useState([])
    const [serviceStatus, setServiceStatus] = useState(null)
    const [balance, setBalance] = useState(null)

    // 발송 폼
    const [messageType, setMessageType] = useState('sms') // sms, kakao
    const [sendMode, setSendMode] = useState('single') // single, bulk, direct
    const [selectedStudent, setSelectedStudent] = useState('')
    const [selectedStudents, setSelectedStudents] = useState([])
    const [messageText, setMessageText] = useState('')
    const [directPhone, setDirectPhone] = useState('')

    // 발송 결과
    const [sendResult, setSendResult] = useState(null)
    const [sending, setSending] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    // 카카오 선택 시 일괄 발송 모드면 개별로 전환
    useEffect(() => {
        if (messageType === 'kakao' && sendMode === 'bulk') {
            setSendMode('single')
        }
    }, [messageType])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [studentsRes, statusRes] = await Promise.all([
                api.get('/students/'),
                api.get('/messages/status')
            ])

            setStudents(studentsRes.data.filter(s => s.status === '재원'))
            setServiceStatus(statusRes.data)

            // 잔액 조회 시도
            try {
                const balanceRes = await api.get('/messages/balance')
                setBalance(balanceRes.data)
            } catch (e) {
                console.log('Balance check failed:', e)
            }

            setLoading(false)
        } catch (error) {
            console.error('Error:', error)
            setLoading(false)
        }
    }

    const handleSingleSend = async () => {
        if (!selectedStudent || !messageText.trim()) {
            alert('학생과 메시지를 입력해주세요.')
            return
        }

        setSending(true)
        setSendResult(null)

        try {
            const endpoint = messageType === 'kakao'
                ? '/messages/send-friendtalk-to-parent'
                : '/messages/send-to-parent'

            const res = await api.post(endpoint, {
                student_id: parseInt(selectedStudent),
                text: messageText
            })
            setSendResult({ success: true, data: res.data })
        } catch (error) {
            setSendResult({
                success: false,
                error: error.response?.data?.detail || error.message
            })
        }

        setSending(false)
    }

    const handleBulkSend = async () => {
        if (selectedStudents.length === 0 || !messageText.trim()) {
            alert('학생과 메시지를 입력해주세요.')
            return
        }

        setSending(true)
        setSendResult(null)

        try {
            const res = await api.post('/messages/send-bulk-to-parents', {
                student_ids: selectedStudents.map(id => parseInt(id)),
                text: messageText
            })
            setSendResult({ success: true, data: res.data })
        } catch (error) {
            setSendResult({
                success: false,
                error: error.response?.data?.detail || error.message
            })
        }

        setSending(false)
    }

    const handleDirectSend = async () => {
        if (!directPhone.trim() || !messageText.trim()) {
            alert('전화번호와 메시지를 입력해주세요.')
            return
        }

        setSending(true)
        setSendResult(null)

        try {
            const endpoint = messageType === 'kakao'
                ? '/messages/send-friendtalk'
                : '/messages/send-sms'

            const res = await api.post(endpoint, {
                to: directPhone.replace(/-/g, ''),
                text: messageText
            })
            setSendResult({ success: true, data: res.data })
        } catch (error) {
            setSendResult({
                success: false,
                error: error.response?.data?.detail || error.message
            })
        }

        setSending(false)
    }

    const toggleStudentSelection = (studentId) => {
        setSelectedStudents(prev => {
            if (prev.includes(studentId)) {
                return prev.filter(id => id !== studentId)
            } else {
                return [...prev, studentId]
            }
        })
    }

    const selectAllStudents = () => {
        if (selectedStudents.length === students.length) {
            setSelectedStudents([])
        } else {
            setSelectedStudents(students.map(s => s.id))
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-xl">로딩 중...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-6">
            <div className="max-w-4xl mx-auto">
                {/* 헤더 */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">메시지 발송</h1>
                            <p className="text-sm text-gray-600 mt-1">
                                학부모님께 SMS 또는 카카오톡을 발송합니다 (Solapi)
                            </p>
                        </div>
                        <a href="/" className="text-blue-600 hover:underline">홈</a>
                    </div>
                </div>

                {/* 서비스 상태 */}
                <div className={`rounded-lg shadow-md p-4 mb-4 ${serviceStatus?.available ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'}`}>
                    <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${serviceStatus?.available ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className={serviceStatus?.available ? 'text-green-800' : 'text-red-800'}>
                            {serviceStatus?.message || '서비스 상태 확인 중...'}
                        </span>
                    </div>
                    {balance?.success && (
                        <div className="mt-2 text-sm text-gray-600">
                            잔액: {JSON.stringify(balance.balance)}
                        </div>
                    )}
                </div>

                {/* 메시지 유형 선택 */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                    <h2 className="font-bold text-gray-700 mb-3">메시지 유형</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMessageType('sms')}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${messageType === 'sms' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                        >
                            <span>SMS/LMS</span>
                        </button>
                        <button
                            onClick={() => setMessageType('kakao')}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${messageType === 'kakao' ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}
                        >
                            <span>카카오 친구톡</span>
                        </button>
                    </div>
                    {messageType === 'kakao' && (
                        <p className="text-sm text-yellow-700 mt-2 bg-yellow-50 p-2 rounded">
                            친구톡은 카카오 채널을 친구 추가한 사용자에게만 발송됩니다.
                        </p>
                    )}
                </div>

                {/* 발송 모드 선택 */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                    <h2 className="font-bold text-gray-700 mb-3">발송 모드</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSendMode('single')}
                            className={`px-4 py-2 rounded-lg ${sendMode === 'single' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                        >
                            개별 발송
                        </button>
                        <button
                            onClick={() => setSendMode('bulk')}
                            disabled={messageType === 'kakao'}
                            className={`px-4 py-2 rounded-lg ${sendMode === 'bulk' ? 'bg-blue-600 text-white' : 'bg-gray-200'} ${messageType === 'kakao' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            일괄 발송
                        </button>
                        <button
                            onClick={() => setSendMode('direct')}
                            className={`px-4 py-2 rounded-lg ${sendMode === 'direct' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                        >
                            직접 입력
                        </button>
                    </div>
                </div>

                {/* 발송 폼 */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                    {sendMode === 'single' && (
                        <div>
                            <h2 className="font-bold text-gray-700 mb-3">학생 선택 (학부모 번호로 발송)</h2>
                            <select
                                value={selectedStudent}
                                onChange={(e) => setSelectedStudent(e.target.value)}
                                className="w-full p-2 border rounded-lg mb-4"
                            >
                                <option value="">학생 선택...</option>
                                {students.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.seat_number} {s.name} {s.parent_phone ? `(${s.parent_phone})` : '(번호없음)'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {sendMode === 'bulk' && (
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="font-bold text-gray-700">학생 선택 ({selectedStudents.length}명)</h2>
                                <button
                                    onClick={selectAllStudents}
                                    className="text-sm text-blue-600 hover:underline"
                                >
                                    {selectedStudents.length === students.length ? '전체 해제' : '전체 선택'}
                                </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 mb-4">
                                {students.map(s => (
                                    <label key={s.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedStudents.includes(s.id)}
                                            onChange={() => toggleStudentSelection(s.id)}
                                            className="w-4 h-4"
                                        />
                                        <span className={s.parent_phone ? '' : 'text-gray-400'}>
                                            {s.seat_number} {s.name}
                                            {!s.parent_phone && ' (번호없음)'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {sendMode === 'direct' && (
                        <div>
                            <h2 className="font-bold text-gray-700 mb-3">직접 번호 입력</h2>
                            <input
                                type="tel"
                                value={directPhone}
                                onChange={(e) => setDirectPhone(e.target.value)}
                                placeholder="01012345678"
                                className="w-full p-2 border rounded-lg mb-4"
                            />
                        </div>
                    )}

                    {/* 메시지 입력 */}
                    <div>
                        <h2 className="font-bold text-gray-700 mb-2">메시지 내용</h2>
                        <textarea
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder="발송할 메시지를 입력하세요..."
                            rows={4}
                            className="w-full p-2 border rounded-lg"
                        />
                        <div className="text-sm text-gray-500 mt-1">
                            {messageText.length}자 / {new Blob([messageText]).size}바이트
                            {new Blob([messageText]).size > 80 && <span className="text-orange-600"> (LMS로 발송됩니다)</span>}
                        </div>
                    </div>

                    {/* 발송 버튼 */}
                    <div className="mt-4">
                        <button
                            onClick={() => {
                                if (sendMode === 'single') handleSingleSend()
                                else if (sendMode === 'bulk') handleBulkSend()
                                else handleDirectSend()
                            }}
                            disabled={sending || !serviceStatus?.available}
                            className={`w-full py-3 text-white rounded-lg font-bold disabled:bg-gray-400 disabled:cursor-not-allowed ${
                                messageType === 'kakao' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {sending ? '발송 중...' : messageType === 'kakao' ? '카카오톡 발송' : '문자 발송'}
                        </button>
                    </div>
                </div>

                {/* 발송 결과 */}
                {sendResult && (
                    <div className={`rounded-lg shadow-md p-4 ${sendResult.success ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'}`}>
                        <h2 className={`font-bold mb-2 ${sendResult.success ? 'text-green-800' : 'text-red-800'}`}>
                            {sendResult.success ? '발송 성공!' : '발송 실패'}
                        </h2>
                        <pre className="text-sm overflow-x-auto bg-white p-2 rounded">
                            {JSON.stringify(sendResult.success ? sendResult.data : sendResult.error, null, 2)}
                        </pre>
                    </div>
                )}

                {/* 안내 */}
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mt-4">
                    <h3 className="font-bold text-yellow-800 mb-2">참고사항</h3>
                    <ul className="text-sm text-yellow-700 space-y-1">
                        <li>- <strong>SMS:</strong> 80바이트(한글 약 40자) 이하</li>
                        <li>- <strong>LMS:</strong> 80바이트 초과 시 자동 LMS로 발송</li>
                        <li>- <strong>친구톡:</strong> 카카오 채널 친구에게만 발송 가능 (친구 아니면 실패)</li>
                        <li>- SMS/LMS는 발신번호 등록 필수 (Solapi 콘솔)</li>
                        <li>- 테스트 발송도 실제 요금이 차감됩니다</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}

export default MessageTest
