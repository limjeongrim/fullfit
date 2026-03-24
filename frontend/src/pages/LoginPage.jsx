import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

const ROLE_DASHBOARDS = {
  ADMIN: '/admin/dashboard',
  WORKER: '/worker/dashboard',
  SELLER: '/seller/dashboard',
}

const QUICK_ACCOUNTS = [
  { label: '관리자',  group: 'admin',  email: 'admin@fullfit.com',    password: 'admin1234',   badge: 'A', color: '#2563EB' },
  { label: '작업자',  group: 'worker', email: 'worker@fullfit.com',   password: 'worker1234',  badge: 'W', color: '#16A34A' },
]

const SELLER_ACCOUNTS = [
  { label: '달바',    email: 'dalba@fullfit.com',    password: 'seller1234' },
  { label: '클리오',  email: 'clio@fullfit.com',     password: 'seller1234' },
  { label: '구달',    email: 'goodal@fullfit.com',   password: 'seller1234' },
  { label: '비플레인', email: 'bplain@fullfit.com',  password: 'seller1234' },
  { label: '삐아',    email: 'bbia@fullfit.com',     password: 'seller1234' },
  { label: '스킨푸드', email: 'skinfood@fullfit.com', password: 'seller1234' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sellerOpen, setSellerOpen] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const fill = (e, p) => { setEmail(e); setPassword(p); setError(''); setSellerOpen(false) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      navigate(ROLE_DASHBOARDS[user.role] || '/login')
    } catch (err) {
      setError(err.response?.data?.detail || '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3" style={{ background: '#2563EB' }}>
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>FullFit</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>화장품 풀필먼트 운영 플랫폼</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="email@example.com"
              className="w-full px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-colors"
              style={{ color: '#0F172A' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="비밀번호를 입력하세요"
              className="w-full px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-colors"
              style={{ color: '#0F172A' }}
            />
          </div>

          {error && (
            <div className="bg-[#FEE2E2] border border-red-200 text-[#991B1B] text-sm rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: loading ? '#93C5FD' : '#2563EB' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1D4ED8' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#2563EB' }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* Quick login */}
        <div className="mt-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4">
          <p className="text-xs font-semibold mb-3" style={{ color: '#374151' }}>빠른 로그인 (테스트 계정)</p>

          {/* Admin + Worker buttons */}
          <div className="flex gap-2 mb-2">
            {QUICK_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => fill(a.email, a.password)}
                className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all hover:shadow-sm active:scale-[0.98]"
                style={{
                  borderColor: a.color + '40',
                  backgroundColor: a.color + '08',
                }}
              >
                <span
                  className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                  style={{ background: a.color }}
                >
                  {a.badge}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight" style={{ color: '#0F172A' }}>{a.label}</p>
                  <p className="text-[10px] truncate" style={{ color: '#94A3B8' }}>{a.email}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Seller dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSellerOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all hover:shadow-sm"
              style={{ borderColor: '#7C3AED40', backgroundColor: '#7C3AED08' }}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: '#7C3AED' }}>S</span>
                <div>
                  <p className="text-xs font-semibold leading-tight" style={{ color: '#0F172A' }}>셀러 (브랜드 계정)</p>
                  <p className="text-[10px]" style={{ color: '#94A3B8' }}>6개 브랜드 · seller1234</p>
                </div>
              </div>
              <span className="text-xs" style={{ color: '#94A3B8' }}>{sellerOpen ? '▲' : '▼'}</span>
            </button>

            {sellerOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-lg z-10 overflow-hidden">
                {SELLER_ACCOUNTS.map((s) => (
                  <button
                    key={s.email}
                    type="button"
                    onClick={() => fill(s.email, s.password)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#F5F3FF] transition-colors border-b border-[#F1F5F9] last:border-0"
                  >
                    <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>{s.label}</span>
                    <span className="text-xs font-mono" style={{ color: '#94A3B8' }}>{s.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
