import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'

const EMPTY_FORM = { email: '', password: '', full_name: '', company_name: '', business_number: '' }

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ko-KR')
}

function SummaryModal({ seller, onClose }) {
  const [detail, setDetail] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get(`/sellers/${seller.id}/summary`).then(r => setDetail(r.data)).catch(() => {})
  }, [seller.id])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h3 className="font-bold text-lg text-gray-800">{seller.full_name}</h3>
            <p className="text-xs text-gray-500">{seller.company_name || '업체명 없음'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {!detail ? (
          <div className="text-center py-12 text-gray-400">로딩 중...</div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Seller info */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">이메일</span>
                <span className="font-medium">{detail.seller.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">업체명</span>
                <span className="font-medium">{detail.seller.company_name || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">사업자번호</span>
                <span className="font-medium font-mono">{detail.seller.business_number || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">가입일</span>
                <span className="font-medium">{timeAgo(detail.seller.joined_at)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">상태</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${detail.seller.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {detail.seller.is_active ? '활성' : '비활성'}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-600">총 주문</p>
                <p className="text-2xl font-bold text-blue-700">{detail.total_orders}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-xs text-purple-600">상품 수</p>
                <p className="text-2xl font-bold text-purple-700">{detail.total_products}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-green-600">총 재고</p>
                <p className="text-2xl font-bold text-green-700">{detail.total_inventory}</p>
              </div>
            </div>

            {/* Products */}
            {detail.products.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 text-sm mb-2">보유 상품</h4>
                <div className="space-y-1">
                  {detail.products.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-medium text-gray-800">{p.name}</span>
                      <span className="font-mono text-xs text-gray-500">{p.sku}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent orders */}
            {detail.recent_orders.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 text-sm mb-2">최근 주문 (5건)</h4>
                <div className="space-y-1">
                  {detail.recent_orders.map((o, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-mono text-gray-600">{o.order_number}</span>
                      <span className="font-medium text-gray-800">₩{Number(o.total_amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent settlements */}
            {detail.recent_settlements.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 text-sm mb-2">최근 정산</h4>
                <div className="space-y-1">
                  {detail.recent_settlements.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-medium text-gray-800">{s.year_month}</span>
                      <span className="font-bold text-blue-700">₩{Number(s.total_fee).toLocaleString()}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.status === 'CONFIRMED' ? '확정' : '임시'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SellerManagementPage() {
  const { user, logout } = useAuthStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()

  const [sellers, setSellers] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [summaryTarget, setSummaryTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchSellers = () => {
    api.get('/sellers/').then(r => setSellers(r.data)).catch(() => {})
  }

  useEffect(() => { fetchSellers() }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const handleToggleActive = async (s) => {
    try {
      await api.patch(`/sellers/${s.id}/toggle-active`)
      addToast('success', `${s.full_name} 셀러가 ${s.is_active ? '비활성화' : '활성화'}되었습니다.`)
      fetchSellers()
    } catch (e) {
      addToast('error', '처리 실패')
    }
  }

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name) {
      addToast('warning', '필수 항목을 입력하세요.')
      return
    }
    setSaving(true)
    try {
      await api.post('/auth/register', form)
      addToast('success', `셀러 "${form.full_name}" 등록 완료`)
      setShowCreate(false)
      setForm(EMPTY_FORM)
      fetchSellers()
    } catch (e) {
      addToast('error', e.response?.data?.detail || '등록 실패')
    } finally {
      setSaving(false)
    }
  }

  const thisMonth = new Date().toISOString().slice(0, 7)
  const activeSellers = sellers.filter(s => s.is_active).length
  const newThisMonth = sellers.filter(s => s.joined_at?.slice(0, 7) === thisMonth).length

  return (
    <div className="min-h-screen bg-blue-50">
      <nav className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/dashboard')} className="text-blue-200 hover:text-white text-sm">← 대시보드</button>
          <span className="text-xl font-bold">셀러 관리</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-blue-100">{user?.email}</span>
          <button onClick={handleLogout} className="bg-blue-900 hover:bg-blue-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">로그아웃</button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h2 className="text-2xl font-bold text-blue-900">셀러 관리</h2>
            <p className="text-blue-600 mt-1 text-sm">등록된 셀러 계정 관리 및 현황 조회</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + 셀러 등록
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          <div className="bg-white rounded-xl border border-blue-100 p-5">
            <p className="text-sm text-gray-500 mb-1">전체 셀러</p>
            <p className="text-4xl font-bold text-blue-700">{sellers.length}</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-5">
            <p className="text-sm text-green-600 mb-1">활성 셀러</p>
            <p className="text-4xl font-bold text-green-700">{activeSellers}</p>
          </div>
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-5">
            <p className="text-sm text-purple-600 mb-1">이번달 신규</p>
            <p className="text-4xl font-bold text-purple-700">{newThisMonth}</p>
          </div>
        </div>

        {/* Seller table */}
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-blue-700 text-white">
              <tr>
                {['셀러명', '업체명', '이메일', '상품 수', '총 주문', '총 재고', '가입일', '상태', '액션'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sellers.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">셀러가 없습니다.</td></tr>
              ) : (
                sellers.map(s => (
                  <tr key={s.id}
                    onClick={() => setSummaryTarget(s)}
                    className="border-t border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-semibold text-gray-800">{s.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.company_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.email}</td>
                    <td className="px-4 py-3 text-center font-medium">{s.total_products}</td>
                    <td className="px-4 py-3 text-center font-medium">{s.total_orders}</td>
                    <td className="px-4 py-3 text-center font-medium">{s.total_inventory.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{timeAgo(s.joined_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleActive(s)}
                        className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                          s.is_active
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            : 'bg-green-100 hover:bg-green-200 text-green-700'
                        }`}>
                        {s.is_active ? '비활성화' : '활성화'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">행 클릭 시 셀러 상세 보기</p>
      </div>

      {/* Register modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-800">셀러 등록</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {[
                { key: 'email', label: '이메일 *', type: 'email', placeholder: 'seller@example.com' },
                { key: 'password', label: '비밀번호 *', type: 'password', placeholder: '••••••••' },
                { key: 'full_name', label: '이름 *', type: 'text', placeholder: '홍길동' },
                { key: 'company_name', label: '업체명', type: 'text', placeholder: '길동뷰티' },
                { key: 'business_number', label: '사업자번호', type: 'text', placeholder: '000-00-00000' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key]}
                    onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleCreate} disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {summaryTarget && (
        <SummaryModal seller={summaryTarget} onClose={() => setSummaryTarget(null)} />
      )}
    </div>
  )
}
