import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const EMPTY_FORM = { product_id: '', lot_number: '', expiry_date: '', quantity: '', note: '' }

export default function InboundPage() {
  const addToast = useToastStore((s) => s.addToast)

  const [products, setProducts] = useState([])
  const [inventory, setInventory] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchData = async () => {
    const [pRes, iRes] = await Promise.all([
      api.get('/products/'),
      api.get('/inventory/'),
    ])
    setProducts(pRes.data)
    const sorted = [...iRes.data].sort((a, b) => {
      const da = a.inbound_date || ''
      const db_ = b.inbound_date || ''
      return db_.localeCompare(da)
    })
    setInventory(sorted.slice(0, 10))
  }

  useEffect(() => { fetchData() }, [])

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
          {/* Form card */}
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
                  placeholder="예: LOT-2026-001"
                  inputMode="text"
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
                  min={1} placeholder="0"
                  inputMode="numeric"
                  className={INPUT_CLS} style={{ fontSize: '16px' }} />
              </div>

              <div>
                <label className={LABEL_CLS} style={{ color: '#374151' }}>메모 <span className="font-normal text-sm" style={{ color: '#94A3B8' }}>(선택)</span></label>
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
                  <div key={inv.id}
                    className="bg-[#F8FAFC] rounded-lg p-4 border border-[#E2E8F0]">
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
