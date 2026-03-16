import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'

function StatusBadge({ status }) {
  return status === 'CONFIRMED'
    ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">확정</span>
    : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">미확정</span>
}

const fmt = (n) => `₩${Number(n).toLocaleString()}`

export default function AdminSettlementPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const [settlements, setSettlements] = useState([])
  const [sellers, setSellers] = useState([])
  const [toast, setToast] = useState({ msg: '', type: 'success' })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ seller_id: '', year_month: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3000)
  }

  const fetchSettlements = () =>
    api.get('/settlements/').then((r) => setSettlements(r.data))

  const fetchSellers = () =>
    api.get('/orders/?limit=1').then(() =>
      // Derive seller list from existing settlements or fetch users
      api.get('/settlements/').then((r) => {
        const seen = new Map()
        r.data.forEach((s) => seen.set(s.seller_id, s.seller_name))
        setSellers([...seen.entries()].map(([id, name]) => ({ id, name })))
      })
    ).catch(() => {})

  useEffect(() => { fetchSettlements(); fetchSellers() }, [])

  const handleLogout = () => { logout(); navigate('/login') }

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
    <div className="min-h-screen bg-blue-50">
      <nav className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/dashboard')} className="text-blue-200 hover:text-white text-sm">← 대시보드</button>
          <span className="text-xl font-bold">정산 관리</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-blue-100">{user?.email}</span>
          <button onClick={handleLogout} className="bg-blue-900 hover:bg-blue-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">로그아웃</button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {toast.msg && (
          <div className={`mb-4 rounded-xl px-5 py-3 font-medium border ${
            toast.type === 'error' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-green-50 border-green-300 text-green-700'
          }`}>
            {toast.type === 'error' ? '⚠️' : '✅'} {toast.msg}
          </div>
        )}

        <div className="flex justify-end mb-5">
          <button onClick={() => setShowModal(true)}
            className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
            + 정산 생성
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-blue-100">
          <table className="w-full text-sm">
            <thead className="bg-blue-700 text-white">
              <tr>
                {['셀러명', '정산월', '보관료', '입고비', '출고비', '부가작업비', '합계', '상태', '확정일', '액션'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-gray-400">정산 데이터가 없습니다.</td></tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100 hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{s.seller_name}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{s.year_month}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(s.storage_fee)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(s.inbound_fee)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(s.outbound_fee)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(s.extra_fee)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{fmt(s.total_fee)}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {s.confirmed_at ? new Date(s.confirmed_at).toLocaleDateString('ko-KR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {s.status === 'DRAFT' ? (
                        <button onClick={() => handleConfirm(s.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition-colors font-medium">
                          확정
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
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
            <h3 className="text-lg font-bold text-gray-800 mb-6">정산 생성</h3>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">셀러 *</label>
                <select name="seller_id" value={form.seller_id} onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">셀러를 선택하세요</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">셀러 목록은 기존 정산 데이터에서 로드됩니다.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">정산월 *</label>
                <input type="month" name="year_month" value={form.year_month} onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2">{formError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setFormError('') }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                  {submitting ? '생성 중...' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
