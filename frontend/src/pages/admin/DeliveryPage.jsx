import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
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

const NEXT_STATUSES = {
  READY:            ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT:       ['OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  DELIVERED:        [],
  FAILED:           [],
}

const ALL_STATUSES = Object.keys(STATUS_META)
const ALL_CARRIERS = Object.keys(CARRIER_META)

const INPUT_CLS = "px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"

function StatusBadge({ status }) {
  const m = STATUS_META[status] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function CarrierBadge({ carrier }) {
  const m = CARRIER_META[carrier] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function StatCard({ label, value, color }) {
  const iconCls = {
    blue:   'text-[#2563EB]',
    purple: 'text-[#7C3AED]',
    green:  'text-[#16A34A]',
    red:    'text-[#DC2626]',
  }
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <p className="text-[13px]" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-[28px] font-bold leading-tight mt-1" style={{ color: '#0F172A' }}>{value}</p>
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

function isDelayed(d) {
  if (!d.estimated_delivery) return false
  return (
    d.estimated_delivery < new Date().toISOString().slice(0, 10) &&
    d.status !== 'DELIVERED' && d.status !== 'FAILED'
  )
}

export default function AdminDeliveryPage() {
  const addToast = useToastStore((s) => s.addToast)

  const [deliveries, setDeliveries] = useState([])
  const [orders, setOrders] = useState([])
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCarrier, setFilterCarrier] = useState('')
  const [filterSeller, setFilterSeller] = useState('')
  const [sellers, setSellers] = useState([])
  const [search, setSearch] = useState('')
  const [showMap, setShowMap] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ order_id: '', carrier: 'CJ', tracking_number: '', estimated_delivery: '', note: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [tick, setTick] = useState(0)

  const showToast = (msg, type = 'success') => addToast(type, msg)

  const fetchDeliveries = async () => {
    const params = new URLSearchParams()
    if (filterSeller) params.set('seller_id', filterSeller)
    const res = await api.get(`/deliveries/?${params}`)
    setDeliveries(res.data)
    setLastUpdated(Date.now())
  }

  const fetchEligibleOrders = async () => {
    try {
      const res = await api.get('/orders/?limit=200')
      const deliveredOrderIds = new Set(deliveries.map((d) => d.order_id))
      const eligible = res.data.items.filter(
        (o) => ['PACKED', 'SHIPPED', 'RECEIVED', 'PICKING'].includes(o.status) && !deliveredOrderIds.has(o.id)
      )
      setOrders(eligible)
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    fetchDeliveries()
    api.get('/sellers/').then(r => setSellers(r.data)).catch(() => {})
  }, [])
  useEffect(() => { fetchDeliveries() }, [filterSeller, tick])
  useEffect(() => { if (deliveries.length >= 0) fetchEligibleOrders() }, [deliveries])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000)
    return () => clearInterval(id)
  }, [])

  const filtered = deliveries.filter((d) => {
    if (filterStatus && d.status !== filterStatus) return false
    if (filterCarrier && d.carrier !== filterCarrier) return false
    if (search) {
      const q = search.toLowerCase()
      if (!d.tracking_number.toLowerCase().includes(q) && !d.order_number.toLowerCase().includes(q)) return false
    }
    return true
  })

  const countStatus = (s) => deliveries.filter((d) => d.status === s).length
  const delayedCount = deliveries.filter(isDelayed).length
  const stats = [
    { label: '전체 배송', value: deliveries.length, color: 'blue' },
    { label: '이동중', value: countStatus('IN_TRANSIT') + countStatus('OUT_FOR_DELIVERY'), color: 'purple' },
    { label: '배송 완료', value: countStatus('DELIVERED'), color: 'green' },
    { label: '지연', value: delayedCount, color: 'red' },
  ]

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/deliveries/${id}/status`, { status })
      await fetchDeliveries()
      showToast('배송 상태가 변경되었습니다.')
    } catch (err) {
      showToast(err.response?.data?.detail || '상태 변경 실패', 'error')
    }
  }

  const handleFormChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.order_id || !form.tracking_number) { setFormError('주문과 운송장번호를 입력하세요.'); return }
    setSubmitting(true)
    try {
      await api.post('/deliveries/', {
        order_id: parseInt(form.order_id),
        tracking_number: form.tracking_number,
        carrier: form.carrier,
        estimated_delivery: form.estimated_delivery || null,
        note: form.note || null,
      })
      setShowModal(false)
      setForm({ order_id: '', carrier: 'CJ', tracking_number: '', estimated_delivery: '', note: '' })
      await fetchDeliveries()
      showToast('송장이 등록되었습니다.')
    } catch (err) {
      setFormError(err.response?.data?.detail || '송장 등록 실패')
    } finally {
      setSubmitting(false)
    }
  }

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

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setShowMap((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  showMap
                    ? 'bg-[#2563EB] text-white border-[#2563EB]'
                    : 'bg-white border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC]'
                }`}>
                🗺️ {showMap ? '지도 숨기기' : '지도 보기'}
              </button>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={INPUT_CLS}>
                <option value="">전체 상태</option>
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
              <select value={filterCarrier} onChange={(e) => setFilterCarrier(e.target.value)} className={INPUT_CLS}>
                <option value="">전체 택배사</option>
                {ALL_CARRIERS.map((c) => <option key={c} value={c}>{CARRIER_META[c].label}</option>)}
              </select>
              <select value={filterSeller} onChange={(e) => setFilterSeller(e.target.value)} className={INPUT_CLS}>
                <option value="">전체 셀러</option>
                {sellers.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.company_name || s.email})</option>)}
              </select>
              <input type="text" placeholder="운송장번호 또는 주문번호 검색" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${INPUT_CLS} w-60`} />
            </div>
            <button onClick={() => setShowModal(true)}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 py-2 rounded-[6px] text-sm font-semibold transition-colors">
              + 송장 등록
            </button>
          </div>

          {/* Map */}
          {showMap && (
            <div className="mb-4 rounded-xl overflow-hidden border border-[#E2E8F0] shadow-sm" style={{ height: 400 }}>
              <DeliveryMap deliveries={filtered} height={400} />
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['주문번호', '수신자', '주소', '택배사', '운송장번호', '상태', '예상배송일', '실제배송일', '액션'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>배송 데이터가 없습니다.</td></tr>
                ) : (
                  filtered.map((d) => (
                    <tr key={d.id}
                      className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors ${isDelayed(d) ? 'bg-[#FEF2F2]' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#374151' }}>{d.order_number}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{d.receiver_name}</td>
                      <td className="px-4 py-3 max-w-[160px] truncate" style={{ color: '#64748B' }}>{d.receiver_address}</td>
                      <td className="px-4 py-3"><CarrierBadge carrier={d.carrier} /></td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: '#64748B' }}>{d.tracking_number}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={d.status} />
                        {isDelayed(d) && <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-[#FEE2E2] text-[#991B1B] font-semibold">지연</span>}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{d.estimated_delivery || '—'}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{d.actual_delivery || '—'}</td>
                      <td className="px-4 py-3">
                        {NEXT_STATUSES[d.status]?.length > 0 ? (
                          <select defaultValue=""
                            onChange={(e) => { if (e.target.value) handleStatusChange(d.id, e.target.value); e.target.value = '' }}
                            className="px-2 py-1 border border-[#E2E8F0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30">
                            <option value="">상태변경</option>
                            {NEXT_STATUSES[d.status].map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                          </select>
                        ) : <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>총 {filtered.length}건 (전체 {deliveries.length}건)</p>
        </div>

        {/* Registration modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
              <h3 className="text-lg font-bold mb-6" style={{ color: '#0F172A' }}>송장 등록</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>주문 선택 *</label>
                  <select name="order_id" value={form.order_id} onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]">
                    <option value="">주문을 선택하세요</option>
                    {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number} — {o.receiver_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>택배사 *</label>
                  <select name="carrier" value={form.carrier} onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]">
                    {ALL_CARRIERS.map((c) => <option key={c} value={c}>{CARRIER_META[c].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>운송장번호 *</label>
                  <input type="text" name="tracking_number" value={form.tracking_number} onChange={handleFormChange}
                    placeholder="예: CJ202603160001"
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>예상배송일</label>
                  <input type="date" name="estimated_delivery" value={form.estimated_delivery} onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>메모</label>
                  <textarea name="note" value={form.note} onChange={handleFormChange} rows={2}
                    placeholder="선택 입력"
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] resize-none" />
                </div>
                {formError && <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm rounded-lg px-4 py-2">{formError}</div>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowModal(false); setFormError('') }}
                    className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-[6px] text-sm text-[#374151] hover:bg-[#F8FAFC] transition-colors">취소</button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-[6px] text-sm font-semibold transition-colors disabled:opacity-50">
                    {submitting ? '등록 중...' : '송장 등록'}
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
