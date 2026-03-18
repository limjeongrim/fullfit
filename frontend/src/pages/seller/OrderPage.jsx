import { useEffect, useState } from 'react'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const STATUS_META = {
  RECEIVED:  { label: '주문 접수',  cls: 'bg-blue-100 text-blue-700' },
  PICKING:   { label: '출고 준비중', cls: 'bg-yellow-100 text-yellow-700' },
  PACKED:    { label: '패킹 완료',  cls: 'bg-orange-100 text-orange-700' },
  SHIPPED:   { label: '출고 완료',  cls: 'bg-purple-100 text-purple-700' },
  DELIVERED: { label: '배송 완료',  cls: 'bg-green-100 text-green-700' },
  CANCELLED: { label: '취소',      cls: 'bg-gray-100 text-gray-500' },
}

const CHANNEL_META = {
  SMARTSTORE: { label: '스마트스토어', cls: 'bg-green-100 text-green-700' },
  OLIVEYOUNG: { label: '올리브영',    cls: 'bg-orange-100 text-orange-700' },
  ZIGZAG:     { label: '지그재그',    cls: 'bg-pink-100 text-pink-700' },
  CAFE24:     { label: '카페24',      cls: 'bg-blue-100 text-blue-700' },
  MANUAL:     { label: '수동',        cls: 'bg-gray-100 text-gray-500' },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function ChannelBadge({ channel }) {
  const m = CHANNEL_META[channel] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
      <span className="text-xs text-green-600 font-medium">실시간</span>
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
  return <span className="text-xs text-gray-400">마지막 업데이트: {display}</span>
}

export default function SellerOrderPage() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [search, setSearch] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [tick, setTick] = useState(0)

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterChannel) params.set('channel', filterChannel)
      if (search) params.set('search', search)
      params.set('limit', '100')
      const res = await api.get(`/orders/seller?${params}`)
      setOrders(res.data.items)
      setTotal(res.data.total)
      setLastUpdated(Date.now())
    } catch (e) { console.error(e) }
  }

  useEffect(() => { fetchOrders() }, [filterStatus, filterChannel, search, tick])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000)
    return () => clearInterval(id)
  }, [])

  const count = (s) => orders.filter((o) => o.status === s).length

  // Channel breakdown for right panel
  const channelBreakdown = Object.entries(CHANNEL_META).map(([key, meta]) => ({
    key, label: meta.label, count: orders.filter(o => o.channel === key).length,
  })).filter(c => c.count > 0)

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-purple-50">
        <div className="px-6 py-6 flex gap-5">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Live bar */}
            <div className="flex items-center justify-between mb-4">
              <LiveIndicator />
              <LastUpdated time={lastUpdated} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              {[
                { label: '전체 주문',    value: total,                                                    color: 'bg-purple-50 border-purple-200 text-purple-700' },
                { label: '접수/처리중',  value: count('RECEIVED') + count('PICKING') + count('PACKED'),  color: 'bg-blue-50 border-blue-200 text-blue-700' },
                { label: '배송 완료',    value: count('DELIVERED'),                                       color: 'bg-green-50 border-green-200 text-green-700' },
                { label: '취소',         value: count('CANCELLED'),                                       color: 'bg-gray-50 border-gray-200 text-gray-600' },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                  <p className="text-sm font-medium opacity-80">{s.label}</p>
                  <p className="text-3xl font-bold mt-1">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                <option value="">전체 상태</option>
                {Object.entries(STATUS_META).map(([s, m]) => (
                  <option key={s} value={s}>{m.label}</option>
                ))}
              </select>
              <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                <option value="">전체 채널</option>
                {Object.entries(CHANNEL_META).map(([c, m]) => (
                  <option key={c} value={c}>{m.label}</option>
                ))}
              </select>
              <input type="text" placeholder="주문번호 또는 수신자 검색" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 w-56" />
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-purple-100">
              <table className="w-full text-sm">
                <thead className="bg-purple-700 text-white">
                  <tr>
                    {['주문번호', '채널', '수신자', '주소', '금액', '상태', '주문일시'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400">주문이 없습니다.</td></tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id} className="border-t border-gray-100 hover:bg-purple-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{o.order_number}</td>
                        <td className="px-4 py-3"><ChannelBadge channel={o.channel} /></td>
                        <td className="px-4 py-3 font-medium text-gray-800">{o.receiver_name}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{o.receiver_address}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">₩{Number(o.total_amount).toLocaleString()}</td>
                        <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(o.created_at).toLocaleString('ko-KR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">총 {total}건</p>
          </div>

          {/* Right panel */}
          <div className="w-64 shrink-0 space-y-4">
            <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">처리 현황</h4>
              <div className="space-y-2">
                {[
                  { label: '주문 접수',   value: count('RECEIVED'),  cls: 'text-blue-700' },
                  { label: '출고 준비중', value: count('PICKING'),   cls: 'text-yellow-600' },
                  { label: '패킹 완료',  value: count('PACKED'),    cls: 'text-orange-600' },
                  { label: '출고 완료',  value: count('SHIPPED'),   cls: 'text-purple-700' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{s.label}</span>
                    <span className={`text-sm font-bold ${s.cls}`}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {channelBreakdown.length > 0 && (
              <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">채널별 주문</h4>
                <div className="space-y-2">
                  {channelBreakdown.map(c => (
                    <div key={c.key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{c.label}</span>
                      <span className="text-sm font-bold text-gray-800">{c.count}건</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
