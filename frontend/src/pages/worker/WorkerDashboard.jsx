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
      <div className="min-h-screen bg-green-50">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Greeting */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-green-900">안녕하세요,</h2>
            <h2 className="text-3xl font-bold text-green-900">{user?.full_name}님!</h2>
            <p className="text-green-600 mt-2 text-base">오늘도 수고해주세요!</p>
          </div>

          {/* Flow guide */}
          <div className="mb-5 bg-white rounded-2xl border border-green-100 px-5 py-4">
            <p className="text-xs text-gray-400 font-medium mb-3">작업 순서</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-center">
                <div className="text-2xl">📦</div>
                <p className="text-xs font-semibold text-gray-700 mt-1">피킹 시작</p>
              </div>
              <div className="text-gray-300 text-lg font-bold">→</div>
              <div className="flex-1 text-center">
                <div className="text-2xl">✅</div>
                <p className="text-xs font-semibold text-gray-700 mt-1">패킹 완료</p>
              </div>
              <div className="text-gray-300 text-lg font-bold">→</div>
              <div className="flex-1 text-center">
                <div className="text-2xl">🚚</div>
                <p className="text-xs font-semibold text-gray-700 mt-1">출고 처리</p>
              </div>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div
              onClick={() => navigate('/worker/picking')}
              className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-center cursor-pointer hover:shadow-md hover:brightness-95 transition-all">
              <p className="text-sm font-semibold text-blue-600">피킹 대기</p>
              <p className="text-5xl font-bold text-blue-700 mt-1">{counts.received ?? '—'}</p>
              <p className="text-xs text-blue-400 mt-1">→ 바로가기</p>
            </div>
            <div
              onClick={() => navigate('/worker/picking')}
              className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 text-center cursor-pointer hover:shadow-md hover:brightness-95 transition-all">
              <p className="text-sm font-semibold text-yellow-600">패킹 대기</p>
              <p className="text-5xl font-bold text-yellow-700 mt-1">{counts.picking ?? '—'}</p>
              <p className="text-xs text-yellow-400 mt-1">→ 바로가기</p>
            </div>
            <div
              onClick={() => navigate('/worker/outbound')}
              className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 text-center cursor-pointer hover:shadow-md hover:brightness-95 transition-all">
              <p className="text-sm font-semibold text-orange-600">출고 대기</p>
              <p className="text-5xl font-bold text-orange-700 mt-1">{counts.packed ?? '—'}</p>
              <p className="text-xs text-orange-400 mt-1">→ 바로가기</p>
            </div>
          </div>

          {/* Today's activity */}
          <div className="bg-white rounded-2xl border border-green-100 px-5 py-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">오늘 내 처리 현황</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚚</span>
                <p className="text-sm text-gray-600">오늘 출고 완료</p>
              </div>
              <span className="text-3xl font-bold text-green-700">
                {counts.shippedToday ?? '—'}<span className="text-lg font-medium">건</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
