import { useState, useEffect } from 'react'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'
import useToastStore from '../../store/toastStore'

export default function InventoryAuditPage() {
  const addToast = useToastStore((s) => s.addToast)

  const [auditItems, setAuditItems]         = useState([])
  const [actualCounts, setActualCounts]     = useState({})
  const [auditDate, setAuditDate]           = useState(new Date().toISOString().slice(0, 10))
  const [submitted, setSubmitted]           = useState(false)
  const [discrepancies, setDiscrepancies]   = useState([])
  const [loading, setLoading]               = useState(true)
  const [applying, setApplying]             = useState(false)

  useEffect(() => { fetchInventory() }, [])

  const fetchInventory = async () => {
    setLoading(true)
    try {
      const res = await api.get('/inventory/')
      setAuditItems(res.data)
      const init = {}
      res.data.forEach(item => { init[item.id] = item.quantity })
      setActualCounts(init)
      setSubmitted(false)
      setDiscrepancies([])
    } catch (e) {
      addToast('error', '재고 목록 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleCountChange = (id, value) => {
    setActualCounts(prev => ({ ...prev, [id]: parseInt(value) || 0 }))
  }

  const handleSubmitAudit = () => {
    const discList = auditItems
      .filter(item => actualCounts[item.id] !== item.quantity)
      .map(item => ({
        inventory_id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        sku: item.sku,
        lot_number: item.lot_number,
        system_qty: item.quantity,
        actual_qty: actualCounts[item.id] ?? item.quantity,
        difference: (actualCounts[item.id] ?? item.quantity) - item.quantity,
        audit_date: auditDate,
      }))

    if (discList.length === 0) {
      addToast('success', '재고 실사 완료! 시스템 재고와 실물 재고가 일치합니다.')
      return
    }
    setDiscrepancies(discList)
    setSubmitted(true)
  }

  const handleApplyAdjustment = async () => {
    setApplying(true)
    try {
      await api.post('/inventory/audit', {
        audit_date: auditDate,
        adjustments: discrepancies.map(d => ({
          inventory_id: d.inventory_id,
          actual_qty: d.actual_qty,
          difference: d.difference,
          audit_date: auditDate,
        })),
      })
      addToast('success', `재고 조정 완료! ${discrepancies.length}개 항목 수정됨`)
      fetchInventory()
    } catch (e) {
      addToast('error', e.response?.data?.detail || '재고 조정 실패')
    } finally {
      setApplying(false)
    }
  }

  const discrepancyCount = auditItems.filter(item => (actualCounts[item.id] ?? item.quantity) !== item.quantity).length

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-5xl mx-auto px-6 py-6">

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#0F172A' }}>재고 실사</h1>
              <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>시스템 재고와 실물 재고를 대조합니다</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={auditDate}
                onChange={(e) => setAuditDate(e.target.value)}
                className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              />
              {!submitted ? (
                <button
                  onClick={handleSubmitAudit}
                  disabled={loading}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                  실사 완료
                </button>
              ) : (
                <button
                  onClick={handleApplyAdjustment}
                  disabled={applying}
                  className="bg-[#DC2626] hover:bg-[#B91C1C] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                  {applying ? '처리 중...' : `재고 조정 적용 (${discrepancies.length}건)`}
                </button>
              )}
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-lg border border-[#E2E8F0] p-4 text-center">
              <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>전체 항목</p>
              <p className="text-2xl font-bold" style={{ color: '#0F172A' }}>{auditItems.length}</p>
            </div>
            <div className={`rounded-lg border p-4 text-center ${discrepancyCount > 0 ? 'bg-[#FEF2F2] border-[#FECACA]' : 'bg-white border-[#E2E8F0]'}`}>
              <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>불일치 항목</p>
              <p className={`text-2xl font-bold ${discrepancyCount > 0 ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}>{discrepancyCount}</p>
            </div>
            <div className="bg-white rounded-lg border border-[#E2E8F0] p-4 text-center">
              <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>일치 항목</p>
              <p className="text-2xl font-bold" style={{ color: '#166534' }}>{auditItems.length - discrepancyCount}</p>
            </div>
          </div>

          {/* Discrepancy summary */}
          {submitted && discrepancies.length > 0 && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 mb-5">
              <h3 className="font-bold mb-3 text-sm" style={{ color: '#991B1B' }}>
                ⚠️ 재고 불일치 {discrepancies.length}건 발견 — "재고 조정 적용" 버튼으로 시스템 재고를 실물에 맞춰 수정합니다
              </h3>
              <div className="flex flex-col gap-1.5">
                {discrepancies.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-[#FECACA]">
                    <span style={{ color: '#374151' }}>
                      <span className="font-medium">{d.product_name}</span>
                      <span className="ml-1.5 text-xs font-mono" style={{ color: '#94A3B8' }}>{d.sku}</span>
                      {d.lot_number && <span className="ml-1.5 text-xs" style={{ color: '#94A3B8' }}>LOT: {d.lot_number}</span>}
                    </span>
                    <span className="font-semibold whitespace-nowrap ml-3" style={{ color: '#DC2626' }}>
                      {d.system_qty}개 → {d.actual_qty}개
                      <span className="ml-1.5">({d.difference > 0 ? '+' : ''}{d.difference})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit table */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            {loading ? (
              <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>로딩 중...</div>
            ) : auditItems.length === 0 ? (
              <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>재고 데이터가 없습니다.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    {['상품명', 'SKU', 'LOT번호', '시스템 재고', '실물 재고 입력', '차이'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditItems.map(item => {
                    const actual = actualCounts[item.id] ?? item.quantity
                    const diff = actual - item.quantity
                    const hasDiscrepancy = diff !== 0
                    return (
                      <tr key={item.id}
                        className={`border-b border-[#F1F5F9] transition-colors ${hasDiscrepancy ? 'bg-[#FEF2F2]' : 'hover:bg-[#F8FAFC]'}`}>
                        <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{item.product_name}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: '#64748B' }}>{item.sku}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>{item.lot_number || '—'}</td>
                        <td className="px-4 py-3 text-center font-semibold" style={{ color: '#374151' }}>{item.quantity}개</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            value={actual}
                            onChange={(e) => handleCountChange(item.id, e.target.value)}
                            className={`border rounded-lg px-2 py-1.5 w-24 text-center text-sm focus:outline-none focus:ring-2 transition-colors ${
                              hasDiscrepancy
                                ? 'border-[#FCA5A5] bg-[#FEF2F2] focus:ring-[#EF4444]/30 focus:border-[#EF4444]'
                                : 'border-[#E2E8F0] focus:ring-[#2563EB]/30 focus:border-[#2563EB]'
                            }`}
                            min="0"
                          />
                        </td>
                        <td className="px-4 py-3 text-center font-bold">
                          {diff === 0 ? (
                            <span style={{ color: '#16A34A' }}>✅</span>
                          ) : (
                            <span style={{ color: diff > 0 ? '#2563EB' : '#DC2626' }}>
                              {diff > 0 ? '+' : ''}{diff}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>실물 재고 수량을 입력 후 "실사 완료" 버튼을 눌러주세요</p>
        </div>
      </div>
    </SidebarLayout>
  )
}
