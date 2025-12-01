function Dashboard() {
    const menuItems = [
        { title: '학생 관리', icon: '👥', href: '/students', color: 'from-blue-500 to-blue-600', description: '학생 정보 조회 및 관리' },
        { title: '벌점 관리', icon: '⚠️', href: '/penalties', color: 'from-red-500 to-red-600', description: '벌점 기록 및 조회' },
        { title: '일정 관리', icon: '📅', href: '/schedules', color: 'from-green-500 to-green-600', description: '상담 및 외출 일정' },
        { title: '순찰 관리', icon: '🚶', href: '/patrols', color: 'from-purple-500 to-purple-600', description: '순찰 기록 조회' },
        { title: '실시간 감독', icon: '📊', href: '/supervision', color: 'from-indigo-500 to-indigo-600', description: '실시간 학생 현황 확인' },
        { title: '반복 일정', icon: '🔄', href: '/recurring-schedules', color: 'from-teal-500 to-teal-600', description: '반복 외출/상담 관리' },
        { title: '문의 관리', icon: '📝', href: '/inquiries', color: 'from-orange-500 to-orange-600', description: '신규 문의 관리' },
        { title: '등록 관리', icon: '✍️', href: '/registrations', color: 'from-pink-500 to-pink-600', description: '학생 등록 처리' },
        { title: '휴대폰 제출', icon: '📱', href: '/phone-submissions', color: 'from-rose-500 to-rose-600', description: '휴대폰 제출 관리' },
        { title: '다이아몬드 상담', icon: '💎', href: '/diamond-counseling', color: 'from-cyan-500 to-cyan-600', description: '다이아몬드 상담 세션' },
        { title: '상담 기록', icon: '📋', href: '/counseling/records', color: 'from-violet-500 to-violet-600', description: '상담 기록 조회' },
        { title: '상담일지 작성', icon: '✏️', href: '/counseling/submit', color: 'from-fuchsia-500 to-fuchsia-600', description: '상담일지 작성 및 제출' },
        { title: '학생 요청', icon: '🎫', href: '/admin/student-requests', color: 'from-amber-500 to-amber-600', description: '학생 요청 관리' },
        { title: '외출/상담 승인', icon: '✅', href: '/admin/request-approval', color: 'from-lime-500 to-lime-600', description: '외출/상담 신청 승인' },
        { title: '운영진 스케줄', icon: '👔', href: '/admin/staff-schedule', color: 'from-slate-500 to-slate-600', description: '운영진 일정 관리' },
        { title: '통계 대시보드', icon: '📈', href: '/statistics', color: 'from-sky-500 to-sky-600', description: '출석/순찰 통계 및 리포트' },
        { title: '문자 발송', icon: '💬', href: '/admin/message-test', color: 'from-yellow-500 to-yellow-600', description: '학부모 문자 발송 테스트' },
        { title: '학생 포털', icon: '🎓', href: '/student-portal/login', color: 'from-emerald-500 to-emerald-600', description: '학생 포털 로그인' },
        { title: '수학 AI 튜터', icon: '🧮', href: '/math-tutor', color: 'from-blue-600 to-purple-700', description: '수능 수학 AI 질의응답' },
        // TODO: 권한 시스템 도입 시 운영진만 표시되도록 수정
        { title: 'ClassUp 연동', icon: '🔗', href: '/admin/classup-settings', color: 'from-gray-600 to-gray-700', description: '출입 자동 동기화 설정' },
    ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="mb-8 text-center">
                    <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-3">Ditton Bot</h1>
                    <p className="text-gray-600 text-lg">학원 관리 시스템</p>
                </div>

                {/* 메뉴 카드 그리드 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {menuItems.map((item, index) => (
                        <MenuCard key={index} {...item} />
                    ))}
                </div>

                {/* 푸터 */}
                <div className="mt-12 text-center text-gray-500 text-sm">
                    <p>Ditton Bot - 학원 관리 시스템 v2.0</p>
                    <p className="mt-1">현재 시간: {new Date().toLocaleString('ko-KR')}</p>
                </div>
            </div>
        </div>
    )
}

function MenuCard({ title, icon, href, color, description }) {
    return (
        <a
            href={href}
            className={`
                bg-gradient-to-br ${color}
                rounded-xl shadow-lg p-6
                hover:shadow-2xl hover:scale-105
                transition-all duration-300
                text-white
                flex flex-col items-center justify-center
                min-h-[180px]
                group
            `}
        >
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">
                {icon}
            </div>
            <h2 className="text-xl font-bold mb-2 text-center">{title}</h2>
            <p className="text-sm text-white/80 text-center">{description}</p>
        </a>
    )
}

export default Dashboard
