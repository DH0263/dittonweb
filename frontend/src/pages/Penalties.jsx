import { useState, useEffect } from 'react'
import api from '../api/axios'

function Penalties() {
    const [penalties, setPenalties] = useState([])
    const [students, setStudents] = useState([])
    const [formData, setFormData] = useState({
        student_id: '',
        reason: '',
        points: 5,
        type: '벌점'
    })

    useEffect(() => {
        fetchPenalties()
        fetchStudents()
    }, [])

    const fetchPenalties = async () => {
        try {
            const response = await api.get('/penalties/')
            setPenalties(response.data)
        } catch (error) {
            console.error('Error fetching penalties:', error)
        }
    }

    const fetchStudents = async () => {
        try {
            const response = await api.get('/students/')
            setStudents(response.data)
        } catch (error) {
            console.error('Error fetching students:', error)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.student_id) {
            alert('학생을 선택해주세요.')
            return
        }
        try {
            await api.post('/penalties/', formData)
            setFormData({ ...formData, reason: '', points: 5 }) // Reset form but keep type/student potentially? No, reset reason.
            fetchPenalties()
            alert('상벌점이 부여되었습니다.')
        } catch (error) {
            console.error('Error giving penalty:', error)
            alert('부여 실패')
        }
    }

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">상벌점 관리</h1>
                    <a href="/" className="text-blue-500 hover:underline">← 대시보드로 돌아가기</a>
                </div>

                {/* Issue Penalty Form */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <h2 className="text-xl font-semibold mb-4">상벌점 부여</h2>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">학생 선택</label>
                            <select
                                name="student_id"
                                value={formData.student_id}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                required
                            >
                                <option value="">학생을 선택하세요</option>
                                {students.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.seat_number || 'No Seat'})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">구분</label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            >
                                <option value="벌점">벌점</option>
                                <option value="상점">상점</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">사유</label>
                            <input
                                type="text"
                                name="reason"
                                value={formData.reason}
                                onChange={handleChange}
                                placeholder="예: 졸음, 소음, 청소 불량"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">점수</label>
                            <input
                                type="number"
                                name="points"
                                value={formData.points}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                required
                            />
                        </div>
                        <div className="md:col-span-2 mt-4">
                            <button
                                type="submit"
                                className={`w-full py-2 px-4 rounded-md text-white transition-colors ${formData.type === '벌점' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                {formData.type} 부여하기
                            </button>
                        </div>
                    </form>
                </div>

                {/* Penalty History */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4">최근 내역</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">학생 ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">구분</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사유</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">점수</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {penalties.map((p) => (
                                    <tr key={p.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(p.date).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.student_id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.type === '벌점' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                                {p.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.reason}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.points}점</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Penalties
