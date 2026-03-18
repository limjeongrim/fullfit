import { useEffect, useState } from 'react'
import api from '../../api/axiosInstance'
import DeliveryMap from '../../components/DeliveryMap'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const STATUS_META = {
  READY:            { label: '준비',    cls: 'bg-gray-100 text-gray-600' },
  IN_TRANSIT:       { label: '배송중',  cls: 'bg-blue-100 text-blue-700' },
  OUT_FOR_DELIVERY: { label: '배달중',  cls: 'bg-orange-100 text-orange-700' },
  DELIVERED:        { label: '배송완료', cls: 'bg-green-100 text-green-700' },
  FAILED:           { label: '배송실패', cls: 'bg-red-100 text-red-700' },
}

const CARRIER_META = {
  CJ:     { label: 'CJ대한통운', cls: 'bg-blue-100 text-blue-700' },
  HANJIN: { label: '한진택배',   cls: 'bg-orange-100 text-orange-700' },
  LOTTE:  { label: '롯데택배',   cls: 'bg-red-100 text-red-700' },
  ETC:    { label: '기타',       cls: 'bg-gray-100 text-gray-500' },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function CarrierBadge({ carrier }) {
  const m = CARRIER_META[carrier] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
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
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-gray-800">배송 추적</h3>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{tracking}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="text-center text-gray-400 py-8">로딩 중...</div>
          ) : !data ? (
            <div className="text-center text-gray-400 py-8">추적 정보를 불러올 수 없습니다.</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5 p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500">택배사</p>
                  <p className="font-semibold text-gray-800">{CARRIER_META[data.carrier]?.label || data.carrier}</p>
                </div>
                <StatusBadge status={data.current_status} />
              </div>

              {/* Timeline */}
              <div className="space-y-0">
                {data.timeline.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full mt-1 shrink-0 border-2 ${step.done ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`} />
                      {i < data.timeline.length - 1 && (
                        <div className={`w-0.5 h-10 ${step.done ? 'bg-blue-300' : 'bg-gray-200'}`} />
                      )}
                    </div>
                    <div className="pb-6">
                      <p className={`text-sm font-semibold ${step.done ? 'text-gray-800' : 'text-gray-400'}`}>{step.status}</p>
                      {step.location && <p className={`text-xs ${step.done ? 'text-gray-500' : 'text-gray-300'}`}>{step.location}</p>}
                      {step.message && <p className={`text-xs ${step.done ? 'text-gray-500' : 'text-gray-300'}`}>{step.message}</p>}
                      {step.timestamp && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
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

  useEffect(() => {
    api.get('/deliveries/seller').then((res) => setDeliveries(res.data))
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
      <div className="min-h-screen bg-purple-50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
            {[
              { label: '전체',    value: deliveries.length,                                          bg: 'bg-purple-50 border-purple-200 text-purple-700' },
              { label: '배송중',  value: countStatus('IN_TRANSIT') + countStatus('OUT_FOR_DELIVERY'), bg: 'bg-blue-50 border-blue-200 text-blue-700' },
              { label: '배송완료', value: countStatus('DELIVERED'),                                  bg: 'bg-green-50 border-green-200 text-green-700' },
              { label: '배송실패', value: countStatus('FAILED'),                                     bg: 'bg-red-50 border-red-200 text-red-700' },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                <p className="text-sm font-medium opacity-80">{s.label}</p>
                <p className="text-3xl font-bold mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <button
              onClick={() => setShowMap((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                showMap
                  ? 'bg-purple-700 text-white border-purple-700'
                  : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'
              }`}
            >
              🗺️ {showMap ? '지도 숨기기' : '지도 보기'}
            </button>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
              <option value="">전체 상태</option>
              {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
            <input type="text" placeholder="운송장번호 또는 주문번호 검색" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 w-60" />
            <span className="text-xs text-gray-400 ml-2">운송장번호 클릭 시 상세 추적</span>
          </div>

          {/* Map */}
          {showMap && (
            <div className="mb-5 rounded-xl overflow-hidden border border-purple-100 shadow-sm" style={{ height: 400 }}>
              <DeliveryMap deliveries={filtered} height={400} />
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-purple-100">
            <table className="w-full text-sm">
              <thead className="bg-purple-700 text-white">
                <tr>
                  {['주문번호', '수신자', '주소', '택배사', '운송장번호', '상태', '예상배송일', '실제배송일'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">배송 데이터가 없습니다.</td></tr>
                ) : (
                  filtered.map((d) => (
                    <tr key={d.id}
                      className={`border-t border-gray-100 hover:bg-purple-50 transition-colors ${isDelayed(d) ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{d.order_number}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{d.receiver_name}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{d.receiver_address}</td>
                      <td className="px-4 py-3"><CarrierBadge carrier={d.carrier} /></td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <button
                          onClick={() => setTrackingModal(d.tracking_number)}
                          className="text-purple-600 hover:underline hover:text-purple-800 transition-colors">
                          {d.tracking_number}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={d.status} />
                        {isDelayed(d) && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-red-200 text-red-700 font-semibold">지연</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{d.estimated_delivery || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{d.actual_delivery || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">총 {filtered.length}건</p>
        </div>

        {trackingModal && (
          <TrackingModal tracking={trackingModal} onClose={() => setTrackingModal(null)} />
        )}
      </div>
    </SidebarLayout>
  )
}
