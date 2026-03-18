import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

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

function StatCard({ label, value, color, icon, onClick, linkLabel }) {
  const map = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red:    'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  }
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-5 ${map[color]} ${onClick ? 'cursor-pointer hover:shadow-md hover:brightness-95 transition-all' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium opacity-80">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-4xl font-bold">{value ?? '—'}</p>
      {onClick && (
        <p className="text-xs mt-2 opacity-60">→ 바로가기</p>
      )}
    </div>
  )
}

function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
      <span className="text-xs text-green-600 font-medium">실시간</span>
    </span>
  )
}

function LastUpdated({ time }) {
  const [display, setDisplay] = useState('—')
  useEffect(() => {
    const update = () => {
      if (!time) { setDisplay('—'); return }
      const diff = Math.floor((Date.now() - time) / 1000)
      if (diff < 10) setDisplay('방금 전')
      else if (diff < 60) setDisplay(`${diff}초 전`)
      else if (diff < 3600) setDisplay(`${Math.floor(diff / 60)}분 전`)
      else setDisplay(new Date(time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [time])
  return <span className="text-xs text-gray-400">마지막 업데이트: {display}</span>
}

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [sellerCount, setSellerCount] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [tick, setTick] = useState(0)

  const fetchStats = () => {
    api.get('/stats/admin').then((r) => {
      setStats(r.data)
      setLastUpdated(Date.now())
    }).catch(console.error)
  }

  useEffect(() => {
    fetchStats()
    api.get('/sellers/').then((r) => setSellerCount(r.data.length)).catch(() => {})
  }, [tick])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000)
    return () => clearInterval(id)
  }, [])

  const pieData = (stats?.channel_breakdown || []).map((row) => ({
    name: CHANNEL_LABELS[row.channel] || row.channel,
    value: row.count,
    color: CHANNEL_COLORS[row.channel] || '#9ca3af',
  }))

  const fmtDate = (d) => d?.slice(5) || ''

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-blue-50">
        <div className="px-6 py-6">
          {/* Greeting */}
          <div className="mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-blue-900">안녕하세요, {user?.full_name}님 (관리자)</h2>
              <LiveIndicator />
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-blue-600 text-sm">오늘의 풀필먼트 현황을 확인하세요.</p>
              <LastUpdated time={lastUpdated} />
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard label="오늘 주문"     value={stats?.today_orders}       color="blue"   icon="📋" onClick={() => navigate('/admin/orders?filter=today')} />
            <StatCard label="미처리 주문"   value={stats?.pending_orders}     color="yellow" icon="⏳" onClick={() => navigate('/admin/orders?filter=pending')} />
            <StatCard label="재고 부족"     value={stats?.low_stock_count}    color="red"    icon="⚠️" onClick={() => navigate('/admin/inventory?filter=low_stock')} />
            <StatCard label="유통기한 임박" value={stats?.expiry_alert_count} color="orange" icon="🕐" onClick={() => navigate('/admin/inventory?filter=expiry_alert')} />
            <StatCard label="수요 알림"     value={stats?.demand_alert_count} color="red"    icon="📈" />
            <StatCard label="등록 셀러"     value={sellerCount}               color="blue"   icon="👥" />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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

            <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">채널별 주문 비율</h3>
              {stats && pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="45%" cy="50%" outerRadius={80}
                      dataKey="value" nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
        </div>
      </div>
    </SidebarLayout>
  )
}
