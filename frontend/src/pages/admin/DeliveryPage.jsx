import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'

// ── Static maps ───────────────────────────────────────────────────────────────

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

const NEXT_STATUSES = {
  READY:            ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT:       ['OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  DELIVERED:        [],
  FAILED:           [],
}

const ALL_STATUSES  = Object.keys(STATUS_META)
const ALL_CARRIERS  = Object.keys(CARRIER_META)

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const m = STATUS_META[status] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function CarrierBadge({ carrier }) {
  const m = CARRIER_META[carrier] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function StatCard({ label, value, color }) {
  const map = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    red:    'bg-red-50 border-red-200 text-red-700',
  }
  return (
    <div className={`rounded-xl border p-4 ${map[color]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  )
}

function isDelayed(d) {
  if (!d.estimated_delivery) return false
  return (
    d.estimated_delivery < new Date().toISOString().slice(0, 10) &&
    d.status !== 'DELIVERED' &&
    d.status !== 'FAILED'
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminDeliveryPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const [deliveries, setDeliveries] = useState([])
  const [orders, setOrders] = useState([])       // PACKED/SHIPPED orders without delivery
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCarrier, setFilterCarrier] = useState('')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState({ msg: '', type: 'success' })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ order_id: '', carrier: 'CJ', tracking_number: '', estimated_delivery: '', note: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3000)
  }

  const fetchDeliveries = async () => {
    const res = await api.get('/deliveries/')
    setDeliveries(res.data)
  }

  // Fetch orders eligible for delivery registration (PACKED or SHIPPED, no delivery yet)
  const fetchEligibleOrders = async () => {
    try {
      const res = await api.get('/orders/?limit=200')
      const deliveredOrderIds = new Set(deliveries.map((d) => d.order_id))
      const eligible = res.data.items.filter(
        (o) => ['PACKED', 'SHIPPED', 'RECEIVED', 'PICKING'].includes(o.status) &&
                !deliveredOrderIds.has(o.id)
      )
      setOrders(eligible)
    } catch (e) { console.error(e) }
  }

  useEffect(() => { fetchDeliveries() }, [])
  useEffect(() => { if (deliveries.length >= 0) fetchEligibleOrders() }, [deliveries])

  const handleLogout = () => { logout(); navigate('/login') }

  // Filtered view
  const filtered = deliveries.filter((d) => {
    if (filterStatus && d.status !== filterStatus) return false
    if (filterCarrier && d.carrier !== filterCarrier) return false
    if (search) {
      const q = search.toLowerCase()
      if (!d.tracking_number.toLowerCase().includes(q) && !d.order_number.toLowerCase().includes(q))
        return false
    }
    return true
  })

  // Stats
  const countStatus = (s) => deliveries.filter((d) => d.status === s).length
  const delayedCount = deliveries.filter(isDelayed).length
  const stats = [
    { label: '전체 배송', value: deliveries.length, color: 'blue' },
    { label: '배송중', value: countStatus('IN_TRANSIT') + countStatus('OUT_FOR_DELIVERY'), color: 'purple' },
    { label: '배송완료', value: countStatus('DELIVERED'), color: 'green' },
    { label: '지연', value: delayedCount, color: 'red' },
  ]

  // Status change
  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/deliveries/${id}/status`, { status })
      await fetchDeliveries()
      showToast('배송 상태가 변경되었습니다.')
    } catch (err) {
      showToast(err.response?.data?.detail || '상태 변경 실패', 'error')
    }
  }

  // Delivery registration
  const handleFormChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.order_id || !form.tracking_number) {
      setFormError('주문과 운송장번호를 입력하세요.')
      return
    }
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
    <div className="min-h-screen bg-blue-50">
      {/* Navbar */}
      <nav className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/dashboard')} className="text-blue-200 hover:text-white text-sm">← 대시보드</button>
          <span className="text-xl font-bold">배송 관리</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-blue-100">{user?.email}</span>
          <button onClick={handleLogout} className="bg-blue-900 hover:bg-blue-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">로그아웃</button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Toast */}
        {toast.msg && (
          <div className={`mb-4 rounded-xl px-5 py-3 font-medium border ${
            toast.type === 'error' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-green-50 border-green-300 text-green-700'
          }`}>
            {toast.type === 'error' ? '⚠️' : '✅'} {toast.msg}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
          {stats.map((s) => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">전체 상태</option>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
            <select value={filterCarrier} onChange={(e) => setFilterCarrier(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">전체 택배사</option>
              {ALL_CARRIERS.map((c) => <option key={c} value={c}>{CARRIER_META[c].label}</option>)}
            </select>
            <input type="text" placeholder="운송장번호 또는 주문번호 검색" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-60" />
          </div>
          <button onClick={() => setShowModal(true)}
            className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
            + 송장 등록
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-blue-100">
          <table className="w-full text-sm">
            <thead className="bg-blue-700 text-white">
              <tr>
                {['주문번호', '수신자', '주소', '택배사', '운송장번호', '상태', '예상배송일', '실제배송일', '액션'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">배송 데이터가 없습니다.</td></tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id}
                    className={`border-t border-gray-100 hover:bg-blue-50 transition-colors ${isDelayed(d) ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{d.order_number}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{d.receiver_name}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{d.receiver_address}</td>
                    <td className="px-4 py-3"><CarrierBadge carrier={d.carrier} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{d.tracking_number}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.status} />
                      {isDelayed(d) && (
                        <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-red-200 text-red-700 font-semibold">지연</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {d.estimated_delivery || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {d.actual_delivery || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {NEXT_STATUSES[d.status]?.length > 0 ? (
                        <select defaultValue=""
                          onChange={(e) => { if (e.target.value) handleStatusChange(d.id, e.target.value); e.target.value = '' }}
                          className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300">
                          <option value="">상태변경</option>
                          {NEXT_STATUSES[d.status].map((s) => (
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
        <p className="text-xs text-gray-400 mt-2">총 {filtered.length}건 (전체 {deliveries.length}건)</p>
      </div>

      {/* Registration modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
            <h3 className="text-lg font-bold text-gray-800 mb-6">송장 등록</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주문 선택 *</label>
                <select name="order_id" value={form.order_id} onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">주문을 선택하세요</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} — {o.receiver_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">택배사 *</label>
                <select name="carrier" value={form.carrier} onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {ALL_CARRIERS.map((c) => <option key={c} value={c}>{CARRIER_META[c].label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">운송장번호 *</label>
                <input type="text" name="tracking_number" value={form.tracking_number} onChange={handleFormChange}
                  placeholder="예: CJ202603160001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">예상배송일</label>
                <input type="date" name="estimated_delivery" value={form.estimated_delivery} onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                <textarea name="note" value={form.note} onChange={handleFormChange} rows={2}
                  placeholder="선택 입력"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </div>
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2">{formError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setFormError('') }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                  {submitting ? '등록 중...' : '송장 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
