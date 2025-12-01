import { useState, useEffect } from 'react'
import api from '../api/axios'

const DAYS_OF_WEEK = ['월', '화', '수', '목', '금', '토', '일']

function RecurringSchedules() {
    const [students, setStudents] = useState([])
    const [recurringOutings, setRecurringOutings] = useState([])

    // Searchable Select State
    const [studentSearch, setStudentSearch] = useState('')
    const [showStudentDropdown, setShowStudentDropdown] = useState(false)

    // Form
    const [outingForm, setOutingForm] = useState({
        student_id: '',
        day_of_week: 0,
        start_time: '',
        end_time: '',
        reason: ''
    })

    // Edit State
    const [editingId, setEditingId] = useState(null)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [studRes, outRes] = await Promise.all([
                api.get('/students/'),
                api.get('/recurring-outings/')
            ])
            setStudents(studRes.data)
            setRecurringOutings(outRes.data)
        } catch (error) {
            console.error('Error fetching data:', error)
        }
    }

    const getStudentName = (id) => {
        const s = students.find(st => st.id === id)
        return s ? `${s.name} (${s.seat_number})` : 'Unknown'
    }

    const filteredStudents = students.filter(s =>
        s.name.includes(studentSearch) || s.seat_number.includes(studentSearch)
    )

    const selectStudent = (student) => {
        setOutingForm({ ...outingForm, student_id: student.id })
        setStudentSearch(`${student.name} (${student.seat_number})`)
        setShowStudentDropdown(false)
    }

    // Submit Handler
    const handleOutingSubmit = async (e) => {
        e.preventDefault()

        // 학생 선택 확인
        if (!outingForm.student_id) {
            alert('학생을 선택해주세요.')
            return
        }

        // 데이터 정수 변환 확인
        const submitData = {
            ...outingForm,
            student_id: parseInt(outingForm.student_id),
            day_of_week: parseInt(outingForm.day_of_week)
        }

        try {
            if (editingId) {
                await api.put(`/recurring-outings/${editingId}`, submitData)
                alert('정기 외출이 수정되었습니다.')
                setEditingId(null)
            } else {
                await api.post('/recurring-outings/', submitData)
                alert('정기 외출이 등록되었습니다.')
            }
            setOutingForm({ student_id: '', day_of_week: 0, start_time: '', end_time: '', reason: '' })
            setStudentSearch('')
            fetchData()
        } catch (error) {
            console.error('Error saving recurring outing:', error)
            alert('저장 실패: ' + (error.response?.data?.detail || '오류 발생'))
        }
    }

    // Edit/Delete Handlers
    const startEdit = (item) => {
        setEditingId(item.id)
        const s = students.find(st => st.id === item.student_id)
        setStudentSearch(s ? `${s.name} (${s.seat_number})` : '')
        setOutingForm({
            student_id: item.student_id,
            day_of_week: item.day_of_week,
            start_time: item.start_time,
            end_time: item.end_time,
            reason: item.reason
        })
    }

    const deleteItem = async (id) => {
        if (!window.confirm('정말 삭제하시겠습니까?')) return
        try {
            await api.delete(`/recurring-outings/${id}`)
            fetchData()
        } catch (error) {
            console.error('Error deleting recurring outing:', error)
            alert('삭제 실패')
        }
    }

    const cancelEdit = () => {
        setEditingId(null)
        setOutingForm({ student_id: '', day_of_week: 0, start_time: '', end_time: '', reason: '' })
        setStudentSearch('')
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">정기 외출 관리</h1>
                        <p className="text-gray-500 text-sm mt-1">매주 반복되는 외출 일정 (요일별 자동 반복)</p>
                    </div>
                    <div className="flex space-x-4">
                        <a href="/diamond-counseling" className="text-indigo-600 hover:underline font-semibold">다이아몬드 상담 &rarr;</a>
                        <a href="/schedules" className="text-green-600 hover:underline font-semibold">비정기 일정 관리 &rarr;</a>
                        <a href="/" className="text-blue-500 hover:underline">&larr; 대시보드로 돌아가기</a>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Section */}
                    <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-6 h-fit relative">
                        <h2 className="text-xl font-semibold mb-4">
                            {editingId ? '정기 외출 수정' : '새 정기 외출'}
                        </h2>

                        <form onSubmit={handleOutingSubmit} className="space-y-4">
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700">학생 검색</label>
                                <input
                                    type="text"
                                    value={studentSearch}
                                    onChange={e => { setStudentSearch(e.target.value); setShowStudentDropdown(true); }}
                                    onFocus={() => setShowStudentDropdown(true)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                    placeholder="이름 또는 좌석번호 입력"
                                    required
                                />
                                {showStudentDropdown && studentSearch && (
                                    <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto mt-1">
                                        {filteredStudents.map(s => (
                                            <li
                                                key={s.id}
                                                onClick={() => selectStudent(s)}
                                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                            >
                                                {s.name} ({s.seat_number})
                                            </li>
                                        ))}
                                        {filteredStudents.length === 0 && <li className="px-4 py-2 text-gray-500">검색 결과 없음</li>}
                                    </ul>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">요일</label>
                                <select
                                    value={outingForm.day_of_week}
                                    onChange={e => setOutingForm({ ...outingForm, day_of_week: parseInt(e.target.value) })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                >
                                    {DAYS_OF_WEEK.map((day, idx) => (
                                        <option key={idx} value={idx}>{day}요일</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">시작 시간</label>
                                    <input
                                        type="time"
                                        value={outingForm.start_time}
                                        onChange={e => setOutingForm({ ...outingForm, start_time: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">종료 시간</label>
                                    <input
                                        type="time"
                                        value={outingForm.end_time}
                                        onChange={e => setOutingForm({ ...outingForm, end_time: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">사유</label>
                                <input
                                    type="text"
                                    value={outingForm.reason}
                                    onChange={e => setOutingForm({ ...outingForm, reason: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                    required
                                />
                            </div>
                            <div className="flex space-x-2">
                                <button type="submit" className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700">
                                    {editingId ? '수정 완료' : '등록하기'}
                                </button>
                                {editingId && (
                                    <button type="button" onClick={cancelEdit} className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600">
                                        취소
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* List Section */}
                    <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold mb-4">정기 외출 목록</h2>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">학생</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">요일</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사유</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {recurringOutings.map(o => (
                                        <tr key={o.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{getStudentName(o.student_id)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{DAYS_OF_WEEK[o.day_of_week]}요일</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{o.start_time} ~ {o.end_time}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{o.reason}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                <button onClick={() => startEdit(o)} className="text-indigo-600 hover:text-indigo-900">수정</button>
                                                <button onClick={() => deleteItem(o.id)} className="text-red-600 hover:text-red-900">삭제</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RecurringSchedules
