import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const EMPTY_FORM = { email: '', password: '', full_name: '', company_name: '', business_number: '' }

const INPUT_CLS = "w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ko-KR')
}

function SummaryModal({ seller, onClose }) {
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    api.get(`/sellers/${seller.id}/summary`).then(r => setDetail(r.data)).catch(() => {})
  }, [seller.id])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h3 className="font-bold text-lg" style={{ color: '#0F172A' }}>{seller.full_name}</h3>
            <p className="text-xs" style={{ color: '#64748B' }}>{seller.company_name || '업체명 없음'}</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none" style={{ color: '#94A3B8' }}>×</button>
        </div>

        {!detail ? (
          <div className="text-center py-12 text-sm" style={{ color: '#94A3B8' }}>로딩 중...</div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Seller info */}
            <div className="bg-[#F8FAFC] rounded-xl p-4 space-y-2">
              {[
                { label: '이메일', value: detail.seller.email },
                { label: '업체명', value: detail.seller.company_name || '—' },
                { label: '사업자번호', value: detail.seller.business_number || '—', mono: true },
                { label: '가입일', value: timeAgo(detail.seller.joined_at) },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span style={{ color: '#64748B' }}>{row.label}</span>
                  <span className={`font-medium ${row.mono ? 'font-mono' : ''}`} style={{ color: '#0F172A' }}>{row.value}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm">
                <span style={{ color: '#64748B' }}>상태</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${detail.seller.is_active ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                  {detail.seller.is_active ? '활성' : '비활성'}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 text-center">
                <p className="text-xs" style={{ color: '#2563EB' }}>총 주문</p>
                <p className="text-2xl font-bold" style={{ color: '#2563EB' }}>{detail.total_orders}</p>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 text-center">
                <p className="text-xs" style={{ color: '#64748B' }}>상품 수</p>
                <p className="text-2xl font-bold" style={{ color: '#0F172A' }}>{detail.total_products}</p>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 text-center">
                <p className="text-xs" style={{ color: '#16A34A' }}>총 재고</p>
                <p className="text-2xl font-bold" style={{ color: '#16A34A' }}>{detail.total_inventory}</p>
              </div>
            </div>

            {/* Products */}
            {detail.products.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2" style={{ color: '#374151' }}>보유 상품</h4>
                <div className="space-y-1">
                  {detail.products.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm bg-[#F8FAFC] rounded-lg px-3 py-2">
                      <span className="font-medium" style={{ color: '#0F172A' }}>{p.name}</span>
                      <span className="font-mono text-xs" style={{ color: '#64748B' }}>{p.sku}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent orders */}
            {detail.recent_orders.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2" style={{ color: '#374151' }}>최근 주문 (5건)</h4>
                <div className="space-y-1">
                  {detail.recent_orders.map((o, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-[#F8FAFC] rounded-lg px-3 py-2">
                      <span className="font-mono" style={{ color: '#64748B' }}>{o.order_number}</span>
                      <span className="font-medium" style={{ color: '#0F172A' }}>₩{Number(o.total_amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent settlements */}
            {detail.recent_settlements.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2" style={{ color: '#374151' }}>최근 정산</h4>
                <div className="space-y-1">
                  {detail.recent_settlements.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-[#F8FAFC] rounded-lg px-3 py-2">
                      <span className="font-medium" style={{ color: '#0F172A' }}>{s.year_month}</span>
                      <span className="font-bold" style={{ color: '#2563EB' }}>₩{Number(s.total_fee).toLocaleString()}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === 'CONFIRMED' ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
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
  const { addToast } = useToastStore()

  const [sellers, setSellers] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [summaryTarget, setSummaryTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchSellers = () => {
    api.get('/sellers/').then(r => setSellers(r.data)).catch(() => {})
  }

  useEffect(() => { fetchSellers() }, [])

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
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-7">
            <div>
              <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>셀러 관리</h2>
              <p className="mt-1 text-sm" style={{ color: '#64748B' }}>등록된 셀러 계정 관리 및 현황 조회</p>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-[6px] text-sm font-medium transition-colors">
              + 셀러 등록
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
            <div className="bg-white rounded-lg border border-[#E2E8F0] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <p className="text-sm mb-1" style={{ color: '#64748B' }}>전체 셀러</p>
              <p className="text-4xl font-bold" style={{ color: '#2563EB' }}>{sellers.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-[#E2E8F0] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <p className="text-sm mb-1" style={{ color: '#16A34A' }}>활성 셀러</p>
              <p className="text-4xl font-bold" style={{ color: '#16A34A' }}>{activeSellers}</p>
            </div>
            <div className="bg-white rounded-lg border border-[#E2E8F0] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <p className="text-sm mb-1" style={{ color: '#64748B' }}>이번달 신규</p>
              <p className="text-4xl font-bold" style={{ color: '#0F172A' }}>{newThisMonth}</p>
            </div>
          </div>

          {/* Seller table */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['셀러명', '업체명', '이메일', '상품 수', '총 주문', '총 재고', '가입일', '상태', '액션'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sellers.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>셀러가 없습니다.</td></tr>
                ) : (
                  sellers.map(s => (
                    <tr key={s.id}
                      onClick={() => setSummaryTarget(s)}
                      className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-semibold" style={{ color: '#0F172A' }}>{s.full_name}</td>
                      <td className="px-4 py-3" style={{ color: '#64748B' }}>{s.company_name || '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>{s.email}</td>
                      <td className="px-4 py-3 text-center font-medium" style={{ color: '#374151' }}>{s.total_products}</td>
                      <td className="px-4 py-3 text-center font-medium" style={{ color: '#374151' }}>{s.total_orders}</td>
                      <td className="px-4 py-3 text-center font-medium" style={{ color: '#374151' }}>{s.total_inventory.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{timeAgo(s.joined_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.is_active ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                          {s.is_active ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleActive(s)}
                          className={`text-xs px-3 py-1 rounded-[6px] font-medium transition-colors ${
                            s.is_active
                              ? 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#374151]'
                              : 'bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#166534]'
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
          <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>행 클릭 시 셀러 상세 보기</p>
        </div>

        {/* Register modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between">
                <h3 className="font-bold text-lg" style={{ color: '#0F172A' }}>셀러 등록</h3>
                <button onClick={() => setShowCreate(false)} className="text-xl" style={{ color: '#94A3B8' }}>×</button>
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
                    <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>{f.label}</label>
                    <input
                      type={f.type}
                      value={form[f.key]}
                      onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className={INPUT_CLS} />
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-[#E2E8F0] flex gap-3 justify-end">
                <button onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-[6px] text-sm text-[#374151] hover:bg-[#F8FAFC]">취소</button>
                <button onClick={handleCreate} disabled={saving}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-[6px] text-sm font-medium disabled:opacity-50 transition-colors">
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
    </SidebarLayout>
  )
}
