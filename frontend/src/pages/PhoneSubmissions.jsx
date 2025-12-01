import { useState, useEffect } from 'react'
import api from '../api/axios'

function PhoneSubmissions() {
    const [submissions, setSubmissions] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('active') // 'all', 'active', 'returned'
    const [students, setStudents] = useState([])

    // 제출 모달
    const [showSubmitModal, setShowSubmitModal] = useState(false)
    const [selectedStudent, setSelectedStudent] = useState(null)
    const [submittedBy, setSubmittedBy] = useState('')
    const [storageLocation, setStorageLocation] = useState('')
    const [notes, setNotes] = useState('')

    useEffect(() => {
        fetchSubmissions()
        fetchStudents()
    }, [filter])

    const fetchSubmissions = async () => {
        try {
            setLoading(true)
            let url = '/phone-submissions/'

            if (filter === 'active') {
                url = '/phone-submissions/active'
            } else if (filter === 'returned') {
                url = '/phone-submissions/?is_returned=true'
            }

            const response = await api.get(url)
            setSubmissions(response.data)
        } catch (error) {
            console.error('Failed to fetch submissions:', error)
            alert('제출 목록을 불러오는데 실패했습니다')
        } finally {
            setLoading(false)
        }
    }

    const fetchStudents = async () => {
        try {
            const response = await api.get('/students/')
            setStudents(response.data)
        } catch (error) {
            console.error('Failed to fetch students:', error)
        }
    }

    const openSubmitModal = () => {
        setShowSubmitModal(true)
        setSelectedStudent(null)
        setSubmittedBy('')
        setStorageLocation('')
        setNotes('')
    }

    const handleSubmit = async () => {
        if (!selectedStudent) {
            alert('학생을 선택해주세요')
            return
        }

        try {
            await api.post('/phone-submissions/', {
                student_id: selectedStudent,
                submitted_by: submittedBy || null,
                storage_location: storageLocation || null,
                notes: notes || null
            })
            alert('휴대폰 제출이 등록되었습니다')
            setShowSubmitModal(false)
            fetchSubmissions()
        } catch (error) {
            console.error('Submit failed:', error)
            alert(error.response?.data?.detail || '제출 등록에 실패했습니다')
        }
    }

    const handleReturn = async (submissionId) => {
        const returnedBy = prompt('반납 처리자 이름을 입력하세요:')
        if (!returnedBy) return

        try {
            await api.put(`/phone-submissions/${submissionId}/return`, {
                returned_by: returnedBy
            })
            alert('반납 처리되었습니다')
            fetchSubmissions()
        } catch (error) {
            console.error('Return failed:', error)
            alert(error.response?.data?.detail || '반납 처리에 실패했습니다')
        }
    }

    const handleDelete = async (submissionId) => {
        if (!confirm('이 제출 기록을 삭제하시겠습니까?')) return

        try {
            await api.delete(`/phone-submissions/${submissionId}`)
            alert('삭제되었습니다')
            fetchSubmissions()
        } catch (error) {
            console.error('Delete failed:', error)
            alert('삭제에 실패했습니다')
        }
    }

    const formatDateTime = (dateString) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getSubmissionDuration = (submittedAt, returnedAt) => {
        const start = new Date(submittedAt)
        const end = returnedAt ? new Date(returnedAt) : new Date()
        const diffHours = Math.floor((end - start) / (1000 * 60 * 60))
        const diffMinutes = Math.floor(((end - start) % (1000 * 60 * 60)) / (1000 * 60))

        if (diffHours > 0) {
            return `${diffHours}시간 ${diffMinutes}분`
        }
        return `${diffMinutes}분`
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">📱 휴대폰 제출 관리</h1>
                        <p className="text-gray-600 mt-1">학생 휴대폰 제출 및 반납 관리</p>
                    </div>
                    <button
                        onClick={openSubmitModal}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg"
                    >
                        + 휴대폰 제출 등록
                    </button>
                </div>

                {/* 필터 */}
                <div className="mb-6 flex gap-3">
                    <button
                        onClick={() => setFilter('active')}
                        className={`px-4 py-2 rounded-lg font-medium ${
                            filter === 'active'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        제출 중 ({submissions.length})
                    </button>
                    <button
                        onClick={() => setFilter('returned')}
                        className={`px-4 py-2 rounded-lg font-medium ${
                            filter === 'returned'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        반납 완료
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg font-medium ${
                            filter === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        전체
                    </button>
                </div>

                {/* 제출 목록 */}
                {loading ? (
                    <div className="text-center py-8">
                        <div className="text-gray-500">로딩 중...</div>
                    </div>
                ) : submissions.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-md p-8 text-center">
                        <p className="text-gray-500">제출 기록이 없습니다</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        학생
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        제출 정보
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        보관 위치
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        경과 시간
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        상태
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        작업
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {submissions.map((submission) => (
                                    <tr key={submission.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">
                                                {submission.student_name}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {submission.student_seat_number}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900">
                                                제출: {formatDateTime(submission.submitted_at)}
                                            </div>
                                            {submission.submitted_by && (
                                                <div className="text-xs text-gray-500">
                                                    담당: {submission.submitted_by}
                                                </div>
                                            )}
                                            {submission.is_returned && (
                                                <div className="text-sm text-green-700 mt-1">
                                                    반납: {formatDateTime(submission.returned_at)}
                                                    {submission.returned_by && ` (${submission.returned_by})`}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {submission.storage_location || '-'}
                                            </div>
                                            {submission.notes && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {submission.notes}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {getSubmissionDuration(submission.submitted_at, submission.returned_at)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {submission.is_returned ? (
                                                <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                    반납 완료
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                    제출 중
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {!submission.is_returned ? (
                                                <button
                                                    onClick={() => handleReturn(submission.id)}
                                                    className="text-green-600 hover:text-green-900 font-medium mr-3"
                                                >
                                                    반납 처리
                                                </button>
                                            ) : null}
                                            <button
                                                onClick={() => handleDelete(submission.id)}
                                                className="text-red-600 hover:text-red-900 font-medium"
                                            >
                                                삭제
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 제출 등록 모달 */}
                {showSubmitModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                            <h3 className="text-xl font-bold mb-4">휴대폰 제출 등록</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        학생 선택 *
                                    </label>
                                    <select
                                        value={selectedStudent || ''}
                                        onChange={(e) => setSelectedStudent(parseInt(e.target.value))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    >
                                        <option value="">학생을 선택하세요</option>
                                        {students.map((student) => (
                                            <option key={student.id} value={student.id}>
                                                {student.name} ({student.seat_number})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        제출 받은 사람
                                    </label>
                                    <input
                                        type="text"
                                        value={submittedBy}
                                        onChange={(e) => setSubmittedBy(e.target.value)}
                                        placeholder="예: 홍길동 선생님"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        보관 위치
                                    </label>
                                    <input
                                        type="text"
                                        value={storageLocation}
                                        onChange={(e) => setStorageLocation(e.target.value)}
                                        placeholder="예: 서랍1, 서랍2"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        메모
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="특이사항이 있으면 입력하세요"
                                        rows="2"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowSubmitModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                >
                                    제출 등록
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default PhoneSubmissions
