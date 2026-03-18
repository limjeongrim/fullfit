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

export default function AdminSettlementPage() {
  const addToast = useToastStore((s) => s.addToast)

  const [settlements, setSettlements] = useState([])
  const [sellers, setSellers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ seller_id: '', year_month: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  const handleConfirm = async (id) => {
    try {
      await api.patch(`/settlements/${id}/confirm`)
      await fetchSettlements()
      showToast('정산이 확정되었습니다.')
    } catch (err) {
      showToast(err.response?.data?.detail || '확정 실패', 'error')
    }
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
          <div className="flex justify-end mb-5">
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
                    <tr key={s.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
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
                      <td className="px-4 py-3">
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
      </div>
    </SidebarLayout>
  )
}
