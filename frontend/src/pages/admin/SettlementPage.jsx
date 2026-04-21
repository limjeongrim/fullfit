import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

function StatusBadge({ status }) {
  return status === 'CONFIRMED'
    ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534]">확정</span>
    : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FEF9C3] text-[#854D0E]">미확정</span>
}

const fmt = (n) => `₩${Number(n ?? 0).toLocaleString()}`

const INPUT_CLS = "w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"

const CHANNEL_LABELS = {
  SMARTSTORE: '스마트스토어', OLIVEYOUNG: '올리브영',
  ZIGZAG: '지그재그', CAFE24: '카페24', MANUAL: '수동',
}

const DETAIL_TABS = [
  { key: 'summary',  label: '정산 요약' },
  { key: 'channel',  label: '채널 수수료' },
  { key: 'outbound', label: '출고비 상세' },
  { key: 'storage',  label: '보관료 상세' },
  { key: 'inbound',  label: '입고 이력' },
]

export default function AdminSettlementPage() {
  const addToast = useToastStore((s) => s.addToast)

  const [settlements, setSettlements] = useState([])
  const [sellers, setSellers]         = useState([])
  const [showModal, setShowModal]     = useState(false)
  const [form, setForm]               = useState({ seller_id: '', year_month: '' })
  const [formError, setFormError]     = useState('')
  const [submitting, setSubmitting]   = useState(false)

  const [selectedSettlement, setSelectedSettlement] = useState(null)
  const [settlementDetail, setSettlementDetail]     = useState(null)
  const [detailTab, setDetailTab]                   = useState('summary')
  const [detailLoading, setDetailLoading]           = useState(false)

  const fetchSettlements = () =>
    api.get('/settlements/').then((r) => setSettlements(r.data))

  const fetchSellers = () =>
    api.get('/sellers/').then((r) => setSellers(r.data)).catch(() => {})

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
      addToast('success', '정산이 확정되었습니다.')
    } catch (err) {
      addToast('error', err.response?.data?.detail || '확정 실패')
    }
  }

  const downloadSettlementCSV = () => {
    const esc = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s }
    const headers = ['셀러명', '정산월', '판매금액', '채널수수료', '출고비', '보관료', '반품처리비', '최종정산금액', '주문수', '반품수', '상태', '확정일']
    const rows = settlements.map(s => [
      s.seller_name, s.year_month,
      s.total_sales, s.channel_fee, s.outbound_fee, s.storage_fee, s.extra_fee, s.total_fee,
      s.order_count, s.return_count,
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
      addToast('success', '정산이 생성되었습니다.')
    } catch (err) {
      setFormError(err.response?.data?.detail || '생성 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const summary = settlementDetail?.summary

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
                  {['셀러명', '정산월', '판매금액', '채널수수료', '출고비', '보관료', '반품처리비', '최종정산금액', '상태', '확정일', '액션'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settlements.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>정산 데이터가 없습니다.</td></tr>
                ) : (
                  settlements.map((s) => (
                    <tr key={s.id}
                      onClick={() => openDetail(s)}
                      className="border-b border-[#F1F5F9] hover:bg-[#F0F4FF] transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{s.seller_name}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: '#374151' }}>{s.year_month}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: '#166534' }}>{fmt(s.total_sales)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#DC2626' }}>-{fmt(s.channel_fee)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#DC2626' }}>-{fmt(s.outbound_fee)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#DC2626' }}>-{fmt(s.storage_fee)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#DC2626' }}>-{fmt(s.extra_fee)}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: '#1D4ED8' }}>{fmt(s.total_fee)}</td>
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
                      <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                    ))}
                  </select>
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
                  <div className="space-y-5">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={settlementDetail.status} />
                      <span className="text-sm font-medium" style={{ color: '#374151' }}>{settlementDetail.period}</span>
                    </div>

                    {/* Formula breakdown table */}
                    <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                            <td className="px-4 py-3 font-medium" style={{ color: '#374151' }}>
                              총 판매금액
                              <span className="ml-2 text-xs font-normal" style={{ color: '#94A3B8' }}>({summary?.order_count ?? 0}건)</span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold" style={{ color: '#166534' }}>
                              {fmt(summary?.total_sales)}
                            </td>
                          </tr>
                          <tr className="border-b border-[#F1F5F9]">
                            <td className="px-4 py-3" style={{ color: '#374151' }}>
                              채널 수수료
                              <span className="ml-2 text-xs" style={{ color: '#94A3B8' }}>(채널별 수수료율 적용)</span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium" style={{ color: '#DC2626' }}>
                              -{fmt(summary?.channel_fee)}
                            </td>
                          </tr>
                          <tr className="border-b border-[#F1F5F9]">
                            <td className="px-4 py-3" style={{ color: '#374151' }}>
                              출고비
                              <span className="ml-2 text-xs" style={{ color: '#94A3B8' }}>(기본 800원 + 추가상품 200원)</span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium" style={{ color: '#DC2626' }}>
                              -{fmt(summary?.outbound_fee)}
                            </td>
                          </tr>
                          <tr className="border-b border-[#F1F5F9]">
                            <td className="px-4 py-3" style={{ color: '#374151' }}>
                              보관료
                              <span className="ml-2 text-xs" style={{ color: '#94A3B8' }}>(상품당 100원 × 재고수량)</span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium" style={{ color: '#DC2626' }}>
                              -{fmt(summary?.storage_fee)}
                            </td>
                          </tr>
                          <tr className="border-b border-[#E2E8F0]">
                            <td className="px-4 py-3" style={{ color: '#374151' }}>
                              반품처리비
                              <span className="ml-2 text-xs" style={{ color: '#94A3B8' }}>({summary?.return_count ?? 0}건 × 1,500원)</span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium" style={{ color: '#DC2626' }}>
                              -{fmt(summary?.return_fee)}
                            </td>
                          </tr>
                          <tr className="bg-[#EFF6FF]">
                            <td className="px-4 py-4 font-bold text-base" style={{ color: '#1D4ED8' }}>최종 정산금액</td>
                            <td className="px-4 py-4 text-right font-bold text-xl" style={{ color: '#1D4ED8' }}>
                              {fmt(summary?.final_amount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Quick stat chips */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: '총 공제', value: summary?.total_deduction, red: true },
                        { label: '주문 수', value: `${summary?.order_count ?? 0}건`, raw: true },
                        { label: '반품 수', value: `${summary?.return_count ?? 0}건`, raw: true },
                      ].map(item => (
                        <div key={item.label} className="rounded-lg p-3 border border-[#E2E8F0] bg-[#F8FAFC] text-center">
                          <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>{item.label}</p>
                          <p className={`text-lg font-bold ${item.red ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}>
                            {item.raw ? item.value : fmt(item.value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                ) : detailTab === 'channel' ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>채널 수수료 상세</p>
                    {(settlementDetail.channel_items || []).length === 0 ? (
                      <p className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>채널 수수료 내역이 없습니다.</p>
                    ) : (
                      <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-[#F8FAFC]">
                            <tr>
                              {['날짜', '주문번호', '채널', '판매금액', '수수료율', '수수료'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#64748B' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(settlementDetail.channel_items || []).map((item, i) => (
                              <tr key={i} className="border-t border-[#F1F5F9]">
                                <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{item.date}</td>
                                <td className="px-3 py-2 font-mono text-xs" style={{ color: '#64748B' }}>{item.order_number}</td>
                                <td className="px-3 py-2">
                                  <span className="px-1.5 py-0.5 rounded text-xs bg-[#F1F5F9] font-medium" style={{ color: '#374151' }}>
                                    {CHANNEL_LABELS[item.channel] || item.channel}
                                  </span>
                                </td>
                                <td className="px-3 py-2" style={{ color: '#374151' }}>{fmt(item.sales_amount)}</td>
                                <td className="px-3 py-2 text-xs" style={{ color: '#64748B' }}>{item.rate_pct}%</td>
                                <td className="px-3 py-2 font-medium" style={{ color: '#DC2626' }}>{fmt(item.fee)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex justify-end mt-2">
                      <span className="text-sm font-bold" style={{ color: '#0F172A' }}>
                        채널 수수료 합계: <span style={{ color: '#DC2626' }}>{fmt(summary?.channel_fee)}</span>
                      </span>
                    </div>
                  </div>

                ) : detailTab === 'outbound' ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#64748B' }}>출고비 상세</p>
                    <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>기본 800원 + 추가 상품 1개당 200원</p>
                    {settlementDetail.outbound_items.length === 0 ? (
                      <p className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>출고 내역이 없습니다.</p>
                    ) : (
                      <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-[#F8FAFC]">
                            <tr>
                              {['날짜', '주문번호', '채널', '상품명', '수량', '출고비'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#64748B' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {settlementDetail.outbound_items.map((item, i) => (
                              <tr key={i} className="border-t border-[#F1F5F9]">
                                <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{item.date}</td>
                                <td className="px-3 py-2 font-mono text-xs" style={{ color: '#64748B' }}>{item.order_number}</td>
                                <td className="px-3 py-2 text-xs" style={{ color: '#374151' }}>{CHANNEL_LABELS[item.channel] || item.channel}</td>
                                <td className="px-3 py-2" style={{ color: '#0F172A' }}>{item.product_name}</td>
                                <td className="px-3 py-2" style={{ color: '#374151' }}>{item.quantity}</td>
                                <td className="px-3 py-2 font-medium" style={{ color: '#DC2626' }}>{fmt(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex justify-end mt-2">
                      <span className="text-sm font-bold" style={{ color: '#0F172A' }}>
                        출고비 합계: <span style={{ color: '#DC2626' }}>{fmt(summary?.outbound_fee)}</span>
                      </span>
                    </div>
                  </div>

                ) : detailTab === 'storage' ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#64748B' }}>보관료 상세</p>
                    <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>상품당 월 100원 × 현재 재고수량</p>
                    {settlementDetail.storage_items.length === 0 ? (
                      <p className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>보관 내역이 없습니다.</p>
                    ) : (
                      <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-[#F8FAFC]">
                            <tr>
                              {['상품명', '재고수량', '단가 (원/개)', '보관료'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#64748B' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {settlementDetail.storage_items.map((item, i) => (
                              <tr key={i} className="border-t border-[#F1F5F9]">
                                <td className="px-3 py-2" style={{ color: '#0F172A' }}>{item.product_name}</td>
                                <td className="px-3 py-2" style={{ color: '#374151' }}>{item.avg_stock}개</td>
                                <td className="px-3 py-2" style={{ color: '#374151' }}>{item.unit_price}원</td>
                                <td className="px-3 py-2 font-medium" style={{ color: '#DC2626' }}>{fmt(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex justify-end mt-2">
                      <span className="text-sm font-bold" style={{ color: '#0F172A' }}>
                        보관료 합계: <span style={{ color: '#DC2626' }}>{fmt(summary?.storage_fee)}</span>
                      </span>
                    </div>
                  </div>

                ) : (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>입고 이력</p>
                    {settlementDetail.inbound_items.length === 0 ? (
                      <p className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>입고 내역이 없습니다.</p>
                    ) : (
                      <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-[#F8FAFC]">
                            <tr>
                              {['날짜', '상품명', '수량', '유형'].map(h => (
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
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
