import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const ADJ_TYPE = {
  ADD:      { label: '수량 추가', cls: 'bg-[#DCFCE7] text-[#166534]', sign: '+' },
  SUBTRACT: { label: '수량 차감', cls: 'bg-[#FEE2E2] text-[#991B1B]', sign: '-' },
  SET:      { label: '수량 설정', cls: 'bg-[#DBEAFE] text-[#1D4ED8]', sign: '→' },
}

const INPUT_CLS = "w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"

function DeltaBadge({ delta }) {
  if (delta > 0) return <span className="font-semibold" style={{ color: '#16A34A' }}>+{delta}</span>
  if (delta < 0) return <span className="font-semibold" style={{ color: '#DC2626' }}>{delta}</span>
  return <span style={{ color: '#94A3B8' }}>0</span>
}

export default function InventoryAdjustPage() {
  const addToast = useToastStore((s) => s.addToast)
  const [inventory, setInventory] = useState([])
  const [history, setHistory] = useState([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('adjust') // 'adjust' | 'history'
  const [rows, setRows] = useState([]) // staged adjustments
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get('/inventory/').then(r => setInventory(r.data)).catch(console.error)
    api.get('/inventory/adjustments').then(r => setHistory(r.data)).catch(console.error)
  }, [])

  const filtered = inventory.filter(inv => {
    if (!search) return true
    const q = search.toLowerCase()
    return inv.product_name.toLowerCase().includes(q) || inv.sku.toLowerCase().includes(q)
  })

  const addRow = (inv) => {
    if (rows.find(r => r.inventory_id === inv.id)) return
    setRows(prev => [...prev, {
      inventory_id: inv.id,
      product_name: inv.product_name,
      sku: inv.sku,
      lot_number: inv.lot_number,
      current_qty: inv.quantity,
      adjustment_type: 'ADD',
      value: 0,
      reason: '',
    }])
  }

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const removeRow = (idx) => {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  const preview = (row) => {
    const v = parseInt(row.value) || 0
    if (row.adjustment_type === 'ADD') return row.current_qty + v
    if (row.adjustment_type === 'SUBTRACT') return Math.max(0, row.current_qty - v)
    return v
  }

  const handleSubmit = async () => {
    if (rows.length === 0) { addToast('error', '조정 항목을 추가하세요.'); return }
    for (const r of rows) {
      if (!r.value && r.adjustment_type !== 'SET') { addToast('error', '수량을 입력하세요.'); return }
    }
    setSubmitting(true)
    try {
      await api.post('/inventory/adjust', {
        items: rows.map(r => ({
          inventory_id: r.inventory_id,
          adjustment_type: r.adjustment_type,
          value: parseInt(r.value) || 0,
          reason: r.reason || null,
        })),
      })
      addToast('success', `${rows.length}건 재고 조정이 완료되었습니다.`)
      setRows([])
      const [invRes, histRes] = await Promise.all([
        api.get('/inventory/'),
        api.get('/inventory/adjustments'),
      ])
      setInventory(invRes.data)
      setHistory(histRes.data)
    } catch (err) {
      addToast('error', err.response?.data?.detail || '재고 조정 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6 py-6">

          {/* Tabs */}
          <div className="flex border-b border-[#E2E8F0] mb-6">
            {[['adjust', '재고 조정'], ['history', '조정 이력']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`py-3 px-5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === key ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-[#64748B] hover:text-[#374151]'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'adjust' ? (
            <div className="flex gap-5">
              {/* Left: inventory list */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <input type="text" placeholder="상품명 또는 SKU 검색" value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 w-64" />
                  <p className="text-xs" style={{ color: '#94A3B8' }}>+ 클릭으로 조정 목록에 추가</p>
                </div>
                <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F8FAFC]">
                      <tr>
                        {['상품명', 'SKU', 'LOT', '현재수량', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-8 text-sm" style={{ color: '#94A3B8' }}>재고 없음</td></tr>
                      ) : filtered.map(inv => (
                        <tr key={inv.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                          <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{inv.product_name}</td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: '#64748B' }}>{inv.sku}</td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: '#64748B' }}>{inv.lot_number}</td>
                          <td className="px-4 py-3 font-semibold" style={{ color: '#0F172A' }}>{inv.quantity}개</td>
                          <td className="px-4 py-3">
                            <button onClick={() => addRow(inv)}
                              disabled={!!rows.find(r => r.inventory_id === inv.id)}
                              className="px-3 py-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs rounded-[6px] transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                              + 추가
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: staged adjustments */}
              <div className="w-96 shrink-0">
                <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>조정 목록 ({rows.length}건)</h3>
                    {rows.length > 0 && (
                      <button onClick={() => setRows([])} className="text-xs" style={{ color: '#94A3B8' }}>전체 삭제</button>
                    )}
                  </div>

                  {rows.length === 0 ? (
                    <p className="text-sm text-center py-6" style={{ color: '#94A3B8' }}>왼쪽에서 재고 항목을 추가하세요</p>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {rows.map((row, idx) => (
                        <div key={idx} className="border border-[#E2E8F0] rounded-lg p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{row.product_name}</p>
                              <p className="text-xs font-mono mt-0.5" style={{ color: '#64748B' }}>{row.sku} / {row.lot_number}</p>
                            </div>
                            <button onClick={() => removeRow(idx)} className="text-lg leading-none ml-2" style={{ color: '#94A3B8' }}>×</button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>조정 방식</label>
                              <select value={row.adjustment_type} onChange={(e) => updateRow(idx, 'adjustment_type', e.target.value)}
                                className="w-full px-2 py-1.5 border border-[#E2E8F0] rounded-lg text-xs focus:outline-none">
                                <option value="ADD">수량 추가</option>
                                <option value="SUBTRACT">수량 차감</option>
                                <option value="SET">수량 설정</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>수량</label>
                              <input type="number" min={0} value={row.value}
                                onChange={(e) => updateRow(idx, 'value', e.target.value)}
                                className="w-full px-2 py-1.5 border border-[#E2E8F0] rounded-lg text-xs focus:outline-none" />
                            </div>
                          </div>

                          <div className="mb-2">
                            <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>조정 사유</label>
                            <input type="text" value={row.reason} placeholder="실사 결과, 파손 등 (선택)"
                              onChange={(e) => updateRow(idx, 'reason', e.target.value)}
                              className="w-full px-2 py-1.5 border border-[#E2E8F0] rounded-lg text-xs focus:outline-none" />
                          </div>

                          <div className="flex items-center gap-2 text-xs bg-[#F8FAFC] rounded-lg px-3 py-2">
                            <span style={{ color: '#64748B' }}>현재</span>
                            <span className="font-semibold" style={{ color: '#0F172A' }}>{row.current_qty}개</span>
                            <span style={{ color: '#94A3B8' }}>→</span>
                            <span className="font-semibold" style={{ color: '#2563EB' }}>{preview(row)}개</span>
                            <span className="ml-auto">
                              <DeltaBadge delta={preview(row) - row.current_qty} />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {rows.length > 0 && (
                    <button onClick={handleSubmit} disabled={submitting}
                      className="w-full mt-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2.5 rounded-[6px] text-sm font-semibold transition-colors disabled:opacity-50">
                      {submitting ? '처리 중...' : `${rows.length}건 재고 조정 적용`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* History tab */
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    {['조정일시', '상품명', 'SKU', 'LOT', '조정방식', '조정 전', '조정 후', '변동', '사유', '처리자'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>조정 이력이 없습니다.</td></tr>
                  ) : history.map(h => (
                    <tr key={h.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                        {new Date(h.created_at).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{h.product_name}</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: '#64748B' }}>{h.sku}</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: '#64748B' }}>{h.lot_number}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ADJ_TYPE[h.adjustment_type]?.cls}`}>
                          {ADJ_TYPE[h.adjustment_type]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: '#64748B' }}>{h.quantity_before}개</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: '#0F172A' }}>{h.quantity_after}개</td>
                      <td className="px-4 py-3"><DeltaBadge delta={h.delta} /></td>
                      <td className="px-4 py-3 text-xs max-w-[140px] truncate" style={{ color: '#64748B' }}>{h.reason || '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>{h.adjusted_by_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  )
}
