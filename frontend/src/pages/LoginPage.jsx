import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

const ROLE_DASHBOARDS = {
  ADMIN: '/admin/dashboard',
  WORKER: '/worker/dashboard',
  SELLER: '/seller/dashboard',
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

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

        {/* Role guide */}
        <div className="mt-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 text-xs space-y-1" style={{ color: '#64748B' }}>
          <p className="font-semibold mb-2" style={{ color: '#374151' }}>테스트 계정 안내</p>
          <p><span className="font-medium" style={{ color: '#0F172A' }}>관리자:</span> admin@fullfit.com / admin1234</p>
          <p><span className="font-medium" style={{ color: '#0F172A' }}>작업자:</span> worker@fullfit.com / worker1234</p>
          <p><span className="font-medium" style={{ color: '#0F172A' }}>셀러:</span> seller@fullfit.com / seller1234</p>
        </div>
      </div>
    </div>
  )
}
