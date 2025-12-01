import { useState, useEffect, useRef } from 'react'
import api from '../api/axios'

// KaTeX CSS/JS는 index.html에 CDN으로 추가 필요
// 또는 useEffect에서 동적 로드

function MathTutor() {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [sessionId, setSessionId] = useState(null)
    const [sessions, setSessions] = useState([])
    const [remainingQuestions, setRemainingQuestions] = useState(10)
    const [selectedImage, setSelectedImage] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)
    const [showSidebar, setShowSidebar] = useState(false)
    const [aiStatus, setAiStatus] = useState(null)

    const messagesEndRef = useRef(null)
    const fileInputRef = useRef(null)

    // KaTeX 동적 로드
    useEffect(() => {
        // KaTeX CSS
        if (!document.getElementById('katex-css')) {
            const link = document.createElement('link')
            link.id = 'katex-css'
            link.rel = 'stylesheet'
            link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css'
            document.head.appendChild(link)
        }

        // KaTeX JS
        if (!window.katex) {
            const script = document.createElement('script')
            script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js'
            script.async = true
            document.body.appendChild(script)

            script.onload = () => {
                // Auto-render extension
                const autoRender = document.createElement('script')
                autoRender.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js'
                autoRender.async = true
                document.body.appendChild(autoRender)
            }
        }
    }, [])

    // 초기 로드
    useEffect(() => {
        checkAiStatus()
        fetchUsage()
        fetchSessions()
    }, [])

    // 메시지 스크롤
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // KaTeX 렌더링
    useEffect(() => {
        if (window.renderMathInElement) {
            window.renderMathInElement(document.body, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\[', right: '\\]', display: true },
                    { left: '\\(', right: '\\)', display: false }
                ],
                throwOnError: false
            })
        }
    }, [messages])

    const checkAiStatus = async () => {
        try {
            const res = await api.get('/ai/health')
            setAiStatus(res.data)
        } catch (err) {
            setAiStatus({ status: 'error', message: 'AI 서비스 연결 실패' })
        }
    }

    const fetchUsage = async () => {
        try {
            const res = await api.get('/ai/usage')
            setRemainingQuestions(res.data.remaining)
        } catch (err) {
            console.error('사용량 조회 실패:', err)
        }
    }

    const fetchSessions = async () => {
        try {
            const res = await api.get('/ai/sessions')
            setSessions(res.data)
        } catch (err) {
            console.error('세션 목록 조회 실패:', err)
        }
    }

    const loadSession = async (id) => {
        try {
            const res = await api.get(`/ai/sessions/${id}/messages`)
            setMessages(res.data.map(msg => ({
                role: msg.role,
                content: msg.content,
                hasImage: msg.has_image
            })))
            setSessionId(id)
            setShowSidebar(false)
        } catch (err) {
            console.error('세션 로드 실패:', err)
        }
    }

    const startNewSession = () => {
        setSessionId(null)
        setMessages([])
        setShowSidebar(false)
    }

    const handleImageSelect = (e) => {
        const file = e.target.files[0]
        if (file) {
            // 파일 크기 제한 (5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('이미지 크기는 5MB 이하여야 합니다.')
                return
            }

            setSelectedImage(file)

            // 미리보기 생성
            const reader = new FileReader()
            reader.onloadend = () => {
                setImagePreview(reader.result)
            }
            reader.readAsDataURL(file)
        }
    }

    const removeImage = () => {
        setSelectedImage(null)
        setImagePreview(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const sendMessage = async () => {
        if (!input.trim() && !selectedImage) return
        if (remainingQuestions <= 0) {
            alert('오늘의 질문 횟수를 모두 사용했습니다.')
            return
        }

        const userMessage = input.trim() || (selectedImage ? '이 문제를 풀어주세요.' : '')

        // 사용자 메시지 추가
        setMessages(prev => [...prev, {
            role: 'user',
            content: userMessage,
            hasImage: !!selectedImage,
            imagePreview: imagePreview
        }])

        setInput('')
        setIsLoading(true)

        try {
            // 이미지를 Base64로 변환
            let imageBase64 = null
            if (selectedImage) {
                imageBase64 = await new Promise((resolve) => {
                    const reader = new FileReader()
                    reader.onloadend = () => {
                        // data:image/jpeg;base64, 부분 제거
                        const base64 = reader.result.split(',')[1]
                        resolve(base64)
                    }
                    reader.readAsDataURL(selectedImage)
                })
            }

            const res = await api.post('/ai/chat', {
                message: userMessage,
                session_id: sessionId,
                image_base64: imageBase64
            })

            // AI 응답 추가
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: res.data.response
            }])

            setSessionId(res.data.session_id)
            setRemainingQuestions(res.data.remaining_questions)

            // 이미지 초기화
            removeImage()

            // 세션 목록 갱신
            fetchSessions()

        } catch (err) {
            console.error('메시지 전송 실패:', err)
            const errorMsg = err.response?.data?.detail || '오류가 발생했습니다.'
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `⚠️ ${errorMsg}`
            }])
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    return (
        <div className="h-screen flex bg-gray-100">
            {/* 사이드바 (세션 목록) */}
            <div className={`
                ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0
                fixed lg:relative
                w-72 h-full
                bg-white border-r
                transition-transform duration-300
                z-20
                flex flex-col
            `}>
                <div className="p-4 border-b">
                    <button
                        onClick={startNewSession}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition"
                    >
                        + 새 대화
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    <h3 className="text-sm font-semibold text-gray-500 px-2 py-1">이전 대화</h3>
                    {sessions.map(session => (
                        <button
                            key={session.id}
                            onClick={() => loadSession(session.id)}
                            className={`
                                w-full text-left p-3 rounded-lg mb-1
                                hover:bg-gray-100 transition
                                ${sessionId === session.id ? 'bg-blue-50 border border-blue-200' : ''}
                            `}
                        >
                            <div className="font-medium text-gray-800 truncate">{session.title}</div>
                            <div className="text-xs text-gray-500">
                                {new Date(session.created_at).toLocaleDateString('ko-KR')}
                                · {session.message_count}개 메시지
                            </div>
                        </button>
                    ))}
                    {sessions.length === 0 && (
                        <p className="text-gray-400 text-sm text-center py-4">
                            아직 대화가 없습니다
                        </p>
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50">
                    <div className="text-sm text-gray-600">
                        오늘 남은 질문: <span className="font-bold text-blue-600">{remainingQuestions}</span>회
                    </div>
                </div>
            </div>

            {/* 오버레이 (모바일) */}
            {showSidebar && (
                <div
                    className="fixed inset-0 bg-black/50 z-10 lg:hidden"
                    onClick={() => setShowSidebar(false)}
                />
            )}

            {/* 메인 채팅 영역 */}
            <div className="flex-1 flex flex-col">
                {/* 헤더 */}
                <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <h1 className="text-xl font-bold text-gray-800">🧮 수능 수학 AI 튜터</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {aiStatus?.status === 'ok' ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">AI 준비됨</span>
                        ) : (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">AI 오프라인</span>
                        )}
                        <a href="/" className="text-gray-500 hover:text-gray-700">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                        </a>
                    </div>
                </header>

                {/* 메시지 영역 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">📚</div>
                            <h2 className="text-2xl font-bold text-gray-700 mb-2">수능 수학 문제를 물어보세요!</h2>
                            <p className="text-gray-500 mb-6">
                                문제 사진을 올리거나 질문을 입력하면<br />
                                단계별로 친절하게 풀이해드립니다.
                            </p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {['수학I', '수학II', '미적분', '확률과통계', '기하'].map(tag => (
                                    <span key={tag} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <ChatBubble key={idx} message={msg} />
                    ))}

                    {isLoading && (
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
                                AI
                            </div>
                            <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* 이미지 미리보기 */}
                {imagePreview && (
                    <div className="px-4 py-2 bg-gray-50 border-t">
                        <div className="relative inline-block">
                            <img
                                src={imagePreview}
                                alt="미리보기"
                                className="h-20 rounded-lg border"
                            />
                            <button
                                onClick={removeImage}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm hover:bg-red-600"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}

                {/* 입력 영역 */}
                <div className="border-t bg-white p-4">
                    <div className="max-w-4xl mx-auto flex items-end gap-2">
                        {/* 이미지 업로드 버튼 */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                            title="이미지 첨부"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </button>

                        {/* 텍스트 입력 */}
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="수학 문제나 질문을 입력하세요..."
                            className="flex-1 border rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={1}
                            disabled={isLoading}
                        />

                        {/* 전송 버튼 */}
                        <button
                            onClick={sendMessage}
                            disabled={isLoading || (!input.trim() && !selectedImage)}
                            className={`
                                p-3 rounded-xl transition
                                ${isLoading || (!input.trim() && !selectedImage)
                                    ? 'bg-gray-200 text-gray-400'
                                    : 'bg-blue-500 hover:bg-blue-600 text-white'}
                            `}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </div>

                    <p className="text-center text-xs text-gray-400 mt-2">
                        Gemini AI 기반 · 수식은 자동으로 렌더링됩니다 ($...$ 또는 $$...$$)
                    </p>
                </div>
            </div>
        </div>
    )
}

// 채팅 말풍선 컴포넌트
function ChatBubble({ message }) {
    const isUser = message.role === 'user'

    // 마크다운 스타일 수식 렌더링을 위한 처리
    const renderContent = (content) => {
        // 줄바꿈 처리
        return content.split('\n').map((line, i) => (
            <span key={i}>
                {line}
                {i < content.split('\n').length - 1 && <br />}
            </span>
        ))
    }

    return (
        <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* 아바타 */}
            <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0
                ${isUser ? 'bg-green-500' : 'bg-blue-500'}
            `}>
                {isUser ? '나' : 'AI'}
            </div>

            {/* 메시지 */}
            <div className={`
                max-w-[80%] rounded-2xl px-4 py-3 shadow-sm
                ${isUser
                    ? 'bg-green-500 text-white rounded-tr-none'
                    : 'bg-white text-gray-800 rounded-tl-none'}
            `}>
                {/* 이미지 미리보기 (사용자 메시지) */}
                {message.imagePreview && (
                    <img
                        src={message.imagePreview}
                        alt="첨부 이미지"
                        className="max-w-full rounded-lg mb-2"
                    />
                )}

                {/* 텍스트 내용 */}
                <div className="whitespace-pre-wrap break-words math-content">
                    {renderContent(message.content)}
                </div>
            </div>
        </div>
    )
}

export default MathTutor
