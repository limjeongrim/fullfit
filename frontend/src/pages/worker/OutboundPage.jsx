import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'

const CHANNEL_LABELS = {
  SMARTSTORE: '스마트스토어', OLIVEYOUNG: '올리브영',
  ZIGZAG: '지그재그', CAFE24: '카페24', MANUAL: '수동',
}

export default function OutboundPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const addToast = useToastStore((s) => s.addToast)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

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

  const handleLogout = () => { logout(); navigate('/login') }

  const handleOutbound = async (orderId) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'SHIPPED' })
      await fetchOrders()
      addToast('success', '출고 처리 완료')
    } catch (err) {
      addToast('error', err.response?.data?.detail || '처리 실패')
    }
  }

  return (
    <div className="min-h-screen bg-green-50">
      <nav className="bg-green-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/worker/dashboard')} className="text-green-200 hover:text-white text-sm">← 대시보드</button>
          <span className="text-xl font-bold">출고 완료 처리</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-green-100">{user?.email}</span>
          <button onClick={handleLogout} className="bg-green-900 hover:bg-green-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">로그아웃</button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Info banner */}
        <div className="mb-5 flex items-start gap-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-5 py-3 text-sm">
          <span className="mt-0.5">ℹ️</span>
          <span>출고 완료 처리 후 <strong>배송 관리</strong>에서 송장을 등록해주세요.</span>
        </div>

        {/* Count banner */}
        {!loading && (
          <div className={`mb-5 rounded-xl px-5 py-3 font-semibold text-sm ${
            orders.length > 0
              ? 'bg-orange-50 border border-orange-300 text-orange-800'
              : 'bg-green-50 border border-green-300 text-green-700'
          }`}>
            {orders.length > 0
              ? `📤 ${orders.length}건의 출고 대기 주문이 있습니다`
              : '현재 출고 대기 중인 주문이 없습니다 ✅'}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-green-100">
          <table className="w-full text-sm">
            <thead className="bg-green-700 text-white">
              <tr>
                {['주문번호', '채널', '수신자', '주소', '금액', '상태', '액션'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">로딩 중...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">출고 대기 주문이 없습니다.</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-green-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{o.order_number}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{CHANNEL_LABELS[o.channel] || o.channel}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{o.receiver_name}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{o.receiver_address}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      ₩{Number(o.total_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                        패킹완료
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleOutbound(o.id)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-semibold transition-colors">
                        출고 완료
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
