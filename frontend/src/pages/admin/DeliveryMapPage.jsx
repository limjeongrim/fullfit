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

const FILTER_OPTIONS = [
  { key: '', label: '전체' },
  { key: 'IN_TRANSIT', label: '배송중' },
  { key: 'OUT_FOR_DELIVERY', label: '배달중' },
  { key: 'DELIVERED', label: '배송완료' },
]

export default function DeliveryMapPage() {
  const [deliveries, setDeliveries] = useState([])
  const [filterStatus, setFilterStatus] = useState('')
  const [flyToId, setFlyToId] = useState(null)

  useEffect(() => {
    api.get('/deliveries/').then((r) => setDeliveries(r.data)).catch(console.error)
  }, [])

  const filtered = filterStatus ? deliveries.filter((d) => d.status === filterStatus) : deliveries
  const countStatus = (s) => deliveries.filter((d) => d.status === s).length

  return (
    <SidebarLayout>
      {/* Full-height layout: fills viewport minus 56px navbar */}
      <div className="h-[calc(100vh-56px)] bg-blue-50 flex flex-col">
        {/* Stats bar */}
        <div className="bg-white border-b border-blue-100 px-6 py-3 flex flex-wrap gap-4 shrink-0">
          <span className="text-sm font-medium text-gray-700">전체 {deliveries.length}건</span>
          <span className="text-sm font-medium text-blue-700">배송중 {countStatus('IN_TRANSIT')}건</span>
          <span className="text-sm font-medium text-orange-600">배달중 {countStatus('OUT_FOR_DELIVERY')}건</span>
          <span className="text-sm font-medium text-green-600">배송완료 {countStatus('DELIVERED')}건</span>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — delivery list */}
          <div className="w-[300px] shrink-0 bg-white border-r border-blue-100 flex flex-col overflow-hidden">
            {/* Filter buttons */}
            <div className="p-3 border-b border-gray-100 flex gap-1 flex-wrap">
              {FILTER_OPTIONS.map(({ key, label }) => (
                <button key={key} onClick={() => setFilterStatus(key)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterStatus === key ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Delivery list */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-10">배송 없음</div>
              ) : (
                filtered.map((d) => {
                  const meta = STATUS_META[d.status] || {}
                  return (
                    <button key={d.id} onClick={() => setFlyToId(d.id)}
                      className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-gray-700 font-semibold">{d.order_number}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${meta.cls}`}>{meta.label}</span>
                      </div>
                      <p className="text-xs text-gray-600 font-medium">{d.receiver_name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{d.receiver_address}</p>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 p-4">
            <DeliveryMap deliveries={filtered} height="100%" flyToId={flyToId} />
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
