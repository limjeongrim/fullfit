import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

function ExpiryBadge({ days }) {
  if (days <= 30) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#991B1B]">만료임박</span>
  if (days <= 60) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FEF9C3] text-[#854D0E]">주의</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534]">정상</span>
}

function DaysCell({ days }) {
  const cls = days <= 30 ? 'text-[#DC2626] font-semibold' : days <= 60 ? 'text-[#D97706] font-semibold' : 'text-[#16A34A]'
  return <span className={cls}>{days}일</span>
}

const STORAGE_LABEL = { ROOM_TEMP: '상온', COLD: '냉장' }

const ABC_STYLE = {
  A: 'bg-[#FEE2E2] text-[#991B1B]',
  B: 'bg-[#FEF9C3] text-[#854D0E]',
  C: 'bg-[#F1F5F9] text-[#475569]',
  D: 'bg-[#ECFEFF] text-[#0E7490]',
}

function AbcBadge({ cls }) {
  if (!cls) return null
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ABC_STYLE[cls] || ABC_STYLE.C}`}>
      {cls}
    </span>
  )
}

const INPUT_CLS = "w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"

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

export default function InventoryPage() {
  const addToast = useToastStore((s) => s.addToast)
  const [searchParams] = useSearchParams()

  const [inventory, setInventory] = useState([])
  const [products, setProducts] = useState([])
  const [filter, setFilter] = useState(() => {
    const f = searchParams.get('filter')
    if (f === 'expiry_alert') return 'expiring'
    if (f === 'low_stock') return 'low_stock'
    return 'all'
  })
  const [search, setSearch] = useState('')
  const [filterSeller, setFilterSeller] = useState('')
  const [sellers, setSellers] = useState([])
  const [alertCount, setAlertCount] = useState(0)
  const [abcMap, setAbcMap] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [tick, setTick] = useState(0)

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
      setLastUpdated(Date.now())
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
    api.get('/slotting/abc-map').then(r => setAbcMap(r.data)).catch(() => {})
  }, [])
  useEffect(() => { fetchInventory() }, [filterSeller, tick])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const counts = {
    expiring:  inventory.filter((r) => r.days_until_expiry <= 30).length,
    low_stock: inventory.filter((r) => r.quantity < 20).length,
    cold:      inventory.filter((r) => r.storage_type === 'COLD' || r.warehouse_zone === 'D').length,
  }

  const filtered = inventory.filter((row) => {
    if (filter === 'expiring'  && row.days_until_expiry > 30) return false
    if (filter === 'cold'      && row.storage_type !== 'COLD' && row.warehouse_zone !== 'D') return false
    if (filter === 'low_stock' && row.quantity >= 20) return false
    if (search) {
      const q = search.toLowerCase()
      if (!row.product_name.toLowerCase().includes(q) && !row.sku.toLowerCase().includes(q)) return false
    }
    return true
  })

  const downloadInventoryCSV = () => {
    const esc = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s }
    const headers = ['상품명','SKU','LOT번호','유통기한','남은일수','수량','보관방식','ABC등급','상태']
    const rows = filtered.map(r => [
      r.product_name, r.sku, r.lot_number, r.expiry_date, r.days_until_expiry, r.quantity,
      STORAGE_LABEL[r.storage_type] || r.storage_type,
      abcMap[r.product_id] || '',
      r.days_until_expiry <= 30 ? '만료임박' : r.days_until_expiry <= 60 ? '주의' : '정상',
    ])
    const csv = [headers, ...rows].map(row => row.map(esc).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `재고현황_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

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
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="px-6 py-6">
          {alertCount > 0 && (
            <div className="mb-4 flex items-center gap-3 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-xl px-5 py-3">
              <span className="text-lg">⚠️</span>
              <span className="font-semibold">주의: {alertCount}개 상품의 유통기한이 30일 이내입니다</span>
            </div>
          )}

          {/* Live bar */}
          <div className="flex items-center justify-between mb-4">
            <LiveIndicator />
            <LastUpdated time={lastUpdated} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: 'all', label: '전체' },
                { key: 'expiring', label: '만료임박' },
                { key: 'low_stock', label: '재고부족' },
                { key: 'cold', label: '냉장보관' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setFilter(key)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === key
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-white border border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC]'
                  }`}>
                  {label}
                  {counts[key] != null && counts[key] > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      filter === key ? 'bg-white/30 text-white' : 'bg-[#EF4444] text-white'
                    }`}>
                      {counts[key]}
                    </span>
                  )}
                </button>
              ))}
              <select value={filterSeller} onChange={(e) => setFilterSeller(e.target.value)}
                className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30">
                <option value="">전체 셀러</option>
                {sellers.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.company_name || s.email})</option>)}
              </select>
              <input type="text" placeholder="상품명 또는 SKU 검색" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ml-2 px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 w-52" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={downloadInventoryCSV}
                className="border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] px-4 py-2 rounded-[6px] text-sm font-medium transition-colors flex items-center gap-1.5" style={{ color: '#374151' }}>
                ↓ 재고 내보내기
              </button>
              <button onClick={() => setShowModal(true)}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 py-2 rounded-[6px] text-sm font-semibold transition-colors">
                + 입고 등록
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['상품명', 'SKU', 'LOT번호', '유통기한', '남은일수', '수량', '보관방식', 'ABC', '상태'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>데이터가 없습니다.</td></tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id}
                      className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors ${row.days_until_expiry <= 30 ? 'bg-[#FEF2F2]' : ''}`}>
                      <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{row.product_name}</td>
                      <td className="px-4 py-3" style={{ color: '#64748B' }}>{row.sku}</td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: '#64748B' }}>{row.lot_number}</td>
                      <td className="px-4 py-3" style={{ color: '#374151' }}>{row.expiry_date}</td>
                      <td className="px-4 py-3"><DaysCell days={row.days_until_expiry} /></td>
                      <td className="px-4 py-3" style={{ color: '#374151' }}>{row.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.storage_type === 'COLD' ? 'bg-[#ECFEFF] text-[#0E7490]' : 'bg-[#F1F5F9] text-[#475569]'}`}>
                          {STORAGE_LABEL[row.storage_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3"><AbcBadge cls={abcMap[String(row.product_id)]} /></td>
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
              <h3 className="text-lg font-bold mb-6" style={{ color: '#0F172A' }}>입고 등록</h3>
              <form onSubmit={handleInboundSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>상품 선택 *</label>
                  <select name="product_id" value={form.product_id} onChange={handleFormChange} className={INPUT_CLS}>
                    <option value="">상품을 선택하세요</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>LOT번호 *</label>
                  <input type="text" name="lot_number" value={form.lot_number} onChange={handleFormChange}
                    placeholder="예: LOT-2026-005" className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>유통기한 *</label>
                  <input type="date" name="expiry_date" value={form.expiry_date} onChange={handleFormChange} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>수량 *</label>
                  <input type="number" name="quantity" value={form.quantity} onChange={handleFormChange} min={1} placeholder="0" className={INPUT_CLS} />
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
