import { useState } from 'react'
import api from '../api/axios'

const StudentRequestForm = ({ requestType, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        cable_type: '없음',
        print_file_link: '',
        paper_size: 'A4',
        print_sides: '단면',
        priority: '일반',
        // 외출 신청
        outing_date: new Date().toISOString().slice(0, 10),
        outing_start_time: '',
        outing_end_time: '',
        outing_reason: '',
        // 상담 신청
        counselor_name: '김현철 선생님',
        counseling_date: '',
        counseling_time: '',
        counseling_reason: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // 현재 교시 계산 함수
    const getCurrentPeriod = () => {
        const now = new Date()
        const hour = now.getHours()
        const minute = now.getMinutes()
        const time = hour * 60 + minute

        // 교시 시간표 (분으로 변환)
        const periods = [
            { period: 0, start: 0, end: 8 * 60 }, // ~오전 8:00: 등원
            { period: 1, start: 8 * 60, end: 10 * 60 }, // 1교시
            { period: 2, start: 10 * 60 + 20, end: 12 * 60 }, // 2교시
            { period: 3, start: 13 * 60, end: 15 * 60 }, // 3교시
            { period: 4, start: 15 * 60 + 20, end: 16 * 60 + 40 }, // 4교시
            { period: 5, start: 16 * 60 + 50, end: 18 * 60 }, // 5교시
            { period: 6, start: 19 * 60, end: 20 * 60 + 20 }, // 6교시
            { period: 7, start: 20 * 60 + 30, end: 22 * 60 }, // 7교시
        ]

        for (const p of periods) {
            if (time >= p.start && time < p.end) {
                return p.period
            }
        }
        return 0 // 기본값
    }

    // 교시별 종료 시간 (반납 시간 표시용)
    const PERIOD_END_TIMES = {
        1: '10:00',
        2: '12:00',
        3: '15:00',
        4: '16:40',
        5: '18:00',
        6: '20:20',
        7: '22:00'
    }

    // 반납 예정 교시 계산 (다음 교시 끝)
    const getReturnDuePeriod = () => {
        const current = getCurrentPeriod()
        if (current === 0) return 1 // 등원 시간이면 1교시 끝
        if (current === 7) return 7 // 마지막 교시면 마지막 교시 끝
        return current + 1 // 다음 교시 끝
    }

    // 반납 예정 시간 (실제 시간)
    const getReturnDueTime = () => {
        const duePeriod = getReturnDuePeriod()
        return PERIOD_END_TIMES[duePeriod] || '22:00'
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        // 보조배터리: 확인 메시지
        if (requestType === '보조배터리') {
            const confirmed = window.confirm(
                `추가물품: ${formData.cable_type}\n\n즉시 신청하시겠습니까?\n\n관리 선생님께서 15분 이내로 최대한 빠르게 가져다 드리겠습니다.`
            )
            if (!confirmed) return
        }

        // 프린트: 확인 메시지
        if (requestType === '프린트') {
            const confirmed = window.confirm(
                `파일: ${formData.print_file_link}\n종이: ${formData.paper_size} (${formData.print_sides})\n\n신청하시겠습니까?\n\n다음 교시 쉬는시간에 가져다 드리겠습니다.`
            )
            if (!confirmed) return
        }

        // 외출 신청
        if (requestType === '외출신청') {
            if (!formData.outing_start_time || !formData.outing_end_time || !formData.outing_reason) {
                setError('모든 필수 항목을 입력해주세요.')
                setLoading(false)
                return
            }
            const confirmed = window.confirm(
                `외출 신청\n\n날짜: ${formData.outing_date}\n시간: ${formData.outing_start_time} ~ ${formData.outing_end_time}\n사유: ${formData.outing_reason}\n\n신청하시겠습니까?`
            )
            if (!confirmed) {
                setLoading(false)
                return
            }
        }

        // 상담 신청
        if (requestType === '상담신청') {
            if (!formData.counseling_date || !formData.counseling_time || !formData.counseling_reason) {
                setError('모든 필수 항목을 입력해주세요.')
                setLoading(false)
                return
            }
            const confirmed = window.confirm(
                `상담 신청\n\n상담 선생님: ${formData.counselor_name}\n날짜: ${formData.counseling_date}\n시간: ${formData.counseling_time}\n사유: ${formData.counseling_reason}\n\n신청하시겠습니까?`
            )
            if (!confirmed) {
                setLoading(false)
                return
            }
        }

        // 학관호출은 미구현
        if (requestType === '학관호출') {
            alert('이 기능은 아직 개발 중입니다. 관리 선생님께 직접 문의해주세요.')
            onClose()
            return
        }

        setLoading(true)

        const studentId = localStorage.getItem('student_id')
        if (!studentId) {
            setError('로그인이 필요합니다')
            setLoading(false)
            return
        }

        try {
            const requestData = {
                student_id: parseInt(studentId),
                request_type: requestType,
                title: null,
                content: null,
                priority: formData.priority
            }

            // 보조배터리 전용 필드
            if (requestType === '보조배터리') {
                requestData.title = '보조배터리 대여'
                requestData.cable_type = formData.cable_type
                requestData.return_due_period = getReturnDuePeriod()
            }

            // 프린트 전용 필드
            if (requestType === '프린트') {
                requestData.title = '프린트 신청'
                requestData.print_file_link = formData.print_file_link
                requestData.paper_size = formData.paper_size
                requestData.print_sides = formData.print_sides
            }

            // 외출 신청 전용 필드
            if (requestType === '외출신청') {
                requestData.title = '외출 신청'
                requestData.content = `날짜: ${formData.outing_date}\n시간: ${formData.outing_start_time} ~ ${formData.outing_end_time}\n사유: ${formData.outing_reason}`
                requestData.preferred_datetime = `${formData.outing_date}T${formData.outing_start_time}:00`
            }

            // 상담 신청 전용 필드
            if (requestType === '상담신청') {
                requestData.title = `상담 신청 - ${formData.counselor_name}`
                requestData.content = `상담 선생님: ${formData.counselor_name}\n날짜: ${formData.counseling_date}\n시간: ${formData.counseling_time}\n사유: ${formData.counseling_reason}`
                requestData.preferred_datetime = `${formData.counseling_date}T${formData.counseling_time}:00`
            }

            await api.post('/student-requests/', requestData)

            if (onSuccess) {
                onSuccess()
            }
            onClose()
        } catch (err) {
            console.error('Request submission error:', err)
            setError('요청 제출에 실패했습니다. 다시 시도해주세요.')
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    // 학관호출은 아직 미구현
    if (requestType === '학관호출') {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">{requestType}</h2>
                    <p className="text-gray-600 mb-6">
                        이 기능은 현재 개발 중입니다.<br />
                        관리 선생님께 직접 문의해주세요.
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                        확인
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
                <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-800">{requestType}</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-2xl"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* 보조배터리 전용 필드 */}
                    {requestType === '보조배터리' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                추가물품 (케이블)
                            </label>
                            <select
                                name="cable_type"
                                value={formData.cable_type}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="없음">없음 (케이블 필요 없음)</option>
                                <option value="C타입">C타입</option>
                                <option value="라이트닝">라이트닝</option>
                            </select>
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                <p className="text-sm font-medium text-blue-800">
                                    반납 예정: {getReturnDuePeriod()}교시 끝 ({getReturnDueTime()})
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 외출 신청 전용 필드 */}
                    {requestType === '외출신청' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    외출 날짜 *
                                </label>
                                <input
                                    type="date"
                                    name="outing_date"
                                    value={formData.outing_date}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        시작 시간 *
                                    </label>
                                    <input
                                        type="time"
                                        name="outing_start_time"
                                        value={formData.outing_start_time}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        종료 시간 *
                                    </label>
                                    <input
                                        type="time"
                                        name="outing_end_time"
                                        value={formData.outing_end_time}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    외출 사유 *
                                </label>
                                <textarea
                                    name="outing_reason"
                                    value={formData.outing_reason}
                                    onChange={handleChange}
                                    placeholder="외출 사유를 입력하세요"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    rows="3"
                                    required
                                />
                            </div>
                            <p className="text-sm text-yellow-600 font-medium">
                                * 신청 후 관리 선생님의 승인이 필요합니다
                            </p>
                        </>
                    )}

                    {/* 상담 신청 전용 필드 */}
                    {requestType === '상담신청' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    상담 선생님 *
                                </label>
                                <select
                                    name="counselor_name"
                                    value={formData.counselor_name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                >
                                    <option value="김현철 선생님">김현철 선생님</option>
                                    <option value="정현재 선생님">정현재 선생님</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        상담 날짜 *
                                    </label>
                                    <input
                                        type="date"
                                        name="counseling_date"
                                        value={formData.counseling_date}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        희망 시간 *
                                    </label>
                                    <input
                                        type="time"
                                        name="counseling_time"
                                        value={formData.counseling_time}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    상담 사유 *
                                </label>
                                <textarea
                                    name="counseling_reason"
                                    value={formData.counseling_reason}
                                    onChange={handleChange}
                                    placeholder="상담 받고 싶은 내용을 입력하세요"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    rows="3"
                                    required
                                />
                            </div>
                            <p className="text-sm text-purple-600 font-medium">
                                * 신청 후 운영진의 승인이 필요합니다
                            </p>
                        </>
                    )}

                    {/* 프린트 전용 필드 */}
                    {requestType === '프린트' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    파일 링크 (Google Drive, OneDrive 등) *
                                </label>
                                <input
                                    type="url"
                                    name="print_file_link"
                                    value={formData.print_file_link}
                                    onChange={handleChange}
                                    placeholder="https://drive.google.com/..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    파일을 클라우드에 업로드한 후 공유 링크를 붙여넣으세요
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        종이 크기 *
                                    </label>
                                    <select
                                        name="paper_size"
                                        value={formData.paper_size}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    >
                                        <option value="A4">A4</option>
                                        <option value="B4">B4</option>
                                        <option value="A3">A3</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        인쇄 방식 *
                                    </label>
                                    <select
                                        name="print_sides"
                                        value={formData.print_sides}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    >
                                        <option value="단면">단면</option>
                                        <option value="양면">양면</option>
                                    </select>
                                </div>
                            </div>

                            <p className="text-sm text-blue-600 font-medium">
                                📢 다음 교시 쉬는시간에 가져다 드립니다
                            </p>
                        </>
                    )}

                    {/* 에러 메시지 */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* 버튼 */}
                    <div className="flex space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            {loading ? '제출 중...' : '신청하기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default StudentRequestForm
