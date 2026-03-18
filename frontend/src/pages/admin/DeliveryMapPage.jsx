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

const FILTER_OPTIONS = [
  { key: '', label: '전체' },
  { key: 'IN_TRANSIT', label: '이동중' },
  { key: 'OUT_FOR_DELIVERY', label: '배달 출발' },
  { key: 'DELIVERED', label: '배송 완료' },
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
      <div className="h-[calc(100vh-56px)] bg-[#F8FAFC] flex flex-col">
        {/* Stats bar */}
        <div className="bg-white border-b border-[#E2E8F0] px-6 py-3 flex flex-wrap gap-5 shrink-0">
          <span className="text-sm font-medium" style={{ color: '#374151' }}>전체 {deliveries.length}건</span>
          <span className="text-sm font-medium" style={{ color: '#1D4ED8' }}>이동중 {countStatus('IN_TRANSIT')}건</span>
          <span className="text-sm font-medium" style={{ color: '#9A3412' }}>배달 출발 {countStatus('OUT_FOR_DELIVERY')}건</span>
          <span className="text-sm font-medium" style={{ color: '#166534' }}>배송 완료 {countStatus('DELIVERED')}건</span>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — delivery list */}
          <div className="w-[300px] shrink-0 bg-white border-r border-[#E2E8F0] flex flex-col overflow-hidden">
            {/* Filter buttons */}
            <div className="p-3 border-b border-[#E2E8F0] flex gap-1 flex-wrap">
              {FILTER_OPTIONS.map(({ key, label }) => (
                <button key={key} onClick={() => setFilterStatus(key)}
                  className={`text-xs px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
                    filterStatus === key ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] text-[#374151] hover:bg-[#E2E8F0]'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Delivery list */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="text-center text-sm py-10" style={{ color: '#94A3B8' }}>배송 없음</div>
              ) : (
                filtered.map((d) => {
                  const meta = STATUS_META[d.status] || {}
                  return (
                    <button key={d.id} onClick={() => setFlyToId(d.id)}
                      className="w-full text-left px-4 py-3 border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-semibold" style={{ color: '#374151' }}>{d.order_number}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${meta.cls}`}>{meta.label}</span>
                      </div>
                      <p className="text-xs font-medium" style={{ color: '#0F172A' }}>{d.receiver_name}</p>
                      <p className="text-[11px] truncate" style={{ color: '#94A3B8' }}>{d.receiver_address}</p>
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
