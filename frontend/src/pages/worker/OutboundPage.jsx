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

export default function OutboundPage() {
  const addToast = useToastStore((s) => s.addToast)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await api.get('/orders/?limit=200')
      const packed = res.data.items
        .filter((o) => o.status === 'PACKED')
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      setOrders(packed)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrders() }, [])

  const handleOutbound = async (orderId) => {
    setConfirmId(null)
    setActing(orderId)
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'SHIPPED' })
      await fetchOrders()
      addToast('success', '출고 처리 완료')
    } catch (err) {
      addToast('error', err.response?.data?.detail || '처리 실패')
    } finally {
      setActing(null)
    }
  }

  const confirmOrder = orders.find(o => o.id === confirmId)

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-green-50">
        {/* Sticky status bar */}
        <div className="sticky top-14 z-10 bg-white border-b border-green-100 shadow-sm px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-700">출고 대기</span>
          <span className="px-3 py-1 rounded-full text-sm font-bold bg-orange-100 text-orange-700">
            {orders.length}건
          </span>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-5">
          {/* Info banner */}
          <div className="mb-4 flex items-center gap-2 bg-blue-50 border-2 border-blue-200 text-blue-700 rounded-2xl px-5 py-3 text-sm">
            <span>ℹ️</span>
            <span>출고 완료 후 배송 관리에서 송장을 등록해주세요.</span>
          </div>

          {/* Count banner */}
          {!loading && (
            <div className={`mb-4 rounded-2xl px-5 py-3 font-semibold text-base ${
              orders.length > 0
                ? 'bg-orange-50 border-2 border-orange-300 text-orange-800'
                : 'bg-green-50 border-2 border-green-300 text-green-700'
            }`}>
              {orders.length > 0
                ? `📤 ${orders.length}건 출고 대기 중`
                : '✅ 출고 대기 주문이 없습니다'}
            </div>
          )}

          {loading ? (
            <div className="text-center py-16 text-gray-400 text-lg">로딩 중...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-lg font-semibold">출고 대기 주문이 없습니다</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {orders.map((o) => {
                const isActing = acting === o.id
                return (
                  <div key={o.id}
                    className="bg-white rounded-2xl shadow-sm border-2 border-orange-100 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-mono text-sm text-gray-500">{o.order_number}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CHANNEL_CLS[o.channel] || 'bg-gray-100 text-gray-600'}`}>
                            {CHANNEL_LABELS[o.channel] || o.channel}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">패킹완료</span>
                        </div>
                      </div>
                      <span className="text-base font-bold text-gray-700 whitespace-nowrap">
                        ₩{Number(o.total_amount).toLocaleString()}
                      </span>
                    </div>

                    <div className="mb-4">
                      <p className="text-lg font-bold text-gray-800">{o.receiver_name}</p>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{o.receiver_address}</p>
                    </div>

                    <button
                      onClick={() => setConfirmId(o.id)}
                      disabled={isActing}
                      className="w-full py-4 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-base font-bold rounded-xl transition-colors disabled:opacity-50">
                      {isActing ? '처리 중...' : '🚚 출고 완료 처리'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Confirmation dialog */}
        {confirmId && confirmOrder && (
          <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">🚚</div>
                <h3 className="text-xl font-bold text-gray-800">출고 완료 처리</h3>
                <p className="text-gray-600 mt-2">아래 주문을 출고 처리하시겠습니까?</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 mb-5">
                <p className="font-mono text-sm text-gray-500">{confirmOrder.order_number}</p>
                <p className="text-lg font-bold text-gray-800 mt-1">{confirmOrder.receiver_name}</p>
                <p className="text-sm text-gray-500 truncate">{confirmOrder.receiver_address}</p>
                <p className="font-semibold text-green-700 mt-1">₩{Number(confirmOrder.total_amount).toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setConfirmId(null)}
                  className="py-4 border-2 border-gray-200 rounded-xl text-base font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  취소
                </button>
                <button onClick={() => handleOutbound(confirmId)}
                  className="py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl text-base font-bold transition-colors">
                  출고 완료
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
