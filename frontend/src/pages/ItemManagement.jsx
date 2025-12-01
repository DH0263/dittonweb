import { useState, useEffect } from 'react'
import api from '../api/axios'

const ItemManagement = () => {
    const [items, setItems] = useState([])
    const [activeRentals, setActiveRentals] = useState([])
    const [categoryFilter, setCategoryFilter] = useState('전체')
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [selectedItem, setSelectedItem] = useState(null)
    const [activeTab, setActiveTab] = useState('items') // 'items' or 'rentals'

    const [formData, setFormData] = useState({
        name: '',
        category: '보조배터리',
        serial_number: '',
        notes: ''
    })

    const CATEGORIES = ['전체', '보조배터리', '스탠드', '우산', '기타']

    useEffect(() => {
        fetchItems()
        fetchActiveRentals()
    }, [])

    const fetchItems = async () => {
        try {
            const response = await api.get('/items/')
            setItems(response.data)
        } catch (error) {
            console.error('Failed to fetch items:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchActiveRentals = async () => {
        try {
            const response = await api.get('/items/rentals/active')
            setActiveRentals(response.data)
        } catch (error) {
            console.error('Failed to fetch rentals:', error)
        }
    }

    const handleAddItem = async (e) => {
        e.preventDefault()
        try {
            await api.post('/items/', formData)
            alert('물품이 등록되었습니다')
            setShowAddModal(false)
            setFormData({ name: '', category: '보조배터리', serial_number: '', notes: '' })
            fetchItems()
        } catch (error) {
            console.error('Failed to add item:', error)
            alert('물품 등록에 실패했습니다')
        }
    }

    const handleEditItem = async (e) => {
        e.preventDefault()
        try {
            await api.put(`/items/${selectedItem.id}`, formData)
            alert('물품 정보가 수정되었습니다')
            setShowEditModal(false)
            setSelectedItem(null)
            fetchItems()
        } catch (error) {
            console.error('Failed to edit item:', error)
            alert('물품 수정에 실패했습니다')
        }
    }

    const handleDeleteItem = async (itemId) => {
        if (!confirm('이 물품을 삭제하시겠습니까?')) return

        try {
            await api.delete(`/items/${itemId}`)
            alert('물품이 삭제되었습니다')
            fetchItems()
        } catch (error) {
            console.error('Failed to delete item:', error)
            alert(error.response?.data?.detail || '물품 삭제에 실패했습니다')
        }
    }

    const openEditModal = (item) => {
        setSelectedItem(item)
        setFormData({
            name: item.name,
            category: item.category,
            serial_number: item.serial_number || '',
            notes: item.notes || ''
        })
        setShowEditModal(true)
    }

    const filteredItems = categoryFilter === '전체'
        ? items
        : items.filter(item => item.category === categoryFilter)

    const formatDateTime = (dateString) => {
        const date = new Date(dateString)
        return date.toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-gray-600">로딩 중...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* 헤더 */}
            <div className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">물품 대여 관리</h1>
                            <p className="text-gray-600 mt-1">전체 {items.length}개 물품 / 대여중 {activeRentals.length}건</p>
                        </div>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                            >
                                물품 등록
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                대시보드로
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6">
                {/* 탭 */}
                <div className="mb-6 border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('items')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'items'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            물품 목록 ({items.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('rentals')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'rentals'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            대여 중 ({activeRentals.length})
                        </button>
                    </nav>
                </div>

                {/* 물품 목록 탭 */}
                {activeTab === 'items' && (
                    <>
                        {/* 카테고리 필터 */}
                        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map(category => (
                                    <button
                                        key={category}
                                        onClick={() => setCategoryFilter(category)}
                                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                            categoryFilter === category
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {category}
                                        {category !== '전체' && (
                                            <span className="ml-1">
                                                ({items.filter(i => i.category === category).length})
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 물품 목록 */}
                        {filteredItems.length === 0 ? (
                            <div className="bg-white rounded-lg shadow-md p-12 text-center">
                                <p className="text-gray-500 text-lg">등록된 물품이 없습니다</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredItems.map(item => (
                                    <div key={item.id} className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1">
                                                <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
                                                <p className="text-sm text-gray-500">{item.category}</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                item.is_available
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                            }`}>
                                                {item.is_available ? '사용가능' : '대여중'}
                                            </span>
                                        </div>

                                        {item.serial_number && (
                                            <p className="text-sm text-gray-600 mb-2">
                                                <span className="font-medium">시리얼:</span> {item.serial_number}
                                            </p>
                                        )}

                                        {item.notes && (
                                            <p className="text-sm text-gray-600 mb-3">
                                                <span className="font-medium">메모:</span> {item.notes}
                                            </p>
                                        )}

                                        <div className="flex space-x-2 mt-3">
                                            <button
                                                onClick={() => openEditModal(item)}
                                                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                                            >
                                                수정
                                            </button>
                                            <button
                                                onClick={() => handleDeleteItem(item.id)}
                                                disabled={!item.is_available}
                                                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* 대여 중 탭 */}
                {activeTab === 'rentals' && (
                    <div className="space-y-4">
                        {activeRentals.length === 0 ? (
                            <div className="bg-white rounded-lg shadow-md p-12 text-center">
                                <p className="text-gray-500 text-lg">현재 대여 중인 물품이 없습니다</p>
                            </div>
                        ) : (
                            activeRentals.map(rental => (
                                <div key={rental.request_id} className="bg-white rounded-lg shadow-md p-6">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-500">물품</p>
                                            <p className="font-medium text-gray-800">{rental.item_name}</p>
                                            <p className="text-sm text-gray-600">{rental.item_category}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">학생</p>
                                            <p className="font-medium text-gray-800">{rental.student_name}</p>
                                            <p className="text-sm text-gray-600">{rental.student_seat}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">대여 시간</p>
                                            <p className="text-sm text-gray-800">{formatDateTime(rental.delivered_at)}</p>
                                            <p className="text-sm text-gray-600">by {rental.delivered_by}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">반납 예정</p>
                                            <p className="text-sm font-medium text-red-600">{rental.return_due_period}교시 끝</p>
                                            {rental.cable_type && (
                                                <p className="text-sm text-gray-600">케이블: {rental.cable_type}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* 물품 등록 모달 */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold mb-4">물품 등록</h3>
                        <form onSubmit={handleAddItem} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">물품명 *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="예: 보조배터리 #1"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 *</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                >
                                    <option value="보조배터리">보조배터리</option>
                                    <option value="스탠드">스탠드</option>
                                    <option value="우산">우산</option>
                                    <option value="기타">기타</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">시리얼 번호 (선택)</label>
                                <input
                                    type="text"
                                    value={formData.serial_number}
                                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                                    placeholder="바코드 또는 시리얼"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">메모 (선택)</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="상태, 특이사항 등"
                                    rows="3"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div className="flex space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddModal(false)
                                        setFormData({ name: '', category: '보조배터리', serial_number: '', notes: '' })
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                >
                                    등록
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 물품 수정 모달 */}
            {showEditModal && selectedItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold mb-4">물품 수정</h3>
                        <form onSubmit={handleEditItem} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">물품명 *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 *</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                >
                                    <option value="보조배터리">보조배터리</option>
                                    <option value="스탠드">스탠드</option>
                                    <option value="우산">우산</option>
                                    <option value="기타">기타</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">시리얼 번호</label>
                                <input
                                    type="text"
                                    value={formData.serial_number}
                                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">메모</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows="3"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div className="flex space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditModal(false)
                                        setSelectedItem(null)
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                >
                                    수정
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ItemManagement
