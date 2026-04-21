import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const EMPTY_FORM = { product_id: '', lot_number: '', expiry_date: '', quantity: '', note: '' }

export default function InboundPage() {
  const addToast = useToastStore((s) => s.addToast)

  const [products, setProducts]               = useState([])
  const [inventory, setInventory]             = useState([])
  const [scheduledInbounds, setScheduledInbounds] = useState([])
  const [form, setForm]                       = useState(EMPTY_FORM)
  const [formError, setFormError]             = useState('')
  const [submitting, setSubmitting]           = useState(false)

  const fetchScheduledInbounds = async () => {
    try {
      const res = await api.get('/inbound/scheduled-upcoming')
      setScheduledInbounds(res.data)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchData = async () => {
    const [pRes, iRes] = await Promise.all([
      api.get('/products/'),
      api.get('/inventory/'),
    ])
    setProducts(pRes.data)
    const sorted = [...iRes.data].sort((a, b) =>
      (b.inbound_date || '').localeCompare(a.inbound_date || '')
    )
    setInventory(sorted.slice(0, 10))
  }

  useEffect(() => {
    fetchData()
    fetchScheduledInbounds()
  }, [])

  const handleConfirmArrival = async (inboundId, productName, quantity) => {
    if (!window.confirm(`${productName} ${quantity}개 입고를 확인하시겠습니까?\n확인 시 재고에 즉시 반영됩니다.`)) return
    try {
      await api.post(`/inbound/${inboundId}/confirm`, { actual_quantity: quantity })
      alert('✅ 입고 확인 완료! 재고에 반영되었습니다.')
      fetchScheduledInbounds()
      fetchData()
    } catch (e) {
      alert('오류: ' + (e.response?.data?.detail || e.message))
    }
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.product_id || !form.lot_number || !form.expiry_date || !form.quantity) {
      setFormError('필수 항목을 모두 입력하세요.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/inventory/inbound', {
        product_id: parseInt(form.product_id),
        lot_number: form.lot_number,
        expiry_date: form.expiry_date,
        quantity: parseInt(form.quantity),
        note: form.note || null,
      })
      setForm(EMPTY_FORM)
      addToast('success', '입고 등록이 완료되었습니다.')
      await fetchData()
    } catch (err) {
      const msg = err.response?.data?.detail || '입고 등록 실패'
      setFormError(msg)
      addToast('error', msg)
    } finally {
      setSubmitting(false)
    }
  }

  const INPUT_CLS = "w-full px-4 py-4 border-2 border-[#E2E8F0] rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] bg-white"
  const LABEL_CLS = "block text-base font-semibold mb-2"

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* 입고 스케줄 섹션 */}
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-3">📦 입고 예정 스케줄</h2>
            {scheduledInbounds.length === 0 ? (
              <div className="text-gray-400 text-sm p-4 border rounded bg-gray-50">
                예정된 입고가 없습니다.
              </div>
            ) : (
              scheduledInbounds.map(item => (
                <div key={item.id}
                  className={`border rounded p-4 mb-3 ${item.is_today ? 'border-blue-400 bg-blue-50' : 'bg-white'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold">{item.product_name}</div>
                      <div className="text-sm text-gray-600">{item.seller_name} | {item.quantity}개</div>
                      <div className="text-sm text-blue-600 font-medium">
                        {item.scheduled_date} {item.time_slot} | 도크{item.dock_number}
                      </div>
                      {item.lot_number && (
                        <div className="text-xs text-gray-400">LOT: {item.lot_number}</div>
                      )}
                      {item.is_today && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">오늘</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <span className={`px-2 py-1 rounded text-xs text-white ${
                        item.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'
                      }`}>
                        {item.status === 'COMPLETED' ? '✅ 입고완료' : '📋 예정'}
                      </span>
                      {item.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleConfirmArrival(item.inbound_id, item.product_name, item.quantity)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          입고 확인
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Manual 입고 등록 form */}
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-[#E2E8F0] p-6 mb-6">
            <h3 className="text-xl font-bold mb-5" style={{ color: '#0F172A' }}>입고 정보 입력</h3>

            {formError && (
              <div className="mb-5 rounded-lg px-4 py-4 text-base font-medium bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B]">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={LABEL_CLS} style={{ color: '#374151' }}>상품 선택 *</label>
                <select name="product_id" value={form.product_id} onChange={handleChange}
                  className={INPUT_CLS} style={{ fontSize: '16px' }}>
                  <option value="">상품을 선택하세요</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL_CLS} style={{ color: '#374151' }}>LOT번호 *</label>
                <input type="text" name="lot_number" value={form.lot_number} onChange={handleChange}
                  placeholder="예: LOT-2026-001" inputMode="text"
                  className={INPUT_CLS} style={{ fontSize: '16px' }} />
              </div>

              <div>
                <label className={LABEL_CLS} style={{ color: '#374151' }}>유통기한 *</label>
                <input type="date" name="expiry_date" value={form.expiry_date} onChange={handleChange}
                  className={INPUT_CLS} style={{ fontSize: '16px' }} />
              </div>

              <div>
                <label className={LABEL_CLS} style={{ color: '#374151' }}>수량 *</label>
                <input type="number" name="quantity" value={form.quantity} onChange={handleChange}
                  min={1} placeholder="0" inputMode="numeric"
                  className={INPUT_CLS} style={{ fontSize: '16px' }} />
              </div>

              <div>
                <label className={LABEL_CLS} style={{ color: '#374151' }}>
                  메모 <span className="font-normal text-sm" style={{ color: '#94A3B8' }}>(선택)</span>
                </label>
                <textarea name="note" value={form.note} onChange={handleChange} rows={3}
                  placeholder="입고 메모를 입력하세요"
                  className={`${INPUT_CLS} resize-none`} style={{ fontSize: '16px' }} />
              </div>

              <button type="submit" disabled={submitting}
                className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white py-5 rounded-xl text-lg font-bold transition-colors disabled:opacity-50 mt-2">
                {submitting ? '등록 중...' : '📥 입고 등록'}
              </button>
            </form>
          </div>

          {/* Recent history */}
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-[#E2E8F0] p-5">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#0F172A' }}>최근 입고 이력 (최대 10건)</h3>
            {inventory.length === 0 ? (
              <p className="text-center py-6 text-sm" style={{ color: '#94A3B8' }}>입고 이력이 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {inventory.map((inv) => (
                  <div key={inv.id} className="bg-[#F8FAFC] rounded-lg p-4 border border-[#E2E8F0]">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-base" style={{ color: '#0F172A' }}>{inv.product_name}</p>
                        <p className="font-mono text-xs mt-0.5" style={{ color: '#64748B' }}>{inv.lot_number}</p>
                      </div>
                      <span className="text-base font-bold" style={{ color: '#166534' }}>+{inv.quantity.toLocaleString()}개</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-sm" style={{ color: '#64748B' }}>
                      <span>유통기한: {inv.expiry_date}</span>
                      <span style={{ color: '#CBD5E1' }}>|</span>
                      <span>입고일: {inv.inbound_date || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </SidebarLayout>
  )
}
