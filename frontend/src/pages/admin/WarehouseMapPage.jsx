import { useEffect, useRef, useState } from 'react'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  normal:   { bg: '#F0FDF4', border: '#86EFAC', text: '#166534', dot: '#22C55E' },
  warning:  { bg: '#FEFCE8', border: '#FDE047', text: '#854D0E', dot: '#EAB308' },
  critical: { bg: '#FEF2F2', border: '#FCA5A5', text: '#991B1B', dot: '#EF4444' },
  empty:    { bg: '#F8FAFC', border: '#E2E8F0', text: '#CBD5E1', dot: '#CBD5E1' },
}

const STATUS_LABEL = {
  normal: '정상', warning: '주의', critical: '부족', empty: '빈칸',
}

const ZONE_ACCENT = {
  A: '#EA580C', B: '#2563EB', C: '#7C3AED', D: '#0891B2',
}

// ── LocationCell ───────────────────────────────────────────────────────────────

function LocationCell({ loc, isRefrig, onHover, onLeave }) {
  const s = STATUS_STYLE[loc.status] || STATUS_STYLE.empty
  return (
    <div
      onMouseEnter={(e) => onHover(loc, e)}
      onMouseLeave={onLeave}
      className="rounded border text-left transition-all cursor-default select-none"
      style={{
        background: loc.product_id ? s.bg : '#F8FAFC',
        borderColor: isRefrig ? '#7DD3FC' : (loc.product_id ? s.border : '#E2E8F0'),
        borderWidth: isRefrig ? '1.5px' : '1px',
        padding: '3px 5px',
        minWidth: '70px',
        boxShadow: isRefrig ? '0 0 0 1px #BAE6FD22' : undefined,
      }}
    >
      <p className="text-[9px] font-mono font-semibold truncate" style={{ color: '#94A3B8' }}>
        {loc.code}
      </p>
      {loc.product_name ? (
        <>
          <p className="text-[10px] font-semibold leading-tight truncate mt-0.5" style={{ color: s.text }}>
            {loc.product_name}
          </p>
          <p className="text-[9px]" style={{ color: s.text }}>
            {loc.total_stock}개
          </p>
        </>
      ) : (
        <p className="text-[10px]" style={{ color: '#CBD5E1' }}>—</p>
      )}
    </div>
  )
}

// ── ZoneBlock: renders a zone's rows filtered by col range ─────────────────────

function ZoneBlock({ zone, colMin, colMax, onHover, onLeave }) {
  if (!zone) return null
  const isRefrig = zone.zone === 'D'

  const byRow = {}
  zone.locations.forEach((loc) => {
    if (loc.col >= colMin && loc.col <= colMax) {
      if (!byRow[loc.row]) byRow[loc.row] = []
      byRow[loc.row].push(loc)
    }
  })

  const rows = Object.entries(byRow).sort(([a], [b]) => Number(a) - Number(b))

  return (
    <div className="flex flex-col gap-1">
      {rows.map(([rowNum, locs]) => (
        <div key={rowNum} className="flex gap-1">
          {[...locs].sort((a, b) => a.col - b.col).map((loc) => (
            <LocationCell
              key={loc.code}
              loc={loc}
              isRefrig={isRefrig}
              onHover={onHover}
              onLeave={onLeave}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── ZoneLabel ──────────────────────────────────────────────────────────────────

function ZoneLabel({ zone, name, desc }) {
  const accent = ZONE_ACCENT[zone] || '#64748B'
  return (
    <div className="mb-1.5">
      <span className="text-xs font-bold" style={{ color: accent }}>{name}</span>
      {desc && <span className="text-[10px] ml-1.5" style={{ color: '#94A3B8' }}>{desc}</span>}
    </div>
  )
}

// ── Tooltip ────────────────────────────────────────────────────────────────────

function HoverTooltip({ tooltip }) {
  if (!tooltip) return null
  const { loc, x, y } = tooltip
  if (!loc.product_id) return null
  const s = STATUS_STYLE[loc.status] || STATUS_STYLE.empty
  const isRefrig = loc.code.startsWith('D-')
  const pct = Math.min(100, Math.round((loc.total_stock / 100) * 100))

  return (
    <div
      className="fixed z-50 pointer-events-none bg-white border border-[#E2E8F0] rounded-xl shadow-2xl p-3.5 w-56"
      style={{ left: x + 10, top: y - 30, transform: 'translateY(0)' }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm font-mono font-bold" style={{ color: '#374151' }}>📍 {loc.code}</span>
        {isRefrig && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E0F2FE] text-[#0369A1] font-semibold">❄ 냉장</span>
        )}
      </div>
      <p className="text-sm font-bold leading-tight" style={{ color: '#0F172A' }}>{loc.product_name}</p>
      <p className="text-[11px] font-mono mt-0.5" style={{ color: '#64748B' }}>{loc.sku}</p>
      {loc.seller_name && (
        <p className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>브랜드: {loc.seller_name}</p>
      )}
      <div className="mt-2 pt-2 border-t border-[#F1F5F9]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px]" style={{ color: '#64748B' }}>현재 재고</span>
          <span className="text-sm font-bold" style={{ color: s.text }}>{loc.total_stock}개</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px]" style={{ color: '#64748B' }}>추정 용량</span>
          <span className="text-[11px]" style={{ color: '#94A3B8' }}>100개 기준</span>
        </div>
        {/* Stock bar */}
        <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: s.dot }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px]" style={{ color: '#94A3B8' }}>0</span>
          <span className="text-[10px] font-semibold" style={{ color: s.text }}>
            {STATUS_LABEL[loc.status]}
          </span>
          <span className="text-[10px]" style={{ color: '#94A3B8' }}>100</span>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function WarehouseMapPage() {
  const [mapData, setMapData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    api.get('/picking-route/warehouse-map')
      .then((r) => setMapData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <p className="text-sm" style={{ color: '#94A3B8' }}>창고 지도 로딩 중...</p>
        </div>
      </SidebarLayout>
    )
  }

  const zoneC = mapData?.zones?.find((z) => z.zone === 'C')
  const zoneB = mapData?.zones?.find((z) => z.zone === 'B')
  const zoneA = mapData?.zones?.find((z) => z.zone === 'A')
  const zoneD = mapData?.zones?.find((z) => z.zone === 'D')

  // Stats
  const allLocs  = mapData?.zones?.flatMap((z) => z.locations) || []
  const occupied = allLocs.filter((l) => l.product_id).length
  const warning  = allLocs.filter((l) => l.status === 'warning').length
  const critical = allLocs.filter((l) => l.status === 'critical').length
  const refrigLocs = (zoneD?.locations || []).filter((l) => l.product_id).length

  function handleHover(loc, e) {
    if (!loc.product_id) return
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ loc, x: rect.right, y: rect.top })
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="px-6 py-5">
          {/* Header */}
          <div className="mb-4">
            <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>창고 지도</h2>
            <p className="mt-0.5 text-sm" style={{ color: '#64748B' }}>
              U형 창고 레이아웃 — 입고/출고구 동일 방향 (효율적 동선)
            </p>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap gap-2 mb-4">
            <StatChip label="전체 로케이션" value={mapData?.total_slots} color="gray" />
            <StatChip label="사용중" value={occupied} color="green" />
            <StatChip label="빈 로케이션" value={mapData?.empty_slots} color="slate" />
            {warning > 0 && <StatChip label="재고 주의" value={warning} color="yellow" />}
            {critical > 0 && <StatChip label="재고 부족" value={critical} color="red" />}
            <StatChip label="냉장 구역" value={refrigLocs} color="cyan" />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-5 text-xs">
            {Object.entries(STATUS_STYLE).map(([k, s]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.dot }} />
                <span style={{ color: '#64748B' }}>{STATUS_LABEL[k]}</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="text-[#7DD3FC]">❄</span>
              <span style={{ color: '#64748B' }}>냉장</span>
            </span>
          </div>

          {/* ── U-Shape Map ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-5 overflow-x-auto">

            {/* ① C구역 (top — full width) */}
            <div className="mb-1">
              <ZoneLabel zone="C" name="C구역 (저회전 - 안쪽)" desc="대용량, 특수 제품" />
            </div>
            <div className="bg-[#FAF5FF] border border-[#DDD6FE] rounded-xl p-3 mb-3">
              {zoneC && (
                <div className="flex flex-col gap-1">
                  {Array.from({ length: zoneC.rows }, (_, ri) => {
                    const row = ri + 1
                    const locs = (zoneC.locations || []).filter((l) => l.row === row).sort((a, b) => a.col - b.col)
                    return (
                      <div key={row} className="flex gap-1">
                        {locs.map((loc) => (
                          <div key={loc.code} className="flex-1" style={{ minWidth: '70px' }}>
                            <LocationCell loc={loc} isRefrig={false} onHover={handleHover} onLeave={() => setTooltip(null)} />
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Aisle indicator */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 border-t-2 border-dashed border-[#CBD5E1]" />
              <span className="text-[11px] font-semibold px-3 py-1 bg-[#F1F5F9] rounded-full" style={{ color: '#64748B' }}>
                ↕ 중앙 통로
              </span>
              <div className="flex-1 border-t-2 border-dashed border-[#CBD5E1]" />
            </div>

            {/* ② B구역 (split) */}
            <div className="mb-3">
              <div className="flex gap-3">
                {/* B-Left */}
                <div className="flex-1 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3">
                  <ZoneLabel zone="B" name="B구역 좌 (중회전)" desc="기초 케어 제품" />
                  <ZoneBlock zone={zoneB} colMin={1} colMax={2} onHover={handleHover} onLeave={() => setTooltip(null)} />
                </div>
                {/* Center aisle label */}
                <div className="flex flex-col items-center justify-center w-12 shrink-0">
                  <div className="w-px flex-1 bg-[#E2E8F0]" />
                  <span className="text-[9px] text-center font-semibold rotate-0 my-2 leading-none" style={{ color: '#CBD5E1', writingMode: 'vertical-lr' }}>
                    통 로
                  </span>
                  <div className="w-px flex-1 bg-[#E2E8F0]" />
                </div>
                {/* B-Right */}
                <div className="flex-1 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3">
                  <ZoneLabel zone="B" name="B구역 우 (중회전)" desc="기초 케어 제품" />
                  <ZoneBlock zone={zoneB} colMin={4} colMax={5} onHover={handleHover} onLeave={() => setTooltip(null)} />
                </div>
              </div>
            </div>

            {/* ③ A구역 (split) */}
            <div className="mb-3">
              <div className="flex gap-3">
                {/* A-Left */}
                <div className="flex-1 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-3">
                  <ZoneLabel zone="A" name="A구역 좌 (고회전)" desc="색조 / 립 제품" />
                  <ZoneBlock zone={zoneA} colMin={1} colMax={2} onHover={handleHover} onLeave={() => setTooltip(null)} />
                </div>
                {/* Center aisle */}
                <div className="flex flex-col items-center justify-center w-12 shrink-0">
                  <div className="w-px flex-1 bg-[#E2E8F0]" />
                  <span className="text-[9px] font-semibold my-2" style={{ color: '#CBD5E1', writingMode: 'vertical-lr' }}>
                    통 로
                  </span>
                  <div className="w-px flex-1 bg-[#E2E8F0]" />
                </div>
                {/* A-Right */}
                <div className="flex-1 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-3">
                  <ZoneLabel zone="A" name="A구역 우 (고회전)" desc="색조 / 립 제품" />
                  <ZoneBlock zone={zoneA} colMin={4} colMax={5} onHover={handleHover} onLeave={() => setTooltip(null)} />
                </div>
              </div>
            </div>

            {/* ④ D구역 corners + 작업 공간 */}
            <div className="flex gap-3 mb-3">
              {/* D-Left */}
              <div className="bg-[#ECFEFF] border border-[#A5F3FC] rounded-xl p-3" style={{ minWidth: '220px' }}>
                <ZoneLabel zone="D" name="D구역 냉장 (좌)" desc="냉장 보관 필요" />
                <ZoneBlock zone={zoneD} colMin={1} colMax={2} onHover={handleHover} onLeave={() => setTooltip(null)} />
              </div>
              {/* Staging area */}
              <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC]" style={{ minHeight: '100px' }}>
                <span className="text-2xl mb-1">📦</span>
                <p className="text-sm font-bold" style={{ color: '#374151' }}>작업 공간</p>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>포장 · 검수 · 스테이징</p>
              </div>
              {/* D-Right */}
              <div className="bg-[#ECFEFF] border border-[#A5F3FC] rounded-xl p-3" style={{ minWidth: '220px' }}>
                <ZoneLabel zone="D" name="D구역 냉장 (우)" desc="냉장 보관 필요" />
                <ZoneBlock zone={zoneD} colMin={4} colMax={5} onHover={handleHover} onLeave={() => setTooltip(null)} />
              </div>
            </div>

            {/* ⑤ Dock row */}
            <div className="flex rounded-xl overflow-hidden border border-[#E2E8F0]">
              <div className="flex-1 flex flex-col items-center justify-center py-3 bg-[#F0FDF4] border-r border-[#BBF7D0]">
                <span className="text-xl mb-0.5">📥</span>
                <p className="text-sm font-bold" style={{ color: '#166534' }}>RECV 입고구</p>
                <p className="text-[11px]" style={{ color: '#4ADE80' }}>입고 전용 도크</p>
              </div>
              <div className="w-1/3 flex items-center justify-center bg-[#F8FAFC] py-3">
                <p className="text-[11px] font-semibold" style={{ color: '#94A3B8' }}>← 동선 흐름 →</p>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center py-3 bg-[#FFF7ED] border-l border-[#FED7AA]">
                <span className="text-xl mb-0.5">📤</span>
                <p className="text-sm font-bold" style={{ color: '#EA580C' }}>SHIP 출고구</p>
                <p className="text-[11px]" style={{ color: '#FB923C' }}>출고 전용 도크</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      <HoverTooltip tooltip={tooltip} />
    </SidebarLayout>
  )
}

function StatChip({ label, value, color }) {
  const styles = {
    gray:   { bg: 'bg-white border-[#E2E8F0]',           text: 'text-[#374151]',  val: 'text-[#0F172A]' },
    green:  { bg: 'bg-[#F0FDF4] border-[#BBF7D0]',       text: 'text-[#166534]',  val: 'text-[#16A34A]' },
    slate:  { bg: 'bg-[#F8FAFC] border-[#E2E8F0]',       text: 'text-[#94A3B8]',  val: 'text-[#64748B]' },
    yellow: { bg: 'bg-[#FEFCE8] border-[#FEF08A]',       text: 'text-[#854D0E]',  val: 'text-[#D97706]' },
    red:    { bg: 'bg-[#FEF2F2] border-[#FECACA]',       text: 'text-[#991B1B]',  val: 'text-[#DC2626]' },
    cyan:   { bg: 'bg-[#ECFEFF] border-[#A5F3FC]',       text: 'text-[#0E7490]',  val: 'text-[#0891B2]' },
  }
  const s = styles[color] || styles.gray
  return (
    <div className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 ${s.bg}`}>
      <span className={`text-xs font-semibold ${s.text}`}>{label}</span>
      <span className={`text-base font-bold ${s.val}`}>{value ?? '—'}</span>
    </div>
  )
}
