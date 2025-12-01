import { useState, useEffect } from 'react'
import axios from '../api/axios'
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6']

function Statistics() {
    const [loading, setLoading] = useState(true)
    const [todaySummary, setTodaySummary] = useState(null)
    const [attendanceTrend, setAttendanceTrend] = useState([])
    const [patrolHistory, setPatrolHistory] = useState([])
    const [weeklyReport, setWeeklyReport] = useState(null)
    const [monthlyReport, setMonthlyReport] = useState(null)
    const [selectedTab, setSelectedTab] = useState('today') // today, weekly, monthly

    useEffect(() => {
        fetchDashboardData()
        // 자동 새로고침 (30초마다)
        const interval = setInterval(fetchDashboardData, 30000)
        return () => clearInterval(interval)
    }, [])

    const fetchDashboardData = async () => {
        try {
            setLoading(true)
            const [summaryRes, trendRes, patrolRes, weeklyRes, monthlyRes] = await Promise.all([
                axios.get('/statistics/today-summary'),
                axios.get('/statistics/attendance-trend?days=7'),
                axios.get('/statistics/patrol-history?limit=10'),
                axios.get('/statistics/weekly-report'),
                axios.get('/statistics/monthly-report')
            ])

            setTodaySummary(summaryRes.data)
            setAttendanceTrend(trendRes.data.trend)
            setPatrolHistory(patrolRes.data.patrols)
            setWeeklyReport(weeklyRes.data)
            setMonthlyReport(monthlyRes.data)
        } catch (error) {
            console.error('대시보드 데이터 로딩 실패:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-xl text-gray-600">데이터 로딩 중...</div>
            </div>
        )
    }

    // 태도 체크 데이터를 파이 차트용으로 변환
    const attitudePieData = todaySummary?.attitude ?
        Object.entries(todaySummary.attitude).map(([name, value]) => ({ name, value })) : []

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="mb-6 sm:mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">통계 대시보드</h1>
                        <p className="text-gray-600 text-sm sm:text-base">
                            마지막 업데이트: {new Date().toLocaleTimeString('ko-KR')}
                        </p>
                    </div>
                    <a
                        href="/"
                        className="px-4 py-2 bg-white text-gray-700 rounded-lg shadow hover:shadow-md transition-shadow font-semibold"
                    >
                        ← 메인으로
                    </a>
                </div>

                {/* 탭 메뉴 */}
                <div className="mb-6 border-b border-gray-300">
                    <div className="flex flex-wrap gap-2 sm:gap-4">
                        <button
                            onClick={() => setSelectedTab('today')}
                            className={`px-4 py-2 font-semibold transition-colors ${
                                selectedTab === 'today'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-gray-600 hover:text-blue-600'
                            }`}
                        >
                            오늘
                        </button>
                        <button
                            onClick={() => setSelectedTab('weekly')}
                            className={`px-4 py-2 font-semibold transition-colors ${
                                selectedTab === 'weekly'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-gray-600 hover:text-blue-600'
                            }`}
                        >
                            주간 리포트
                        </button>
                        <button
                            onClick={() => setSelectedTab('monthly')}
                            className={`px-4 py-2 font-semibold transition-colors ${
                                selectedTab === 'monthly'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-gray-600 hover:text-blue-600'
                            }`}
                        >
                            월간 리포트
                        </button>
                    </div>
                </div>

                {/* 오늘 탭 */}
                {selectedTab === 'today' && (
                    <div className="space-y-6">
                        {/* 주요 통계 카드 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="전체 학생"
                                value={todaySummary.total_students}
                                subtitle="재원 중"
                                color="blue"
                            />
                            <StatCard
                                title="출석률"
                                value={`${todaySummary.attendance.attendance_rate}%`}
                                subtitle={`${todaySummary.attendance.present}명 출석`}
                                color="green"
                            />
                            <StatCard
                                title="지각률"
                                value={`${todaySummary.attendance.late_rate}%`}
                                subtitle={`${todaySummary.attendance.late}명 지각`}
                                color="orange"
                            />
                            <StatCard
                                title="순찰 횟수"
                                value={todaySummary.patrol.count}
                                subtitle={todaySummary.patrol.active ? '진행 중 ●' : '완료'}
                                color={todaySummary.patrol.active ? 'green' : 'gray'}
                            />
                        </div>

                        {/* 차트 섹션 */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* 출석률 추이 */}
                            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                                <h2 className="text-lg sm:text-xl font-semibold mb-4">출석률 추이 (7일)</h2>
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={attendanceTrend}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{fontSize: 12}}
                                            tickFormatter={(date) => new Date(date).getDate() + '일'}
                                        />
                                        <YAxis tick={{fontSize: 12}} />
                                        <Tooltip
                                            labelFormatter={(date) => new Date(date).toLocaleDateString('ko-KR')}
                                            formatter={(value) => `${value}%`}
                                        />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="attendance_rate"
                                            stroke="#10B981"
                                            name="출석률"
                                            strokeWidth={2}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="late_rate"
                                            stroke="#F59E0B"
                                            name="지각률"
                                            strokeWidth={2}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* 태도 체크 통계 */}
                            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                                <h2 className="text-lg sm:text-xl font-semibold mb-4">오늘의 태도 체크</h2>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={attitudePieData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) =>
                                                percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : null
                                            }
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {attitudePieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 순찰 히스토리 */}
                        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                            <h2 className="text-lg sm:text-xl font-semibold mb-4">최근 순찰 기록</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시작</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">종료</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">소요시간</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">순찰자</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">체크수</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {patrolHistory.map((patrol) => (
                                            <tr key={patrol.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {new Date(patrol.date).toLocaleDateString('ko-KR')}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">{patrol.start_time}</td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {patrol.end_time || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {patrol.duration_minutes ? `${patrol.duration_minutes}분` : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {patrol.inspector_name || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {patrol.total_checks}명
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {patrol.is_active ? (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                            진행중
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                                            완료
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 빠른 링크 */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            <QuickLink href="/students" title="학생 관리" icon="👥" />
                            <QuickLink href="/patrols" title="순찰 관리" icon="🚶" />
                            <QuickLink href="/penalties" title="벌점 관리" icon="⚠️" />
                            <QuickLink href="/supervision" title="실시간 감독" icon="📊" />
                        </div>
                    </div>
                )}

                {/* 주간 리포트 탭 */}
                {selectedTab === 'weekly' && weeklyReport && (
                    <div className="space-y-6">
                        {/* 주간 요약 카드 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="평균 출석률"
                                value={`${weeklyReport.attendance.avg_rate}%`}
                                subtitle="최근 7일"
                                color="green"
                            />
                            <StatCard
                                title="평균 지각률"
                                value={`${weeklyReport.attendance.avg_late_rate}%`}
                                subtitle="최근 7일"
                                color="orange"
                            />
                            <StatCard
                                title="순찰 횟수"
                                value={weeklyReport.patrol.total_count}
                                subtitle={`하루 평균 ${weeklyReport.patrol.avg_per_day}회`}
                                color="blue"
                            />
                            <StatCard
                                title="기간"
                                value="7일"
                                subtitle={`${new Date(weeklyReport.period.start).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'})} ~ ${new Date(weeklyReport.period.end).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'})}`}
                                color="gray"
                            />
                        </div>

                        {/* 주간 태도 체크 통계 */}
                        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                            <h2 className="text-lg sm:text-xl font-semibold mb-4">주간 태도 체크 통계</h2>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={Object.entries(weeklyReport.attitude).map(([name, value]) => ({ name, value }))}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="value" fill="#3B82F6" name="횟수" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* 월간 리포트 탭 */}
                {selectedTab === 'monthly' && monthlyReport && (
                    <div className="space-y-6">
                        {/* 월간 요약 카드 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="평균 출석률"
                                value={`${monthlyReport.attendance.avg_rate}%`}
                                subtitle="최근 30일"
                                color="green"
                            />
                            <StatCard
                                title="평균 지각률"
                                value={`${monthlyReport.attendance.avg_late_rate}%`}
                                subtitle="최근 30일"
                                color="orange"
                            />
                            <StatCard
                                title="순찰 횟수"
                                value={monthlyReport.patrol.total_count}
                                subtitle={`하루 평균 ${monthlyReport.patrol.avg_per_day}회`}
                                color="blue"
                            />
                            <StatCard
                                title="기간"
                                value="30일"
                                subtitle={`${new Date(monthlyReport.period.start).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'})} ~ ${new Date(monthlyReport.period.end).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'})}`}
                                color="gray"
                            />
                        </div>

                        {/* 주별 추이 */}
                        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                            <h2 className="text-lg sm:text-xl font-semibold mb-4">주별 출석률 추이</h2>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={monthlyReport.weekly_trend}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="week"
                                        tickFormatter={(week) => `${week}주차`}
                                    />
                                    <YAxis />
                                    <Tooltip
                                        labelFormatter={(week) => `${week}주차`}
                                        formatter={(value, name) =>
                                            name === 'attendance_rate' ? `${value}%` : value
                                        }
                                    />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="attendance_rate"
                                        stroke="#10B981"
                                        name="출석률"
                                        strokeWidth={2}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* 월간 태도 체크 통계 */}
                        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                            <h2 className="text-lg sm:text-xl font-semibold mb-4">월간 태도 체크 통계</h2>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={Object.entries(monthlyReport.attitude).map(([name, value]) => ({ name, value }))}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="value" fill="#8B5CF6" name="횟수" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// 통계 카드 컴포넌트
function StatCard({ title, value, subtitle, color }) {
    const colorClasses = {
        blue: 'from-blue-500 to-blue-600',
        green: 'from-green-500 to-green-600',
        orange: 'from-orange-500 to-orange-600',
        red: 'from-red-500 to-red-600',
        gray: 'from-gray-500 to-gray-600'
    }

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-lg shadow-md p-4 sm:p-6 text-white`}>
            <h3 className="text-sm sm:text-base font-medium opacity-90 mb-2">{title}</h3>
            <p className="text-2xl sm:text-3xl font-bold mb-1">{value}</p>
            <p className="text-xs sm:text-sm opacity-80">{subtitle}</p>
        </div>
    )
}

// 빠른 링크 컴포넌트
function QuickLink({ href, title, icon }) {
    return (
        <a
            href={href}
            className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow flex flex-col items-center justify-center text-center"
        >
            <div className="text-3xl sm:text-4xl mb-2">{icon}</div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-800">{title}</h3>
        </a>
    )
}

export default Statistics
