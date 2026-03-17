import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'

const STATUS_META = {
  REQUESTED: { label: '접수',   cls: 'bg-blue-100 text-blue-700' },
  IN_REVIEW:  { label: '검수중', cls: 'bg-yellow-100 text-yellow-700' },
  RESTOCKED:  { label: '재입고', cls: 'bg-green-100 text-green-700' },
  DISPOSED:   { label: '폐기',   cls: 'bg-gray-100 text-gray-500' },
}

const REASON_LABELS = {
  DEFECTIVE:      '상품 불량',
  WRONG_ITEM:     '오배송',
  CHANGE_OF_MIND: '단순 변심',
  OTHER:          '기타',
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || {}
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
  )
}

export default function AdminReturnPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const addToast = useToastStore((s) => s.addToast)

  const [returns, setReturns] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null) // { id, targetStatus }
  const [inspectionNote, setInspectionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchReturns = async () => {
    try {
      const res = await api.get('/returns/')
      setReturns(res.data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { fetchReturns() }, [])

  const handleLogout = () => { logout(); navigate('/login') }

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
    if (r.status === 'REQUESTED') {
      return [{ label: '검수 시작', targetStatus: 'IN_REVIEW' }]
    }
    if (r.status === 'IN_REVIEW') {
      return [
        { label: '재입고 처리', targetStatus: 'RESTOCKED' },
        { label: '폐기 처리',   targetStatus: 'DISPOSED' },
      ]
    }
    return []
  }

  return (
    <div className="min-h-screen bg-blue-50">
      <nav className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/dashboard')} className="text-blue-200 hover:text-white text-sm">
            ← 대시보드
          </button>
          <span className="text-xl font-bold">반품 관리</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-blue-100">{user?.email}</span>
          <button onClick={handleLogout} className="bg-blue-900 hover:bg-blue-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
            로그아웃
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-blue-100">
          <table className="w-full text-sm">
            <thead className="bg-blue-700 text-white">
              <tr>
                {['주문번호', '셀러명', '반품사유', '상태', '접수일', '검수 메모', '액션'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">반품 데이터가 없습니다.</td>
                </tr>
              ) : (
                returns.map((r) => {
                  const actions = getActions(r)
                  return (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-blue-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{r.order_number}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{r.seller_name}</td>
                      <td className="px-4 py-3 text-gray-600">{REASON_LABELS[r.reason] || r.reason}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                        {r.inspection_note || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {actions.length > 0 ? (
                          <div className="flex gap-2 flex-wrap">
                            {actions.map((a) => (
                              <button
                                key={a.targetStatus}
                                onClick={() => openModal(r.id, a.targetStatus)}
                                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                                  a.targetStatus === 'RESTOCKED'
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : a.targetStatus === 'DISPOSED'
                                    ? 'bg-gray-500 hover:bg-gray-600 text-white'
                                    : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                }`}
                              >
                                {a.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">총 {returns.length}건</p>
      </div>

      {/* Confirmation modal */}
      {showModal && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              {selected.targetStatus === 'RESTOCKED' ? '재입고 처리' :
               selected.targetStatus === 'DISPOSED'  ? '폐기 처리'  : '검수 시작'}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {selected.targetStatus === 'RESTOCKED'
                ? '재입고 처리 시 해당 주문 상품 수량이 재고에 반영됩니다.'
                : selected.targetStatus === 'DISPOSED'
                ? '폐기 처리된 반품은 되돌릴 수 없습니다.'
                : '반품 검수를 시작합니다.'}
            </p>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">검수 메모 (선택)</label>
              <textarea
                value={inspectionNote}
                onChange={(e) => setInspectionNote(e.target.value)}
                rows={3}
                placeholder="검수 내용을 입력하세요"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? '처리 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
