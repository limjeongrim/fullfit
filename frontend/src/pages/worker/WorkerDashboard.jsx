import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

export default function WorkerDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [counts, setCounts] = useState({ received: null, picking: null, packed: null, shippedToday: null })

  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    api.get('/orders/?limit=200').then((res) => {
      const items = res.data.items
      setCounts({
        received:     items.filter((o) => o.status === 'RECEIVED').length,
        picking:      items.filter((o) => o.status === 'PICKING').length,
        packed:       items.filter((o) => o.status === 'PACKED').length,
        shippedToday: items.filter((o) => o.status === 'SHIPPED' && o.created_at.slice(0, 10) === todayStr).length,
      })
    }).catch(() => {})
  }, [])

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Greeting */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>안녕하세요,</h2>
            <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>{user?.full_name}님!</h2>
            <p className="mt-2 text-base" style={{ color: '#64748B' }}>오늘도 수고해주세요!</p>
          </div>

          {/* Flow guide */}
          <div className="mb-5 bg-white rounded-xl border border-[#E2E8F0] px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <p className="text-xs font-medium mb-3" style={{ color: '#94A3B8' }}>작업 순서</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-center">
                <div className="text-2xl">📦</div>
                <p className="text-xs font-semibold mt-1" style={{ color: '#374151' }}>피킹 시작</p>
              </div>
              <div className="text-lg font-bold" style={{ color: '#E2E8F0' }}>→</div>
              <div className="flex-1 text-center">
                <div className="text-2xl">✅</div>
                <p className="text-xs font-semibold mt-1" style={{ color: '#374151' }}>패킹 완료</p>
              </div>
              <div className="text-lg font-bold" style={{ color: '#E2E8F0' }}>→</div>
              <div className="flex-1 text-center">
                <div className="text-2xl">🚚</div>
                <p className="text-xs font-semibold mt-1" style={{ color: '#374151' }}>출고 처리</p>
              </div>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div
              onClick={() => navigate('/worker/picking')}
              className="bg-white border-2 border-[#DBEAFE] rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition-all"
            >
              <p className="text-sm font-semibold" style={{ color: '#2563EB' }}>피킹 대기</p>
              <p className="text-4xl font-bold mt-1" style={{ color: '#1D4ED8' }}>{counts.received ?? '—'}</p>
              <p className="text-xs mt-1" style={{ color: '#93C5FD' }}>→ 바로가기</p>
            </div>
            <div
              onClick={() => navigate('/worker/picking')}
              className="bg-white border-2 border-[#FEF9C3] rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition-all"
            >
              <p className="text-sm font-semibold" style={{ color: '#D97706' }}>패킹 대기</p>
              <p className="text-4xl font-bold mt-1" style={{ color: '#B45309' }}>{counts.picking ?? '—'}</p>
              <p className="text-xs mt-1" style={{ color: '#FCD34D' }}>→ 바로가기</p>
            </div>
            <div
              onClick={() => navigate('/worker/outbound')}
              className="bg-white border-2 border-[#FED7AA] rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition-all"
            >
              <p className="text-sm font-semibold" style={{ color: '#D97706' }}>출고 대기</p>
              <p className="text-4xl font-bold mt-1" style={{ color: '#9A3412' }}>{counts.packed ?? '—'}</p>
              <p className="text-xs mt-1" style={{ color: '#FDBA74' }}>→ 바로가기</p>
            </div>
          </div>

          {/* Today's activity */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <p className="text-sm font-semibold mb-3" style={{ color: '#374151' }}>오늘 내 처리 현황</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚚</span>
                <p className="text-sm" style={{ color: '#64748B' }}>오늘 출고 완료</p>
              </div>
              <span className="text-3xl font-bold" style={{ color: '#16A34A' }}>
                {counts.shippedToday ?? '—'}<span className="text-lg font-medium">건</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
