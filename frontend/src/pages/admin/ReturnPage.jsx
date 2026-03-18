import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const STATUS_META = {
  REQUESTED: { label: '접수',   cls: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  IN_REVIEW:  { label: '검수중', cls: 'bg-[#FEF9C3] text-[#854D0E]' },
  RESTOCKED:  { label: '재입고', cls: 'bg-[#DCFCE7] text-[#166534]' },
  DISPOSED:   { label: '폐기',   cls: 'bg-[#F1F5F9] text-[#64748B]' },
}

const REASON_LABELS = {
  DEFECTIVE:      '상품 불량',
  WRONG_ITEM:     '오배송',
  CHANGE_OF_MIND: '단순 변심',
  OTHER:          '기타',
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

export default function AdminReturnPage() {
  const addToast = useToastStore((s) => s.addToast)

  const [returns, setReturns] = useState([])
  const [filterSeller, setFilterSeller] = useState('')
  const [sellers, setSellers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [inspectionNote, setInspectionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchReturns = async () => {
    try {
      const params = new URLSearchParams()
      if (filterSeller) params.set('seller_id', filterSeller)
      const res = await api.get(`/returns/?${params}`)
      setReturns(res.data)
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    fetchReturns()
    api.get('/sellers/').then(r => setSellers(r.data)).catch(() => {})
  }, [])
  useEffect(() => { fetchReturns() }, [filterSeller])

  const openModal = (id, targetStatus) => {
    setSelected({ id, targetStatus })
    setInspectionNote('')
    setShowModal(true)
  }

  const handleConfirm = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      await api.patch(`/returns/${selected.id}/status`, {
        status: selected.targetStatus,
        inspection_note: inspectionNote || null,
      })
      await fetchReturns()
      addToast('success', '반품 상태가 업데이트되었습니다.')
      setShowModal(false)
    } catch (err) {
      addToast('error', err.response?.data?.detail || '처리 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const getActions = (r) => {
    if (r.status === 'REQUESTED') return [{ label: '검수 시작', targetStatus: 'IN_REVIEW' }]
    if (r.status === 'IN_REVIEW') return [
      { label: '재입고 처리', targetStatus: 'RESTOCKED' },
      { label: '폐기 처리',   targetStatus: 'DISPOSED' },
    ]
    return []
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="px-6 py-6">
          <div className="flex items-center gap-2 mb-5">
            <select value={filterSeller} onChange={(e) => setFilterSeller(e.target.value)}
              className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30">
              <option value="">전체 셀러</option>
              {sellers.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.company_name || s.email})</option>)}
            </select>
          </div>

          <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['주문번호', '셀러명', '반품사유', '상태', '접수일', '검수 메모', '액션'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>반품 데이터가 없습니다.</td></tr>
                ) : (
                  returns.map((r) => {
                    const actions = getActions(r)
                    return (
                      <tr key={r.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#374151' }}>{r.order_number}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{r.seller_name}</td>
                        <td className="px-4 py-3" style={{ color: '#64748B' }}>{REASON_LABELS[r.reason] || r.reason}</td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                          {new Date(r.created_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[160px] truncate" style={{ color: '#64748B' }}>{r.inspection_note || '—'}</td>
                        <td className="px-4 py-3">
                          {actions.length > 0 ? (
                            <div className="flex gap-2 flex-wrap">
                              {actions.map((a) => (
                                <button key={a.targetStatus} onClick={() => openModal(r.id, a.targetStatus)}
                                  className={`px-3 py-1 text-xs rounded-[6px] font-medium transition-colors ${
                                    a.targetStatus === 'RESTOCKED' ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white' :
                                    a.targetStatus === 'DISPOSED'  ? 'bg-[#DC2626] hover:bg-[#B91C1C] text-white' :
                                    'bg-[#D97706] hover:bg-[#B45309] text-white'
                                  }`}>
                                  {a.label}
                                </button>
                              ))}
                            </div>
                          ) : <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>총 {returns.length}건</p>
        </div>

        {/* Confirmation modal */}
        {showModal && selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
              {selected.targetStatus === 'RESTOCKED' ? (
                <>
                  <h3 className="text-lg font-bold mb-2" style={{ color: '#0F172A' }}>재입고 처리 확인</h3>
                  <p className="text-sm mb-5" style={{ color: '#64748B' }}>
                    이 상품을 재입고 처리하시겠습니까? 현재 재고에 수량이 추가됩니다.
                  </p>
                  <div className="mb-5">
                    <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>검수 메모 <span style={{ color: '#94A3B8' }}>(선택)</span></label>
                    <textarea value={inspectionNote} onChange={(e) => setInspectionNote(e.target.value)} rows={3}
                      placeholder="검수 내용을 입력하세요"
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] resize-none" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-[6px] text-sm text-[#374151] hover:bg-[#F8FAFC] transition-colors">취소</button>
                    <button onClick={handleConfirm} disabled={submitting}
                      className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-[6px] text-sm font-semibold transition-colors disabled:opacity-50">
                      {submitting ? '처리 중...' : '재입고 확정'}
                    </button>
                  </div>
                </>
              ) : selected.targetStatus === 'DISPOSED' ? (
                <>
                  <h3 className="text-lg font-bold mb-2" style={{ color: '#0F172A' }}>폐기 처리 확인</h3>
                  <p className="text-sm mb-5" style={{ color: '#64748B' }}>
                    이 상품을 폐기 처리하시겠습니까? <span className="font-semibold" style={{ color: '#DC2626' }}>이 작업은 되돌릴 수 없습니다.</span>
                  </p>
                  <div className="mb-5">
                    <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>폐기 사유 <span style={{ color: '#DC2626' }}>*</span></label>
                    <textarea value={inspectionNote} onChange={(e) => setInspectionNote(e.target.value)} rows={3}
                      placeholder="폐기 사유를 입력하세요 (필수)"
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626] resize-none" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-[6px] text-sm text-[#374151] hover:bg-[#F8FAFC] transition-colors">취소</button>
                    <button onClick={handleConfirm} disabled={submitting || !inspectionNote.trim()}
                      className="flex-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white px-4 py-2 rounded-[6px] text-sm font-semibold transition-colors disabled:opacity-50">
                      {submitting ? '처리 중...' : '폐기 확정'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold mb-2" style={{ color: '#0F172A' }}>검수 시작</h3>
                  <p className="text-sm mb-5" style={{ color: '#64748B' }}>반품 검수를 시작합니다.</p>
                  <div className="mb-5">
                    <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>검수 메모 <span style={{ color: '#94A3B8' }}>(선택)</span></label>
                    <textarea value={inspectionNote} onChange={(e) => setInspectionNote(e.target.value)} rows={3}
                      placeholder="검수 내용을 입력하세요"
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] resize-none" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-[6px] text-sm text-[#374151] hover:bg-[#F8FAFC] transition-colors">취소</button>
                    <button onClick={handleConfirm} disabled={submitting}
                      className="flex-1 bg-[#D97706] hover:bg-[#B45309] text-white px-4 py-2 rounded-[6px] text-sm font-semibold transition-colors disabled:opacity-50">
                      {submitting ? '처리 중...' : '검수 시작'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
