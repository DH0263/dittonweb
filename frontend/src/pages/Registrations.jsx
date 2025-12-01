import { useState, useEffect } from 'react'
import api from '../api/axios'

const DAYS_OF_WEEK = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

function Registrations() {
    const [registrations, setRegistrations] = useState([])
    const [filteredRegistrations, setFilteredRegistrations] = useState([])
    const [filter, setFilter] = useState('all') // all, pending, processed
    const [selectedRegistration, setSelectedRegistration] = useState(null)
    const [seatNumber, setSeatNumber] = useState('')

    useEffect(() => {
        fetchRegistrations()
    }, [])

    useEffect(() => {
        if (filter === 'all') {
            setFilteredRegistrations(registrations)
        } else if (filter === 'pending') {
            setFilteredRegistrations(registrations.filter(r => !r.is_processed))
        } else if (filter === 'processed') {
            setFilteredRegistrations(registrations.filter(r => r.is_processed))
        }
    }, [filter, registrations])

    const fetchRegistrations = async () => {
        try {
            const res = await api.get('/student-registrations/')
            setRegistrations(res.data)
            setFilteredRegistrations(res.data)
        } catch (error) {
            console.error('Error fetching registrations:', error)
        }
    }

    // 좌석 번호 유효성 검사 (대문자 A, B만 허용)
    const validateSeatNumber = (seatNum) => {
        const pattern = /^[AB]\d+$/
        return pattern.test(seatNum)
    }

    const processRegistration = async (registrationId) => {
        if (!seatNumber) {
            alert('좌석 번호를 입력해주세요.')
            return
        }

        // 좌석 번호 유효성 검사
        if (!validateSeatNumber(seatNumber)) {
            alert('좌석 번호는 대문자 A 또는 B로 시작해야 합니다. (예: A1, B23)')
            return
        }

        if (!window.confirm('이 등록을 처리하여 학생 DB를 생성하시겠습니까?')) return

        try {
            await api.post(`/student-registrations/${registrationId}/process?seat_number=${seatNumber}`)
            alert('학생 DB가 생성되었습니다.')
            setSelectedRegistration(null)
            setSeatNumber('')
            fetchRegistrations()
        } catch (error) {
            console.error('Error processing registration:', error)
            alert('처리 실패: ' + (error.response?.data?.detail || '알 수 없는 오류'))
        }
    }

    const viewDetails = (registration) => {
        setSelectedRegistration(registration)
        setSeatNumber('')
    }

    const closeModal = () => {
        setSelectedRegistration(null)
        setSeatNumber('')
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">신입생 등록 관리</h1>
                    <a href="/" className="text-blue-500 hover:underline">&larr; 대시보드로 돌아가기</a>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">제출된 등록 목록</h2>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                            >
                                전체
                            </button>
                            <button
                                onClick={() => setFilter('pending')}
                                className={`px-4 py-2 rounded ${filter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-200'}`}
                            >
                                미처리
                            </button>
                            <button
                                onClick={() => setFilter('processed')}
                                className={`px-4 py-2 rounded ${filter === 'processed' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                            >
                                처리완료
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">연락처</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">신분</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">등원일</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">예비등원</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">제출일</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredRegistrations.map(reg => (
                                    <tr key={reg.id} className={reg.is_processed ? 'bg-green-50' : ''}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{reg.student_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{reg.student_phone}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{reg.student_type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(reg.first_attendance_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span className={`px-2 py-1 text-xs rounded ${reg.pre_attendance_status === '완료' ? 'bg-green-100 text-green-800' :
                                                    reg.pre_attendance_status === '신청' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-gray-100 text-gray-800'
                                                }`}>
                                                {reg.pre_attendance_status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(reg.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {reg.is_processed ? (
                                                <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">처리완료</span>
                                            ) : (
                                                <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">미처리</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => viewDetails(reg)}
                                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                                            >
                                                상세보기
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedRegistration && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">등록 상세 정보</h2>
                            <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <div>
                                <h3 className="font-semibold text-gray-700 mb-2">기본 정보</h3>
                                <div className="space-y-2 text-sm">
                                    <p><span className="font-medium">이름:</span> {selectedRegistration.student_name}</p>
                                    <p><span className="font-medium">성별:</span> {selectedRegistration.gender}</p>
                                    <p><span className="font-medium">신분:</span> {selectedRegistration.student_type}</p>
                                    <p><span className="font-medium">학생 연락처:</span> {selectedRegistration.student_phone}</p>
                                    <p><span className="font-medium">학부모 연락처:</span> {selectedRegistration.parent_phone}</p>
                                    {selectedRegistration.school_name && (
                                        <p><span className="font-medium">학교:</span> {selectedRegistration.school_name}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-700 mb-2">등원 정보</h3>
                                <div className="space-y-2 text-sm">
                                    <p><span className="font-medium">등원일:</span> {new Date(selectedRegistration.first_attendance_date).toLocaleDateString()}</p>
                                    <p><span className="font-medium">예비등원:</span> {selectedRegistration.pre_attendance_status}</p>
                                    {selectedRegistration.pre_attendance_date && (
                                        <p><span className="font-medium">예비등원 예약:</span> {new Date(selectedRegistration.pre_attendance_date).toLocaleString()}</p>
                                    )}
                                    <p><span className="font-medium">좌석 유형:</span> {selectedRegistration.seat_type}</p>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-700 mb-2">과목 선택</h3>
                                <div className="space-y-2 text-sm">
                                    <p><span className="font-medium">국어:</span> {selectedRegistration.korean_subject}</p>
                                    <p><span className="font-medium">수학:</span> {selectedRegistration.math_subject}</p>
                                    <p><span className="font-medium">탐구:</span> {selectedRegistration.inquiry_subjects.join(', ')}</p>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-700 mb-2">성적</h3>
                                <div className="space-y-2 text-sm">
                                    <p className="font-mono">{selectedRegistration.recent_grade}</p>
                                </div>
                            </div>
                        </div>

                        {selectedRegistration.special_notes && (
                            <div className="mb-6">
                                <h3 className="font-semibold text-gray-700 mb-2">특이사항</h3>
                                <p className="text-sm bg-gray-50 p-3 rounded">{selectedRegistration.special_notes}</p>
                            </div>
                        )}

                        {selectedRegistration.recurring_outings_data && Object.keys(selectedRegistration.recurring_outings_data).length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-semibold text-gray-700 mb-2">정기 외출 일정</h3>
                                <div className="space-y-2">
                                    {Object.entries(selectedRegistration.recurring_outings_data).map(([dayIndex, outings]) => (
                                        outings.length > 0 && (
                                            <div key={dayIndex} className="bg-gray-50 p-3 rounded">
                                                <p className="font-medium text-sm mb-2">{DAYS_OF_WEEK[dayIndex]}</p>
                                                {outings.map((outing, idx) => (
                                                    <p key={idx} className="text-sm ml-4">
                                                        • {outing.start_time} - {outing.end_time}: {outing.reason}
                                                    </p>
                                                ))}
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>
                        )}

                        {!selectedRegistration.is_processed ? (
                            <div className="border-t pt-6">
                                <h3 className="font-semibold text-gray-700 mb-4">학생 DB 생성</h3>
                                <div className="flex items-center space-x-4">
                                    <input
                                        type="text"
                                        value={seatNumber}
                                        onChange={e => setSeatNumber(e.target.value)}
                                        placeholder="좌석 번호 (예: A1)"
                                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                    />
                                    <button
                                        onClick={() => processRegistration(selectedRegistration.id)}
                                        className="bg-green-600 text-white py-2 px-6 rounded-md hover:bg-green-700"
                                    >
                                        처리하기
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    처리하면 이 등록 정보를 바탕으로 학생 DB가 생성되고, 정기 외출 일정도 자동으로 등록됩니다.
                                </p>
                            </div>
                        ) : (
                            <div className="border-t pt-6">
                                <p className="text-green-600 font-medium">
                                    ✓ 이미 처리된 등록입니다. (학생 ID: {selectedRegistration.processed_student_id})
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default Registrations
