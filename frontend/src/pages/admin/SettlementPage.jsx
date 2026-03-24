import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

function StatusBadge({ status }) {
  return status === 'CONFIRMED'
    ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534]">확정</span>
    : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FEF9C3] text-[#854D0E]">미확정</span>
}

const fmt = (n) => `₩${Number(n).toLocaleString()}`

const INPUT_CLS = "w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"

const DETAIL_TABS = [
  { key: 'summary',  label: '정산 요약' },
  { key: 'outbound', label: '출고 상세' },
  { key: 'storage',  label: '보관료 상세' },
  { key: 'inbound',  label: '입고 상세' },
]

export default function AdminSettlementPage() {
  const addToast = useToastStore((s) => s.addToast)

  const [settlements, setSettlements] = useState([])
  const [sellers, setSellers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ seller_id: '', year_month: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [selectedSettlement, setSelectedSettlement] = useState(null)
  const [settlementDetail, setSettlementDetail] = useState(null)
  const [detailTab, setDetailTab] = useState('summary')
  const [detailLoading, setDetailLoading] = useState(false)

  const showToast = (msg, type = 'success') => addToast(type, msg)

  const fetchSettlements = () =>
    api.get('/settlements/').then((r) => setSettlements(r.data))

  const fetchSellers = () =>
    api.get('/orders/?limit=1').then(() =>
      api.get('/settlements/').then((r) => {
        const seen = new Map()
        r.data.forEach((s) => seen.set(s.seller_id, s.seller_name))
        setSellers([...seen.entries()].map(([id, name]) => ({ id, name })))
      })
    ).catch(() => {})

  useEffect(() => { fetchSettlements(); fetchSellers() }, [])

  const openDetail = async (s) => {
    setSelectedSettlement(s)
    setDetailTab('summary')
    setSettlementDetail(null)
    setDetailLoading(true)
    try {
      const r = await api.get(`/settlements/${s.id}/detail`)
      setSettlementDetail(r.data)
    } catch (e) {
      console.error(e)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleConfirm = async (id) => {
    try {
      await api.patch(`/settlements/${id}/confirm`)
      await fetchSettlements()
      showToast('정산이 확정되었습니다.')
    } catch (err) {
      showToast(err.response?.data?.detail || '확정 실패', 'error')
    }
  }

  const downloadSettlementCSV = () => {
    const esc = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s }
    const headers = ['셀러명','정산월','보관료','입고비','출고비','부가작업비','합계','상태','확정일']
    const rows = settlements.map(s => [
      s.seller_name, s.year_month, s.storage_fee, s.inbound_fee, s.outbound_fee, s.extra_fee, s.total_fee,
      s.status === 'CONFIRMED' ? '확정' : '미확정',
      s.confirmed_at ? new Date(s.confirmed_at).toLocaleDateString('ko-KR') : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `정산내역_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const handleFormChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleGenerate = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.seller_id || !form.year_month) { setFormError('모든 항목을 입력하세요.'); return }
    setSubmitting(true)
    try {
      await api.post('/settlements/generate', {
        seller_id: parseInt(form.seller_id),
        year_month: form.year_month,
      })
      setShowModal(false)
      setForm({ seller_id: '', year_month: '' })
      await fetchSettlements()
      await fetchSellers()
      showToast('정산이 생성되었습니다.')
    } catch (err) {
      setFormError(err.response?.data?.detail || '생성 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-end gap-2 mb-5">
            <button onClick={downloadSettlementCSV}
              className="border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] px-4 py-2 rounded-[6px] text-sm font-medium transition-colors flex items-center gap-1.5" style={{ color: '#374151' }}>
              ↓ 정산 내보내기
            </button>
            <button onClick={() => setShowModal(true)}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 py-2 rounded-[6px] text-sm font-semibold transition-colors">
              + 정산 생성
            </button>
          </div>

          <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['셀러명', '정산월', '보관료', '입고비', '출고비', '부가작업비', '합계', '상태', '확정일', '액션'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settlements.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>정산 데이터가 없습니다.</td></tr>
                ) : (
                  settlements.map((s) => (
                    <tr key={s.id}
                      onClick={() => openDetail(s)}
                      className="border-b border-[#F1F5F9] hover:bg-[#F0F4FF] transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{s.seller_name}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: '#374151' }}>{s.year_month}</td>
                      <td className="px-4 py-3" style={{ color: '#64748B' }}>{fmt(s.storage_fee)}</td>
                      <td className="px-4 py-3" style={{ color: '#64748B' }}>{fmt(s.inbound_fee)}</td>
                      <td className="px-4 py-3" style={{ color: '#64748B' }}>{fmt(s.outbound_fee)}</td>
                      <td className="px-4 py-3" style={{ color: '#64748B' }}>{fmt(s.extra_fee)}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: '#0F172A' }}>{fmt(s.total_fee)}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                        {s.confirmed_at ? new Date(s.confirmed_at).toLocaleDateString('ko-KR') : '—'}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {s.status === 'DRAFT' ? (
                          <button onClick={() => handleConfirm(s.id)}
                            className="px-3 py-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs rounded-[6px] transition-colors font-medium">
                            확정
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>행 클릭 시 상세 내역 보기</p>
        </div>

        {/* Generate modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8">
              <h3 className="text-lg font-bold mb-6" style={{ color: '#0F172A' }}>정산 생성</h3>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>셀러 *</label>
                  <select name="seller_id" value={form.seller_id} onChange={handleFormChange} className={INPUT_CLS}>
                    <option value="">셀러를 선택하세요</option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>셀러 목록은 기존 정산 데이터에서 로드됩니다.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>정산월 *</label>
                  <input type="month" name="year_month" value={form.year_month} onChange={handleFormChange} className={INPUT_CLS} />
                </div>
                {formError && (
                  <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm rounded-lg px-4 py-2">{formError}</div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowModal(false); setFormError('') }}
                    className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-[6px] text-sm text-[#374151] hover:bg-[#F8FAFC] transition-colors">취소</button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-[6px] text-sm font-semibold transition-colors disabled:opacity-50">
                    {submitting ? '생성 중...' : '생성'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Settlement detail modal */}
        {selectedSettlement && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-bold text-lg" style={{ color: '#0F172A' }}>정산 상세 내역</h3>
                  <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                    {settlementDetail?.seller_name || selectedSettlement.seller_name} · {selectedSettlement.year_month}
                  </p>
                </div>
                <button onClick={() => setSelectedSettlement(null)}
                  className="text-[#94A3B8] hover:text-[#475569] text-2xl font-light leading-none">×</button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[#E2E8F0] px-6 shrink-0 overflow-x-auto">
                {DETAIL_TABS.map(({ key, label }) => (
                  <button key={key} onClick={() => setDetailTab(key)}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                      detailTab === key ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-[#64748B] hover:text-[#374151]'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {detailLoading ? (
                  <div className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>로딩 중...</div>
                ) : !settlementDetail ? (
                  <div className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>데이터를 불러올 수 없습니다.</div>
                ) : detailTab === 'summary' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={settlementDetail.status} />
                      <span className="text-sm font-medium" style={{ color: '#374151' }}>{settlementDetail.period}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { label: '합계', value: settlementDetail.summary.total, highlight: true },
                        { label: '보관료', value: settlementDetail.summary.storage_fee },
                        { label: '입고비', value: settlementDetail.summary.inbound_fee },
                        { label: '출고비', value: settlementDetail.summary.outbound_fee },
                        { label: '부가작업비', value: settlementDetail.summary.extra_fee },
                      ].map(item => (
                        <div key={item.label} className={`rounded-lg p-4 border ${item.highlight ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-[#E2E8F0] bg-[#F8FAFC]'}`}>
                          <p className="text-xs font-medium mb-1" style={{ color: item.highlight ? '#1D4ED8' : '#64748B' }}>{item.label}</p>
                          <p className={`text-xl font-bold ${item.highlight ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>{fmt(item.value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : detailTab === 'outbound' ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>출고 상세 내역</p>
                    {settlementDetail.outbound_items.length === 0 ? (
                      <p className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>출고 내역이 없습니다.</p>
                    ) : (
                      <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-[#F8FAFC]">
                            <tr>
                              {['날짜', '주문번호', '상품명', '수량', '단가', '금액'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#64748B' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {settlementDetail.outbound_items.map((item, i) => (
                              <tr key={i} className="border-t border-[#F1F5F9]">
                                <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{item.date}</td>
                                <td className="px-3 py-2 font-mono text-xs" style={{ color: '#64748B' }}>{item.order_number}</td>
                                <td className="px-3 py-2" style={{ color: '#0F172A' }}>{item.product_name}</td>
                                <td className="px-3 py-2" style={{ color: '#374151' }}>{item.quantity}</td>
                                <td className="px-3 py-2" style={{ color: '#374151' }}>{fmt(item.unit_price)}</td>
                                <td className="px-3 py-2 font-medium" style={{ color: '#0F172A' }}>{fmt(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex justify-end mt-2">
                      <span className="text-sm font-bold" style={{ color: '#0F172A' }}>
                        출고비 합계: {fmt(settlementDetail.summary.outbound_fee)}
                      </span>
                    </div>
                  </div>
                ) : detailTab === 'storage' ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>보관료 상세 내역</p>
                    {settlementDetail.storage_items.length === 0 ? (
                      <p className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>보관 내역이 없습니다.</p>
                    ) : (
                      <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-[#F8FAFC]">
                            <tr>
                              {['상품명', '평균 재고', '일수', '단가 (원/개/일)', '금액'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#64748B' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {settlementDetail.storage_items.map((item, i) => (
                              <tr key={i} className="border-t border-[#F1F5F9]">
                                <td className="px-3 py-2" style={{ color: '#0F172A' }}>{item.product_name}</td>
                                <td className="px-3 py-2" style={{ color: '#374151' }}>{item.avg_stock}개</td>
                                <td className="px-3 py-2" style={{ color: '#374151' }}>{item.days}일</td>
                                <td className="px-3 py-2" style={{ color: '#374151' }}>{item.unit_price}원</td>
                                <td className="px-3 py-2 font-medium" style={{ color: '#0F172A' }}>{fmt(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex justify-end mt-2">
                      <span className="text-sm font-bold" style={{ color: '#0F172A' }}>
                        보관료 합계: {fmt(settlementDetail.summary.storage_fee)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>입고 상세 내역</p>
                    {settlementDetail.inbound_items.length === 0 ? (
                      <p className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>입고 내역이 없습니다.</p>
                    ) : (
                      <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-[#F8FAFC]">
                            <tr>
                              {['날짜', '상품명', '수량', '유형', '단가', '금액'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#64748B' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {settlementDetail.inbound_items.map((item, i) => (
                              <tr key={i} className="border-t border-[#F1F5F9]">
                                <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{item.date}</td>
                                <td className="px-3 py-2" style={{ color: '#0F172A' }}>{item.product_name}</td>
                                <td className="px-3 py-2" style={{ color: '#374151' }}>{item.quantity}</td>
                                <td className="px-3 py-2">
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-[#DCFCE7] text-[#166534]">{item.type}</span>
                                </td>
                                <td className="px-3 py-2" style={{ color: '#374151' }}>{fmt(item.unit_price)}</td>
                                <td className="px-3 py-2 font-medium" style={{ color: '#0F172A' }}>{fmt(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex justify-end mt-2">
                      <span className="text-sm font-bold" style={{ color: '#0F172A' }}>
                        입고비 합계: {fmt(settlementDetail.summary.inbound_fee)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
