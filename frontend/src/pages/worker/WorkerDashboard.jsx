import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'
import NotificationBell from '../../components/NotificationBell'

const CARDS = [
  {
    title: '오늘의 피킹 목록',
    desc: '작업 배정된 피킹 작업 확인',
    icon: '📋',
    path: '/worker/picking',
    statusKey: 'picking_pending',
    badgeLabel: '피킹 대기',
    badgeCls: 'bg-blue-100 text-blue-700',
  },
  {
    title: '입고 등록',
    desc: '상품 입고 처리 및 검수',
    icon: '📥',
    path: '/worker/inbound',
    statusKey: null,
  },
  {
    title: '출고 완료 처리',
    desc: '포장 및 출고 완료 등록',
    icon: '📤',
    path: '/worker/outbound',
    statusKey: 'outbound_pending',
    badgeLabel: '출고 대기',
    badgeCls: 'bg-orange-100 text-orange-700',
  },
]

export default function WorkerDashboard() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [counts, setCounts] = useState({ received: null, picking: null, packed: null })

  useEffect(() => {
    api.get('/orders/?limit=200').then((res) => {
      const items = res.data.items
      setCounts({
        received: items.filter((o) => o.status === 'RECEIVED').length,
        picking:  items.filter((o) => o.status === 'PICKING').length,
        packed:   items.filter((o) => o.status === 'PACKED').length,
      })
    }).catch(() => {})
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="min-h-screen bg-green-50">
      <nav className="bg-green-700 text-white px-5 py-4 flex justify-between items-center shadow">
        <span className="text-xl font-bold">FullFit 작업자</span>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-green-100">{user?.email}</span>
          <NotificationBell />
          <button onClick={handleLogout}
            className="bg-green-900 hover:bg-green-800 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            로그아웃
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Greeting */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-green-900">안녕하세요,</h2>
          <h2 className="text-3xl font-bold text-green-900">{user?.full_name}님!</h2>
          <p className="text-green-600 mt-2 text-base">오늘도 수고해주세요!</p>
        </div>

        {/* Quick stats — large and touch-friendly */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-blue-600">피킹 대기</p>
            <p className="text-5xl font-bold text-blue-700 mt-1">{counts.received ?? '—'}</p>
          </div>
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-yellow-600">패킹 대기</p>
            <p className="text-5xl font-bold text-yellow-700 mt-1">{counts.picking ?? '—'}</p>
          </div>
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-orange-600">출고 대기</p>
            <p className="text-5xl font-bold text-orange-700 mt-1">{counts.packed ?? '—'}</p>
          </div>
        </div>

        {/* Navigation cards — large and touch-friendly */}
        <div className="flex flex-col gap-4">
          {CARDS.map((card) => {
            const badge =
              card.statusKey === 'picking_pending' ? counts.received :
              card.statusKey === 'outbound_pending' ? counts.packed : null

            return (
              <button key={card.title} onClick={() => navigate(card.path)}
                className="bg-white rounded-2xl shadow-sm border-2 border-green-100 p-6 hover:shadow-md hover:border-green-300 active:bg-green-50 transition-all text-left w-full min-h-[110px] flex items-center gap-5">
                <span className="text-5xl shrink-0">{card.icon}</span>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800">{card.title}</h3>
                  <p className="text-gray-500 text-sm mt-0.5">{card.desc}</p>
                  {badge !== null && badge > 0 && (
                    <span className={`mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${card.badgeCls}`}>
                      {badge}건 대기 중
                    </span>
                  )}
                </div>
                <span className="text-green-500 text-2xl">›</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
