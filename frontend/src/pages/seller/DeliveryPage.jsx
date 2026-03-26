import { useEffect, useState } from 'react'
import api from '../../api/axiosInstance'
import DeliveryMap from '../../components/DeliveryMap'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const STATUS_META = {
  READY:            { label: '접수 완료', cls: 'bg-[#F1F5F9] text-[#475569]' },
  IN_TRANSIT:       { label: '이동중',    cls: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  OUT_FOR_DELIVERY: { label: '배달 출발', cls: 'bg-[#FED7AA] text-[#9A3412]' },
  DELIVERED:        { label: '배송 완료', cls: 'bg-[#DCFCE7] text-[#166534]' },
  FAILED:           { label: '배송 실패', cls: 'bg-[#FEE2E2] text-[#991B1B]' },
}

const CARRIER_META = {
  CJ:     { label: 'CJ대한통운', cls: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  HANJIN: { label: '한진택배',   cls: 'bg-[#FED7AA] text-[#9A3412]' },
  LOTTE:  { label: '롯데택배',   cls: 'bg-[#FEE2E2] text-[#991B1B]' },
  ETC:    { label: '기타',       cls: 'bg-[#F1F5F9] text-[#64748B]' },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function CarrierBadge({ carrier }) {
  const m = CARRIER_META[carrier] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
      </span>
      <span className="text-xs font-medium" style={{ color: '#64748B' }}>실시간</span>
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

function isDelayed(d) {
  if (!d.estimated_delivery) return false
  return (
    d.estimated_delivery < new Date().toISOString().slice(0, 10) &&
    d.status !== 'DELIVERED' &&
    d.status !== 'FAILED'
  )
}

function TrackingModal({ tracking, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/deliveries/tracking/${tracking}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [tracking])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg" style={{ color: '#0F172A' }}>배송 추적</h3>
            <p className="text-xs font-mono mt-0.5" style={{ color: '#64748B' }}>{tracking}</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none" style={{ color: '#94A3B8' }}>×</button>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="text-center py-8" style={{ color: '#94A3B8' }}>로딩 중...</div>
          ) : !data ? (
            <div className="text-center py-8" style={{ color: '#94A3B8' }}>추적 정보를 불러올 수 없습니다.</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5 p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <div>
                  <p className="text-xs" style={{ color: '#64748B' }}>택배사</p>
                  <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{CARRIER_META[data.carrier]?.label || data.carrier}</p>
                </div>
                <StatusBadge status={data.current_status} />
              </div>

              <div className="space-y-0">
                {data.timeline.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full mt-1 shrink-0 border-2 ${step.done ? 'bg-[#2563EB] border-[#2563EB]' : 'bg-white border-[#CBD5E1]'}`} />
                      {i < data.timeline.length - 1 && (
                        <div className={`w-0.5 h-10 ${step.done ? 'bg-[#BFDBFE]' : 'bg-[#E2E8F0]'}`} />
                      )}
                    </div>
                    <div className="pb-6">
                      <p className={`text-sm font-semibold`} style={{ color: step.done ? '#0F172A' : '#CBD5E1' }}>{step.status}</p>
                      {step.location && <p className="text-xs" style={{ color: step.done ? '#64748B' : '#CBD5E1' }}>{step.location}</p>}
                      {step.message && <p className="text-xs" style={{ color: step.done ? '#64748B' : '#CBD5E1' }}>{step.message}</p>}
                      {step.timestamp && (
                        <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>
                          {new Date(step.timestamp).toLocaleString('ko-KR')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SellerDeliveryPage() {
  const [deliveries, setDeliveries] = useState([])
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [trackingModal, setTrackingModal] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchDeliveries = async () => {
    try {
      const res = await api.get('/deliveries/seller')
      setDeliveries(res.data)
      setLastUpdated(Date.now())
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    fetchDeliveries()
    const id = setInterval(fetchDeliveries, 15000)
    return () => clearInterval(id)
  }, [])

  const filtered = deliveries.filter((d) => {
    if (filterStatus && d.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      if (!d.tracking_number.toLowerCase().includes(q) && !d.order_number.toLowerCase().includes(q))
        return false
    }
    return true
  })

  const countStatus = (s) => deliveries.filter((d) => d.status === s).length

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
            {[
              { label: '전체',    value: deliveries.length },
              { label: '이동중',  value: countStatus('IN_TRANSIT') + countStatus('OUT_FOR_DELIVERY') },
              { label: '배송 완료', value: countStatus('DELIVERED') },
              { label: '배송 실패', value: countStatus('FAILED') },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-lg border border-[#E2E8F0] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <p className="text-sm font-medium" style={{ color: '#64748B' }}>{s.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: '#0F172A' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Live bar */}
          <div className="flex items-center justify-between mb-4">
            <LiveIndicator />
            <LastUpdated time={lastUpdated} />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <button
              onClick={() => setShowMap((v) => !v)}
              className={`px-3 py-1.5 rounded-[6px] text-sm font-medium border transition-colors ${
                showMap
                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-white border-[#E2E8F0] hover:bg-[#F8FAFC]'
              }`} style={showMap ? {} : { color: '#374151' }}
            >
              🗺️ {showMap ? '지도 숨기기' : '지도 보기'}
            </button>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]">
              <option value="">전체 상태</option>
              {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
            <input type="text" placeholder="운송장번호 또는 주문번호 검색" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] w-60" />
            <span className="text-xs" style={{ color: '#94A3B8' }}>운송장번호 클릭 시 상세 추적</span>
          </div>

          {/* Map */}
          {showMap && (
            <div className="mb-5 rounded-lg overflow-hidden border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ height: 400 }}>
              <DeliveryMap deliveries={filtered} height={400} />
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['주문번호', '수신자', '주소', '택배사', '운송장번호', '상태', '예상배송일', '실제배송일'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>배송 데이터가 없습니다.</td></tr>
                ) : (
                  filtered.map((d) => (
                    <tr key={d.id}
                      className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors ${isDelayed(d) ? 'bg-[#FEF2F2]' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#374151' }}>{d.order_number}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{d.receiver_name}</td>
                      <td className="px-4 py-3 max-w-[160px] truncate" style={{ color: '#64748B' }}>{d.receiver_address}</td>
                      <td className="px-4 py-3"><CarrierBadge carrier={d.carrier} /></td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <button
                          onClick={() => setTrackingModal(d.tracking_number)}
                          className="hover:underline transition-colors font-semibold" style={{ color: '#2563EB' }}>
                          {d.tracking_number}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={d.status} />
                        {isDelayed(d) && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-[#FEE2E2] text-[#991B1B] font-semibold">지연</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{d.estimated_delivery || '—'}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{d.actual_delivery || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>총 {filtered.length}건</p>
        </div>

        {trackingModal && (
          <TrackingModal tracking={trackingModal} onClose={() => setTrackingModal(null)} />
        )}
      </div>
    </SidebarLayout>
  )
}
