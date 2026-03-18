import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const STATUS_META = {
  REQUESTED: { label: '접수',   cls: 'bg-blue-100 text-blue-700' },
  IN_REVIEW:  { label: '검수중', cls: 'bg-yellow-100 text-yellow-700' },
  RESTOCKED:  { label: '재입고', cls: 'bg-green-100 text-green-700' },
  DISPOSED:   { label: '폐기',   cls: 'bg-gray-100 text-gray-500' },
}

const REASON_OPTIONS = [
  { value: 'DEFECTIVE',      label: '상품 불량' },
  { value: 'WRONG_ITEM',     label: '오배송' },
  { value: 'CHANGE_OF_MIND', label: '단순 변심' },
  { value: 'OTHER',          label: '기타' },
]

function StatusBadge({ status }) {
  const m = STATUS_META[status] || {}
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
  )
}

export default function SellerReturnPage() {
  const addToast = useToastStore((s) => s.addToast)

  const [returns, setReturns] = useState([])
  const [deliveredOrders, setDeliveredOrders] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ order_id: '', reason: '', note: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchReturns = async () => {
    try {
      const res = await api.get('/returns/seller')
      setReturns(res.data)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchDeliveredOrders = async () => {
    try {
      const res = await api.get('/orders/seller')
      const delivered = (res.data.items || res.data).filter((o) => o.status === 'DELIVERED')
      setDeliveredOrders(delivered)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchReturns()
    fetchDeliveredOrders()
  }, [])

  const handleFormChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.order_id || !form.reason) {
      setFormError('주문과 반품 사유를 선택하세요.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/returns/', {
        order_id: parseInt(form.order_id),
        reason: form.reason,
        note: form.note || null,
      })
      setShowModal(false)
      setForm({ order_id: '', reason: '', note: '' })
      await fetchReturns()
      addToast('success', '반품 신청이 완료되었습니다.')
    } catch (err) {
      const msg = err.response?.data?.detail || '반품 신청 실패'
      setFormError(msg)
      addToast('error', msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-purple-50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex justify-end mb-5">
            <button
              onClick={() => { setShowModal(true); setFormError('') }}
              className="bg-purple-700 hover:bg-purple-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              + 반품 신청
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-purple-100">
            <table className="w-full text-sm">
              <thead className="bg-purple-700 text-white">
                <tr>
                  {['주문번호', '반품사유', '상태', '접수일', '검수 메모', '상세내용'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400">반품 내역이 없습니다.</td>
                  </tr>
                ) : (
                  returns.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-purple-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{r.order_number}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {REASON_OPTIONS.find((o) => o.value === r.reason)?.label || r.reason}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                        {r.inspection_note || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                        {r.note || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">총 {returns.length}건</p>
        </div>

        {/* Return request modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
              <h3 className="text-lg font-bold text-gray-800 mb-6">반품 신청</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">주문 선택 *</label>
                  <select
                    name="order_id"
                    value={form.order_id}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <option value="">배송완료된 주문을 선택하세요</option>
                    {deliveredOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.order_number} — {o.receiver_name}
                      </option>
                    ))}
                  </select>
                  {deliveredOrders.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">배송완료된 주문이 없습니다.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">반품 사유 *</label>
                  <select
                    name="reason"
                    value={form.reason}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <option value="">사유를 선택하세요</option>
                    {REASON_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">상세 내용</label>
                  <textarea
                    name="note"
                    value={form.note}
                    onChange={handleFormChange}
                    rows={3}
                    placeholder="반품 사유를 상세히 입력하세요 (선택)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                  />
                </div>

                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2">
                    {formError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setFormError('') }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {submitting ? '신청 중...' : '반품 신청'}
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
