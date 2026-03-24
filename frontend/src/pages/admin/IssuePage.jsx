import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const ISSUE_TYPES = [
  { key: '',               label: '전체' },
  { key: 'STOCK_SHORTAGE', label: '재고부족' },
  { key: 'ADDRESS_ERROR',  label: '주소오류' },
  { key: 'RETURN_DELAY',   label: '반품지연' },
  { key: 'EXPIRY_HOLD',    label: '유통기한' },
  { key: 'DAMAGE',         label: '파손/불량' },
  { key: 'COURIER_ERROR',  label: '택배오류' },
  { key: 'DUPLICATE_ORDER',label: '중복주문' },
  { key: 'OTHER',          label: '기타' },
]

const PRIORITY_META = {
  CRITICAL: { label: '긴급',  cls: 'bg-[#FEE2E2] text-[#991B1B]', icon: '🔴' },
  HIGH:     { label: '높음',  cls: 'bg-[#FED7AA] text-[#9A3412]', icon: '🟠' },
  NORMAL:   { label: '보통',  cls: 'bg-[#FEF9C3] text-[#854D0E]', icon: '🟡' },
}

const STATUS_META = {
  OPEN:        { label: '미해결',  cls: 'bg-[#FEE2E2] text-[#991B1B]' },
  IN_PROGRESS: { label: '진행중',  cls: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  RESOLVED:    { label: '해결완료', cls: 'bg-[#DCFCE7] text-[#166534]' },
  CLOSED:      { label: '종결',    cls: 'bg-[#F1F5F9] text-[#64748B]' },
}

const ISSUE_TYPE_LABELS = {
  STOCK_SHORTAGE:   '재고 부족',
  ADDRESS_ERROR:    '주소 오류',
  RETURN_DELAY:     '반품 지연',
  EXPIRY_HOLD:      '유통기한 보류',
  DAMAGE:           '파손/불량',
  COURIER_ERROR:    '택배사 오류',
  DUPLICATE_ORDER:  '중복 주문',
  OTHER:            '기타',
}

const ALL_PRIORITIES = ['CRITICAL', 'HIGH', 'NORMAL']
const ALL_TYPES = Object.keys(ISSUE_TYPE_LABELS)

const INPUT_CLS = "w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"

function fmtDt(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function IssuePage() {
  const addToast = useToastStore((s) => s.addToast)
  const [searchParams] = useSearchParams()

  const [issues, setIssues] = useState([])
  const [stats, setStats] = useState(null)
  const [filterType, setFilterType] = useState('')
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')
  const [saving, setSaving] = useState(false)

  const [createForm, setCreateForm] = useState({
    issue_type: 'STOCK_SHORTAGE', priority: 'NORMAL',
    title: '', description: '', assigned_to: '',
  })
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchAll = async () => {
    try {
      const params = new URLSearchParams()
      if (filterType) params.set('issue_type', filterType)
      const [issRes, statsRes] = await Promise.all([
        api.get(`/issues/?${params}`),
        api.get('/issues/stats'),
      ])
      setIssues(issRes.data)
      setStats(statsRes.data)
    } catch (e) { console.error(e) }
  }

  useEffect(() => { fetchAll() }, [filterType])

  const handleStatusChange = async (issue, newStatus) => {
    setSaving(true)
    try {
      const body = { status: newStatus }
      if (newStatus === 'RESOLVED' && resolutionNote) body.resolution_note = resolutionNote
      await api.put(`/issues/${issue.id}`, body)
      await fetchAll()
      addToast('success', '이슈 상태가 업데이트되었습니다.')
      setSelectedIssue(null)
      setResolutionNote('')
    } catch {
      addToast('error', '업데이트에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateError('')
    if (!createForm.title) { setCreateError('제목을 입력하세요.'); return }
    setCreating(true)
    try {
      await api.post('/issues/', createForm)
      await fetchAll()
      setShowCreate(false)
      setCreateForm({ issue_type: 'STOCK_SHORTAGE', priority: 'NORMAL', title: '', description: '', assigned_to: '' })
      addToast('success', '이슈가 등록되었습니다.')
    } catch (err) {
      setCreateError(err.response?.data?.detail || '등록 실패')
    } finally {
      setCreating(false)
    }
  }

  const openCount = stats?.open ?? 0
  const inProgCount = stats?.in_progress ?? 0
  const critCount = stats?.critical ?? 0
  const highCount = stats?.high ?? 0
  const resToday = stats?.resolved_today ?? 0

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="px-6 py-6">

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: '전체 이슈',    value: stats?.total ?? '—',            cls: 'text-[#0F172A]' },
              { label: '긴급 (CRITICAL)', value: critCount,                   cls: 'text-[#DC2626]' },
              { label: '높음 (HIGH)',  value: highCount,                       cls: 'text-[#D97706]' },
              { label: '미해결',       value: (openCount + inProgCount),       cls: 'text-[#854D0E]' },
              { label: '오늘 해결',    value: resToday,                        cls: 'text-[#16A34A]' },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <p className="text-xs" style={{ color: '#64748B' }}>{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Type filter tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {ISSUE_TYPES.map(({ key, label }) => (
              <button key={key} onClick={() => setFilterType(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterType === key
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-white border border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC]'
                }`}>
                {label}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={() => setShowCreate(true)}
              className="bg-[#DC2626] hover:bg-[#B91C1C] text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors">
              + 이슈 등록
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['우선순위', '유형', '제목', '관련 주문', '셀러', '상태', '발생일시', '담당자', '액션'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: '#94A3B8' }}>이슈가 없습니다.</td></tr>
                ) : (
                  issues.map((issue) => {
                    const pm = PRIORITY_META[issue.priority] || PRIORITY_META.NORMAL
                    const sm = STATUS_META[issue.status] || STATUS_META.OPEN
                    return (
                      <tr key={issue.id}
                        onClick={() => { setSelectedIssue(issue); setResolutionNote(issue.resolution_note || '') }}
                        className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] cursor-pointer transition-colors ${
                          issue.priority === 'CRITICAL' ? 'bg-[#FEF2F2]' : issue.priority === 'HIGH' ? 'bg-[#FFF7ED]' : ''
                        }`}>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pm.cls}`}>
                            {pm.icon} {pm.label}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-[#F1F5F9] text-[#475569] font-medium">
                            {ISSUE_TYPE_LABELS[issue.issue_type] || issue.issue_type}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-medium max-w-[200px] truncate" style={{ color: '#0F172A' }}>{issue.title}</td>
                        <td className="px-3 py-3 font-mono text-xs" style={{ color: '#64748B' }}>{issue.order_number || '—'}</td>
                        <td className="px-3 py-3 text-xs" style={{ color: '#374151' }}>{issue.seller_name || '—'}</td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sm.cls}`}>{sm.label}</span>
                        </td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{fmtDt(issue.created_at)}</td>
                        <td className="px-3 py-3 text-xs" style={{ color: '#374151' }}>{issue.assigned_to || '—'}</td>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            {issue.status === 'OPEN' && (
                              <button onClick={() => handleStatusChange(issue, 'IN_PROGRESS')}
                                className="text-xs px-2 py-1 bg-[#DBEAFE] text-[#1D4ED8] rounded font-medium hover:bg-[#BFDBFE] transition-colors whitespace-nowrap">
                                처리 시작
                              </button>
                            )}
                            {issue.status === 'IN_PROGRESS' && (
                              <button onClick={() => { setSelectedIssue(issue); setResolutionNote('') }}
                                className="text-xs px-2 py-1 bg-[#DCFCE7] text-[#166534] rounded font-medium hover:bg-[#BBF7D0] transition-colors whitespace-nowrap">
                                해결 완료
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>총 {issues.length}건</p>
        </div>

        {/* Detail modal */}
        {selectedIssue && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
              <div className="flex items-start justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${(PRIORITY_META[selectedIssue.priority] || PRIORITY_META.NORMAL).cls}`}>
                      {(PRIORITY_META[selectedIssue.priority] || PRIORITY_META.NORMAL).icon} {(PRIORITY_META[selectedIssue.priority] || PRIORITY_META.NORMAL).label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${(STATUS_META[selectedIssue.status] || STATUS_META.OPEN).cls}`}>
                      {(STATUS_META[selectedIssue.status] || STATUS_META.OPEN).label}
                    </span>
                  </div>
                  <h3 className="text-base font-bold" style={{ color: '#0F172A' }}>{selectedIssue.title}</h3>
                </div>
                <button onClick={() => setSelectedIssue(null)} className="text-[#94A3B8] hover:text-[#64748B] text-xl leading-none ml-4">×</button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-xs font-medium" style={{ color: '#64748B' }}>유형</span><p style={{ color: '#374151' }}>{ISSUE_TYPE_LABELS[selectedIssue.issue_type] || selectedIssue.issue_type}</p></div>
                  <div><span className="text-xs font-medium" style={{ color: '#64748B' }}>셀러</span><p style={{ color: '#374151' }}>{selectedIssue.seller_name || '—'}</p></div>
                  <div><span className="text-xs font-medium" style={{ color: '#64748B' }}>관련 주문</span><p className="font-mono text-xs" style={{ color: '#374151' }}>{selectedIssue.order_number || '—'}</p></div>
                  <div><span className="text-xs font-medium" style={{ color: '#64748B' }}>담당자</span><p style={{ color: '#374151' }}>{selectedIssue.assigned_to || '—'}</p></div>
                  <div><span className="text-xs font-medium" style={{ color: '#64748B' }}>발생일시</span><p style={{ color: '#374151' }}>{fmtDt(selectedIssue.created_at)}</p></div>
                  <div><span className="text-xs font-medium" style={{ color: '#64748B' }}>해결일시</span><p style={{ color: '#374151' }}>{selectedIssue.resolved_at ? fmtDt(selectedIssue.resolved_at) : '—'}</p></div>
                </div>

                {selectedIssue.description && (
                  <div className="bg-[#F8FAFC] rounded-lg p-3">
                    <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>설명</p>
                    <p className="text-sm whitespace-pre-line" style={{ color: '#374151' }}>{selectedIssue.description}</p>
                  </div>
                )}

                {selectedIssue.resolution_note && (
                  <div className="bg-[#DCFCE7] rounded-lg p-3">
                    <p className="text-xs font-medium mb-1" style={{ color: '#166534' }}>해결 내용</p>
                    <p className="text-sm whitespace-pre-line" style={{ color: '#166534' }}>{selectedIssue.resolution_note}</p>
                  </div>
                )}

                {(selectedIssue.status === 'OPEN' || selectedIssue.status === 'IN_PROGRESS') && (
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>해결 메모</label>
                    <textarea
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      rows={3}
                      placeholder="해결 내용 또는 조치 사항을 입력하세요"
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 resize-none"
                    />
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-[#E2E8F0] shrink-0 flex gap-2 justify-end">
                <button onClick={() => setSelectedIssue(null)}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-lg text-sm text-[#374151] hover:bg-[#F8FAFC] transition-colors">
                  닫기
                </button>
                {selectedIssue.status === 'OPEN' && (
                  <button disabled={saving} onClick={() => handleStatusChange(selectedIssue, 'IN_PROGRESS')}
                    className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                    처리 시작
                  </button>
                )}
                {(selectedIssue.status === 'OPEN' || selectedIssue.status === 'IN_PROGRESS') && (
                  <button disabled={saving} onClick={() => handleStatusChange(selectedIssue, 'RESOLVED')}
                    className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                    해결 완료
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
                <h3 className="text-base font-bold" style={{ color: '#0F172A' }}>이슈 등록</h3>
                <button onClick={() => setShowCreate(false)} className="text-[#94A3B8] hover:text-[#64748B] text-xl">×</button>
              </div>
              <form onSubmit={handleCreate} className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>이슈 유형 *</label>
                  <select value={createForm.issue_type} onChange={(e) => setCreateForm((f) => ({ ...f, issue_type: e.target.value }))} className={INPUT_CLS}>
                    {ALL_TYPES.map((t) => <option key={t} value={t}>{ISSUE_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>우선순위 *</label>
                  <select value={createForm.priority} onChange={(e) => setCreateForm((f) => ({ ...f, priority: e.target.value }))} className={INPUT_CLS}>
                    {ALL_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>제목 *</label>
                  <input type="text" value={createForm.title}
                    onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="이슈 제목" className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>설명</label>
                  <textarea value={createForm.description}
                    onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3} placeholder="상세 내용" className={`${INPUT_CLS} resize-none`} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>담당자</label>
                  <input type="text" value={createForm.assigned_to}
                    onChange={(e) => setCreateForm((f) => ({ ...f, assigned_to: e.target.value }))}
                    placeholder="담당자 이름" className={INPUT_CLS} />
                </div>
                {createError && <div className="bg-[#FEE2E2] border border-red-200 text-[#991B1B] text-sm rounded-lg px-4 py-2">{createError}</div>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-lg text-sm text-[#374151] hover:bg-[#F8FAFC] transition-colors">취소</button>
                  <button type="submit" disabled={creating}
                    className="flex-1 px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                    {creating ? '등록 중...' : '등록'}
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
