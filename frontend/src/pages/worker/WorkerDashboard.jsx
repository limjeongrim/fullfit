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

function StatChip({ label, value, cls }) {
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value ?? '—'}</p>
    </div>
  )
}

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
      <nav className="bg-green-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <span className="text-xl font-bold">FullFit 작업자</span>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-green-100">{user?.email}</span>
          <NotificationBell />
          <button onClick={handleLogout}
            className="bg-green-900 hover:bg-green-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
            로그아웃
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-7">
          <h2 className="text-2xl font-bold text-green-900">
            안녕하세요, {user?.full_name}님 (창고 작업자)
          </h2>
          <p className="text-green-600 mt-1 text-sm">오늘도 수고해주세요!</p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatChip label="피킹 대기"  value={counts.received} cls="bg-blue-50 border-blue-200 text-blue-700" />
          <StatChip label="패킹 대기"  value={counts.picking}  cls="bg-yellow-50 border-yellow-200 text-yellow-700" />
          <StatChip label="출고 대기"  value={counts.packed}   cls="bg-orange-50 border-orange-200 text-orange-700" />
        </div>

        {/* Navigation cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {CARDS.map((card) => {
            const badge =
              card.statusKey === 'picking_pending' ? counts.received :
              card.statusKey === 'outbound_pending' ? counts.packed : null

            return (
              <div key={card.title} onClick={() => navigate(card.path)}
                className="bg-white rounded-xl shadow-sm border border-green-100 p-6 hover:shadow-md hover:border-green-300 transition-all cursor-pointer">
                <div className="text-3xl mb-3">{card.icon}</div>
                <h3 className="text-lg font-semibold text-gray-800">{card.title}</h3>
                <p className="text-gray-500 text-sm mt-1">{card.desc}</p>
                {badge !== null && badge > 0 && (
                  <span className={`mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${card.badgeCls}`}>
                    {badge}건
                  </span>
                )}
                <span className="mt-3 ml-2 inline-block text-green-600 text-xs font-medium">바로가기 →</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
