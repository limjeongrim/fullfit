import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'

const CHANNEL_LABELS = {
  SMARTSTORE: '스마트스토어', OLIVEYOUNG: '올리브영',
  ZIGZAG: '지그재그', CAFE24: '카페24', MANUAL: '수동',
}

const STATUS_META = {
  RECEIVED: { label: '접수',   cls: 'bg-blue-100 text-blue-700' },
  PICKING:  { label: '피킹중', cls: 'bg-yellow-100 text-yellow-700' },
}

export default function PickingPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await api.get('/orders/?limit=200')
      const active = res.data.items.filter(
        (o) => o.status === 'RECEIVED' || o.status === 'PICKING'
      )
      // FEFO-style: RECEIVED first, then PICKING, each sorted by created_at asc
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

  const handleLogout = () => { logout(); navigate('/login') }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleAction = async (orderId, nextStatus) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: nextStatus })
      await fetchOrders()
      showToast(nextStatus === 'PICKING' ? '피킹이 시작되었습니다.' : '패킹 완료 처리되었습니다.')
    } catch (err) {
      showToast(err.response?.data?.detail || '처리 실패')
    }
  }

  return (
    <div className="min-h-screen bg-green-50">
      <nav className="bg-green-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/worker/dashboard')} className="text-green-200 hover:text-white text-sm">← 대시보드</button>
          <span className="text-xl font-bold">오늘의 피킹 목록</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-green-100">{user?.email}</span>
          <button onClick={handleLogout} className="bg-green-900 hover:bg-green-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">로그아웃</button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {toast && (
          <div className="mb-4 bg-green-50 border border-green-300 text-green-700 rounded-xl px-5 py-3 font-medium">
            ✅ {toast}
          </div>
        )}

        {/* Count banner */}
        {!loading && (
          <div className={`mb-5 rounded-xl px-5 py-3 font-semibold text-sm ${
            orders.length > 0
              ? 'bg-yellow-50 border border-yellow-300 text-yellow-800'
              : 'bg-green-50 border border-green-300 text-green-700'
          }`}>
            {orders.length > 0
              ? `📋 총 ${orders.length}건의 주문을 처리해야 합니다`
              : '현재 처리할 주문이 없습니다 ✅'}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-green-100">
          <table className="w-full text-sm">
            <thead className="bg-green-700 text-white">
              <tr>
                {['주문번호', '채널', '수신자', '주소', '상품 수', '주문일시', '상태', '액션'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">로딩 중...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">처리할 주문이 없습니다.</td></tr>
              ) : (
                orders.map((o) => {
                  const m = STATUS_META[o.status]
                  return (
                    <tr key={o.id} className={`border-t border-gray-100 hover:bg-green-50 transition-colors ${
                      o.status === 'PICKING' ? 'bg-yellow-50' : ''
                    }`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{o.order_number}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{CHANNEL_LABELS[o.channel] || o.channel}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{o.receiver_name}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{o.receiver_address}</td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {/* order_items count not in list response — show dash */}
                        —
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(o.created_at).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {o.status === 'RECEIVED' && (
                          <button onClick={() => handleAction(o.id, 'PICKING')}
                            className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded-lg font-semibold transition-colors">
                            피킹 시작
                          </button>
                        )}
                        {o.status === 'PICKING' && (
                          <button onClick={() => handleAction(o.id, 'PACKED')}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-semibold transition-colors">
                            패킹 완료
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
