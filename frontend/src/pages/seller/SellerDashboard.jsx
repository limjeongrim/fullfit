import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

function StatCard({ label, value, icon, color }) {
  const iconCls = {
    blue:   'text-[#2563EB]',
    yellow: 'text-[#D97706]',
    red:    'text-[#DC2626]',
    orange: 'text-[#D97706]',
    green:  'text-[#16A34A]',
  }
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px]" style={{ color: '#64748B' }}>{label}</p>
        {icon && <span className={`text-[20px] leading-none ${iconCls[color] || 'text-[#94A3B8]'}`}>{icon}</span>}
      </div>
      <p className="text-[28px] font-bold leading-tight" style={{ color: '#0F172A' }}>{value ?? '—'}</p>
    </div>
  )
}

function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-60"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#16A34A]"></span>
      </span>
      <span className="text-xs" style={{ color: '#64748B' }}>실시간</span>
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
  return <span className="text-xs" style={{ color: '#94A3B8' }}>마지막 업데이트: {display}</span>
}

export default function SellerDashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [tick, setTick] = useState(0)

  const fetchStats = () => {
    api.get('/stats/seller').then((r) => {
      setStats(r.data)
      setLastUpdated(Date.now())
    }).catch(console.error)
  }

  useEffect(() => { fetchStats() }, [tick])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000)
    return () => clearInterval(id)
  }, [])

  const fmtDate = (d) => d?.slice(5) || ''

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="px-6 py-6">
          {/* Greeting */}
          <div className="mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold" style={{ color: '#0F172A' }}>
                안녕하세요, {user?.full_name}님
              </h2>
              <LiveIndicator />
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm" style={{ color: '#64748B' }}>내 스토어 운영 현황을 확인하세요.</p>
              <LastUpdated time={lastUpdated} />
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="오늘 주문"     value={stats?.today_orders}       color="blue"   icon="📋" />
            <StatCard label="전체 주문"     value={stats?.total_orders}       color="blue"   icon="📦" />
            <StatCard label="재고 부족"     value={stats?.low_stock_count}    color="red"    icon="⚠️" />
            <StatCard label="유통기한 임박" value={stats?.expiry_alert_count} color="orange" icon="🕐" />
          </div>

          {/* Bar chart */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>최근 7일 주문량</h3>
            {stats ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.weekly_orders} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [v, '주문수']} labelFormatter={(l) => `날짜: ${l}`} />
                  <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm" style={{ color: '#94A3B8' }}>로딩 중...</div>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
