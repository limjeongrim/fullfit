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

export default function PickingPage() {
  const addToast = useToastStore((s) => s.addToast)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)
  const [activeTab, setActiveTab] = useState('waiting')
  const [confirmPackId, setConfirmPackId] = useState(null)

  const todayStr = new Date().toISOString().slice(0, 10)

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await api.get('/orders/?limit=200')
      const relevant = res.data.items.filter((o) =>
        o.status === 'RECEIVED' ||
        o.status === 'PICKING' ||
        o.status === 'PACKED' ||
        (o.status === 'SHIPPED' && o.created_at.slice(0, 10) === todayStr)
      )
      setOrders(relevant)
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
      if (nextStatus === 'PICKING') addToast('success', '피킹이 시작되었습니다.')
      if (nextStatus === 'PACKED') { addToast('success', '패킹 완료 처리되었습니다.'); setActiveTab('done') }
    } catch (err) {
      addToast('error', err.response?.data?.detail || '처리 실패')
    } finally {
      setActing(null)
    }
  }

  const waitingOrders = orders.filter((o) => o.status === 'RECEIVED')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const pickingOrders = orders.filter((o) => o.status === 'PICKING')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const doneOrders = orders.filter((o) => o.status === 'PACKED' || o.status === 'SHIPPED')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const tabs = [
    { key: 'waiting', label: '대기',  count: waitingOrders.length, activeCls: 'bg-blue-600 text-white',   inactiveCls: 'bg-white text-gray-600 border border-gray-200' },
    { key: 'picking', label: '진행중', count: pickingOrders.length, activeCls: 'bg-yellow-500 text-white', inactiveCls: 'bg-white text-gray-600 border border-gray-200' },
    { key: 'done',    label: '완료',  count: doneOrders.length,    activeCls: 'bg-green-600 text-white',  inactiveCls: 'bg-white text-gray-600 border border-gray-200' },
  ]

  const tabOrders = activeTab === 'waiting' ? waitingOrders : activeTab === 'picking' ? pickingOrders : doneOrders
  const confirmOrder = orders.find((o) => o.id === confirmPackId)

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-green-50">
        {/* Sticky status bar */}
        <div className="sticky top-14 z-10 bg-white border-b border-green-100 shadow-sm px-5 py-3 flex items-center gap-3 text-sm flex-wrap">
          <span className="font-semibold text-gray-700">오늘 처리 현황</span>
          <span className="px-3 py-1 rounded-full font-bold bg-blue-100 text-blue-700">대기 {waitingOrders.length}건</span>
          <span className="px-3 py-1 rounded-full font-bold bg-yellow-100 text-yellow-700">진행중 {pickingOrders.length}건</span>
          <span className="px-3 py-1 rounded-full font-bold bg-green-100 text-green-700">완료 {doneOrders.length}건</span>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-5">
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === tab.key ? tab.activeCls : tab.inactiveCls + ' hover:bg-gray-50'
                }`}>
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.key ? 'bg-white/30' : 'bg-gray-100 text-gray-600'
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Order cards */}
          {loading ? (
            <div className="text-center py-16 text-gray-400 text-lg">로딩 중...</div>
          ) : tabOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-4">{activeTab === 'done' ? '📋' : '🎉'}</div>
              <p className="text-lg font-semibold">
                {activeTab === 'done' ? '완료된 주문이 없습니다' : '처리할 주문이 없습니다'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tabOrders.map((o) => {
                const isActing = acting === o.id
                const hasCold = o.items?.some((it) => it.storage_type === 'COLD')
                const totalQty = o.items?.reduce((sum, it) => sum + it.quantity, 0) || 0
                const isPicking = o.status === 'PICKING'
                const isDone = o.status === 'PACKED' || o.status === 'SHIPPED'
                return (
                  <div key={o.id}
                    className={`bg-white rounded-2xl shadow-sm border-2 p-5 transition-all ${
                      isPicking ? 'border-blue-400 bg-blue-50' : isDone ? 'border-green-200 bg-green-50' : 'border-gray-100'
                    }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-mono text-sm text-gray-500">{o.order_number}</span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CHANNEL_CLS[o.channel] || 'bg-gray-100 text-gray-600'}`}>
                            {CHANNEL_LABELS[o.channel] || o.channel}
                          </span>
                          {hasCold && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-700">❄️ 냉장포함</span>
                          )}
                          {isPicking && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">피킹중</span>}
                          {o.status === 'PACKED' && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">패킹완료</span>}
                          {o.status === 'SHIPPED' && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">출고완료</span>}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(o.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>

                    <div className="mb-3">
                      <p className="text-lg font-bold text-gray-800">{o.receiver_name}</p>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{o.receiver_address}</p>
                    </div>

                    {/* Product list */}
                    {o.items && o.items.length > 0 && (
                      <div className="mb-3 bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1.5 font-medium">상품 {totalQty}개</p>
                        <div className="flex flex-col gap-1">
                          {o.items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700 flex items-center gap-1">
                                {it.storage_type === 'COLD' && <span className="text-cyan-500 text-xs">❄️</span>}
                                {it.product_name}
                              </span>
                              <span className="font-semibold text-gray-900 ml-2 shrink-0">× {it.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
                        onClick={() => setConfirmPackId(o.id)}
                        disabled={isActing}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-base font-bold rounded-xl transition-colors disabled:opacity-50">
                        {isActing ? '처리 중...' : '✅ 패킹 완료'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Packing confirmation modal */}
        {confirmPackId && confirmOrder && (
          <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">📦</div>
                <h3 className="text-xl font-bold text-gray-800">패킹 완료 처리</h3>
                <p className="text-gray-600 mt-2">패킹 완료 처리하시겠습니까?</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 mb-5">
                <p className="font-mono text-sm text-gray-500">{confirmOrder.order_number}</p>
                <p className="text-lg font-bold text-gray-800 mt-1">{confirmOrder.receiver_name}</p>
                <p className="text-sm text-gray-500 truncate">{confirmOrder.receiver_address}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setConfirmPackId(null)}
                  className="py-4 border-2 border-gray-200 rounded-xl text-base font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  취소
                </button>
                <button onClick={() => { setConfirmPackId(null); handleAction(confirmPackId, 'PACKED') }}
                  className="py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-bold transition-colors">
                  패킹 완료
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
