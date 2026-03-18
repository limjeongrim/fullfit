import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const CHANNEL_LABELS = {
  SMARTSTORE: '스마트스토어', OLIVEYOUNG: '올리브영',
  ZIGZAG: '지그재그', CAFE24: '카페24', MANUAL: '수동',
}

const CHANNEL_CLS = {
  SMARTSTORE: 'bg-green-100 text-green-700',
  OLIVEYOUNG: 'bg-orange-100 text-orange-700',
  ZIGZAG:     'bg-pink-100 text-pink-700',
  CAFE24:     'bg-blue-100 text-blue-700',
  MANUAL:     'bg-gray-100 text-gray-600',
}

const STATUS_META = {
  RECEIVED: { label: '접수',   cls: 'bg-blue-100 text-blue-700' },
  PICKING:  { label: '피킹중', cls: 'bg-yellow-100 text-yellow-700' },
}

export default function PickingPage() {
  const addToast = useToastStore((s) => s.addToast)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await api.get('/orders/?limit=200')
      const active = res.data.items.filter(
        (o) => o.status === 'RECEIVED' || o.status === 'PICKING'
      )
      active.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'RECEIVED' ? -1 : 1
        return new Date(a.created_at) - new Date(b.created_at)
      })
      setOrders(active)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrders() }, [])

  const handleAction = async (orderId, nextStatus) => {
    setActing(orderId)
    try {
      await api.patch(`/orders/${orderId}/status`, { status: nextStatus })
      await fetchOrders()
      addToast('success', nextStatus === 'PICKING' ? '피킹이 시작되었습니다.' : '패킹 완료 처리되었습니다.')
    } catch (err) {
      addToast('error', err.response?.data?.detail || '처리 실패')
    } finally {
      setActing(null)
    }
  }

  const receivedCount = orders.filter(o => o.status === 'RECEIVED').length
  const pickingCount = orders.filter(o => o.status === 'PICKING').length

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-green-50">
        {/* Sticky status bar */}
        <div className="sticky top-14 z-10 bg-white border-b border-green-100 shadow-sm px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-700">오늘 처리 현황</span>
          <span className="px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
            접수 {receivedCount}건
          </span>
          <span className="px-3 py-1 rounded-full text-sm font-bold bg-yellow-100 text-yellow-700">
            피킹중 {pickingCount}건
          </span>
          <span className="ml-auto text-sm text-gray-500">총 {orders.length}건</span>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-5">
          {/* Status banner */}
          {!loading && (
            <div className={`mb-4 rounded-2xl px-5 py-3 font-semibold text-base ${
              orders.length > 0
                ? 'bg-yellow-50 border-2 border-yellow-300 text-yellow-800'
                : 'bg-green-50 border-2 border-green-300 text-green-700'
            }`}>
              {orders.length > 0
                ? `📋 ${orders.length}건 처리 필요`
                : '✅ 모든 작업 완료!'}
            </div>
          )}

          {/* Order cards */}
          {loading ? (
            <div className="text-center py-16 text-gray-400 text-lg">로딩 중...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-4">🎉</div>
              <p className="text-lg font-semibold">처리할 주문이 없습니다</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {orders.map((o) => {
                const m = STATUS_META[o.status]
                const isActing = acting === o.id
                return (
                  <div key={o.id}
                    className={`bg-white rounded-2xl shadow-sm border-2 p-5 transition-all ${
                      o.status === 'PICKING' ? 'border-yellow-300 bg-yellow-50' : 'border-green-100'
                    }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-mono text-sm text-gray-500">{o.order_number}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CHANNEL_CLS[o.channel] || 'bg-gray-100 text-gray-600'}`}>
                            {CHANNEL_LABELS[o.channel] || o.channel}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(o.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>

                    <div className="mb-4">
                      <p className="text-lg font-bold text-gray-800">{o.receiver_name}</p>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{o.receiver_address}</p>
                    </div>

                    {o.status === 'RECEIVED' && (
                      <button
                        onClick={() => handleAction(o.id, 'PICKING')}
                        disabled={isActing}
                        className="w-full py-4 bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-white text-base font-bold rounded-xl transition-colors disabled:opacity-50">
                        {isActing ? '처리 중...' : '📦 피킹 시작'}
                      </button>
                    )}
                    {o.status === 'PICKING' && (
                      <button
                        onClick={() => handleAction(o.id, 'PACKED')}
                        disabled={isActing}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-base font-bold rounded-xl transition-colors disabled:opacity-50">
                        {isActing ? '처리 중...' : '✅ 패킹 완료'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  )
}
