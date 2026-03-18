import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useToastStore from '../../store/toastStore'
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

const NEXT_STATUSES = {
  RECEIVED:  ['PICKING', 'CANCELLED'],
  PICKING:   ['PACKED', 'CANCELLED'],
  PACKED:    ['SHIPPED'],
  SHIPPED:   ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

const ALL_STATUSES = Object.keys(STATUS_META)
const ALL_CHANNELS = Object.keys(CHANNEL_META)

function StatusBadge({ status }) {
  const m = STATUS_META[status] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function ChannelBadge({ channel }) {
  const m = CHANNEL_META[channel] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function StatCard({ label, value, color }) {
  const colorMap = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    green:  'bg-green-50 border-green-200 text-green-700',
  }
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  )
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

export default function AdminOrderPage() {
  const addToast = useToastStore((s) => s.addToast)
  const [searchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('filter') === 'pending' ? 'RECEIVED' : '')
  const [filterToday, setFilterToday] = useState(() => searchParams.get('filter') === 'today')
  const [filterChannel, setFilterChannel] = useState('')
  const [filterSeller, setFilterSeller] = useState('')
  const [sellers, setSellers] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [tick, setTick] = useState(0)
  const [notifs, setNotifs] = useState([])
  const [adminStats, setAdminStats] = useState(null)

  const [form, setForm] = useState({
    channel: 'SMARTSTORE', receiver_name: '', receiver_phone: '',
    receiver_address: '', total_amount: '', note: '',
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const showToast = (msg, type = 'success') => addToast(type, msg)

  const fetchOrders = async () => {
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterChannel) params.set('channel', filterChannel)
    if (filterSeller) params.set('seller_id', filterSeller)
    if (search) params.set('search', search)
    params.set('limit', '100')
    const res = await api.get(`/orders/?${params}`)
    setOrders(res.data.items)
    setTotal(res.data.total)
    setLastUpdated(Date.now())
  }

  useEffect(() => {
    api.get('/sellers/').then(r => setSellers(r.data)).catch(() => {})
    api.get('/stats/admin').then(r => setAdminStats(r.data)).catch(() => {})
    api.get('/notifications/?limit=3').then(r => setNotifs(r.data)).catch(() => {})
  }, [])

  const todayStr = new Date().toISOString().slice(0, 10)
  const displayedOrders = filterToday
    ? orders.filter(o => o.created_at && o.created_at.slice(0, 10) === todayStr)
    : orders

  useEffect(() => { fetchOrders() }, [filterStatus, filterChannel, filterSeller, search, tick])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000)
    return () => clearInterval(id)
  }, [])

  const count = (s) => orders.filter((o) => o.status === s).length
  const stats = [
    { label: '전체 주문', value: total, color: 'blue' },
    { label: '주문 접수', value: count('RECEIVED'), color: 'yellow' },
    { label: '출고 준비중', value: count('PICKING'), color: 'yellow' },
    { label: '출고 완료', value: count('SHIPPED'), color: 'purple' },
  ]

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus })
      await fetchOrders()
      showToast('상태가 변경되었습니다.')
    } catch (err) {
      showToast(err.response?.data?.detail || '상태 변경 실패', 'error')
    }
  }

  const handleFormChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleOrderSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.receiver_name || !form.receiver_phone || !form.receiver_address || !form.total_amount) {
      setFormError('필수 항목을 모두 입력하세요.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/orders/', {
        channel: form.channel,
        receiver_name: form.receiver_name,
        receiver_phone: form.receiver_phone,
        receiver_address: form.receiver_address,
        total_amount: parseFloat(form.total_amount),
        note: form.note || null,
        items: [],
      })
      setShowModal(false)
      setForm({ channel: 'SMARTSTORE', receiver_name: '', receiver_phone: '', receiver_address: '', total_amount: '', note: '' })
      await fetchOrders()
      showToast('주문이 등록되었습니다.')
    } catch (err) {
      setFormError(err.response?.data?.detail || '주문 등록 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const packedCount = count('PACKED')

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-blue-50">
        <div className="px-6 py-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            {stats.map((s) => <StatCard key={s.label} {...s} />)}
          </div>

          {/* Live bar */}
          <div className="flex items-center justify-between mb-4">
            <LiveIndicator />
            <LastUpdated time={lastUpdated} />
          </div>

          <div className="flex gap-4 items-start">
            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  {filterToday && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      오늘 주문
                      <button onClick={() => setFilterToday(false)} className="hover:text-blue-900 font-bold">×</button>
                    </span>
                  )}
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">전체 상태</option>
                    {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>
                  <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">전체 채널</option>
                    {ALL_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_META[c].label}</option>)}
                  </select>
                  <select value={filterSeller} onChange={(e) => setFilterSeller(e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">전체 셀러</option>
                    {sellers.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.company_name || s.email})</option>)}
                  </select>
                  <input type="text" placeholder="주문번호 또는 수신자 검색" value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-56" />
                </div>
                <button onClick={() => setShowModal(true)}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
                  + 수동 주문 등록
                </button>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-blue-100">
                <table className="w-full text-sm">
                  <thead className="bg-blue-700 text-white">
                    <tr>
                      {['주문번호', '채널', '수신자', '주소', '금액', '상태', '주문일시', '액션'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedOrders.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-10 text-gray-400">주문이 없습니다.</td></tr>
                    ) : (
                      displayedOrders.map((o) => (
                        <tr key={o.id} className="border-t border-gray-100 hover:bg-blue-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{o.order_number}</td>
                          <td className="px-4 py-3"><ChannelBadge channel={o.channel} /></td>
                          <td className="px-4 py-3 font-medium text-gray-800">{o.receiver_name}</td>
                          <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{o.receiver_address}</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">₩{Number(o.total_amount).toLocaleString()}</td>
                          <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {new Date(o.created_at).toLocaleString('ko-KR')}
                          </td>
                          <td className="px-4 py-3">
                            {NEXT_STATUSES[o.status]?.length > 0 ? (
                              <select defaultValue=""
                                onChange={(e) => { if (e.target.value) handleStatusChange(o.id, e.target.value); e.target.value = '' }}
                                className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300">
                                <option value="">상태변경</option>
                                {NEXT_STATUSES[o.status].map((s) => (
                                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">총 {filterToday ? displayedOrders.length : total}건{filterToday ? ' (오늘)' : ''}</p>
            </div>

            {/* Right panel */}
            <div className="w-72 shrink-0 space-y-3">
              <div className="bg-white rounded-xl border border-blue-100 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">출고 대기</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">패킹 완료 (출고 대기)</span>
                  <span className={`text-xl font-bold ${packedCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{packedCount}건</span>
                </div>
                {adminStats && (
                  <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                    <span className="text-sm text-gray-600">재고 부족 상품</span>
                    <span className={`text-xl font-bold ${adminStats.low_stock_count > 0 ? 'text-red-600' : 'text-gray-400'}`}>{adminStats.low_stock_count ?? '—'}개</span>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-blue-100 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">최근 알림</p>
                {notifs.length === 0 ? (
                  <p className="text-xs text-gray-400">알림이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {notifs.slice(0, 3).map((n, i) => (
                      <div key={n.id ?? i} className={`text-xs rounded-lg px-3 py-2 ${n.is_read ? 'bg-gray-50 text-gray-500' : 'bg-blue-50 text-blue-700'}`}>
                        <p className="font-semibold truncate">{n.title}</p>
                        <p className="truncate opacity-80">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-blue-100 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">채널별 현황</p>
                {Object.entries(CHANNEL_META).map(([key, meta]) => {
                  const c = orders.filter(o => o.channel === key).length
                  if (!c) return null
                  return (
                    <div key={key} className="flex items-center justify-between mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
                      <span className="text-sm font-medium text-gray-700">{c}건</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Manual order modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
              <h3 className="text-lg font-bold text-gray-800 mb-6">수동 주문 등록</h3>
              <form onSubmit={handleOrderSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">채널 *</label>
                  <select name="channel" value={form.channel} onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {ALL_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_META[c].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">수신자명 *</label>
                  <input type="text" name="receiver_name" value={form.receiver_name} onChange={handleFormChange}
                    placeholder="홍길동" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">연락처 *</label>
                  <input type="text" name="receiver_phone" value={form.receiver_phone} onChange={handleFormChange}
                    placeholder="010-0000-0000" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">주소 *</label>
                  <input type="text" name="receiver_address" value={form.receiver_address} onChange={handleFormChange}
                    placeholder="서울시 강남구..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">금액 *</label>
                  <input type="number" name="total_amount" value={form.total_amount} onChange={handleFormChange}
                    placeholder="0" min={0} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                  <textarea name="note" value={form.note} onChange={handleFormChange} rows={2}
                    placeholder="선택 입력" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                </div>
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2">{formError}</div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowModal(false); setFormError('') }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                    {submitting ? '등록 중...' : '주문 등록'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
