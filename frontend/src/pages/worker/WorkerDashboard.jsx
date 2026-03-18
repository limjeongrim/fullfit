import { useEffect, useState } from 'react'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

export default function WorkerDashboard() {
  const { user } = useAuthStore()
  const [counts, setCounts] = useState({ received: null, picking: null, packed: null })

  useEffect(() => {
    api.get('/orders/?limit=200').then((res) => {
      const items = res.data.items
      setCounts({
        received: items.filter((o) => o.status === 'RECEIVED').length,
        picking:  items.filter((o) => o.status === 'PICKING').length,
        packed:   items.filter((o) => o.status === 'PACKED').length,
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

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-center">
              <p className="text-sm font-semibold text-blue-600">피킹 대기</p>
              <p className="text-5xl font-bold text-blue-700 mt-1">{counts.received ?? '—'}</p>
            </div>
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 text-center">
              <p className="text-sm font-semibold text-yellow-600">패킹 대기</p>
              <p className="text-5xl font-bold text-yellow-700 mt-1">{counts.picking ?? '—'}</p>
            </div>
            <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 text-center">
              <p className="text-sm font-semibold text-orange-600">출고 대기</p>
              <p className="text-5xl font-bold text-orange-700 mt-1">{counts.packed ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
