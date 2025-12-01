import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

const StudentPortalLogin = () => {
    const navigate = useNavigate()
    const [name, setName] = useState('')
    const [seatNumber, setSeatNumber] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    // 좌석 목록 생성 (A1-A42, B1-B23)
    const generateSeats = () => {
        const seats = []
        // A 자습실: A1-A42
        for (let i = 1; i <= 42; i++) {
            seats.push(`A${i}`)
        }
        // B 자습실: B1-B23
        for (let i = 1; i <= 23; i++) {
            seats.push(`B${i}`)
        }
        return seats
    }

    const seats = generateSeats()

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        if (!name || !seatNumber) {
            setError('이름과 좌석번호를 모두 입력해주세요')
            setLoading(false)
            return
        }

        try {
            const response = await api.post('/student-portal/login', {
                name: name,
                seat_number: seatNumber
            })

            // 로그인 성공 - localStorage에 저장
            localStorage.setItem('student_id', response.data.student_id)
            localStorage.setItem('student_name', response.data.name)
            localStorage.setItem('student_seat', response.data.seat_number)

            // 대시보드로 이동
            navigate('/student-portal/dashboard')
        } catch (err) {
            console.error('Login error:', err)
            if (err.response?.status === 401) {
                setError('이름 또는 좌석번호가 일치하지 않습니다')
            } else {
                setError('로그인에 실패했습니다. 다시 시도해주세요.')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">학생 포털</h1>
                    <p className="text-gray-600">Ditton Bot 학생 서비스</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {/* 이름 입력 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            이름
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="이름을 입력하세요"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                            required
                        />
                    </div>

                    {/* 좌석번호 선택 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            좌석번호
                        </label>
                        <select
                            value={seatNumber}
                            onChange={(e) => setSeatNumber(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                            required
                        >
                            <option value="">좌석을 선택하세요</option>
                            {seats.map(seat => (
                                <option key={seat} value={seat}>{seat}</option>
                            ))}
                        </select>
                    </div>

                    {/* 에러 메시지 */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* 로그인 버튼 */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg transition-colors"
                    >
                        {loading ? '로그인 중...' : '로그인'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-600">
                    <p>로그인에 문제가 있나요?</p>
                    <p className="mt-1">관리 선생님께 문의하세요</p>
                </div>
            </div>
        </div>
    )
}

export default StudentPortalLogin
