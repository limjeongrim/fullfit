import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Cell,
  LineChart, Line, Legend, ReferenceArea,
} from 'recharts'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const RISK_META = {
  HIGH:   { label: '위험', cls: 'bg-[#FEE2E2] text-[#991B1B] font-bold' },
  MEDIUM: { label: '주의', cls: 'bg-[#FEF9C3] text-[#854D0E] font-semibold' },
  LOW:    { label: '안전', cls: 'bg-[#DCFCE7] text-[#166534]' },
}

const TREND_META = {
  increasing: { icon: '↑', label: '증가', cls: 'text-[#16A34A] font-semibold' },
  stable:     { icon: '→', label: '안정', cls: 'text-[#64748B]' },
  decreasing: { icon: '↓', label: '감소', cls: 'text-[#DC2626] font-semibold' },
}

function Tooltip({ text, children }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center">
      {children}
      <button
        className="ml-1 w-4 h-4 rounded-full bg-[#E2E8F0] text-[#64748B] text-[10px] font-bold leading-none flex items-center justify-center hover:bg-[#CBD5E1] transition-colors"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(v => !v)}
        type="button"
      >?</button>
      {show && (
        <div className="absolute left-0 top-6 z-50 w-56 bg-[#1E293B] text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none">
          {text}
        </div>
      )}
    </span>
  )
}

function PromoRiskBadge({ risk }) {
  const m = RISK_META[risk] || RISK_META.LOW
  return <span className={`px-2 py-0.5 rounded-full text-xs ${m.cls}`}>{m.label}</span>
}

function TrendBadge({ trend }) {
  const m = TREND_META[trend] || TREND_META.stable
  return <span className={`text-sm ${m.cls}`}>{m.icon} {m.label}</span>
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

function ChartModal({ item, onClose, onInbound }) {
  const [predict, setPredict] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/forecast/predict/${item.product_id}`)
      .then(r => setPredict(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [item.product_id])

  const chartData = predict ? [
    ...predict.history.map(h => ({
      date: h.date.slice(5),
      actual: h.quantity,
      ma7:  predict.ma_7,
      ma14: predict.ma_14,
      ma30: predict.ma_30,
    })),
    ...predict.forecast_7d.map(f => ({
      date: f.date.slice(5),
      actual: null,
      ma7:  predict.ma_7,
      ma14: predict.ma_14,
      ma30: predict.ma_30,
      forecast: f.quantity,
    })),
  ] : []

  const firstFcDate = predict?.forecast_7d[0]?.date.slice(5)
  const lastFcDate  = predict?.forecast_7d[6]?.date.slice(5)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg" style={{ color: '#0F172A' }}>수요 예측 차트</h3>
            <p className="text-sm" style={{ color: '#64748B' }}>{item.product_name} <span className="font-mono text-xs">({item.sku})</span></p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none" style={{ color: '#94A3B8' }}>×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {loading ? (
            <div className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>로딩 중...</div>
          ) : predict ? (
            <>
              {/* MA stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '7일 평균',  val: predict.ma_7,  mape: predict.mape_7,  win: 7,  color: '#F97316' },
                  { label: '14일 평균', val: predict.ma_14, mape: predict.mape_14, win: 14, color: '#22C55E' },
                  { label: '30일 평균', val: predict.ma_30, mape: predict.mape_30, win: 30, color: '#A855F7' },
                ].map(({ label, val, mape, win, color }) => {
                  const isRec = predict.recommended_window === win
                  const accuracy = Math.max(0, 100 - mape).toFixed(1)
                  return (
                    <div key={label}
                      className={`rounded-xl p-3 border ${isRec ? 'border-2' : 'border'}`}
                      style={{ backgroundColor: color + '15', borderColor: isRec ? color : '#E2E8F0' }}>
                      <p className="text-xs font-semibold" style={{ color }}>
                        {label}{isRec && ' ★ 권장 기준'}
                      </p>
                      <p className="text-lg font-bold" style={{ color: '#0F172A' }}>{val}/일</p>
                      <p className="text-xs" style={{ color: '#64748B' }}>예측 정확도 {accuracy}%</p>
                    </div>
                  )
                })}
              </div>

              {/* Line Chart */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>
                  최근 30일 실적 + 7일 예측 (음영 구간)
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <RechartsTooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {firstFcDate && lastFcDate && (
                      <ReferenceArea x1={firstFcDate} x2={lastFcDate} fill="#EFF6FF" fillOpacity={0.7} />
                    )}
                    <Line type="monotone" dataKey="actual"   name="실제 판매" stroke="#2563EB" strokeWidth={2} dot={false} connectNulls={false} />
                    <Line type="monotone" dataKey="forecast" name="7일 예측"   stroke="#2563EB" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} connectNulls={false} />
                    <Line type="monotone" dataKey="ma7"  name="7일 평균"  stroke="#F97316" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                    <Line type="monotone" dataKey="ma14" name="14일 평균" stroke="#22C55E" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                    <Line type="monotone" dataKey="ma30" name="30일 평균" stroke="#A855F7" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>예측 데이터가 없습니다.</div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#E2E8F0] flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-[6px] text-sm text-[#374151] hover:bg-[#F8FAFC]">닫기</button>
          {(item.reorder_recommended || item.promotion_risk !== 'LOW') && (
            <button onClick={onInbound}
              className="flex-1 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-[6px] text-sm font-semibold">
              입고 요청
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SellerForecastPage() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)
  const [riskFilter, setRiskFilter] = useState('ALL')

  useEffect(() => {
    api.get('/forecast/summary')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const reorderCount  = data.filter(d => d.reorder_recommended).length
  const safeCount     = data.filter(d => !d.reorder_recommended).length
  const highRiskCount = data.filter(d => d.promotion_risk === 'HIGH').length
  const criticalCount = data.filter(d => d.days_of_stock < 7 && d.days_of_stock !== 999).length
  const avgAccuracy   = data.length > 0
    ? (100 - data.reduce((s, d) => s + d.mape, 0) / data.length).toFixed(1)
    : 0

  const isDanger  = (d) => (d.days_of_stock < 14 && d.days_of_stock !== 999) || d.promotion_risk === 'HIGH'
  const isCaution = (d) => (d.days_of_stock >= 14 && d.days_of_stock < 30 && d.days_of_stock !== 999) || d.promotion_risk === 'MEDIUM'

  const dangerCount  = data.filter(isDanger).length
  const cautionCount = data.filter(isCaution).length

  const filtered = riskFilter === 'ALL'    ? data
    : riskFilter === 'DANGER'  ? data.filter(isDanger)
    : data.filter(isCaution)

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
          <div className="mb-5">
            <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>수요 예측 분석</h2>
            <p className="mt-1 text-sm" style={{ color: '#64748B' }}>이동평균 기반 수요 예측 + 재고 소진 분석</p>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-2">
              <span className="text-sm font-semibold text-[#991B1B]">발주 필요</span>
              <span className="text-lg font-bold text-[#DC2626]">{reorderCount}개 상품</span>
            </div>
            <div className="flex items-center gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-4 py-2">
              <span className="text-sm font-semibold text-[#166534]">안전 재고</span>
              <span className="text-lg font-bold text-[#16A34A]">{safeCount}개 상품</span>
            </div>
            <div className="flex items-center gap-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg px-4 py-2">
              <span className="text-sm font-semibold text-[#1D4ED8]">평균 예측 정확도</span>
              <span className="text-lg font-bold text-[#2563EB]">{avgAccuracy}%</span>
            </div>
          </div>

          {highRiskCount > 0 && (
            <div className="mb-5 flex items-center gap-3 bg-[#FEF2F2] border-2 border-[#FECACA] text-[#991B1B] rounded-lg px-5 py-4">
              <span className="text-xl">⚠️</span>
              <span className="font-semibold text-sm">
                {highRiskCount}개 상품이 예정된 프로모션 기간 동안 재고 부족이 예상됩니다.
              </span>
            </div>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: '내 상품',         value: data.length,    color: '#0F172A' },
              { label: '프로모션 위험',    value: highRiskCount,  color: '#991B1B' },
              { label: '재입고 필요',      value: reorderCount,   color: '#9A3412' },
              { label: '긴급 (7일 미만)', value: criticalCount,  color: '#854D0E' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-lg border border-[#E2E8F0] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <p className="text-sm font-medium" style={{ color: '#64748B' }}>{s.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 mb-6">
              <h3 className="text-sm font-semibold mb-4" style={{ color: '#374151' }}>
                <Tooltip text="현재 재고를 평균 판매량으로 나눈 예상 재고 소진 일수입니다">
                  예상 소진일수
                </Tooltip>
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} unit="일" />
                  <RechartsTooltip formatter={(v, n, props) => {
                    const d = props.payload.raw
                    const fmt = fmtDays(d.days_of_stock)
                    return [`${fmt.text} (재고 ${d.current_stock}개)`, '소진일수']
                  }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={() => '예상 소진일'} />
                  <Bar dataKey="days" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={getBarColor(entry.days)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex gap-2 mb-4">
            {[
              ['ALL',     `전체 (${data.length})`],
              ['DANGER',  `위험 (${dangerCount})`],
              ['CAUTION', `주의 (${cautionCount})`],
            ].map(([k, v]) => (
              <button key={k} onClick={() => setRiskFilter(k)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  riskFilter === k ? 'bg-[#2563EB] text-white' : 'bg-white border border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC]'
                }`}>{v}</button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {[
                    { label: '상품명' },
                    { label: 'SKU' },
                    { label: '현재재고' },
                    { label: '일평균판매' },
                    { label: '예상 소진일', tip: '현재 재고를 평균 판매량으로 나눈 예상 재고 소진 일수입니다' },
                    { label: '추세' },
                    { label: '7일예측' },
                    { label: '재고상태' },
                    { label: '프로모션 리스크' },
                    { label: '권장 기준' },
                    { label: '예측 정확도', tip: '최근 30일 예측값과 실제 판매량을 비교한 정확도입니다' },
                    { label: '조치' },
                  ].map(h => (
                    <th key={h.label} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>
                      {h.tip ? (
                        <Tooltip text={h.tip}>{h.label}</Tooltip>
                      ) : h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>로딩 중...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={12} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>해당 조건의 상품이 없습니다.</td></tr>
                ) : (
                  filtered.map(d => {
                    const isCritical = d.days_of_stock < 7 && d.days_of_stock !== 999
                    const isWarn = d.reorder_recommended && !isCritical
                    const daysFmt = fmtDays(d.days_of_stock)
                    const accuracy = Math.max(0, 100 - d.mape).toFixed(1)
                    return (
                      <tr key={d.product_id}
                        onClick={() => setSelectedItem(d)}
                        className={`border-b border-[#F1F5F9] transition-colors cursor-pointer ${
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
                        <td className="px-4 py-3"><TrendBadge trend={d.trend} /></td>
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
                          <span className="px-2 py-0.5 rounded-full text-xs bg-[#EFF6FF] text-[#1D4ED8] font-medium">{d.recommended_window}일 평균</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#64748B' }}>정확도 {accuracy}%</td>
                        <td className="px-4 py-3">
                          {(isCritical || isWarn || d.promotion_risk !== 'LOW') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate('/seller/inbound-request') }}
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
          {filtered.length > 0 && (
            <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>행 클릭 시 이동평균 예측 차트 상세 보기</p>
          )}
        </div>

        {selectedItem && (
          <ChartModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onInbound={() => { setSelectedItem(null); navigate('/seller/inbound-request') }}
          />
        )}
      </div>
    </SidebarLayout>
  )
}
