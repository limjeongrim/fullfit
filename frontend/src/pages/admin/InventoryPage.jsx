import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

function ExpiryBadge({ days }) {
  if (days <= 30) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">만료임박</span>
  if (days <= 60) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">주의</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">정상</span>
}

function DaysCell({ days }) {
  const cls = days <= 30 ? 'text-red-600 font-semibold' : days <= 60 ? 'text-yellow-600 font-semibold' : 'text-green-700'
  return <span className={cls}>{days}일</span>
}

const STORAGE_LABEL = { ROOM_TEMP: '상온', COLD: '냉장' }

export default function InventoryPage() {
  const addToast = useToastStore((s) => s.addToast)

  const [inventory, setInventory] = useState([])
  const [products, setProducts] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [filterSeller, setFilterSeller] = useState('')
  const [sellers, setSellers] = useState([])
  const [alertCount, setAlertCount] = useState(0)
  const [showModal, setShowModal] = useState(false)

  const [form, setForm] = useState({ product_id: '', lot_number: '', expiry_date: '', quantity: '', note: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchInventory = async () => {
    try {
      const params = new URLSearchParams()
      if (filterSeller) params.set('seller_id', filterSeller)
      const res = await api.get(`/inventory/?${params}`)
      setInventory(res.data)
      setAlertCount(res.data.filter((r) => r.days_until_expiry <= 30).length)
    } catch (e) { console.error(e) }
  }

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products/')
      setProducts(res.data)
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    fetchInventory()
    fetchProducts()
    api.get('/sellers/').then(r => setSellers(r.data)).catch(() => {})
  }, [])
  useEffect(() => { fetchInventory() }, [filterSeller])

  const filtered = inventory.filter((row) => {
    if (filter === 'expiring' && row.days_until_expiry > 30) return false
    if (filter === 'cold' && row.storage_type !== 'COLD') return false
    if (search) {
      const q = search.toLowerCase()
      if (!row.product_name.toLowerCase().includes(q) && !row.sku.toLowerCase().includes(q)) return false
    }
    return true
  })

  const handleFormChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleInboundSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.product_id || !form.lot_number || !form.expiry_date || !form.quantity) {
      setFormError('모든 필수 항목을 입력하세요.')
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
      setShowModal(false)
      setForm({ product_id: '', lot_number: '', expiry_date: '', quantity: '', note: '' })
      await fetchInventory()
      addToast('success', '입고 등록이 완료되었습니다.')
    } catch (err) {
      setFormError(err.response?.data?.detail || '입고 등록에 실패했습니다.')
      addToast('error', err.response?.data?.detail || '입고 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-blue-50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {alertCount > 0 && (
            <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-300 text-red-700 rounded-xl px-5 py-3">
              <span className="text-lg">⚠️</span>
              <span className="font-semibold">주의: {alertCount}개 상품의 유통기한이 30일 이내입니다</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2 flex-wrap">
              {[{ key: 'all', label: '전체' }, { key: 'expiring', label: '만료임박' }, { key: 'cold', label: '냉장보관' }].map(({ key, label }) => (
                <button key={key} onClick={() => setFilter(key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === key ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-blue-50'
                  }`}>
                  {label}
                </button>
              ))}
              <select value={filterSeller} onChange={(e) => setFilterSeller(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">전체 셀러</option>
                {sellers.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.company_name || s.email})</option>)}
              </select>
              <input type="text" placeholder="상품명 또는 SKU 검색" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ml-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-52" />
            </div>
            <button onClick={() => setShowModal(true)}
              className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
              + 입고 등록
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-blue-100">
            <table className="w-full text-sm">
              <thead className="bg-blue-700 text-white">
                <tr>
                  {['상품명', 'SKU', 'LOT번호', '유통기한', '남은일수', '수량', '보관방식', '상태'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">데이터가 없습니다.</td></tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id}
                      className={`border-t border-gray-100 hover:bg-blue-50 transition-colors ${row.days_until_expiry <= 30 ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-800">{row.product_name}</td>
                      <td className="px-4 py-3 text-gray-500">{row.sku}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.lot_number}</td>
                      <td className="px-4 py-3 text-gray-700">{row.expiry_date}</td>
                      <td className="px-4 py-3"><DaysCell days={row.days_until_expiry} /></td>
                      <td className="px-4 py-3 text-gray-700">{row.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.storage_type === 'COLD' ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-600'}`}>
                          {STORAGE_LABEL[row.storage_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3"><ExpiryBadge days={row.days_until_expiry} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inbound modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
              <h3 className="text-lg font-bold text-gray-800 mb-6">입고 등록</h3>
              <form onSubmit={handleInboundSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">상품 선택 *</label>
                  <select name="product_id" value={form.product_id} onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">상품을 선택하세요</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LOT번호 *</label>
                  <input type="text" name="lot_number" value={form.lot_number} onChange={handleFormChange}
                    placeholder="예: LOT-2026-005"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">유통기한 *</label>
                  <input type="date" name="expiry_date" value={form.expiry_date} onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">수량 *</label>
                  <input type="number" name="quantity" value={form.quantity} onChange={handleFormChange} min={1} placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                  <textarea name="note" value={form.note} onChange={handleFormChange} rows={2}
                    placeholder="선택 입력"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                </div>
                {formError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2">{formError}</div>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowModal(false); setFormError('') }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                    {submitting ? '등록 중...' : '입고 등록'}
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
