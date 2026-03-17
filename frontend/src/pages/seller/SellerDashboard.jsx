import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'

const NAV_CARDS = [
  { title: '주문 현황', icon: '🛒', path: '/seller/orders',      desc: '내 주문 접수 및 처리 현황' },
  { title: '재고 조회', icon: '📊', path: '/seller/inventory',   desc: '현재 창고 보관 재고 확인' },
  { title: '배송 추적', icon: '🔍', path: '/seller/deliveries',  desc: '출고된 상품 배송 현황' },
  { title: '정산 내역', icon: '📑', path: '/seller/settlements', desc: '월별 수수료 및 정산 내역' },
  { title: '반품 신청', icon: '↩️', path: '/seller/returns',     desc: '반품 요청 및 처리 현황' },
]

function StatCard({ label, value, color, icon }) {
  const map = {
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    red:    'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  }
  return (
    <div className={`rounded-xl border p-5 ${map[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium opacity-80">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-4xl font-bold">{value ?? '—'}</p>
    </div>
  )
}

export default function SellerDashboard() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/stats/seller').then((r) => setStats(r.data)).catch(console.error)
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const fmtDate = (d) => d?.slice(5) || ''

  return (
    <div className="min-h-screen bg-purple-50">
      {/* Navbar */}
      <nav className="bg-purple-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <span className="text-xl font-bold">FullFit 셀러</span>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-purple-100">{user?.email}</span>
          <button onClick={handleLogout}
            className="bg-purple-900 hover:bg-purple-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
            로그아웃
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-7">
          <h2 className="text-2xl font-bold text-purple-900">안녕하세요, {user?.full_name}님 (셀러)</h2>
          <p className="text-purple-600 mt-1 text-sm">내 스토어 운영 현황을 확인하세요.</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          <StatCard label="오늘 주문"      value={stats?.today_orders}       color="purple" icon="📋" />
          <StatCard label="전체 주문"      value={stats?.total_orders}       color="blue"   icon="📦" />
          <StatCard label="재고 부족"      value={stats?.low_stock_count}    color="red"    icon="⚠️" />
          <StatCard label="유통기한 임박"  value={stats?.expiry_alert_count} color="orange" icon="🕐" />
        </div>

        {/* Bar chart */}
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-5 mb-7">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">최근 7일 주문량</h3>
          {stats ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.weekly_orders} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, '주문수']} labelFormatter={(l) => `날짜: ${l}`} />
                <Bar dataKey="count" fill="#9333ea" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-300 text-sm">로딩 중...</div>
          )}
        </div>

        {/* Quick navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {NAV_CARDS.map((card) => (
            <div key={card.title} onClick={() => navigate(card.path)}
              className="bg-white rounded-xl shadow-sm border border-purple-100 p-5 hover:shadow-md hover:border-purple-300 transition-all cursor-pointer">
              <div className="text-3xl mb-3">{card.icon}</div>
              <h3 className="text-base font-semibold text-gray-800">{card.title}</h3>
              <p className="text-gray-500 text-xs mt-1">{card.desc}</p>
              <span className="mt-3 inline-block text-purple-600 text-xs font-medium">바로가기 →</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
