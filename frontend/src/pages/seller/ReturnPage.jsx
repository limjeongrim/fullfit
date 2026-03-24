import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const STATUS_META = {
  REQUESTED: { label: '접수',        cls: 'bg-[#F1F5F9] text-[#64748B]' },
  IN_REVIEW:  { label: '검수중',      cls: 'bg-[#FEF9C3] text-[#854D0E]' },
  RESTOCKED:  { label: '재입고 완료', cls: 'bg-[#DCFCE7] text-[#166534]' },
  DISPOSED:   { label: '폐기 완료',   cls: 'bg-[#FEE2E2] text-[#991B1B]' },
}

const RECOVERY_STATUS = {
  REQUESTED: { label: '회수 대기', cls: 'bg-[#F1F5F9] text-[#64748B]' },
  IN_REVIEW:  { label: '검수 중',  cls: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  RESTOCKED:  { label: '처리 완료', cls: 'bg-[#DCFCE7] text-[#166534]' },
  DISPOSED:   { label: '처리 완료', cls: 'bg-[#DCFCE7] text-[#166534]' },
}

const REASON_OPTIONS = [
  { value: 'CHANGE_OF_MIND', label: '고객 변심' },
  { value: 'DEFECTIVE',      label: '상품 불량' },
  { value: 'WRONG_ITEM',     label: '오배송' },
  { value: 'DAMAGED',        label: '파손' },
  { value: 'OTHER',          label: '기타' },
]

const REASON_LABEL = Object.fromEntries(REASON_OPTIONS.map(o => [o.value, o.label]))

const COST_ATTRIBUTION = {
  CHANGE_OF_MIND: '구매자 부담',
  DEFECTIVE:      '판매자 부담',
  DAMAGED:        '판매자 부담',
  WRONG_ITEM:     '판매자 부담',
  OTHER:          '확인 중',
}

const INPUT_CLS = "w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"

function StatusBadge({ status, meta }) {
  const m = meta[status] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function ResultBadge({ status }) {
  if (status === 'RESTOCKED') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534]">재입고 완료</span>
  if (status === 'DISPOSED')  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#991B1B]">폐기 완료</span>
  return <span className="text-xs" style={{ color: '#94A3B8' }}>—</span>
}

export default function SellerReturnPage() {
  const addToast = useToastStore((s) => s.addToast)

  const [returns, setReturns] = useState([])
  const [deliveredOrders, setDeliveredOrders] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ order_id: '', reason: '', note: '' })
  const [selectedOrderItems, setSelectedOrderItems] = useState([])
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchReturns = async () => {
    try {
      const res = await api.get('/returns/seller')
      setReturns(res.data)
    } catch (e) { console.error(e) }
  }

  const fetchDeliveredOrders = async () => {
    try {
      const res = await api.get('/orders/seller')
      const delivered = (res.data.items || res.data).filter((o) => o.status === 'DELIVERED')
      setDeliveredOrders(delivered)
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    fetchReturns()
    fetchDeliveredOrders()
  }, [])

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    if (name === 'order_id') {
      const order = deliveredOrders.find(o => String(o.id) === value)
      setSelectedOrderItems(order?.items || [])
    }
  }

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
      setSelectedOrderItems([])
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
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold" style={{ color: '#0F172A' }}>반품 관리</h2>
              <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>총 {returns.length}건</p>
            </div>
            <button
              onClick={() => { setShowModal(true); setFormError('') }}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 py-2 rounded-[6px] text-sm font-semibold transition-colors"
            >
              + 반품 신청
            </button>
          </div>

          <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['신청일', '주문번호', '상품 / SKU / 수량', '반품 사유', '회수 상태', '검수 결과', '센터 메모', '처리 결과', '비용 귀속'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>반품 내역이 없습니다.</td>
                  </tr>
                ) : (
                  returns.map((r) => (
                    <tr key={r.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                        {new Date(r.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#374151' }}>
                        {r.order_number}
                      </td>
                      <td className="px-4 py-3 min-w-[160px]">
                        {r.items?.length > 0 ? (
                          <div className="space-y-1">
                            {r.items.map((it, i) => (
                              <div key={i} className="text-xs">
                                <span className="font-medium" style={{ color: '#0F172A' }}>{it.product_name}</span>
                                <span className="ml-1 font-mono" style={{ color: '#94A3B8' }}>{it.sku}</span>
                                <span className="ml-1" style={{ color: '#64748B' }}>×{it.quantity}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#64748B' }}>
                        {REASON_LABEL[r.reason] || r.reason}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} meta={RECOVERY_STATUS} />
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[140px] truncate" title={r.inspection_note || ''} style={{ color: '#64748B' }}>
                        {r.inspection_note || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[140px] truncate" title={r.note || ''} style={{ color: '#64748B' }}>
                        {r.note || '—'}
                      </td>
                      <td className="px-4 py-3"><ResultBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                        {COST_ATTRIBUTION[r.reason] || '확인 중'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Return request modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between">
                <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>반품 신청</h3>
                <button onClick={() => { setShowModal(false); setFormError('') }}
                  className="text-2xl leading-none" style={{ color: '#94A3B8' }}>×</button>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>주문번호 선택 *</label>
                  <select name="order_id" value={form.order_id} onChange={handleFormChange} className={INPUT_CLS}>
                    <option value="">배송완료된 주문을 선택하세요</option>
                    {deliveredOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.order_number} — {o.receiver_name}
                      </option>
                    ))}
                  </select>
                  {deliveredOrders.length === 0 && (
                    <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>배송완료된 주문이 없습니다.</p>
                  )}
                </div>

                {selectedOrderItems.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>주문 상품</label>
                    <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-[#F8FAFC]">
                          <tr>
                            {['상품명', 'SKU', '수량'].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: '#64748B' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrderItems.map((it, i) => (
                            <tr key={i} className="border-t border-[#F1F5F9]">
                              <td className="px-3 py-2" style={{ color: '#0F172A' }}>{it.product_name}</td>
                              <td className="px-3 py-2 font-mono" style={{ color: '#64748B' }}>{it.sku || '—'}</td>
                              <td className="px-3 py-2" style={{ color: '#374151' }}>{it.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>반품 사유 *</label>
                  <select name="reason" value={form.reason} onChange={handleFormChange} className={INPUT_CLS}>
                    <option value="">사유를 선택하세요</option>
                    {REASON_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>상세 사유</label>
                  <textarea
                    name="note" value={form.note} onChange={handleFormChange} rows={3}
                    placeholder="반품 사유를 상세히 입력하세요 (선택)"
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] resize-none"
                  />
                </div>

                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-xs" style={{ color: '#64748B' }}>
                  📸 <span className="font-medium">사진 첨부 안내:</span> 실제 사진은 담당 AM에게 채팅으로 전달해주세요.
                </div>

                {formError && (
                  <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm rounded-lg px-4 py-2">
                    {formError}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setFormError('') }}
                    className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-[6px] text-sm hover:bg-[#F8FAFC] transition-colors"
                    style={{ color: '#374151' }}
                  >
                    취소
                  </button>
                  <button
                    type="submit" disabled={submitting}
                    className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-[6px] text-sm font-semibold transition-colors disabled:opacity-50"
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
