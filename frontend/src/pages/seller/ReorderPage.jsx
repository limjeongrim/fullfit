import { useEffect, useState } from 'react'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'
import useToastStore from '../../store/toastStore'

function UrgencyBadge({ urgency }) {
  if (urgency === 'CRITICAL')
    return <span className="px-2 py-0.5 rounded-full text-xs bg-[#FEE2E2] text-[#991B1B] font-bold">긴급</span>
  if (urgency === 'WARNING')
    return <span className="px-2 py-0.5 rounded-full text-xs bg-[#FEF9C3] text-[#854D0E] font-semibold">권고</span>
  return <span className="px-2 py-0.5 rounded-full text-xs bg-[#DCFCE7] text-[#166534]">안전</span>
}

function ConfirmModal({ item, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-5 border-b border-[#E2E8F0]">
          <h3 className="font-bold text-lg" style={{ color: '#0F172A' }}>발주 요청 확인</h3>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p style={{ color: '#374151' }}>
            <span className="font-bold">{item.product_name}</span>을(를){' '}
            <span className="font-bold" style={{ color: '#2563EB' }}>{item.recommended_qty}개</span> 발주 요청하시겠습니까?
          </p>
          <div className="bg-[#F8FAFC] rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: '#64748B' }}>현재 재고</span>
              <span className="font-medium" style={{ color: '#0F172A' }}>{item.current_stock}개</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#64748B' }}>재주문점</span>
              <span className="font-medium" style={{ color: '#0F172A' }}>{item.reorder_point}개</span>
            </div>
            <div className="flex justify-between border-t border-[#E2E8F0] pt-2 mt-2">
              <span className="font-semibold" style={{ color: '#374151' }}>권장 발주량 (EOQ)</span>
              <span className="font-bold" style={{ color: '#2563EB' }}>{item.recommended_qty}개</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#E2E8F0] flex gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-[6px] text-sm hover:bg-[#F8FAFC]"
            style={{ color: '#374151' }}>취소</button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-[6px] text-sm font-semibold">
            발주 요청
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SellerReorderPage() {
  const { addToast } = useToastStore()
  const [items, setItems] = useState([])
  const [safeCount, setSafeCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [confirmItem, setConfirmItem] = useState(null)
  const [ordered, setOrdered] = useState(new Set())
  const [dismissed, setDismissed] = useState(new Set())

  useEffect(() => {
    api.get('/reorder/check')
      .then(r => {
        setItems(r.data.items)
        setSafeCount(r.data.safe_count)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const criticalCount = items.filter(i => i.urgency === 'CRITICAL').length
  const warningCount  = items.filter(i => i.urgency === 'WARNING').length

  const handleOrder = (item) => setConfirmItem(item)

  const confirmOrder = async () => {
    if (!confirmItem) return
    try {
      await api.post(`/reorder/${confirmItem.recommendation_id}/order`)
      setOrdered(prev => new Set([...prev, confirmItem.recommendation_id]))
      addToast('success', '발주 요청이 등록되었습니다')
    } catch {
      addToast('error', '발주 요청에 실패했습니다')
    }
    setConfirmItem(null)
  }

  const handleDismiss = async (item) => {
    try {
      await api.post(`/reorder/${item.recommendation_id}/dismiss`)
      setDismissed(prev => new Set([...prev, item.recommendation_id]))
      addToast('success', '무시 처리되었습니다')
    } catch {
      addToast('error', '처리에 실패했습니다')
    }
  }

  const visible = items.filter(i => !dismissed.has(i.recommendation_id))

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="px-6 py-6">
          <div className="mb-5">
            <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>발주 추천</h2>
            <p className="mt-1 text-sm" style={{ color: '#64748B' }}>
              재주문점(ROP) 및 경제적 발주량(EOQ) 기반 자동 발주 추천
            </p>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-2">
              <span className="text-sm font-semibold" style={{ color: '#991B1B' }}>긴급 발주</span>
              <span className="text-lg font-bold" style={{ color: '#DC2626' }}>{criticalCount}건</span>
            </div>
            <div className="flex items-center gap-2 bg-[#FEFCE8] border border-[#FEF08A] rounded-lg px-4 py-2">
              <span className="text-sm font-semibold" style={{ color: '#854D0E' }}>발주 권고</span>
              <span className="text-lg font-bold" style={{ color: '#CA8A04' }}>{warningCount}건</span>
            </div>
            <div className="flex items-center gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-4 py-2">
              <span className="text-sm font-semibold" style={{ color: '#166534' }}>안전 재고</span>
              <span className="text-lg font-bold" style={{ color: '#16A34A' }}>{safeCount}건</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['상품명', 'SKU', '현재 재고', '재주문점', '재고 소진 예상', '권장 발주량', '긴급도', '액션'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>로딩 중...</td></tr>
                ) : visible.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>발주 추천 항목이 없습니다.</td></tr>
                ) : (
                  visible.map(item => {
                    const isOrdered = ordered.has(item.recommendation_id)
                    const daysText = item.days_of_stock >= 365 ? '1년 이상' : `${item.days_of_stock}일 후`
                    const dosColor = item.urgency === 'CRITICAL' ? '#DC2626'
                      : item.urgency === 'WARNING' ? '#CA8A04' : '#2563EB'
                    return (
                      <tr key={item.product_id}
                        className={`border-b border-[#F1F5F9] transition-colors ${
                          item.urgency === 'CRITICAL' ? 'bg-[#FEF2F2]' :
                          item.urgency === 'WARNING'  ? 'bg-[#FEFCE8]' : ''
                        }`}>
                        <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{item.product_name}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: '#64748B' }}>{item.sku}</td>
                        <td className="px-4 py-3 font-semibold">{item.current_stock.toLocaleString()}개</td>
                        <td className="px-4 py-3" style={{ color: '#64748B' }}>{item.reorder_point}개</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: dosColor }}>{daysText}</td>
                        <td className="px-4 py-3 font-bold" style={{ color: '#2563EB' }}>{item.recommended_qty}개</td>
                        <td className="px-4 py-3"><UrgencyBadge urgency={item.urgency} /></td>
                        <td className="px-4 py-3">
                          {isOrdered ? (
                            <span className="px-2 py-1 rounded-[6px] text-xs bg-[#DCFCE7] text-[#166534] font-semibold">발주 완료</span>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={() => handleOrder(item)}
                                className="text-xs px-3 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-[6px] font-semibold transition-colors whitespace-nowrap">
                                발주 요청
                              </button>
                              <button onClick={() => handleDismiss(item)}
                                className="text-xs px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-[6px] transition-colors whitespace-nowrap"
                                style={{ color: '#64748B' }}>
                                무시
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && visible.length > 0 && (
            <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>
              EOQ = 경제적 발주량 · ROP = (일수요 × 입고소요일 3일) + 안전재고(7일분)
            </p>
          )}
        </div>
      </div>

      {confirmItem && (
        <ConfirmModal
          item={confirmItem}
          onConfirm={confirmOrder}
          onCancel={() => setConfirmItem(null)}
        />
      )}
    </SidebarLayout>
  )
}
