import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const STATUS_META = {
  RECEIVED:  { label: '주문 접수',  cls: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  PICKING:   { label: '출고 준비중', cls: 'bg-[#FEF9C3] text-[#854D0E]' },
  PACKED:    { label: '패킹 완료',  cls: 'bg-[#FED7AA] text-[#9A3412]' },
  SHIPPED:   { label: '출고 완료',  cls: 'bg-[#E0E7FF] text-[#3730A3]' },
  DELIVERED: { label: '배송 완료',  cls: 'bg-[#DCFCE7] text-[#166534]' },
  CANCELLED: { label: '취소',      cls: 'bg-[#F1F5F9] text-[#64748B]' },
}

const CHANNEL_META = {
  SMARTSTORE: { label: '스마트스토어', cls: 'bg-[#DCFCE7] text-[#166534]' },
  OLIVEYOUNG: { label: '올리브영',    cls: 'bg-[#FEF3C7] text-[#92400E]' },
  ZIGZAG:     { label: '지그재그',    cls: 'bg-[#FDF4FF] text-[#7E22CE]' },
  CAFE24:     { label: '카페24',      cls: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  MANUAL:     { label: '수동',        cls: 'bg-[#F1F5F9] text-[#64748B]' },
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
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>{m.label}</span>
}

function ChannelBadge({ channel }) {
  const m = CHANNEL_META[channel] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>{m.label}</span>
}

function StatCard({ label, value, color }) {
  const numCls = {
    blue:   'text-[#2563EB]',
    yellow: 'text-[#D97706]',
    purple: 'text-[#7C3AED]',
    green:  'text-[#16A34A]',
  }
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <p className="text-[13px] mb-1" style={{ color: '#64748B' }}>{label}</p>
      <p className={`text-[28px] font-bold leading-tight ${numCls[color] || 'text-[#0F172A]'}`}>{value}</p>
    </div>
  )
}

function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-60"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#16A34A]"></span>
      </span>
      <span className="text-xs" style={{ color: '#64748B' }}>실시간</span>
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
  const INPUT_CLS = "w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
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
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#DBEAFE] text-[#1D4ED8] rounded-full text-xs font-medium">
                      오늘 주문
                      <button onClick={() => setFilterToday(false)} className="hover:text-[#1E3A8A] font-bold">×</button>
                    </span>
                  )}
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 bg-white">
                    <option value="">전체 상태</option>
                    {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>
                  <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)}
                    className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 bg-white">
                    <option value="">전체 채널</option>
                    {ALL_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_META[c].label}</option>)}
                  </select>
                  <select value={filterSeller} onChange={(e) => setFilterSeller(e.target.value)}
                    className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 bg-white">
                    <option value="">전체 셀러</option>
                    {sellers.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.company_name || s.email})</option>)}
                  </select>
                  <input type="text" placeholder="주문번호 또는 수신자 검색" value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 w-56 bg-white" />
                </div>
                <button onClick={() => setShowModal(true)}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 py-2 rounded-[6px] text-sm font-semibold transition-colors">
                  + 수동 주문 등록
                </button>
              </div>

              {/* Table */}
              <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <table className="w-full text-sm">
                  <thead className="bg-[#F8FAFC]">
                    <tr>
                      {['주문번호', '채널', '수신자', '주소', '금액', '상태', '주문일시', '액션'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedOrders.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>주문이 없습니다.</td></tr>
                    ) : (
                      displayedOrders.map((o) => (
                        <tr key={o.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                          <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{o.order_number}</td>
                          <td className="px-4 py-3"><ChannelBadge channel={o.channel} /></td>
                          <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{o.receiver_name}</td>
                          <td className="px-4 py-3 max-w-[180px] truncate" style={{ color: '#64748B' }}>{o.receiver_address}</td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#374151' }}>₩{Number(o.total_amount).toLocaleString()}</td>
                          <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                            {new Date(o.created_at).toLocaleString('ko-KR')}
                          </td>
                          <td className="px-4 py-3">
                            {NEXT_STATUSES[o.status]?.length > 0 ? (
                              <select defaultValue=""
                                onChange={(e) => { if (e.target.value) handleStatusChange(o.id, e.target.value); e.target.value = '' }}
                                className="px-2 py-1 border border-[#E2E8F0] rounded-lg text-xs focus:outline-none bg-white">
                                <option value="">상태변경</option>
                                {NEXT_STATUSES[o.status].map((s) => (
                                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>총 {filterToday ? displayedOrders.length : total}건{filterToday ? ' (오늘)' : ''}</p>
            </div>

            {/* Right panel */}
            <div className="w-72 shrink-0 space-y-3">
              <div className="bg-white rounded-lg border border-[#E2E8F0] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>출고 대기</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#64748B' }}>패킹 완료 (출고 대기)</span>
                  <span className={`text-xl font-bold ${packedCount > 0 ? 'text-[#D97706]' : 'text-[#CBD5E1]'}`}>{packedCount}건</span>
                </div>
                {adminStats && (
                  <div className="mt-2 flex items-center justify-between border-t border-[#F1F5F9] pt-2">
                    <span className="text-sm" style={{ color: '#64748B' }}>재고 부족 상품</span>
                    <span className={`text-xl font-bold ${adminStats.low_stock_count > 0 ? 'text-[#DC2626]' : 'text-[#CBD5E1]'}`}>{adminStats.low_stock_count ?? '—'}개</span>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-[#E2E8F0] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>최근 알림</p>
                {notifs.length === 0 ? (
                  <p className="text-xs" style={{ color: '#94A3B8' }}>알림이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {notifs.slice(0, 3).map((n, i) => (
                      <div key={n.id ?? i} className={`text-xs rounded-lg px-3 py-2 ${n.is_read ? 'bg-[#F8FAFC] text-[#64748B]' : 'bg-[#DBEAFE] text-[#1D4ED8]'}`}>
                        <p className="font-semibold truncate">{n.title}</p>
                        <p className="truncate opacity-80">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-[#E2E8F0] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>채널별 현황</p>
                {Object.entries(CHANNEL_META).map(([key, meta]) => {
                  const c = orders.filter(o => o.channel === key).length
                  if (!c) return null
                  return (
                    <div key={key} className="flex items-center justify-between mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                      <span className="text-sm font-medium" style={{ color: '#374151' }}>{c}건</span>
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
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl w-full max-w-md mx-4 p-8">
              <h3 className="text-lg font-bold mb-6" style={{ color: '#0F172A' }}>수동 주문 등록</h3>
              <form onSubmit={handleOrderSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>채널 *</label>
                  <select name="channel" value={form.channel} onChange={handleFormChange} className={INPUT_CLS}>
                    {ALL_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_META[c].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>수신자명 *</label>
                  <input type="text" name="receiver_name" value={form.receiver_name} onChange={handleFormChange}
                    placeholder="홍길동" className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>연락처 *</label>
                  <input type="text" name="receiver_phone" value={form.receiver_phone} onChange={handleFormChange}
                    placeholder="010-0000-0000" className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>주소 *</label>
                  <input type="text" name="receiver_address" value={form.receiver_address} onChange={handleFormChange}
                    placeholder="서울시 강남구..." className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>금액 *</label>
                  <input type="number" name="total_amount" value={form.total_amount} onChange={handleFormChange}
                    placeholder="0" min={0} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>메모</label>
                  <textarea name="note" value={form.note} onChange={handleFormChange} rows={2}
                    placeholder="선택 입력" className={`${INPUT_CLS} resize-none`} />
                </div>
                {formError && (
                  <div className="bg-[#FEE2E2] border border-red-200 text-[#991B1B] text-sm rounded-lg px-4 py-2">{formError}</div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowModal(false); setFormError('') }}
                    className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-[6px] text-sm text-[#374151] hover:bg-[#F8FAFC] transition-colors">취소</button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-[6px] text-sm font-semibold transition-colors disabled:opacity-50">
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
