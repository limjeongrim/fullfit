import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const PIE_COLORS = ['#2563EB', '#16A34A', '#D97706', '#7C3AED', '#64748B']

function KpiCard({ label, value, unit, color, sub }) {
  const colorMap = {
    blue:   { num: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
    green:  { num: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
    orange: { num: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
    red:    { num: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  }
  const c = colorMap[color] || colorMap.blue
  return (
    <div className="bg-white rounded-lg border shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5" style={{ borderColor: c.border }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium" style={{ color: '#64748B' }}>{label}</p>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: c.bg }}></div>
      </div>
      <p className="text-3xl font-bold leading-tight" style={{ color: c.num }}>
        {value}<span className="text-base font-normal ml-1" style={{ color: '#94A3B8' }}>{unit}</span>
      </p>
      {sub && <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{sub}</p>}
    </div>
  )
}

const PERIOD_OPTIONS = [
  { label: '7일', value: 7 },
  { label: '14일', value: 14 },
  { label: '30일', value: 30 },
  { label: '60일', value: 60 },
  { label: '90일', value: 90 },
]

export default function KPIReportPage() {
  const [data, setData] = useState(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/kpi/summary?days=${days}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [days])

  const downloadCSV = () => {
    if (!data) return
    const k = data.kpis
    const esc = (v) => { const s = String(v ?? ''); return s.includes(',') ? `"${s}"` : s }
    const rows = [
      ['기간', `최근 ${days}일`],
      ['출고정확도', `${k.outbound_accuracy}%`],
      ['평균처리시간', `${k.avg_processing_hours}시간`],
      ['반품률', `${k.return_rate}%`],
      ['재고정확도', `${k.inventory_accuracy}%`],
      ['총주문수', k.total_orders],
      ['배송완료', k.delivered_count],
      ['반품건수', k.return_count],
      ['총매출', `₩${Number(k.total_revenue).toLocaleString()}`],
    ]
    const csv = rows.map(r => r.map(esc).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `KPI리포트_최근${days}일.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const fmtDate = (d) => d?.slice(5) || ''

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6 py-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold" style={{ color: '#0F172A' }}>KPI 리포트</h2>
              <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>핵심 운영 지표를 확인합니다.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
                {PERIOD_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setDays(o.value)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${days === o.value ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              <button onClick={downloadCSV}
                className="border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] px-4 py-2 rounded-[6px] text-sm font-medium transition-colors" style={{ color: '#374151' }}>
                ↓ CSV
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64 text-sm" style={{ color: '#94A3B8' }}>로딩 중...</div>
          ) : data ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KpiCard label="출고 정확도" value={data.kpis.outbound_accuracy} unit="%" color="green"
                  sub={`배송완료 ${data.kpis.delivered_count}건`} />
                <KpiCard label="평균 처리시간" value={data.kpis.avg_processing_hours} unit="시간" color="blue"
                  sub="접수 → 출고 기준" />
                <KpiCard label="반품률" value={data.kpis.return_rate} unit="%" color="orange"
                  sub={`반품 ${data.kpis.return_count}건`} />
                <KpiCard label="재고 정확도" value={data.kpis.inventory_accuracy} unit="%" color="green"
                  sub="실사 기준 추정치" />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <KpiCard label="총 주문" value={data.kpis.total_orders.toLocaleString()} unit="건" color="blue" />
                <KpiCard label="배송 완료" value={data.kpis.delivered_count.toLocaleString()} unit="건" color="green" />
                <KpiCard label="반품 건수" value={data.kpis.return_count.toLocaleString()} unit="건" color="red" />
                <KpiCard label="총 매출" value={`₩${(data.kpis.total_revenue / 10000).toFixed(0)}만`} unit="" color="blue"
                  sub={`₩${Number(data.kpis.total_revenue).toLocaleString()}`} />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
                {/* Daily orders line chart */}
                <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
                  <h3 className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>일별 주문량</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data.daily_orders} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [v, '주문수']} labelFormatter={(l) => `날짜: ${l}`} />
                      <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Channel pie chart */}
                <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
                  <h3 className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>채널별 주문 비중</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={data.channel_breakdown} dataKey="count" nameKey="channel"
                        cx="50%" cy="50%" outerRadius={80} label={({ channel, percent }) => `${channel} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}>
                        {data.channel_breakdown.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v + '건', n]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Seller bar chart */}
              <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
                <h3 className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>셀러별 주문량</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.seller_breakdown} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [v, '주문수']} />
                    <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-sm" style={{ color: '#94A3B8' }}>데이터를 불러올 수 없습니다.</div>
          )}
        </div>
      </div>
    </SidebarLayout>
  )
}
