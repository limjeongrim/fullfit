import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const RISK_META = {
  HIGH:   { label: '위험', cls: 'bg-[#FEE2E2] text-[#991B1B] font-bold' },
  MEDIUM: { label: '주의', cls: 'bg-[#FEF9C3] text-[#854D0E] font-semibold' },
  LOW:    { label: '안전', cls: 'bg-[#DCFCE7] text-[#166534]' },
}

function PromoRiskBadge({ risk }) {
  const m = RISK_META[risk] || RISK_META.LOW
  return <span className={`px-2 py-0.5 rounded-full text-xs ${m.cls}`}>{m.label}</span>
}

function fmtDays(days) {
  if (days === 999 || days >= 365) return { text: '1년 이상', color: '#94A3B8' }
  if (days >= 180) return { text: '6개월 이상', color: '#166534' }
  if (days >= 90)  return { text: '3개월 이상', color: '#166534' }
  if (days >= 30)  return { text: `${Math.floor(days / 30)}개월`, color: '#1D4ED8' }
  if (days >= 14)  return { text: `${days}일`, color: '#854D0E' }
  if (days >= 7)   return { text: `${days}일`, color: '#9A3412' }
  return { text: `${days}일`, color: '#991B1B' }
}

function fmtForecast(value, avgDailySales) {
  if (!avgDailySales || avgDailySales === 0) return '데이터 부족'
  if (value >= 1000) return `약 ${(value / 1000).toFixed(1)}k개`
  return `약 ${value}개`
}

export default function SellerForecastPage() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/stats/demand-forecast/seller')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const highRiskCount = data.filter(d => d.promotion_risk === 'HIGH').length
  const reorderCount = data.filter(d => d.reorder_recommended).length
  const criticalCount = data.filter(d => d.days_of_stock < 7 && d.days_of_stock !== 999).length

  const chartData = data.slice(0, 10).map(d => ({
    name: d.product_name.length > 8 ? d.product_name.slice(0, 8) + '…' : d.product_name,
    days: d.days_of_stock === 999 || d.days_of_stock >= 365 ? 365 : d.days_of_stock,
    raw: d,
  }))

  const getBarColor = (days) => {
    if (days < 7) return '#EF4444'
    if (days < 14) return '#F97316'
    if (days < 30) return '#EAB308'
    return '#2563EB'
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="px-6 py-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>수요 예측 분석</h2>
            <p className="mt-1 text-sm" style={{ color: '#64748B' }}>최근 30일 평균 판매량 기준 재고 소진 예측</p>
          </div>

          {highRiskCount > 0 && (
            <div className="mb-5 flex items-center gap-3 bg-[#FEF2F2] border-2 border-[#FECACA] text-[#991B1B] rounded-lg px-5 py-4">
              <span className="text-xl">⚠️</span>
              <span className="font-semibold text-sm">
                {highRiskCount}개 상품이 예정된 프로모션 기간 동안 재고 부족이 예상됩니다.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: '내 상품',       value: data.length,    color: '#0F172A' },
              { label: '프로모션 위험',  value: highRiskCount,  color: '#991B1B' },
              { label: '재입고 필요',   value: reorderCount,   color: '#9A3412' },
              { label: '긴급 (7일 미만)', value: criticalCount, color: '#854D0E' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-lg border border-[#E2E8F0] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <p className="text-sm font-medium" style={{ color: '#64748B' }}>{s.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {chartData.length > 0 && (
            <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 mb-6">
              <h3 className="text-sm font-semibold mb-4" style={{ color: '#374151' }}>재고 소진일수</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} unit="일" />
                  <Tooltip formatter={(v, n, props) => {
                    const d = props.payload.raw
                    const fmt = fmtDays(d.days_of_stock)
                    return [`${fmt.text} (재고 ${d.current_stock}개)`, '소진일수']
                  }} />
                  <Bar dataKey="days" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={getBarColor(entry.days)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['상품명', 'SKU', '현재재고', '일평균판매', '소진일수', '7일예측', '재고상태', '프로모션 리스크', '조치'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>로딩 중...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>데이터가 없습니다.</td></tr>
                ) : (
                  data.map(d => {
                    const isCritical = d.days_of_stock < 7 && d.days_of_stock !== 999
                    const isWarn = d.reorder_recommended && !isCritical
                    const daysFmt = fmtDays(d.days_of_stock)
                    return (
                      <tr key={d.product_id}
                        className={`border-b border-[#F1F5F9] transition-colors ${
                          d.promotion_risk === 'HIGH' ? 'bg-[#FEF2F2] hover:bg-[#FEE2E2]/50' :
                          isCritical ? 'bg-[#FFF7ED] hover:bg-[#FFEDD5]/50' :
                          isWarn ? 'bg-[#FEFCE8]' : 'hover:bg-[#F8FAFC]'
                        }`}>
                        <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{d.product_name}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: '#64748B' }}>{d.sku}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: '#374151' }}>{d.current_stock.toLocaleString()}개</td>
                        <td className="px-4 py-3" style={{ color: '#64748B' }}>
                          {d.avg_daily_sales > 0 ? `${d.avg_daily_sales}/일` : <span style={{ color: '#CBD5E1' }}>데이터 없음</span>}
                        </td>
                        <td className="px-4 py-3 font-bold">
                          <span style={{ color: daysFmt.color }}>{daysFmt.text}</span>
                        </td>
                        <td className="px-4 py-3" style={{ color: '#64748B' }}>{fmtForecast(d.forecast_7day, d.avg_daily_sales)}</td>
                        <td className="px-4 py-3">
                          {isCritical
                            ? <span className="px-2 py-0.5 rounded-full text-xs bg-[#FEE2E2] text-[#991B1B] font-bold">긴급</span>
                            : isWarn
                            ? <span className="px-2 py-0.5 rounded-full text-xs bg-[#FED7AA] text-[#9A3412]">재입고필요</span>
                            : <span className="px-2 py-0.5 rounded-full text-xs bg-[#DCFCE7] text-[#166534]">정상</span>}
                        </td>
                        <td className="px-4 py-3"><PromoRiskBadge risk={d.promotion_risk} /></td>
                        <td className="px-4 py-3">
                          {(isCritical || isWarn || d.promotion_risk !== 'LOW') && (
                            <button
                              onClick={() => navigate('/seller/inbound-request')}
                              className="text-xs px-2 py-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-[6px] transition-colors whitespace-nowrap">
                              입고 요청
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
