import { useState, useEffect } from 'react'
import api from '../api/axios'

const STATUS_OPTIONS = [
    '미방문(노쇼)', '방문완료/대기중',
    '워크인', '방문예약',
    '미등록확정', '등록/미결제', '등록확정', '비대면 바로등록'
]

const PROGRAM_OPTIONS = ['정규', '올케어']
const SOURCE_OPTIONS = ['전화', '워크인', '네이버 예약', '카카오채널']

function Inquiries() {
    const [inquiries, setInquiries] = useState([])
    const [filteredInquiries, setFilteredInquiries] = useState([])
    const [statusFilter, setStatusFilter] = useState('')
    const [editingId, setEditingId] = useState(null)

    const [form, setForm] = useState({
        name: '',
        visit_date: '',
        status: '방문예약',
        program: '',
        student_phone: '',
        parent_phone: '',
        inquiry_source: '',
        memo: '',
        payment_info: ''
    })

    useEffect(() => {
        fetchInquiries()
    }, [])

    useEffect(() => {
        if (statusFilter) {
            setFilteredInquiries(inquiries.filter(i => i.status === statusFilter))
        } else {
            setFilteredInquiries(inquiries)
        }
    }, [statusFilter, inquiries])

    const fetchInquiries = async () => {
        try {
            const res = await api.get('/inquiries/')
            setInquiries(res.data)
            setFilteredInquiries(res.data)
        } catch (error) {
            console.error('Error fetching inquiries:', error)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const submitData = {
                ...form,
                visit_date: form.visit_date ? new Date(form.visit_date).toISOString() : null
            }

            if (editingId) {
                await api.put(`/inquiries/${editingId}`, submitData)
                alert('문의가 수정되었습니다.')
                setEditingId(null)
            } else {
                await api.post('/inquiries/', submitData)
                alert('문의가 등록되었습니다.')
            }

            setForm({
                name: '',
                visit_date: '',
                status: '방문예약',
                program: '',
                student_phone: '',
                parent_phone: '',
                inquiry_source: '',
                memo: '',
                payment_info: ''
            })
            fetchInquiries()
        } catch (error) {
            console.error('Error saving inquiry:', error)
            alert('저장 실패')
        }
    }

    const startEdit = (inquiry) => {
        setEditingId(inquiry.id)
        setForm({
            name: inquiry.name,
            visit_date: inquiry.visit_date ? inquiry.visit_date.split('T')[0] : '',
            status: inquiry.status,
            program: inquiry.program || '',
            student_phone: inquiry.student_phone || '',
            parent_phone: inquiry.parent_phone || '',
            inquiry_source: inquiry.inquiry_source || '',
            memo: inquiry.memo || '',
            payment_info: inquiry.payment_info || ''
        })
    }

    const deleteInquiry = async (id) => {
        if (!window.confirm('정말 삭제하시겠습니까?')) return
        try {
            await api.delete(`/inquiries/${id}`)
            fetchInquiries()
        } catch (error) {
            console.error('Error deleting inquiry:', error)
            alert('삭제 실패')
        }
    }

    const cancelEdit = () => {
        setEditingId(null)
        setForm({
            name: '',
            visit_date: '',
            status: '방문예약',
            program: '',
            student_phone: '',
            parent_phone: '',
            inquiry_source: '',
            memo: '',
            payment_info: ''
        })
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">신규 등록 문의 관리</h1>
                    <a href="/" className="text-blue-500 hover:underline">&larr; 대시보드로 돌아가기</a>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Section */}
                    <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-6 h-fit">
                        <h2 className="text-xl font-semibold mb-4">
                            {editingId ? '문의 수정' : '새 문의 등록'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">학생 이름 *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">방문 예약 날짜</label>
                                <input
                                    type="date"
                                    value={form.visit_date}
                                    onChange={e => setForm({ ...form, visit_date: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">상태 *</label>
                                <select
                                    value={form.status}
                                    onChange={e => setForm({ ...form, status: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                    required
                                >
                                    {STATUS_OPTIONS.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">프로그램</label>
                                <select
                                    value={form.program}
                                    onChange={e => setForm({ ...form, program: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                >
                                    <option value="">선택</option>
                                    {PROGRAM_OPTIONS.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">학생 전화번호</label>
                                <input
                                    type="tel"
                                    value={form.student_phone}
                                    onChange={e => setForm({ ...form, student_phone: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">학부모 전화번호</label>
                                <input
                                    type="tel"
                                    value={form.parent_phone}
                                    onChange={e => setForm({ ...form, parent_phone: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">문의 경로</label>
                                <select
                                    value={form.inquiry_source}
                                    onChange={e => setForm({ ...form, inquiry_source: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                >
                                    <option value="">선택</option>
                                    {SOURCE_OPTIONS.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">메모</label>
                                <textarea
                                    value={form.memo}
                                    onChange={e => setForm({ ...form, memo: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                    rows="3"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">결제 정보</label>
                                <textarea
                                    value={form.payment_info}
                                    onChange={e => setForm({ ...form, payment_info: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                    rows="2"
                                    placeholder="결제방법/일시/금액"
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
                    </div>

                    {/* List Section */}
                    <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">문의 목록</h2>
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            >
                                <option value="">전체</option>
                                {STATUS_OPTIONS.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">방문예약</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">프로그램</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">문의경로</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredInquiries.map(inquiry => (
                                        <tr key={inquiry.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{inquiry.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {inquiry.visit_date ? new Date(inquiry.visit_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                    {inquiry.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{inquiry.program || '-'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{inquiry.inquiry_source || '-'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                <button onClick={() => startEdit(inquiry)} className="text-indigo-600 hover:text-indigo-900">수정</button>
                                                <button onClick={() => deleteInquiry(inquiry.id)} className="text-red-600 hover:text-red-900">삭제</button>
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

export default Inquiries
