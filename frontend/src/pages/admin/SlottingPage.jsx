import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const ABC_META = {
  A: { label: 'A클래스', cls: 'bg-[#DCFCE7] text-[#166534] font-bold',  color: '#16A34A' },
  B: { label: 'B클래스', cls: 'bg-[#DBEAFE] text-[#1D4ED8] font-semibold', color: '#2563EB' },
  C: { label: 'C클래스', cls: 'bg-[#F1F5F9] text-[#475569]',              color: '#64748B' },
  D: { label: 'D클래스', cls: 'bg-[#ECFEFF] text-[#0E7490] font-semibold', color: '#0891B2' },
}

const PRIORITY_META = {
  HIGH:   { label: '즉시',   cls: 'bg-[#FEE2E2] text-[#991B1B] font-bold' },
  MEDIUM: { label: '권장',   cls: 'bg-[#FEF9C3] text-[#854D0E] font-semibold' },
  LOW:    { label: '선택',   cls: 'bg-[#F1F5F9] text-[#475569]' },
}

const ZONE_COLORS = { A: '#EA580C', B: '#2563EB', C: '#7C3AED', D: '#0891B2' }

const TABS = [
  { key: 'ALL',    label: '전체' },
  { key: 'A',      label: 'A클래스' },
  { key: 'B',      label: 'B클래스' },
  { key: 'C',      label: 'C클래스' },
  { key: 'HIGH',   label: 'HIGH만' },
]

function fmtTime(isoStr) {
  if (!isoStr) return '—'
  const diff = Math.floor((Date.now() - new Date(isoStr + 'Z').getTime()) / 1000)
  if (diff < 60)   return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  return `${Math.floor(diff / 3600)}시간 전`
}

export default function SlottingPage() {
  const [data,         setData]         = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState('ALL')
  const [applying,     setApplying]     = useState(null)   // product_id
  const [applyingAll,  setApplyingAll]  = useState(false)
  const [confirmAll,   setConfirmAll]   = useState(false)
  const [applyResult,  setApplyResult]  = useState(null)

  function load() {
    setLoading(true)
    api.get('/slotting/analyze')
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function handleApply(productId) {
    setApplying(productId)
    api.post(`/slotting/apply/${productId}`)
      .then(() => load())
      .catch(console.error)
      .finally(() => setApplying(null))
  }

  function handleApplyAll() {
    setConfirmAll(false)
    setApplyingAll(true)
    api.post('/slotting/apply-all')
      .then((r) => {
        setApplyResult(r.data)
        load()
      })
      .catch(console.error)
      .finally(() => setApplyingAll(false))
  }

  const recs     = data?.recommendations || []
  const highCount = recs.filter((r) => r.priority === 'HIGH' && r.needs_move).length

  const filtered = recs.filter((r) => {
    if (tab === 'ALL')    return true
    if (tab === 'HIGH')   return r.priority === 'HIGH'
    return r.abc_class === tab
  })

  const pieData = data ? Object.entries(data.abc_counts || {}).map(([cls, count]) => ({
    name:  `${cls}클래스`,
    value: count,
    color: ABC_META[cls]?.color || '#94A3B8',
  })) : []

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="px-6 py-6">
          <div className="mb-5">
            <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>슬로팅 최적화</h2>
            <p className="mt-1 text-sm" style={{ color: '#64748B' }}>
              ABC 분류 기반 회전율 최적 로케이션 추천
            </p>
          </div>

          {/* Summary bar */}
          {data && (
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-2">
                <span className="text-sm font-semibold text-[#991B1B]">재배치 필요</span>
                <span className="text-lg font-bold text-[#DC2626]">{data.relocation_needed}개 상품</span>
              </div>
              <div className="flex items-center gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-4 py-2">
                <span className="text-sm font-semibold text-[#166534]">예상 피킹 효율</span>
                <span className="text-lg font-bold text-[#16A34A]">+{data.efficiency_gain_pct}%</span>
              </div>
              <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-lg px-4 py-2">
                <span className="text-sm font-semibold" style={{ color: '#64748B' }}>마지막 분석</span>
                <span className="text-sm font-medium" style={{ color: '#374151' }}>{fmtTime(data.analyzed_at)}</span>
              </div>
              <button onClick={load} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm font-medium hover:bg-[#F8FAFC] transition-colors" style={{ color: '#374151' }}>
                🔄 {loading ? '분석 중...' : '재분석'}
              </button>
            </div>
          )}

          {/* Result toast */}
          {applyResult && (
            <div className="mb-5 flex items-center gap-3 bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] rounded-xl px-5 py-3">
              <span>✅</span>
              <span className="font-semibold">{applyResult.message}</span>
              <button onClick={() => setApplyResult(null)} className="ml-auto text-lg leading-none" style={{ color: '#94A3B8' }}>×</button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
            {/* ABC Pie chart */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>ABC 분류 현황</h3>
              {loading ? (
                <div className="h-[200px] flex items-center justify-center text-sm" style={{ color: '#94A3B8' }}>로딩 중...</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={70}
                      dataKey="value" nameKey="name"
                      label={({ name, value }) => `${name} ${value}개`} labelLine={false}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v + '개', n]} />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Stats */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>구역별 분류 기준</h3>
              <div className="space-y-3 text-sm">
                {[
                  { zone: 'A', cls: 'A', desc: '상위 20% 회전율 상품 — 출하구 인접 배치', color: '#EA580C' },
                  { zone: 'B', cls: 'B', desc: '중간 30% 회전율 상품 — 중간 구역 배치',   color: '#2563EB' },
                  { zone: 'C', cls: 'C', desc: '하위 50% 회전율 상품 — 안쪽 구역 배치',   color: '#7C3AED' },
                  { zone: 'D', cls: 'D', desc: '냉장 보관 필요 상품 — 냉장 구역 고정',    color: '#0891B2' },
                ].map(({ zone, cls, desc, color }) => (
                  <div key={zone} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: color + '10' }}>
                    <span className="font-bold text-base shrink-0" style={{ color }}>{zone}구역</span>
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${ABC_META[cls].cls}`}>{ABC_META[cls].label}</span>
                      <span className="text-xs" style={{ color: '#64748B' }}>{desc}</span>
                    </div>
                    <span className="ml-auto text-lg font-bold shrink-0" style={{ color }}>
                      {data?.abc_counts?.[cls] ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* "전체 HIGH 적용" button + filter tabs */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {TABS.map(({ key, label }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === key ? 'bg-[#2563EB] text-white' : 'bg-white border border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC]'
                  }`}>
                  {label}
                  {key === 'HIGH' && highCount > 0 && (
                    <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      tab === key ? 'bg-white/30 text-white' : 'bg-[#FEE2E2] text-[#991B1B]'
                    }`}>{highCount}</span>
                  )}
                </button>
              ))}
            </div>

            {highCount > 0 && (
              <button
                onClick={() => setConfirmAll(true)}
                disabled={applyingAll}
                className="ml-auto px-5 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50">
                {applyingAll ? '적용 중...' : `⚡ 전체 HIGH 적용 (${highCount}건)`}
              </button>
            )}
          </div>

          {/* Recommendations table */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['상품명', 'SKU', '현재 위치', '권장 위치', '회전율', '분류', '우선순위', '이유', '적용'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]"
                      style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>분석 중...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>해당 항목이 없습니다.</td></tr>
                ) : (
                  filtered.map((r) => {
                    const abcM  = ABC_META[r.abc_class]  || ABC_META.C
                    const priM  = PRIORITY_META[r.priority] || PRIORITY_META.LOW
                    const moved = !r.needs_move
                    return (
                      <tr key={r.product_id}
                        className={`border-b border-[#F1F5F9] transition-colors ${
                          r.priority === 'HIGH' && r.needs_move ? 'bg-[#FEF2F2] hover:bg-[#FEE2E2]' :
                          r.priority === 'MEDIUM' && r.needs_move ? 'bg-[#FEFCE8] hover:bg-[#FEF9C3]' :
                          'hover:bg-[#F8FAFC]'
                        } ${moved ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{r.product_name}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: '#64748B' }}>{r.sku}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569]">
                            📍 {r.current_location}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {r.needs_move ? (
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: ZONE_COLORS[r.recommended_zone] + '20', color: ZONE_COLORS[r.recommended_zone] }}>
                              📍 {r.recommended_location}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: '#94A3B8' }}>현재 최적</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: '#64748B' }}>
                          {r.turnover_rate.toFixed(2)}
                          <span className="ml-1 text-[10px]" style={{ color: '#94A3B8' }}>({r.total_sold_30d}개/30일)</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${abcM.cls}`}>{abcM.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${priM.cls}`}>{priM.label}</span>
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[200px]" style={{ color: '#64748B' }}>{r.reason}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {r.needs_move ? (
                            <button
                              onClick={() => handleApply(r.product_id)}
                              disabled={applying === r.product_id}
                              className="text-xs px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg transition-colors disabled:opacity-50">
                              {applying === r.product_id ? '적용 중...' : '적용'}
                            </button>
                          ) : (
                            <span className="text-xs" style={{ color: '#16A34A' }}>✓ 최적</span>
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
            <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>
              적용 후 피킹 경로가 새 위치를 즉시 반영합니다.
            </p>
          )}
        </div>

        {/* Confirm apply-all modal */}
        {confirmAll && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">⚡</div>
                <h3 className="text-xl font-bold" style={{ color: '#0F172A' }}>일괄 위치 변경</h3>
                <p className="mt-2 text-sm" style={{ color: '#64748B' }}>
                  HIGH 우선순위 <strong style={{ color: '#DC2626' }}>{highCount}개 상품</strong>의 위치를 권장 위치로 변경합니다.
                </p>
                <p className="mt-1 text-xs" style={{ color: '#94A3B8' }}>
                  실제 상품 이동은 별도로 진행해야 합니다.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setConfirmAll(false)}
                  className="py-3 border-2 border-[#E2E8F0] rounded-xl text-sm font-semibold hover:bg-[#F8FAFC]"
                  style={{ color: '#374151' }}>취소</button>
                <button onClick={handleApplyAll}
                  className="py-3 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-xl text-sm font-bold">
                  변경 적용
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
