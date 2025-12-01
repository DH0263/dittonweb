import { useState, useEffect } from 'react'
import api from '../api/axios'

const StudentRequestsAdmin = () => {
    // 탭 관리
    const [activeTab, setActiveTab] = useState('requests') // 'requests', 'items', 'stats'

    // 요청 관리 상태
    const [requests, setRequests] = useState([])
    const [filteredRequests, setFilteredRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [typeFilter, setTypeFilter] = useState('전체')
    const [statusFilter, setStatusFilter] = useState('전체')
    const [selectedRequest, setSelectedRequest] = useState(null)
    const [showActionModal, setShowActionModal] = useState(false)
    const [actionType, setActionType] = useState(null)
    const [adminNote, setAdminNote] = useState('')
    const [processedBy, setProcessedBy] = useState('')

    // 물품 배달 관련
    const [showDeliverModal, setShowDeliverModal] = useState(false)
    const [availableItems, setAvailableItems] = useState([])
    const [selectedItem, setSelectedItem] = useState(null)
    const [deliveredBy, setDeliveredBy] = useState('')
    const [deliveryCategory, setDeliveryCategory] = useState('전체')
    const [batteryNumber, setBatteryNumber] = useState('') // 보조배터리 번호 직접 입력

    // 물품 관리 상태
    const [items, setItems] = useState([])
    const [itemsLoading, setItemsLoading] = useState(true)
    const [itemCategoryFilter, setItemCategoryFilter] = useState('전체')
    const [itemAvailabilityFilter, setItemAvailabilityFilter] = useState('전체')
    const [showItemModal, setShowItemModal] = useState(false)
    const [itemModalMode, setItemModalMode] = useState('create') // 'create' or 'edit'
    const [currentItem, setCurrentItem] = useState(null)
    const [itemFormData, setItemFormData] = useState({
        name: '',
        category: '보조배터리',
        serial_number: '',
        notes: ''
    })

    // 대여 중인 물품
    const [activeRentals, setActiveRentals] = useState([])

    // 통계 데이터
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        delivered: 0,
        completed: 0,
        totalItems: 0,
        availableItems: 0,
        rentedItems: 0
    })

    const REQUEST_TYPES = ['전체', '보조배터리', '프린트', '학관호출', '외출신청', '상담신청']
    const STATUS_OPTIONS = ['전체', '대기', '승인', '거부', '배달완료', '완료']
    const STATUS_COLORS = {
        '대기': 'bg-yellow-100 text-yellow-800 border-yellow-300',
        '승인': 'bg-green-100 text-green-800 border-green-300',
        '거부': 'bg-red-100 text-red-800 border-red-300',
        '배달완료': 'bg-blue-100 text-blue-800 border-blue-300',
        '완료': 'bg-gray-100 text-gray-800 border-gray-300'
    }
    const ITEM_CATEGORIES = ['전체', '보조배터리', '스탠드', '우산', '기타']

    useEffect(() => {
        fetchRequests()
        fetchItems()
        fetchActiveRentals()
    }, [])

    useEffect(() => {
        let filtered = requests

        if (typeFilter !== '전체') {
            filtered = filtered.filter(req => req.request_type === typeFilter)
        }

        if (statusFilter !== '전체') {
            filtered = filtered.filter(req => req.status === statusFilter)
        }

        setFilteredRequests(filtered)
    }, [typeFilter, statusFilter, requests])

    useEffect(() => {
        calculateStats()
    }, [requests, items, activeRentals])

    const calculateStats = () => {
        setStats({
            total: requests.length,
            pending: requests.filter(r => r.status === '대기').length,
            approved: requests.filter(r => r.status === '승인').length,
            rejected: requests.filter(r => r.status === '거부').length,
            delivered: requests.filter(r => r.status === '배달완료').length,
            completed: requests.filter(r => r.status === '완료').length,
            totalItems: items.length,
            availableItems: items.filter(i => i.is_available).length,
            rentedItems: items.filter(i => !i.is_available).length
        })
    }

    const fetchRequests = async () => {
        try {
            const response = await api.get('/student-requests/')
            setRequests(response.data)
            setFilteredRequests(response.data)
        } catch (error) {
            console.error('Failed to fetch requests:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchItems = async () => {
        try {
            const response = await api.get('/items/')
            setItems(response.data)
        } catch (error) {
            console.error('Failed to fetch items:', error)
        } finally {
            setItemsLoading(false)
        }
    }

    const fetchActiveRentals = async () => {
        try {
            const response = await api.get('/items/rentals/active')
            setActiveRentals(response.data)
        } catch (error) {
            console.error('Failed to fetch active rentals:', error)
        }
    }

    const fetchAvailableItems = async (category = '전체') => {
        try {
            const params = category !== '전체' ? { category, available_only: true } : { available_only: true }
            const response = await api.get('/items/', { params })
            setAvailableItems(response.data)
        } catch (error) {
            console.error('Failed to fetch items:', error)
        }
    }

    const openDeliverModal = async (request) => {
        setSelectedRequest(request)
        setDeliveredBy('')
        setSelectedItem(null)
        setBatteryNumber('')

        // 보조배터리 요청이면 자동으로 보조배터리 카테고리 선택
        if (request.request_type === '보조배터리') {
            setDeliveryCategory('보조배터리')
            await fetchAvailableItems('보조배터리')
        } else {
            setDeliveryCategory('전체')
            await fetchAvailableItems()
        }

        setShowDeliverModal(true)
    }

    const handleDeliver = async () => {
        if (!deliveredBy) {
            alert('전달한 사람 이름을 입력해주세요')
            return
        }

        // 보조배터리 요청일 경우 번호 입력 필수
        if (selectedRequest.request_type === '보조배터리' && !batteryNumber) {
            alert('보조배터리 번호를 입력해주세요')
            return
        }

        try {
            let finalItemId = selectedItem

            // 보조배터리 번호를 입력한 경우, 해당 번호의 보조배터리 찾기
            if (selectedRequest.request_type === '보조배터리' && batteryNumber) {
                const batteryName = `보조배터리 #${batteryNumber}`
                const foundItem = availableItems.find(item =>
                    item.name === batteryName ||
                    item.name.includes(`#${batteryNumber}`)
                )

                if (foundItem) {
                    finalItemId = foundItem.id
                } else {
                    alert(`보조배터리 #${batteryNumber}을(를) 찾을 수 없습니다. 사용 가능한 보조배터리: ${availableItems.filter(i => i.category === '보조배터리').map(i => i.name).join(', ')}`)
                    return
                }
            }

            const params = new URLSearchParams({ delivered_by: deliveredBy })
            if (finalItemId) {
                params.append('item_id', finalItemId)
            }

            await api.put(`/student-requests/${selectedRequest.id}/deliver?${params.toString()}`)
            alert('전달 완료되었습니다')
            setShowDeliverModal(false)
            fetchRequests()
            fetchItems()
            fetchActiveRentals()
        } catch (error) {
            console.error('Deliver failed:', error)
            alert(`처리에 실패했습니다: ${error.response?.data?.detail || error.message}`)
        }
    }

    const handleReturn = async (request) => {
        if (!confirm('물품을 반납받았습니까?')) return

        try {
            await api.put(`/student-requests/${request.id}/return`)
            alert('반납 완료되었습니다')
            fetchRequests()
            fetchItems()
            fetchActiveRentals()
        } catch (error) {
            console.error('Return failed:', error)
            alert('처리에 실패했습니다')
        }
    }

    const openActionModal = (request, type) => {
        setSelectedRequest(request)
        setActionType(type)
        setShowActionModal(true)
        setAdminNote('')
        setProcessedBy('')
    }

    const handleAction = async () => {
        if (!processedBy) {
            alert('처리자 이름을 입력해주세요')
            return
        }

        try {
            const endpoint = `/student-requests/${selectedRequest.id}/${actionType}`
            await api.put(endpoint, {
                processed_by: processedBy,
                admin_note: adminNote || null
            })

            alert(`요청이 ${actionType === 'approve' ? '승인' : actionType === 'reject' ? '거부' : '완료'}되었습니다`)
            setShowActionModal(false)
            fetchRequests()
        } catch (error) {
            console.error('Action failed:', error)
            alert('처리에 실패했습니다')
        }
    }

    // 물품 관리 함수들
    const openItemModal = (mode, item = null) => {
        setItemModalMode(mode)
        setCurrentItem(item)
        if (mode === 'edit' && item) {
            setItemFormData({
                name: item.name,
                category: item.category,
                serial_number: item.serial_number || '',
                notes: item.notes || ''
            })
        } else {
            setItemFormData({
                name: '',
                category: '보조배터리',
                serial_number: '',
                notes: ''
            })
        }
        setShowItemModal(true)
    }

    const handleItemSubmit = async () => {
        if (!itemFormData.name) {
            alert('물품 이름을 입력해주세요')
            return
        }

        try {
            if (itemModalMode === 'create') {
                await api.post('/items/', itemFormData)
                alert('물품이 등록되었습니다')
            } else {
                await api.put(`/items/${currentItem.id}`, itemFormData)
                alert('물품이 수정되었습니다')
            }
            setShowItemModal(false)
            fetchItems()
            fetchActiveRentals()
        } catch (error) {
            console.error('Item submit failed:', error)
            alert('처리에 실패했습니다')
        }
    }

    const handleItemDelete = async (itemId) => {
        if (!confirm('정말 이 물품을 삭제하시겠습니까?')) return

        try {
            await api.delete(`/items/${itemId}`)
            alert('물품이 삭제되었습니다')
            fetchItems()
            fetchActiveRentals()
        } catch (error) {
            console.error('Delete failed:', error)
            alert(error.response?.data?.detail || '삭제에 실패했습니다')
        }
    }

    const formatDateTime = (dateString) => {
        const date = new Date(dateString)
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    // 교시별 종료 시간 계산
    const getPeriodEndTime = (period) => {
        const periodTimes = {
            1: '10:00',
            2: '12:00',
            3: '15:00',
            4: '16:40',
            5: '18:00',
            6: '20:20',
            7: '22:00'
        }
        return periodTimes[period] || '-'
    }

    // 반납 예정 시간 계산 (배달 시간 + 교시 종료 시간)
    const getReturnDueTime = (deliveredAt, returnDuePeriod) => {
        if (!deliveredAt || !returnDuePeriod) return null

        const deliveryDate = new Date(deliveredAt)
        const periodEndTime = getPeriodEndTime(returnDuePeriod)

        if (periodEndTime === '-') return null

        const [hours, minutes] = periodEndTime.split(':')
        const dueDate = new Date(deliveryDate)
        dueDate.setHours(parseInt(hours), parseInt(minutes), 0)

        return dueDate
    }

    // 현재 시간과 반납 예정 시간 비교해서 알림 표시
    const getReturnAlert = (returnDueTime) => {
        if (!returnDueTime) return null

        const now = new Date()
        const diffMinutes = Math.floor((returnDueTime - now) / (1000 * 60))

        if (diffMinutes < 0) {
            return { type: 'danger', message: `반납 지연! (${Math.abs(diffMinutes)}분 초과)` }
        } else if (diffMinutes <= 10) {
            return { type: 'warning', message: `곧 반납 시간! (${diffMinutes}분 남음)` }
        } else if (diffMinutes <= 30) {
            return { type: 'info', message: `반납 30분 전 (${diffMinutes}분 남음)` }
        }

        return null
    }

    const getFilteredItems = () => {
        let filtered = items

        if (itemCategoryFilter !== '전체') {
            filtered = filtered.filter(item => item.category === itemCategoryFilter)
        }

        if (itemAvailabilityFilter === '사용가능') {
            filtered = filtered.filter(item => item.is_available)
        } else if (itemAvailabilityFilter === '대여중') {
            filtered = filtered.filter(item => !item.is_available)
        }

        return filtered
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
                            <h1 className="text-3xl font-bold text-gray-800">학생 요청 및 물품 관리</h1>
                            <p className="text-gray-600 mt-1">요청 {requests.length}건 | 물품 {items.length}개 (대여중 {stats.rentedItems})</p>
                        </div>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            대시보드로
                        </button>
                    </div>

                    {/* 탭 네비게이션 */}
                    <div className="flex gap-2 mt-6 border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('requests')}
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                                activeTab === 'requests'
                                    ? 'border-emerald-600 text-emerald-600'
                                    : 'border-transparent text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            요청 목록 ({stats.total})
                        </button>
                        <button
                            onClick={() => setActiveTab('items')}
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                                activeTab === 'items'
                                    ? 'border-emerald-600 text-emerald-600'
                                    : 'border-transparent text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            물품 관리 ({stats.totalItems})
                        </button>
                        <button
                            onClick={() => setActiveTab('stats')}
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                                activeTab === 'stats'
                                    ? 'border-emerald-600 text-emerald-600'
                                    : 'border-transparent text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            통계 대시보드
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6">
                {/* 요청 목록 탭 */}
                {activeTab === 'requests' && (
                    <div>
                        {/* 필터 섹션 */}
                        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">요청 타입</label>
                                    <div className="flex flex-wrap gap-2">
                                        {REQUEST_TYPES.map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setTypeFilter(type)}
                                                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                                    typeFilter === type
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {type}
                                                {type !== '전체' && (
                                                    <span className="ml-1">
                                                        ({requests.filter(r => r.request_type === type).length})
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">처리 상태</label>
                                    <div className="flex flex-wrap gap-2">
                                        {STATUS_OPTIONS.map(status => (
                                            <button
                                                key={status}
                                                onClick={() => setStatusFilter(status)}
                                                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                                    statusFilter === status
                                                        ? 'bg-purple-600 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {status}
                                                {status !== '전체' && (
                                                    <span className="ml-1">
                                                        ({requests.filter(r => r.status === status).length})
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 요청 목록 */}
                        {filteredRequests.length === 0 ? (
                            <div className="bg-white rounded-lg shadow-md p-12 text-center">
                                <p className="text-gray-500 text-lg">조건에 맞는 요청이 없습니다</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredRequests.map(request => (
                                    <div
                                        key={request.id}
                                        className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-3 mb-2">
                                                    <span className="text-sm font-medium text-blue-600">
                                                        {request.student_name} ({request.student_seat_number})
                                                    </span>
                                                    <h3 className="text-lg font-semibold text-gray-800">
                                                        {request.request_type}
                                                    </h3>
                                                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[request.status]}`}>
                                                        {request.status}
                                                    </span>
                                                    {request.priority === '긴급' && (
                                                        <span className="px-3 py-1 bg-red-500 text-white rounded-full text-sm font-medium animate-pulse">
                                                            긴급
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xl font-medium text-gray-700">{request.title}</p>
                                            </div>

                                            <div className="flex flex-wrap gap-2 ml-4">
                                                {request.status === '대기' && (
                                                    <>
                                                        <button
                                                            onClick={() => openDeliverModal(request)}
                                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                                                        >
                                                            전달완료
                                                        </button>
                                                        <button
                                                            onClick={() => openActionModal(request, 'reject')}
                                                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                                                        >
                                                            거부
                                                        </button>
                                                    </>
                                                )}
                                                {request.status === '배달완료' && request.request_type === '보조배터리' && !request.returned && (
                                                    <button
                                                        onClick={() => handleReturn(request)}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                                                    >
                                                        반납 확인
                                                    </button>
                                                )}
                                                {request.status === '승인' && (
                                                    <button
                                                        onClick={() => openActionModal(request, 'complete')}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                                                    >
                                                        완료 처리
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {request.content && (
                                            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                                                <p className="text-gray-700">{request.content}</p>
                                            </div>
                                        )}

                                        {request.request_type === '보조배터리' && (
                                            <div className="mb-3 p-3 bg-purple-50 rounded-lg space-y-1 text-sm">
                                                {request.item_name && (
                                                    <p className="text-purple-800 font-semibold text-base">
                                                        📦 배달 물품: {request.item_name}
                                                    </p>
                                                )}
                                                <p className="text-gray-700">
                                                    <span className="font-medium">케이블:</span> {request.cable_type || '-'}
                                                </p>
                                                <p className="text-gray-700">
                                                    <span className="font-medium">반납 예정:</span> {request.return_due_period}교시 끝 ({getPeriodEndTime(request.return_due_period)})
                                                </p>
                                                {request.delivered && (
                                                    <>
                                                        <p className="text-green-700">
                                                            <span className="font-medium">배달:</span> {formatDateTime(request.delivered_at)} ({request.delivered_by})
                                                        </p>

                                                        {/* 반납 알림 */}
                                                        {!request.returned && (() => {
                                                            const returnDueTime = getReturnDueTime(request.delivered_at, request.return_due_period)
                                                            const alert = getReturnAlert(returnDueTime)

                                                            if (alert) {
                                                                return (
                                                                    <div className={`p-2 rounded-lg font-medium mt-2 ${
                                                                        alert.type === 'danger' ? 'bg-red-100 text-red-800 animate-pulse' :
                                                                        alert.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                                                        'bg-blue-100 text-blue-800'
                                                                    }`}>
                                                                        ⏰ {alert.message}
                                                                        {returnDueTime && (
                                                                            <span className="block text-xs mt-1">
                                                                                예정 시간: {formatDateTime(returnDueTime.toISOString())}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )
                                                            }
                                                            return null
                                                        })()}
                                                    </>
                                                )}
                                                {request.returned && (
                                                    <p className="text-blue-700">
                                                        <span className="font-medium">반납:</span> {formatDateTime(request.returned_at)}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {request.request_type === '프린트' && request.print_file_link && (
                                            <div className="mb-3 p-3 bg-blue-50 rounded-lg space-y-1 text-sm">
                                                <p className="text-gray-700">
                                                    <span className="font-medium">파일:</span>{' '}
                                                    <a href={request.print_file_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                        {request.print_file_link}
                                                    </a>
                                                </p>
                                                <p className="text-gray-700">
                                                    <span className="font-medium">종이:</span> {request.paper_size || '-'} ({request.print_sides || '-'})
                                                </p>
                                                {request.delivered && (
                                                    <p className="text-green-700">
                                                        <span className="font-medium">배달:</span> {formatDateTime(request.delivered_at)} ({request.delivered_by})
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {request.preferred_datetime && (
                                            <div className="mb-3 p-3 bg-purple-50 rounded-lg text-sm">
                                                <p className="text-gray-700">
                                                    <span className="font-medium">희망 시간:</span> {formatDateTime(request.preferred_datetime)}
                                                </p>
                                            </div>
                                        )}

                                        {request.admin_note && (
                                            <div className="mb-3 p-3 bg-green-50 rounded-lg">
                                                <p className="text-sm font-medium text-gray-700 mb-1">관리자 메모:</p>
                                                <p className="text-gray-700">{request.admin_note}</p>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 pt-3 border-t border-gray-200">
                                            <span>요청: {formatDateTime(request.created_at)}</span>
                                            {request.processed_at && (
                                                <span>처리: {formatDateTime(request.processed_at)}</span>
                                            )}
                                            {request.processed_by && (
                                                <span>처리자: {request.processed_by}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 물품 관리 탭 */}
                {activeTab === 'items' && (
                    <div>
                        {/* 물품 헤더 */}
                        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-gray-800">물품 재고 관리</h2>
                                <button
                                    onClick={() => openItemModal('create')}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                                >
                                    + 새 물품 등록
                                </button>
                            </div>

                            {/* 필터 */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
                                    <div className="flex gap-2">
                                        {ITEM_CATEGORIES.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setItemCategoryFilter(cat)}
                                                className={`px-3 py-1 text-sm rounded-lg font-medium ${
                                                    itemCategoryFilter === cat
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
                                    <div className="flex gap-2">
                                        {['전체', '사용가능', '대여중'].map(status => (
                                            <button
                                                key={status}
                                                onClick={() => setItemAvailabilityFilter(status)}
                                                className={`px-3 py-1 text-sm rounded-lg font-medium ${
                                                    itemAvailabilityFilter === status
                                                        ? 'bg-purple-600 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 물품 그리드 */}
                        {itemsLoading ? (
                            <div className="text-center py-12 text-gray-600">로딩 중...</div>
                        ) : getFilteredItems().length === 0 ? (
                            <div className="bg-white rounded-lg shadow-md p-12 text-center">
                                <p className="text-gray-500 text-lg">조건에 맞는 물품이 없습니다</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {getFilteredItems().map(item => (
                                    <div
                                        key={item.id}
                                        className={`bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow border-l-4 ${
                                            item.is_available ? 'border-green-500' : 'border-red-500'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-gray-800 mb-1">{item.name}</h3>
                                                <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                                    {item.category}
                                                </span>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                item.is_available
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                            }`}>
                                                {item.is_available ? '사용 가능' : '대여중'}
                                            </span>
                                        </div>

                                        {item.serial_number && (
                                            <p className="text-sm text-gray-600 mb-2">
                                                <span className="font-medium">S/N:</span> {item.serial_number}
                                            </p>
                                        )}

                                        {item.notes && (
                                            <p className="text-sm text-gray-600 mb-3 p-2 bg-gray-50 rounded">
                                                {item.notes}
                                            </p>
                                        )}

                                        <div className="flex gap-2 pt-3 border-t border-gray-200">
                                            <button
                                                onClick={() => openItemModal('edit', item)}
                                                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                                            >
                                                수정
                                            </button>
                                            <button
                                                onClick={() => handleItemDelete(item.id)}
                                                className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
                                                disabled={!item.is_available}
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 대여 중인 물품 섹션 */}
                        {activeRentals.length > 0 && (
                            <div className="mt-8">
                                <h2 className="text-xl font-bold text-gray-800 mb-4">현재 대여 중인 물품</h2>
                                <div className="space-y-3">
                                    {activeRentals.map(rental => (
                                        <div key={rental.request_id} className="bg-white rounded-lg shadow-md p-4 flex justify-between items-center">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="font-bold text-purple-600">{rental.item_name}</span>
                                                    <span className="text-gray-600">→</span>
                                                    <span className="font-medium text-gray-800">
                                                        {rental.student_name} ({rental.student_seat_number})
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    <span>배달: {formatDateTime(rental.delivered_at)}</span>
                                                    <span className="mx-2">|</span>
                                                    <span>배달자: {rental.delivered_by}</span>
                                                    {rental.return_due_period && (
                                                        <>
                                                            <span className="mx-2">|</span>
                                                            <span>반납 예정: {rental.return_due_period}교시 끝</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const req = requests.find(r => r.id === rental.request_id)
                                                    if (req) handleReturn(req)
                                                }}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium ml-4"
                                            >
                                                반납 확인
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 통계 대시보드 탭 */}
                {activeTab === 'stats' && (
                    <div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                            {/* 요청 통계 */}
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">요청 현황</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">전체 요청</span>
                                        <span className="text-2xl font-bold text-gray-800">{stats.total}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-yellow-600">대기중</span>
                                        <span className="text-xl font-bold text-yellow-600">{stats.pending}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-blue-600">배달완료</span>
                                        <span className="text-xl font-bold text-blue-600">{stats.delivered}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-green-600">승인</span>
                                        <span className="text-xl font-bold text-green-600">{stats.approved}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-red-600">거부</span>
                                        <span className="text-xl font-bold text-red-600">{stats.rejected}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">완료</span>
                                        <span className="text-xl font-bold text-gray-600">{stats.completed}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 물품 통계 */}
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">물품 현황</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">전체 물품</span>
                                        <span className="text-2xl font-bold text-gray-800">{stats.totalItems}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-green-600">사용 가능</span>
                                        <span className="text-xl font-bold text-green-600">{stats.availableItems}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-red-600">대여중</span>
                                        <span className="text-xl font-bold text-red-600">{stats.rentedItems}</span>
                                    </div>
                                    <div className="pt-3 border-t border-gray-200">
                                        <div className="text-sm text-gray-600 mb-2">대여율</div>
                                        <div className="w-full bg-gray-200 rounded-full h-3">
                                            <div
                                                className="bg-purple-600 h-3 rounded-full"
                                                style={{ width: `${stats.totalItems > 0 ? (stats.rentedItems / stats.totalItems * 100) : 0}%` }}
                                            ></div>
                                        </div>
                                        <div className="text-right text-sm font-medium text-gray-700 mt-1">
                                            {stats.totalItems > 0 ? Math.round(stats.rentedItems / stats.totalItems * 100) : 0}%
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 카테고리별 요청 */}
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">요청 타입별 분포</h3>
                                <div className="space-y-3">
                                    {REQUEST_TYPES.filter(t => t !== '전체').map(type => {
                                        const count = requests.filter(r => r.request_type === type).length
                                        const percentage = stats.total > 0 ? (count / stats.total * 100) : 0
                                        return (
                                            <div key={type}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-gray-600">{type}</span>
                                                    <span className="font-medium text-gray-800">{count}건 ({Math.round(percentage)}%)</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-emerald-600 h-2 rounded-full"
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 카테고리별 물품 재고 */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">카테고리별 물품 재고</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {ITEM_CATEGORIES.filter(c => c !== '전체').map(category => {
                                    const categoryItems = items.filter(i => i.category === category)
                                    const available = categoryItems.filter(i => i.is_available).length
                                    const rented = categoryItems.filter(i => !i.is_available).length
                                    return (
                                        <div key={category} className="p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-bold text-gray-800 mb-2">{category}</h4>
                                            <div className="space-y-1 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">전체:</span>
                                                    <span className="font-medium">{categoryItems.length}개</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-green-600">사용가능:</span>
                                                    <span className="font-medium text-green-600">{available}개</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-red-600">대여중:</span>
                                                    <span className="font-medium text-red-600">{rented}개</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 배달 모달 */}
            {showDeliverModal && selectedRequest && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4">물품 전달</h3>

                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">{selectedRequest.student_name} ({selectedRequest.student_seat_number})</p>
                            <p className="font-medium">{selectedRequest.request_type}: {selectedRequest.title}</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    전달한 사람 *
                                </label>
                                <input
                                    type="text"
                                    value={deliveredBy}
                                    onChange={(e) => setDeliveredBy(e.target.value)}
                                    placeholder="이름을 입력하세요"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    required
                                />
                            </div>

                            {/* 보조배터리인 경우 번호 직접 입력 */}
                            {selectedRequest.request_type === '보조배터리' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        보조배터리 번호 입력 *
                                    </label>
                                    <div className="flex gap-2">
                                        <span className="flex items-center px-3 bg-gray-100 border border-gray-300 rounded-l-lg text-gray-700">
                                            보조배터리 #
                                        </span>
                                        <input
                                            type="text"
                                            value={batteryNumber}
                                            onChange={(e) => setBatteryNumber(e.target.value)}
                                            placeholder="예: 1, 2, 3..."
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        사용 가능한 보조배터리: {availableItems.filter(i => i.category === '보조배터리').map(i => i.name).join(', ') || '없음'}
                                    </p>
                                </div>
                            )}

                            {/* 기타 물품인 경우 선택 */}
                            {selectedRequest.request_type !== '보조배터리' && (selectedRequest.request_type === '기타' || availableItems.length > 0) && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        배달할 물품 선택 (선택사항)
                                    </label>

                                    <div className="flex gap-2 mb-3">
                                        {['전체', '보조배터리', '스탠드', '우산', '기타'].map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => {
                                                    setDeliveryCategory(cat)
                                                    fetchAvailableItems(cat)
                                                }}
                                                className={`px-3 py-1 text-sm rounded-lg font-medium ${
                                                    deliveryCategory === cat
                                                        ? 'bg-purple-600 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                                        <button
                                            onClick={() => setSelectedItem(null)}
                                            className={`p-3 border rounded-lg text-left ${
                                                selectedItem === null
                                                    ? 'border-purple-600 bg-purple-50'
                                                    : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            <p className="font-medium text-sm">물품 없이 배달</p>
                                            <p className="text-xs text-gray-500">물품 추적 안함</p>
                                        </button>

                                        {availableItems.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => setSelectedItem(item.id)}
                                                className={`p-3 border rounded-lg text-left ${
                                                    selectedItem === item.id
                                                        ? 'border-purple-600 bg-purple-50'
                                                        : 'border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                <p className="font-medium text-sm">{item.name}</p>
                                                <p className="text-xs text-gray-500">{item.category}</p>
                                                {item.serial_number && (
                                                    <p className="text-xs text-gray-400">{item.serial_number}</p>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {availableItems.length === 0 && (
                                        <p className="text-sm text-gray-500 text-center py-4">
                                            사용 가능한 물품이 없습니다
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex space-x-3 mt-6">
                            <button
                                onClick={() => setShowDeliverModal(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleDeliver}
                                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                            >
                                전달완료
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 액션 모달 */}
            {showActionModal && selectedRequest && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold mb-4">
                            요청 {actionType === 'approve' ? '승인' : actionType === 'reject' ? '거부' : '완료 처리'}
                        </h3>

                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">{selectedRequest.student_name} ({selectedRequest.student_seat_number})</p>
                            <p className="font-medium">{selectedRequest.request_type}: {selectedRequest.title}</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    처리자 이름 *
                                </label>
                                <input
                                    type="text"
                                    value={processedBy}
                                    onChange={(e) => setProcessedBy(e.target.value)}
                                    placeholder="이름을 입력하세요"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    관리자 메모 (선택)
                                </label>
                                <textarea
                                    value={adminNote}
                                    onChange={(e) => setAdminNote(e.target.value)}
                                    placeholder="학생에게 전달할 메시지를 입력하세요"
                                    rows="3"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <div className="flex space-x-3 mt-6">
                            <button
                                onClick={() => setShowActionModal(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleAction}
                                className={`flex-1 px-4 py-2 text-white rounded-lg font-medium ${
                                    actionType === 'approve'
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : actionType === 'reject'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 물품 등록/수정 모달 */}
            {showItemModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold mb-4">
                            {itemModalMode === 'create' ? '새 물품 등록' : '물품 수정'}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    물품 이름 *
                                </label>
                                <input
                                    type="text"
                                    value={itemFormData.name}
                                    onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                                    placeholder="예: 보조배터리 #1"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    카테고리 *
                                </label>
                                <select
                                    value={itemFormData.category}
                                    onChange={(e) => setItemFormData({ ...itemFormData, category: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                >
                                    <option value="보조배터리">보조배터리</option>
                                    <option value="스탠드">스탠드</option>
                                    <option value="우산">우산</option>
                                    <option value="기타">기타</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    시리얼 번호 (선택)
                                </label>
                                <input
                                    type="text"
                                    value={itemFormData.serial_number}
                                    onChange={(e) => setItemFormData({ ...itemFormData, serial_number: e.target.value })}
                                    placeholder="바코드 또는 시리얼 번호"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    메모 (선택)
                                </label>
                                <textarea
                                    value={itemFormData.notes}
                                    onChange={(e) => setItemFormData({ ...itemFormData, notes: e.target.value })}
                                    placeholder="상태나 특이사항을 기록하세요"
                                    rows="3"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <div className="flex space-x-3 mt-6">
                            <button
                                onClick={() => setShowItemModal(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleItemSubmit}
                                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                            >
                                {itemModalMode === 'create' ? '등록' : '수정'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default StudentRequestsAdmin
