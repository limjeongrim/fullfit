import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const INPUT_CLS = "w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"

function ScheduleBadge({ schedule, onConfirm }) {
  if (!schedule) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F1F5F9] text-[#64748B]">
        스케줄 배정 대기중
      </span>
    )
  }

  const statusMap = {
    SCHEDULED: { cls: 'bg-[#EFF6FF] text-[#1D4ED8]', label: '배정됨' },
    CONFIRMED: { cls: 'bg-[#F0FDF4] text-[#15803D]', label: '확정' },
    COMPLETED: { cls: 'bg-[#F8FAFC] text-[#475569]', label: '완료' },
    CANCELLED: { cls: 'bg-[#FEF2F2] text-[#DC2626]', label: '취소' },
  }
  const { cls, label } = statusMap[schedule.status] || statusMap.SCHEDULED

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[#0F172A]">
        {schedule.scheduled_date} {schedule.time_slot}
      </span>
      <span className="text-xs text-[#64748B]">도크 {schedule.dock_number}번</span>
      <div className="flex items-center gap-1.5">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
        {schedule.status === 'SCHEDULED' && (
          <button
            onClick={() => onConfirm(schedule.id)}
            className="text-xs text-[#2563EB] hover:underline font-medium"
          >
            확정
          </button>
        )}
      </div>
    </div>
  )
}

export default function SellerInboundRequestPage() {
  const addToast  = useToastStore((s) => s.addToast)
  const user      = useAuthStore((s) => s.user)
  const [products, setProducts]   = useState([])
  const [history, setHistory]     = useState([])
  const [schedules, setSchedules] = useState([])   // seller's upcoming schedules
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [formError, setFormError]   = useState('')
  const [form, setForm] = useState({
    product_id: '',
    quantity: '',
    expected_arrival: '',
    lot_number: '',
    expiry_date: '',
    note: '',
  })

  const fetchProducts  = () => api.get('/products/seller').then(r => setProducts(r.data)).catch(() => {})
  const fetchHistory   = () => api.get('/inventory/inbound/seller').then(r => setHistory(r.data)).catch(() => {})
  const fetchSchedules = () => {
    if (!user?.id) return
    api.get(`/inbound-schedule/seller/${user.id}`).then(r => setSchedules(r.data)).catch(() => {})
  }

  useEffect(() => {
    fetchProducts()
    fetchHistory()
  }, [])

  useEffect(() => {
    if (user?.id) fetchSchedules()
  }, [user?.id])

  // Build map: inbound_id → schedule
  const scheduleByInbound = {}
  for (const s of schedules) {
    scheduleByInbound[s.inbound_id] = s
  }

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSuccessMsg('')
    if (!form.product_id || !form.quantity || !form.lot_number || !form.expiry_date) {
      setFormError('필수 항목을 모두 입력하세요.')
      return
    }
    setSubmitting(true)
    try {
      const noteLines = []
      if (form.expected_arrival) noteLines.push(`예상 도착일: ${form.expected_arrival}`)
      if (form.note) noteLines.push(form.note)
      await api.post('/inventory/inbound', {
        product_id: parseInt(form.product_id),
        lot_number: form.lot_number,
        expiry_date: form.expiry_date,
        quantity: parseInt(form.quantity),
        note: noteLines.length > 0 ? noteLines.join('\n') : null,
      })
      setSuccessMsg('입고 요청이 접수되었습니다. 관리자가 입고 시간대를 배정하면 알림을 드립니다.')
      setForm({ product_id: '', quantity: '', expected_arrival: '', lot_number: '', expiry_date: '', note: '' })
      fetchHistory()
      fetchSchedules()
    } catch (err) {
      setFormError(err.response?.data?.detail || '입고 요청 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirm = async (scheduleId) => {
    try {
      await api.post(`/inbound-schedule/${scheduleId}/confirm`)
      addToast('success', '입고 시간대를 확정했습니다.')
      fetchSchedules()
    } catch (e) {
      addToast('error', '확정에 실패했습니다.')
    }
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-7">
            <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>입고 요청</h2>
            <p className="mt-1 text-sm" style={{ color: '#64748B' }}>풀핏 창고로 상품을 보내기 전에 입고 요청을 등록하세요.</p>
          </div>

          {/* Upcoming schedule banner */}
          {schedules.length > 0 && (
            <div className="mb-6 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-5 py-4">
              <p className="text-sm font-semibold text-[#1D4ED8] mb-2">📅 배정된 입고 시간대</p>
              <div className="space-y-1">
                {schedules.slice(0, 3).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-[#374151]">
                      {s.scheduled_date} {s.time_slot} — 도크 {s.dock_number}번 ({s.product_name})
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.status === 'CONFIRMED' ? 'bg-[#F0FDF4] text-[#15803D]' : 'bg-[#EFF6FF] text-[#1D4ED8]'
                      }`}>
                        {s.status === 'CONFIRMED' ? '확정' : '배정됨'}
                      </span>
                      {s.status === 'SCHEDULED' && (
                        <button onClick={() => handleConfirm(s.id)}
                          className="text-xs text-[#2563EB] hover:underline font-medium">
                          확정하기
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-6 mb-6">
            <h3 className="font-semibold text-sm mb-4" style={{ color: '#0F172A' }}>입고 요청 등록</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>상품 선택 *</label>
                <select name="product_id" value={form.product_id} onChange={handleChange} className={INPUT_CLS}>
                  <option value="">상품을 선택하세요</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>수량 *</label>
                <input type="number" name="quantity" value={form.quantity} onChange={handleChange}
                  min={1} placeholder="0" className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>예상 도착일</label>
                <input type="date" name="expected_arrival" value={form.expected_arrival} onChange={handleChange} className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>LOT번호 *</label>
                <input type="text" name="lot_number" value={form.lot_number} onChange={handleChange}
                  placeholder="LOT-2026-001" className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>유통기한 *</label>
                <input type="date" name="expiry_date" value={form.expiry_date} onChange={handleChange} className={INPUT_CLS} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>메모</label>
                <textarea name="note" value={form.note} onChange={handleChange} rows={2}
                  placeholder="추가 전달 사항을 입력하세요"
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] resize-none" />
              </div>
              {formError && (
                <div className="sm:col-span-2 bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm rounded-lg px-4 py-2">
                  {formError}
                </div>
              )}
              {successMsg && (
                <div className="sm:col-span-2 bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-sm rounded-lg px-4 py-3">
                  {successMsg}
                </div>
              )}
              <div className="sm:col-span-2 flex justify-end">
                <button type="submit" disabled={submitting}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-6 py-2 rounded-[6px] text-sm font-semibold transition-colors disabled:opacity-50">
                  {submitting ? '요청 중...' : '입고 요청'}
                </button>
              </div>
            </form>
          </div>

          {/* History */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>입고 요청 내역</h3>
              <span className="text-xs" style={{ color: '#94A3B8' }}>최근 10건</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    {['상품명', 'LOT번호', '수량', '유통기한', '배정된 입고 시간', '요청일'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>입고 요청 내역이 없습니다.</td></tr>
                  ) : (
                    history.map(r => (
                      <tr key={r.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{r.product_name}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: '#374151' }}>{r.lot_number}</td>
                        <td className="px-4 py-3" style={{ color: '#374151' }}>{r.quantity.toLocaleString()}개</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{r.expiry_date}</td>
                        <td className="px-4 py-3">
                          <ScheduleBadge
                            schedule={scheduleByInbound[r.id] || null}
                            onConfirm={handleConfirm}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                          {new Date(r.created_at).toLocaleDateString('ko-KR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
