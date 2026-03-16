import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'

// ── Static maps ───────────────────────────────────────────────────────────────

const STATUS_META = {
  RECEIVED:  { label: '접수',    cls: 'bg-blue-100 text-blue-700' },
  PICKING:   { label: '피킹중',  cls: 'bg-yellow-100 text-yellow-700' },
  PACKED:    { label: '패킹완료', cls: 'bg-orange-100 text-orange-700' },
  SHIPPED:   { label: '배송중',  cls: 'bg-purple-100 text-purple-700' },
  DELIVERED: { label: '배송완료', cls: 'bg-green-100 text-green-700' },
  CANCELLED: { label: '취소',    cls: 'bg-gray-100 text-gray-500' },
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const m = STATUS_META[status] || {}
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
  )
}

function ChannelBadge({ channel }) {
  const m = CHANNEL_META[channel] || {}
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
  )
}

function StatCard({ label, value, color }) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  }
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminOrderPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const fileRef = useRef()

  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState({ msg: '', type: 'success' })
  const [showModal, setShowModal] = useState(false)

  // Form state
  const [form, setForm] = useState({
    channel: 'SMARTSTORE', receiver_name: '', receiver_phone: '',
    receiver_address: '', total_amount: '', note: '',
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3000)
  }

  const fetchOrders = async () => {
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterChannel) params.set('channel', filterChannel)
    if (search) params.set('search', search)
    params.set('limit', '100')
    const res = await api.get(`/orders/?${params}`)
    setOrders(res.data.items)
    setTotal(res.data.total)
  }

  useEffect(() => { fetchOrders() }, [filterStatus, filterChannel, search])

  const handleLogout = () => { logout(); navigate('/login') }

  // Stats
  const count = (s) => orders.filter((o) => o.status === s).length
  const stats = [
    { label: '전체 주문', value: total, color: 'blue' },
    { label: '접수', value: count('RECEIVED'), color: 'yellow' },
    { label: '피킹중', value: count('PICKING'), color: 'yellow' },
    { label: '배송중', value: count('SHIPPED'), color: 'purple' },
  ]

  // Status change
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus })
      await fetchOrders()
      showToast('상태가 변경되었습니다.')
    } catch (err) {
      showToast(err.response?.data?.detail || '상태 변경 실패', 'error')
    }
  }

  // Manual order submit
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

  // CSV upload
  const handleCsvUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/orders/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      await fetchOrders()
      showToast(`CSV 업로드 완료: ${res.data.created}건 등록`)
    } catch (err) {
      showToast(err.response?.data?.detail || 'CSV 업로드 실패', 'error')
    }
    e.target.value = ''
  }

  return (
    <div className="min-h-screen bg-blue-50">
      {/* Navbar */}
      <nav className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/dashboard')} className="text-blue-200 hover:text-white text-sm">← 대시보드</button>
          <span className="text-xl font-bold">주문 관리</span>
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
            toast.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-700'
              : 'bg-green-50 border-green-300 text-green-700'
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
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">전체 상태</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>

            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">전체 채널</option>
              {ALL_CHANNELS.map((c) => (
                <option key={c} value={c}>{CHANNEL_META[c].label}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="주문번호 또는 수신자 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-56"
            />
          </div>

          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
            <button
              onClick={() => fileRef.current.click()}
              className="bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              CSV 업로드
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              + 수동 주문 등록
            </button>
          </div>
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
              {orders.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">주문이 없습니다.</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{o.order_number}</td>
                    <td className="px-4 py-3"><ChannelBadge channel={o.channel} /></td>
                    <td className="px-4 py-3 font-medium text-gray-800">{o.receiver_name}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{o.receiver_address}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      ₩{Number(o.total_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(o.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      {NEXT_STATUSES[o.status]?.length > 0 ? (
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) handleStatusChange(o.id, e.target.value)
                            e.target.value = ''
                          }}
                          className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
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
        <p className="text-xs text-gray-400 mt-2">총 {total}건</p>
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
  )
}
