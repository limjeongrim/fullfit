import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

function ActionCenter({ stats, navigate }) {
  const actions = []

  if (stats?.low_stock_count > 0) {
    actions.push({
      icon: '⚠️',
      text: `재고 부족 ${stats.low_stock_count}개 상품 → 보충 입고 요청`,
      color: 'bg-[#FFF7ED] border-[#FED7AA] text-[#9A3412]',
      onClick: () => navigate('/seller/inbound-request'),
    })
  }
  if (stats?.expiry_alert_count > 0) {
    actions.push({
      icon: '⏰',
      text: `유통기한 임박 ${stats.expiry_alert_count}개 상품 → 재고 확인`,
      color: 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]',
      onClick: () => navigate('/seller/inventory'),
    })
  }
  if (stats?.pending_return_count > 0) {
    actions.push({
      icon: '📦',
      text: `반품 접수 ${stats.pending_return_count}건 처리 대기`,
      color: 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]',
      onClick: () => navigate('/seller/returns'),
    })
  }
  if (stats?.unconfirmed_settlement_count > 0) {
    actions.push({
      icon: '💰',
      text: `정산 미확정 ${stats.unconfirmed_settlement_count}건 확인 필요`,
      color: 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]',
      onClick: () => navigate('/seller/settlements'),
    })
  }

  return (
    <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 mb-6">
      <h3 className="text-sm font-bold mb-3" style={{ color: '#0F172A' }}>지금 해야 할 일</h3>
      {actions.length === 0 ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: '#16A34A' }}>
          <span className="text-lg">✅</span>
          <span className="font-medium">현재 처리가 필요한 항목이 없습니다</span>
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium text-left hover:opacity-80 transition-opacity ${a.color}`}
            >
              <span className="text-base">{a.icon}</span>
              <span>{a.text}</span>
              <span className="ml-auto text-xs opacity-60">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SellerDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
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
                {user?.full_name ? `${user.full_name} 브랜드 센터` : `안녕하세요, ${user?.full_name}님`}
              </h2>
              <LiveIndicator />
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm" style={{ color: '#64748B' }}>내 스토어 운영 현황을 확인하세요.</p>
              <LastUpdated time={lastUpdated} />
            </div>
          </div>

          {/* Action center */}
          <ActionCenter stats={stats} navigate={navigate} />

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
