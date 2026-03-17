import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'
import NotificationBell from '../../components/NotificationBell'

// ── Channel colours for pie chart ─────────────────────────────────────────────
const CHANNEL_COLORS = {
  SMARTSTORE: '#22c55e',
  OLIVEYOUNG: '#f97316',
  ZIGZAG:     '#ec4899',
  CAFE24:     '#3b82f6',
  MANUAL:     '#9ca3af',
}
const CHANNEL_LABELS = {
  SMARTSTORE: '스마트스토어', OLIVEYOUNG: '올리브영',
  ZIGZAG: '지그재그', CAFE24: '카페24', MANUAL: '수동',
}

const NAV_CARDS = [
  { title: '주문 관리',    icon: '📦', path: '/admin/orders',        desc: '전체 주문 현황 및 처리' },
  { title: '재고 관리',    icon: '🏭', path: '/admin/inventory',     desc: '입출고 및 재고 현황' },
  { title: '배송 관리',    icon: '🚚', path: '/admin/deliveries',    desc: '배송 현황 및 운송장 조회' },
  { title: '정산 관리',    icon: '💰', path: '/admin/settlements',   desc: '셀러별 정산 내역 관리' },
  { title: '반품 관리',    icon: '↩️', path: '/admin/returns',       desc: '반품 요청 검수 및 처리' },
  { title: '채널 연동',    icon: '🔗', path: '/admin/channel-sync',  desc: '판매채널 CSV 주문 동기화' },
  { title: '프로모션',     icon: '🎯', path: '/admin/promotions',    desc: '프로모션 캘린더 및 수요 알림' },
  { title: '수요 예측',    icon: '📈', path: '/admin/forecast',      desc: '재고 소진 예측 및 재입고 계획' },
]

function StatCard({ label, value, color, icon }) {
  const map = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
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

export default function AdminDashboard() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/stats/admin').then((r) => setStats(r.data)).catch(console.error)
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  // Pie chart data with labels
  const pieData = (stats?.channel_breakdown || []).map((row) => ({
    name: CHANNEL_LABELS[row.channel] || row.channel,
    value: row.count,
    color: CHANNEL_COLORS[row.channel] || '#9ca3af',
  }))

  // Format date label to MM/DD
  const fmtDate = (d) => d?.slice(5) || ''

  return (
    <div className="min-h-screen bg-blue-50">
      {/* Navbar */}
      <nav className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <span className="text-xl font-bold">FullFit Admin</span>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-blue-100">{user?.email}</span>
          <NotificationBell />
          <button onClick={handleLogout}
            className="bg-blue-900 hover:bg-blue-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
            로그아웃
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-7">
          <h2 className="text-2xl font-bold text-blue-900">안녕하세요, {user?.full_name}님 (관리자)</h2>
          <p className="text-blue-600 mt-1 text-sm">오늘의 풀필먼트 현황을 확인하세요.</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-7">
          <StatCard label="오늘 주문"       value={stats?.today_orders}        color="blue"   icon="📋" />
          <StatCard label="미처리 주문"     value={stats?.pending_orders}      color="yellow" icon="⏳" />
          <StatCard label="재고 부족"       value={stats?.low_stock_count}     color="red"    icon="⚠️" />
          <StatCard label="유통기한 임박"   value={stats?.expiry_alert_count}  color="orange" icon="🕐" />
          <StatCard label="수요 알림"       value={stats?.demand_alert_count}  color="red"    icon="📈" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">
          {/* Bar chart — 최근 7일 주문량 */}
          <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">최근 7일 주문량</h3>
            {stats ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.weekly_orders} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [v, '주문수']} labelFormatter={(l) => `날짜: ${l}`} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-300 text-sm">로딩 중...</div>
            )}
          </div>

          {/* Pie chart — 채널별 주문 비율 */}
          <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">채널별 주문 비율</h3>
            {stats && pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="45%" cy="50%" outerRadius={80}
                    dataKey="value" nameKey="name" label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" iconSize={10} />
                  <Tooltip formatter={(v, n) => [v + '건', n]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-300 text-sm">데이터 없음</div>
            )}
          </div>
        </div>

        {/* Quick navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {NAV_CARDS.map((card) => (
            <div key={card.title} onClick={() => navigate(card.path)}
              className="bg-white rounded-xl shadow-sm border border-blue-100 p-5 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
              <div className="text-3xl mb-3">{card.icon}</div>
              <h3 className="text-base font-semibold text-gray-800">{card.title}</h3>
              <p className="text-gray-500 text-xs mt-1">{card.desc}</p>
              <span className="mt-3 inline-block text-blue-600 text-xs font-medium">바로가기 →</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
