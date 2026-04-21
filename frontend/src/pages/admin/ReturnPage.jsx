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

const GRADES = [
  { grade: 'A', label: 'A등급', desc: '새상품',    border: 'border-green-500',  bg: 'bg-green-50',  text: 'text-green-700' },
  { grade: 'B', label: 'B등급', desc: '미사용',    border: 'border-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-700' },
  { grade: 'C', label: 'C등급', desc: '사용감있음', border: 'border-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  { grade: 'D', label: 'D등급', desc: '불량/파손', border: 'border-red-500',    bg: 'bg-red-50',    text: 'text-red-700' },
]

function StatusBadge({ status }) {
  const m = STATUS_META[status] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

export default function AdminReturnPage() {
  const addToast = useToastStore((s) => s.addToast)

  const [returns, setReturns]               = useState([])
  const [filterSeller, setFilterSeller]     = useState('')
  const [sellers, setSellers]               = useState([])

  // Inspection modal state
  const [inspectionModal, setInspectionModal]   = useState(null)
  const [inspectionPhotos, setInspectionPhotos] = useState([])
  const [inspectionGrade, setInspectionGrade]   = useState('')
  const [inspectionNote, setInspectionNote]     = useState('')
  const [submitting, setSubmitting]             = useState(false)

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

  const handleStartInspection = (returnItem) => {
    setInspectionModal(returnItem)
    setInspectionPhotos([])
    setInspectionGrade('')
    setInspectionNote('')
  }

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files)
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setInspectionPhotos(prev => [...prev, { file, preview: ev.target.result, name: file.name }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const handleRemovePhoto = (index) => {
    setInspectionPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const handleInspectionSubmit = async (action) => {
    if (!inspectionGrade) {
      alert('상품 등급을 선택해주세요.')
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('action', action)
      formData.append('grade', inspectionGrade)
      formData.append('note', inspectionNote)
      inspectionPhotos.forEach((photo, i) => {
        formData.append(`photo_${i}`, photo.file)
      })

      await api.post(
        `/returns/${inspectionModal.id}/inspect`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      const actionText = action === 'RESTOCK' ? '재입고' : '폐기'
      addToast('success', `${actionText} 처리 완료! (등급: ${inspectionGrade}등급)`)
      setInspectionModal(null)
      fetchReturns()
    } catch (error) {
      addToast('error', error.response?.data?.detail || '처리 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const getActions = (r) => {
    if (r.status === 'REQUESTED') return [{ label: '검수 시작', color: 'amber' }]
    if (r.status === 'IN_REVIEW') return [
      { label: '재입고 처리', color: 'blue' },
      { label: '폐기 처리',   color: 'red' },
    ]
    return []
  }

  const BTN_CLS = {
    amber: 'bg-[#D97706] hover:bg-[#B45309] text-white',
    blue:  'bg-[#2563EB] hover:bg-[#1D4ED8] text-white',
    red:   'bg-[#DC2626] hover:bg-[#B91C1C] text-white',
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
                  {['주문번호', '셀러명', '반품사유', '상태', '등급', '접수일', '검수 메모', '액션'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>반품 데이터가 없습니다.</td></tr>
                ) : (
                  returns.map((r) => {
                    const actions = getActions(r)
                    return (
                      <tr key={r.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#374151' }}>{r.order_number}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{r.seller_name}</td>
                        <td className="px-4 py-3" style={{ color: '#64748B' }}>{REASON_LABELS[r.reason] || r.reason}</td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3 text-xs font-bold" style={{ color: '#374151' }}>
                          {r.inspection_grade ? `${r.inspection_grade}등급` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                          {new Date(r.created_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[160px] truncate" style={{ color: '#64748B' }}>{r.inspection_note || '—'}</td>
                        <td className="px-4 py-3">
                          {actions.length > 0 ? (
                            <div className="flex gap-2 flex-wrap">
                              {actions.map((a) => (
                                <button key={a.label} onClick={() => handleStartInspection(r)}
                                  className={`px-3 py-1 text-xs rounded-[6px] font-medium transition-colors ${BTN_CLS[a.color]}`}>
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

        {/* Inspection modal */}
        {inspectionModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setInspectionModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>반품 검수</h3>
                  <button onClick={() => setInspectionModal(null)} className="text-2xl leading-none" style={{ color: '#94A3B8' }}>×</button>
                </div>

                {/* Order info */}
                <div className="bg-[#F8FAFC] rounded-lg p-3 mb-5 border border-[#E2E8F0]">
                  <div className="text-xs font-medium mb-0.5" style={{ color: '#94A3B8' }}>주문번호</div>
                  <div className="font-mono text-sm font-semibold" style={{ color: '#0F172A' }}>{inspectionModal.order_number}</div>
                  <div className="text-sm mt-1" style={{ color: '#64748B' }}>
                    반품 사유: {REASON_LABELS[inspectionModal.reason] || inspectionModal.reason}
                  </div>
                </div>

                {/* Grade selection */}
                <div className="mb-5">
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#374151' }}>
                    상품 상태 등급 <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {GRADES.map(({ grade, label, desc, border, bg, text }) => (
                      <button key={grade} onClick={() => setInspectionGrade(grade)}
                        className={`p-2 rounded-lg border-2 text-center transition-colors ${
                          inspectionGrade === grade ? `${border} ${bg}` : 'border-[#E2E8F0] hover:bg-[#F8FAFC]'
                        }`}>
                        <div className={`font-bold text-sm ${inspectionGrade === grade ? text : ''}`}>{label}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{desc}</div>
                      </button>
                    ))}
                  </div>
                  {inspectionGrade && (
                    <p className="text-xs mt-1.5" style={{ color: '#64748B' }}>
                      {inspectionGrade === 'A' || inspectionGrade === 'B'
                        ? '✅ 재입고 시 재고에 수량이 추가됩니다.'
                        : '⚠️ C/D등급은 재입고해도 재고에 반영되지 않습니다.'}
                    </p>
                  )}
                </div>

                {/* Photo upload */}
                <div className="mb-5">
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#374151' }}>
                    검수 사진 <span className="font-normal text-xs" style={{ color: '#94A3B8' }}>(최대 3장)</span>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {inspectionPhotos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img src={photo.preview} alt={photo.name}
                          className="w-20 h-20 object-cover rounded-lg border border-[#E2E8F0]" />
                        <button onClick={() => handleRemovePhoto(index)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#EF4444] text-white text-xs flex items-center justify-center leading-none font-bold hover:bg-[#DC2626]">
                          ×
                        </button>
                      </div>
                    ))}
                    {inspectionPhotos.length < 3 && (
                      <label className="w-20 h-20 border-2 border-dashed border-[#CBD5E1] rounded-lg flex items-center justify-center cursor-pointer hover:border-[#2563EB] transition-colors">
                        <span className="text-2xl" style={{ color: '#94A3B8' }}>+</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Inspection note */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: '#374151' }}>
                    검수 메모 <span className="font-normal" style={{ color: '#94A3B8' }}>(선택)</span>
                  </label>
                  <textarea value={inspectionNote} onChange={(e) => setInspectionNote(e.target.value)}
                    placeholder="상품 상태 상세 설명..."
                    rows={3}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                    style={{ color: '#0F172A' }} />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button onClick={() => setInspectionModal(null)}
                    className="flex-1 px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm font-medium hover:bg-[#F8FAFC] transition-colors"
                    style={{ color: '#374151' }}>
                    취소
                  </button>
                  <button onClick={() => handleInspectionSubmit('RESTOCK')}
                    disabled={!inspectionGrade || submitting}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-colors ${
                      inspectionGrade && !submitting ? 'bg-[#16A34A] hover:bg-[#15803D]' : 'bg-[#CBD5E1] cursor-not-allowed'
                    }`}>
                    {submitting ? '처리 중...' : '재입고 처리'}
                  </button>
                  <button onClick={() => handleInspectionSubmit('DISPOSE')}
                    disabled={!inspectionGrade || submitting}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-colors ${
                      inspectionGrade && !submitting ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'bg-[#CBD5E1] cursor-not-allowed'
                    }`}>
                    {submitting ? '처리 중...' : '폐기 처리'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
