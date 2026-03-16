import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'

const EMPTY_FORM = { product_id: '', lot_number: '', expiry_date: '', quantity: '', note: '' }

export default function InboundPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [inventory, setInventory] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState(null) // { type: 'success'|'error', msg: string }
  const [submitting, setSubmitting] = useState(false)

  const fetchData = async () => {
    const [pRes, iRes] = await Promise.all([
      api.get('/products/'),
      api.get('/inventory/'),
    ])
    setProducts(pRes.data)
    // Sort by latest inbound_date desc, take first 10
    const sorted = [...iRes.data].sort((a, b) => {
      const da = a.inbound_date || ''
      const db_ = b.inbound_date || ''
      return db_.localeCompare(da)
    })
    setInventory(sorted.slice(0, 10))
  }

  useEffect(() => { fetchData() }, [])

  const handleLogout = () => { logout(); navigate('/login') }
  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus(null)
    if (!form.product_id || !form.lot_number || !form.expiry_date || !form.quantity) {
      setStatus({ type: 'error', msg: '필수 항목을 모두 입력하세요.' })
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
      setStatus({ type: 'success', msg: '입고 등록이 완료되었습니다.' })
      await fetchData()
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.detail || '입고 등록 실패' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-green-50">
      <nav className="bg-green-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/worker/dashboard')} className="text-green-200 hover:text-white text-sm">← 대시보드</button>
          <span className="text-xl font-bold">입고 등록</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-green-100">{user?.email}</span>
          <button onClick={handleLogout} className="bg-green-900 hover:bg-green-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">로그아웃</button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Inbound form card */}
        <div className="bg-white rounded-xl shadow-sm border border-green-100 p-7 mb-8">
          <h3 className="text-base font-semibold text-gray-800 mb-5">입고 정보 입력</h3>

          {status && (
            <div className={`mb-5 rounded-xl px-4 py-3 text-sm font-medium border ${
              status.type === 'success'
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              {status.type === 'success' ? '✅' : '⚠️'} {status.msg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">상품 선택 *</label>
              <select name="product_id" value={form.product_id} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                <option value="">상품을 선택하세요</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LOT번호 *</label>
              <input type="text" name="lot_number" value={form.lot_number} onChange={handleChange}
                placeholder="예: LOT-2026-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">유통기한 *</label>
              <input type="date" name="expiry_date" value={form.expiry_date} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">수량 *</label>
              <input type="number" name="quantity" value={form.quantity} onChange={handleChange}
                min={1} placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
              <textarea name="note" value={form.note} onChange={handleChange} rows={2}
                placeholder="선택 입력"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
            </div>

            <div className="sm:col-span-2 flex justify-end pt-1">
              <button type="submit" disabled={submitting}
                className="bg-green-700 hover:bg-green-800 text-white px-8 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                {submitting ? '등록 중...' : '입고 등록'}
              </button>
            </div>
          </form>
        </div>

        {/* Recent inbound history */}
        <div className="bg-white rounded-xl shadow-sm border border-green-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">최근 입고 이력 (최대 10건)</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-green-700 text-white">
              <tr>
                {['상품명', 'LOT번호', '유통기한', '수량', '입고일'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventory.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">입고 이력이 없습니다.</td></tr>
              ) : (
                inventory.map((inv) => (
                  <tr key={inv.id} className="border-t border-gray-100 hover:bg-green-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{inv.product_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{inv.lot_number}</td>
                    <td className="px-4 py-3 text-gray-600">{inv.expiry_date}</td>
                    <td className="px-4 py-3 text-gray-700">{inv.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{inv.inbound_date || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
