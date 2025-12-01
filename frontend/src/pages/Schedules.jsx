import { useState, useEffect } from 'react'
import api from '../api/axios'

function Schedules() {
    const [schedules, setSchedules] = useState([])
    const [outings, setOutings] = useState([])
    const [students, setStudents] = useState([])
    const [activeTab, setActiveTab] = useState('schedule') // 'schedule' or 'outing'

    // Searchable Select State
    const [studentSearch, setStudentSearch] = useState('')
    const [showStudentDropdown, setShowStudentDropdown] = useState(false)

    // Forms
    const [scheduleForm, setScheduleForm] = useState({
        student_id: '',
        date: '',
        time: '',
        type: '상담',
        memo: ''
    })

    const [outingForm, setOutingForm] = useState({
        student_id: '',
        date: '',
        start_time: '',
        end_time: '',
        reason: ''
    })

    // Edit State
    const [editingId, setEditingId] = useState(null)
    const [editType, setEditType] = useState(null) // 'schedule' or 'outing'

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [schedRes, outRes, studRes] = await Promise.all([
                api.get('/schedules/'),
                api.get('/outings/'),
                api.get('/students/')
            ])
            setSchedules(schedRes.data)
            setOutings(outRes.data)
            setStudents(studRes.data)
        } catch (error) {
            console.error('Error fetching data:', error)
        }
    }

    // Helper: Get Student Name
    const getStudentName = (id) => {
        const s = students.find(st => st.id === id)
        return s ? `${s.name} (${s.seat_number})` : 'Unknown'
    }

    // Helper: Date Buttons
    const setDate = (offset, formType) => {
        const d = new Date()
        d.setDate(d.getDate() + offset)
        const dateStr = d.toISOString().split('T')[0]

        if (formType === 'schedule') {
            setScheduleForm({ ...scheduleForm, date: dateStr })
        } else {
            setOutingForm({ ...outingForm, date: dateStr })
        }
    }

    // Helper: Filtered Students for Dropdown
    const filteredStudents = students.filter(s =>
        s.name.includes(studentSearch) || s.seat_number.includes(studentSearch)
    )

    const selectStudent = (student, formType) => {
        if (formType === 'schedule') {
            setScheduleForm({ ...scheduleForm, student_id: student.id })
        } else {
            setOutingForm({ ...outingForm, student_id: student.id })
        }
        setStudentSearch(`${student.name} (${student.seat_number})`)
        setShowStudentDropdown(false)
    }

    // Submit Handlers
    const handleScheduleSubmit = async (e) => {
        e.preventDefault()
        try {
            const dateTime = new Date(`${scheduleForm.date}T${scheduleForm.time}`)
            if (editingId && editType === 'schedule') {
                await api.put(`/schedules/${editingId}`, { ...scheduleForm, date: dateTime.toISOString() })
                alert('일정이 수정되었습니다.')
                setEditingId(null)
            } else {
                await api.post('/schedules/', { ...scheduleForm, date: dateTime.toISOString() })
                alert('일정이 등록되었습니다.')
            }
            setScheduleForm({ student_id: '', date: '', time: '', type: '상담', memo: '' })
            setStudentSearch('')
            fetchData()
        } catch (error) {
            console.error('Error saving schedule:', error)
            alert('저장 실패')
        }
    }

    const handleOutingSubmit = async (e) => {
        e.preventDefault()
        try {
            const dateTime = new Date(`${outingForm.date}T${outingForm.start_time}`)
            if (editingId && editType === 'outing') {
                await api.put(`/outings/${editingId}`, { ...outingForm, date: dateTime.toISOString() })
                alert('외출이 수정되었습니다.')
                setEditingId(null)
            } else {
                await api.post('/outings/', { ...outingForm, date: dateTime.toISOString() })
                alert('외출이 등록되었습니다.')
            }
            setOutingForm({ student_id: '', date: '', start_time: '', end_time: '', reason: '' })
            setStudentSearch('')
            fetchData()
        } catch (error) {
            console.error('Error saving outing:', error)
            alert('저장 실패')
        }
    }

    // Edit/Delete Handlers
    const startEdit = (item, type) => {
        setEditingId(item.id)
        setEditType(type)
        const s = students.find(st => st.id === item.student_id)
        setStudentSearch(s ? `${s.name} (${s.seat_number})` : '')

        if (type === 'schedule') {
            setScheduleForm({
                student_id: item.student_id,
                date: item.date.split('T')[0],
                time: item.time,
                type: item.type,
                memo: item.memo || ''
            })
            setActiveTab('schedule')
        } else {
            setOutingForm({
                student_id: item.student_id,
                date: item.date.split('T')[0],
                start_time: item.start_time,
                end_time: item.end_time,
                reason: item.reason
            })
            setActiveTab('outing')
        }
    }

    const deleteItem = async (id, type) => {
        if (!window.confirm('정말 삭제하시겠습니까?')) return
        try {
            await api.delete(`/${type}s/${id}`)
            fetchData()
        } catch (error) {
            console.error(`Error deleting ${type}:`, error)
            alert('삭제 실패')
        }
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditType(null)
        setScheduleForm({ student_id: '', date: '', time: '', type: '상담', memo: '' })
        setOutingForm({ student_id: '', date: '', start_time: '', end_time: '', reason: '' })
        setStudentSearch('')
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">비정기 일정 관리</h1>
                        <p className="text-gray-500 text-sm mt-1">일회성 외출 및 상담/수업 일정 (특정 날짜에만 발생)</p>
                    </div>
                    <div className="flex space-x-4">
                        <a href="/recurring-schedules" className="text-purple-600 hover:underline font-semibold">정기 외출 관리 &rarr;</a>
                        <a href="/" className="text-blue-500 hover:underline">&larr; 대시보드로 돌아가기</a>
                    </div>
                </div>

                <div className="flex space-x-4 mb-6">
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={`px-4 py-2 rounded-md font-semibold ${activeTab === 'schedule' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                        일회성 상담/수업
                    </button>
                    <button
                        onClick={() => setActiveTab('outing')}
                        className={`px-4 py-2 rounded-md font-semibold ${activeTab === 'outing' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                        일회성 외출
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Section */}
                    <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-6 h-fit relative">
                        <h2 className="text-xl font-semibold mb-4">
                            {editingId ? (activeTab === 'schedule' ? '일정 수정' : '외출 수정') : (activeTab === 'schedule' ? '새 일정 등록' : '새 외출 등록')}
                        </h2>

                        {activeTab === 'schedule' ? (
                            <form onSubmit={handleScheduleSubmit} className="space-y-4">
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
                                                    onClick={() => selectStudent(s, 'schedule')}
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
                                    <label className="block text-sm font-medium text-gray-700">날짜</label>
                                    <div className="flex space-x-2 mb-1">
                                        <button type="button" onClick={() => setDate(0, 'schedule')} className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">오늘</button>
                                        <button type="button" onClick={() => setDate(1, 'schedule')} className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">내일</button>
                                    </div>
                                    <input
                                        type="date"
                                        value={scheduleForm.date}
                                        onChange={e => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">시간</label>
                                    <input
                                        type="time"
                                        value={scheduleForm.time}
                                        onChange={e => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">유형</label>
                                    <select
                                        value={scheduleForm.type}
                                        onChange={e => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                    >
                                        <option value="상담">상담</option>
                                        <option value="수업">수업</option>
                                        <option value="기타">기타</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">메모</label>
                                    <textarea
                                        value={scheduleForm.memo}
                                        onChange={e => setScheduleForm({ ...scheduleForm, memo: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                        rows="3"
                                    />
                                </div>
                                <div className="flex space-x-2">
                                    <button type="submit" className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                                        {editingId ? '수정 완료' : '등록하기'}
                                    </button>
                                    {editingId && (
                                        <button type="button" onClick={cancelEdit} className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600">
                                            취소
                                        </button>
                                    )}
                                </div>
                            </form>
                        ) : (
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
                                                    onClick={() => selectStudent(s, 'outing')}
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
                                    <label className="block text-sm font-medium text-gray-700">날짜</label>
                                    <div className="flex space-x-2 mb-1">
                                        <button type="button" onClick={() => setDate(0, 'outing')} className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">오늘</button>
                                        <button type="button" onClick={() => setDate(1, 'outing')} className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">내일</button>
                                    </div>
                                    <input
                                        type="date"
                                        value={outingForm.date}
                                        onChange={e => setOutingForm({ ...outingForm, date: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                        required
                                    />
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
                        )}
                    </div>

                    {/* List Section */}
                    <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold mb-4">
                            {activeTab === 'schedule' ? '예정된 일정' : '외출 현황'}
                        </h2>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">학생</th>
                                        {activeTab === 'schedule' ? (
                                            <>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">유형</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">메모</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사유</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                                            </>
                                        )}
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {activeTab === 'schedule' ? (
                                        schedules.map(s => (
                                            <tr key={s.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(s.date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.time}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{getStudentName(s.student_id)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${s.type === '상담' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                                        {s.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.memo}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                    <button onClick={() => startEdit(s, 'schedule')} className="text-indigo-600 hover:text-indigo-900">수정</button>
                                                    <button onClick={() => deleteItem(s.id, 'schedule')} className="text-red-600 hover:text-red-900">삭제</button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        outings.map(o => (
                                            <tr key={o.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(o.date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{o.start_time} ~ {o.end_time}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{getStudentName(o.student_id)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{o.reason}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                        {o.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                    <button onClick={() => startEdit(o, 'outing')} className="text-indigo-600 hover:text-indigo-900">수정</button>
                                                    <button onClick={() => deleteItem(o.id, 'outing')} className="text-red-600 hover:text-red-900">삭제</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Schedules
