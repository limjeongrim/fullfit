import { useEffect, useState } from 'react'
import api from '../../api/axiosInstance'
import DeliveryMap from '../../components/DeliveryMap'
import SidebarLayout from '../../components/Layout/SidebarLayout'

// ── Carrier config ─────────────────────────────────────────────────────────────

const CARRIER_META = {
  CJ:     { label: 'CJ대한통운', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', icon: '🔴' },
  LOTTE:  { label: '롯데택배',   color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', icon: '🔵' },
  HANJIN: { label: '한진택배',   color: '#EAB308', bg: '#FEFCE8', border: '#FEF08A', icon: '🟡' },
  ROSEN:  { label: '로젠택배',   color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', icon: '🟢' },
  ETC:    { label: '기타',       color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0', icon: '⚫' },
}

const STATUS_META = {
  READY:            { label: '택배사 인수완료', cls: 'bg-[#F1F5F9] text-[#475569]' },
  IN_TRANSIT:       { label: '배송중',          cls: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  OUT_FOR_DELIVERY: { label: '배달 출발',        cls: 'bg-[#FED7AA] text-[#9A3412]' },
  DELIVERED:        { label: '배송완료',         cls: 'bg-[#DCFCE7] text-[#166534]' },
  FAILED:           { label: '배송 실패',        cls: 'bg-[#FEE2E2] text-[#991B1B]' },
}

const CARRIER_ORDER = ['CJ', 'LOTTE', 'HANJIN', 'ROSEN', 'ETC']

export default function DeliveryMapPage() {
  const [deliveries, setDeliveries]       = useState([])
  const [flyToId, setFlyToId]             = useState(null)
  const [collapsed, setCollapsed]         = useState({})
  const [activeCourier, setActiveCourier] = useState(null)

  useEffect(() => {
    api.get('/deliveries/').then((r) => setDeliveries(r.data)).catch(console.error)
  }, [])

  // All deliveries grouped by carrier (for stats bar counts — never filtered)
  const allGrouped = {}
  deliveries.forEach((d) => {
    const key = d.carrier || 'ETC'
    if (!allGrouped[key]) allGrouped[key] = []
    allGrouped[key].push(d)
  })

  // Filtered deliveries for left panel + map
  const filteredDeliveries = activeCourier
    ? deliveries.filter((d) => (d.carrier || 'ETC') === activeCourier)
    : deliveries

  const grouped = {}
  filteredDeliveries.forEach((d) => {
    const key = d.carrier || 'ETC'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(d)
  })

  function toggleCollapse(carrier) {
    setCollapsed((prev) => ({ ...prev, [carrier]: !prev[carrier] }))
  }

  function toggleCourier(key) {
    setActiveCourier((prev) => (prev === key ? null : key))
  }

  const deliveredCount = deliveries.filter((d) => d.status === 'DELIVERED').length

  return (
    <SidebarLayout>
      <div className="h-[calc(100vh-56px)] bg-[#F8FAFC] flex flex-col">

        {/* Stats bar */}
        <div className="bg-white border-b border-[#E2E8F0] px-6 py-2.5 flex flex-wrap items-center gap-3 shrink-0">
          <span className="text-sm font-semibold" style={{ color: '#374151' }}>
            오늘 출고 {deliveries.length}건
          </span>
          <span className="w-px h-4 bg-[#E2E8F0]" />

          {/* Clickable courier filter pills */}
          {CARRIER_ORDER.map((k) => {
            const meta    = CARRIER_META[k]
            const cnt     = (allGrouped[k] || []).length
            if (cnt === 0) return null
            const isActive = activeCourier === k
            return (
              <button
                key={k}
                onClick={() => toggleCourier(k)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all"
                style={{
                  color:           isActive ? '#fff' : meta.color,
                  backgroundColor: isActive ? meta.color : 'transparent',
                  borderColor:     meta.color,
                }}
              >
                {meta.icon} {meta.label} {cnt}건
              </button>
            )
          })}

          {/* Active filter label + 전체 reset button */}
          {activeCourier && (
            <>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] font-medium">
                {CARRIER_META[activeCourier]?.label} 필터 중
              </span>
              <button
                onClick={() => setActiveCourier(null)}
                className="text-xs px-3 py-1 rounded-full bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] font-medium transition-colors"
                style={{ color: '#374151' }}
              >
                전체 보기
              </button>
            </>
          )}

          <span className="w-px h-4 bg-[#E2E8F0]" />
          <span className="text-sm font-semibold" style={{ color: '#166534' }}>
            배송완료 {deliveredCount}건
          </span>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel: grouped by courier (filtered) */}
          <div className="w-[300px] shrink-0 bg-white border-r border-[#E2E8F0] flex flex-col overflow-y-auto">
            {CARRIER_ORDER.map((key) => {
              const items = grouped[key]
              if (!items || items.length === 0) return null
              const meta = CARRIER_META[key]
              const isCollapsed = collapsed[key]
              return (
                <div key={key}>
                  {/* Courier header */}
                  <button
                    onClick={() => toggleCollapse(key)}
                    className="w-full flex items-center justify-between px-4 py-2.5 border-b hover:bg-[#F8FAFC] transition-colors"
                    style={{ background: meta.bg, borderColor: meta.border }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">{meta.icon}</span>
                      <span className="text-sm font-bold" style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                      <span
                        className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: meta.color, color: 'white' }}
                      >
                        {items.length}건
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: '#94A3B8' }}>
                      {isCollapsed ? '▼' : '▲'}
                    </span>
                  </button>

                  {/* Delivery items */}
                  {!isCollapsed && items.map((d) => {
                    const statusMeta = STATUS_META[d.status] || {}
                    return (
                      <button
                        key={d.id}
                        onClick={() => setFlyToId(d.id)}
                        className="w-full text-left px-4 py-2.5 border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-mono font-semibold truncate" style={{ color: '#374151' }}>
                            {d.order_number}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ml-1 ${statusMeta.cls}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                        <p className="text-xs font-medium" style={{ color: '#0F172A' }}>{d.receiver_name}</p>
                        <p className="text-[11px] truncate" style={{ color: '#94A3B8' }}>{d.receiver_address}</p>
                      </button>
                    )
                  })}
                </div>
              )
            })}

            {filteredDeliveries.length === 0 && (
              <div className="flex items-center justify-center flex-1 p-6">
                <p className="text-sm text-center" style={{ color: '#94A3B8' }}>
                  {activeCourier ? `${CARRIER_META[activeCourier]?.label} 배송 없음` : '출고 데이터 없음'}
                </p>
              </div>
            )}
          </div>

          {/* Map — receives only filtered deliveries */}
          <div className="flex-1 p-4">
            <DeliveryMap
              deliveries={filteredDeliveries}
              height="100%"
              flyToId={flyToId}
            />
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
