import { useEffect, useState } from 'react'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const STATUS_META = {
  CREATED:     { label: '대기',     cls: 'bg-[#F1F5F9] text-[#475569]' },
  IN_PROGRESS: { label: '진행 중',  cls: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  COMPLETED:   { label: '완료',     cls: 'bg-[#DCFCE7] text-[#166534]' },
}

function StatPill({ label, value, color }) {
  const colors = {
    blue:   { bg: '#EFF6FF', border: '#BFDBFE', label: '#1D4ED8', value: '#2563EB' },
    orange: { bg: '#FFF7ED', border: '#FED7AA', label: '#9A3412', value: '#EA580C' },
    green:  { bg: '#F0FDF4', border: '#BBF7D0', label: '#166534', value: '#16A34A' },
  }[color] || {}
  return (
    <div className="flex items-center gap-2 rounded-lg border px-4 py-2"
      style={{ background: colors.bg, borderColor: colors.border }}>
      <span className="text-sm font-semibold" style={{ color: colors.label }}>{label}</span>
      <span className="text-lg font-bold" style={{ color: colors.value }}>{value}</span>
    </div>
  )
}

function BatchCard({ batch, onStart, onComplete }) {
  const [open, setOpen] = useState(false)
  const meta = STATUS_META[batch.status] || STATUS_META.CREATED

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm" style={{ color: '#0F172A' }}>
              {batch.batch_number}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${meta.cls}`}>
              {meta.label}
            </span>
            {(() => {
              const rate = parseFloat(batch.overlap_rate) || 0
              if (rate >= 5) return (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[#DCFCE7] text-[#166534]">
                  SKU 중복 절감 {Math.round(rate)}%
                </span>
              )
              if (rate > 0) return (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[#F1F5F9] text-[#64748B]">
                  소량 절감 {Math.round(rate)}%
                </span>
              )
              return (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[#F1F5F9] text-[#64748B]">
                  단일 SKU 배치
                </span>
              )
            })()}
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap" style={{ color: '#64748B' }}>
            <span>주문 {batch.order_count}건 묶음</span>
            <span>·</span>
            <span>총 {batch.total_items}개 상품</span>
            {batch.zones?.length > 0 && (
              <><span>·</span><span>구역: {batch.zones.join(', ')}</span></>
            )}
            {batch.has_cold && (
              <><span>·</span><span style={{ color: '#0E7490' }}>❄️ 냉장 포함</span></>
            )}
            {batch.assigned_worker && <><span>·</span><span>담당: {batch.assigned_worker}</span></>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setOpen(v => !v)}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#F1F5F9] text-[#374151] hover:bg-[#E2E8F0] transition-colors">
            {open ? '접기' : '상세 보기'}
          </button>
          {batch.status === 'CREATED' && (
            <button onClick={() => onStart(batch.id)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8] font-semibold transition-colors">
              피킹 시작
            </button>
          )}
          {batch.status === 'IN_PROGRESS' && (
            <button onClick={() => onComplete(batch.id)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] font-semibold transition-colors">
              완료
            </button>
          )}
        </div>
      </div>

      {/* SKU summary strip */}
      <div className="px-5 pb-3 flex flex-wrap gap-1.5">
        {batch.sku_summary.slice(0, 3).map(s => (
          <span key={s.sku}
            className="text-[11px] px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] font-medium">
            {s.product_name} ×{s.total_qty}
          </span>
        ))}
        {batch.sku_summary.length > 3 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#94A3B8] font-medium">
            +{batch.sku_summary.length - 3}개 더
          </span>
        )}
      </div>

      {/* Expandable: per-order detail */}
      {open && (
        <div className="border-t border-[#F1F5F9] bg-[#F8FAFC]">
          {batch.orders.map((o, idx) => (
            <div key={o.order_id} className={`px-5 py-3 ${idx > 0 ? 'border-t border-[#F1F5F9]' : ''}`}>
              <p className="text-xs font-mono font-semibold mb-1" style={{ color: '#374151' }}>
                {o.order_number}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {o.items.map(it => (
                  <span key={it.sku}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-white border border-[#E2E8F0] text-[#64748B]">
                    {it.product_name} ×{it.qty}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BatchPickingPage() {
  const [stats, setStats]       = useState(null)
  const [batches, setBatches]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult]   = useState(null)

  function loadAll() {
    setLoading(true)
    Promise.all([
      api.get('/batch-picking/stats'),
      api.get('/batch-picking/list'),
    ]).then(([s, b]) => {
      setStats(s.data)
      setBatches(b.data)
    }).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [])

  function handleGenerate() {
    setGenerating(true)
    setGenResult(null)
    api.post('/batch-picking/generate')
      .then(r => {
        setGenResult(r.data)
        loadAll()
      })
      .catch(e => setGenResult({ message: e.response?.data?.detail || '오류가 발생했습니다.' }))
      .finally(() => setGenerating(false))
  }

  function handleStart(id) {
    api.post(`/batch-picking/${id}/start`)
      .then(() => loadAll())
      .catch(console.error)
  }

  function handleComplete(id) {
    api.post(`/batch-picking/${id}/complete`)
      .then(() => loadAll())
      .catch(console.error)
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="px-6 py-6">
          <div className="mb-5">
            <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>배치 피킹</h2>
            <p className="mt-1 text-sm" style={{ color: '#64748B' }}>
              여러 주문을 묶어 한 번에 피킹해 창고 이동을 최소화합니다.
            </p>
          </div>

          {/* Header stats */}
          <div className="flex flex-wrap gap-3 mb-5">
            <StatPill label="대기 배치"    value={`${stats?.pending_count ?? '—'}건`}    color="blue" />
            <StatPill label="총 절감 예상" value={`${stats?.pending_trips_saved ?? '—'}번 이동`} color="orange" />
            <StatPill label="오늘 완료"    value={`${stats?.today_completed ?? '—'}배치`} color="green" />
          </div>

          {/* Generate button */}
          <div className="mb-5 flex items-center gap-4 flex-wrap">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#93C5FD] text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {generating ? '배치 생성 중…' : '+ 배치 생성'}
            </button>
            {genResult && (
              <span className={`text-sm font-medium ${genResult.created > 0 ? 'text-[#16A34A]' : 'text-[#64748B]'}`}>
                {genResult.message}
              </span>
            )}
          </div>

          {/* Batch cards */}
          {loading ? (
            <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>로딩 중...</div>
          ) : batches.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-sm font-medium" style={{ color: '#64748B' }}>대기 중인 배치가 없습니다.</p>
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                "배치 생성" 버튼으로 RECEIVED 주문을 자동으로 묶어보세요.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {batches.map(b => (
                <BatchCard
                  key={b.id}
                  batch={b}
                  onStart={handleStart}
                  onComplete={handleComplete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  )
}
