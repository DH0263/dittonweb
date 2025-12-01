import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'

function Students() {
    const [students, setStudents] = useState([])
    const [filteredStudents, setFilteredStudents] = useState([])
    const [formData, setFormData] = useState({
        name: '',
        seat_number: '',
        status: '재원'
    })

    // Search & Filter States
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('전체')
    const [sortBy, setSortBy] = useState('seat_number') // seat_number or name

    // Edit Mode States
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({})

    useEffect(() => {
        fetchStudents()
    }, [])

    useEffect(() => {
        filterAndSortStudents()
    }, [students, searchTerm, statusFilter, sortBy])

    const fetchStudents = async () => {
        try {
            const response = await api.get('/students/')
            setStudents(response.data)
        } catch (error) {
            console.error('Error fetching students:', error)
        }
    }

    const filterAndSortStudents = () => {
        let temp = [...students]

        // Filter by Status
        if (statusFilter !== '전체') {
            temp = temp.filter(s => s.status === statusFilter)
        }

        // Search by Name or Seat
        if (searchTerm) {
            temp = temp.filter(s =>
                s.name.includes(searchTerm) ||
                s.seat_number.includes(searchTerm)
            )
        }

        // Sort
        temp.sort((a, b) => {
            if (sortBy === 'seat_number') {
                return a.seat_number.localeCompare(b.seat_number, undefined, { numeric: true, sensitivity: 'base' })
            } else {
                return a.name.localeCompare(b.name)
            }
        })

        setFilteredStudents(temp)
    }

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    // 좌석 번호 유효성 검사 (대문자 A, B만 허용)
    const validateSeatNumber = (seatNumber) => {
        const pattern = /^[AB]\d+$/
        return pattern.test(seatNumber)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // 좌석 번호 유효성 검사
        if (!validateSeatNumber(formData.seat_number)) {
            alert('좌석 번호는 대문자 A 또는 B로 시작해야 합니다. (예: A1, B23)')
            return
        }

        try {
            await api.post('/students/', formData)
            setFormData({ name: '', seat_number: '', status: '재원' })
            fetchStudents()
            alert('학생이 추가되었습니다.')
        } catch (error) {
            console.error('Error adding student:', error)
            alert('학생 추가 실패')
        }
    }

    // Edit Functions
    const startEdit = (student) => {
        setEditingId(student.id)
        setEditForm({ ...student })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditForm({})
    }

    const handleEditChange = (e) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value })
    }

    const saveEdit = async () => {
        // 좌석 번호 유효성 검사
        if (!validateSeatNumber(editForm.seat_number)) {
            alert('좌석 번호는 대문자 A 또는 B로 시작해야 합니다. (예: A1, B23)')
            return
        }

        try {
            await api.put(`/students/${editingId}`, editForm)
            setEditingId(null)
            fetchStudents()
            alert('학생 정보가 수정되었습니다.')
        } catch (error) {
            console.error('Error updating student:', error)
            alert('수정 실패')
        }
    }

    const deleteStudent = async (id) => {
        if (!window.confirm('정말 삭제하시겠습니까?')) return
        try {
            await api.delete(`/students/${id}`)
            fetchStudents()
        } catch (error) {
            console.error('Error deleting student:', error)
            alert('삭제 실패')
        }
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">학생 관리</h1>
                    <a href="/" className="text-blue-500 hover:underline">&larr; 대시보드로 돌아가기</a>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Add Student Form */}
                    <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-6 h-fit">
                        <h2 className="text-xl font-semibold mb-4">학생 추가</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">이름</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">좌석 번호</label>
                                <input
                                    type="text"
                                    name="seat_number"
                                    value={formData.seat_number}
                                    onChange={handleInputChange}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">상태</label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                >
                                    <option value="재원">재원</option>
                                    <option value="휴원">휴원</option>
                                    <option value="퇴원">퇴원</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                                추가하기
                            </button>
                        </form>
                    </div>

                    {/* Student List with Search & Filter */}
                    <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 space-y-2 sm:space-y-0">
                            <h2 className="text-xl font-semibold">학생 목록 ({filteredStudents.length}명)</h2>

                            <div className="flex space-x-2">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-sm"
                                >
                                    <option value="전체">전체 상태</option>
                                    <option value="재원">재원</option>
                                    <option value="휴원">휴원</option>
                                    <option value="퇴원">퇴원</option>
                                </select>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-sm"
                                >
                                    <option value="seat_number">좌석순</option>
                                    <option value="name">이름순</option>
                                </select>
                            </div>
                        </div>

                        <div className="mb-4">
                            <input
                                type="text"
                                placeholder="이름 또는 좌석번호 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            />
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">좌석</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">학년</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">학교</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">학생전화</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">학부모전화</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">성적</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredStudents.map(student => (
                                        <tr key={student.id} className="hover:bg-gray-50">
                                            {editingId === student.id ? (
                                                <>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <input
                                                            name="seat_number"
                                                            value={editForm.seat_number}
                                                            onChange={handleEditChange}
                                                            className="w-16 p-1 border rounded text-sm"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <input
                                                            name="name"
                                                            value={editForm.name}
                                                            onChange={handleEditChange}
                                                            className="w-20 p-1 border rounded text-sm"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <select
                                                            name="student_type"
                                                            value={editForm.student_type || ''}
                                                            onChange={handleEditChange}
                                                            className="w-20 p-1 border rounded text-sm"
                                                        >
                                                            <option value="">-</option>
                                                            <option value="예비고1">예비고1</option>
                                                            <option value="고1">고1</option>
                                                            <option value="고2">고2</option>
                                                            <option value="고3">고3</option>
                                                            <option value="N수생">N수생</option>
                                                            <option value="자퇴생">자퇴생</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <input
                                                            name="school_name"
                                                            value={editForm.school_name || ''}
                                                            onChange={handleEditChange}
                                                            className="w-24 p-1 border rounded text-sm"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <input
                                                            name="student_phone"
                                                            value={editForm.student_phone || ''}
                                                            onChange={handleEditChange}
                                                            className="w-28 p-1 border rounded text-sm"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <input
                                                            name="parent_phone"
                                                            value={editForm.parent_phone || ''}
                                                            onChange={handleEditChange}
                                                            className="w-28 p-1 border rounded text-sm"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <input
                                                            name="recent_grade"
                                                            value={editForm.recent_grade || ''}
                                                            onChange={handleEditChange}
                                                            className="w-16 p-1 border rounded text-sm"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <select
                                                            name="status"
                                                            value={editForm.status}
                                                            onChange={handleEditChange}
                                                            className="p-1 border rounded text-sm"
                                                        >
                                                            <option value="재원">재원</option>
                                                            <option value="휴원">휴원</option>
                                                            <option value="퇴원">퇴원</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                        <button onClick={saveEdit} className="text-green-600 hover:text-green-900">저장</button>
                                                        <button onClick={cancelEdit} className="text-gray-600 hover:text-gray-900">취소</button>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{student.seat_number}</td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        <Link to={`/students/${student.id}`} className="text-blue-600 hover:underline">
                                                            {student.name}
                                                        </Link>
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{student.student_type || '-'}</td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{student.school_name || '-'}</td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{student.student_phone || '-'}</td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{student.parent_phone || '-'}</td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{student.recent_grade || '-'}</td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                                    ${student.status === '재원' ? 'bg-green-100 text-green-800' :
                                                                student.status === '퇴원' ? 'bg-red-100 text-red-800' :
                                                                    'bg-yellow-100 text-yellow-800'}`}>
                                                            {student.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                        <button onClick={() => startEdit(student)} className="text-indigo-600 hover:text-indigo-900">수정</button>
                                                        <button onClick={() => deleteStudent(student.id)} className="text-red-600 hover:text-red-900">삭제</button>
                                                    </td>
                                                </>
                                            )}
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

export default Students
