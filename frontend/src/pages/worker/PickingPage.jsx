import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const CHANNEL_LABELS = {
  SMARTSTORE: '스마트스토어', OLIVEYOUNG: '올리브영',
  ZIGZAG: '지그재그', CAFE24: '카페24', MANUAL: '수동',
}

const CHANNEL_CLS = {
  SMARTSTORE: 'bg-[#DCFCE7] text-[#166534]',
  OLIVEYOUNG: 'bg-[#FEF3C7] text-[#92400E]',
  ZIGZAG:     'bg-[#FDF4FF] text-[#7E22CE]',
  CAFE24:     'bg-[#DBEAFE] text-[#1D4ED8]',
  MANUAL:     'bg-[#F1F5F9] text-[#64748B]',
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
    { key: 'waiting', label: '대기',  count: waitingOrders.length },
    { key: 'picking', label: '진행중', count: pickingOrders.length },
    { key: 'done',    label: '완료',  count: doneOrders.length },
  ]

  const tabOrders = activeTab === 'waiting' ? waitingOrders : activeTab === 'picking' ? pickingOrders : doneOrders
  const confirmOrder = orders.find((o) => o.id === confirmPackId)

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        {/* Sticky status bar */}
        <div className="sticky top-14 z-10 bg-white border-b border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-5 py-3 flex items-center gap-3 text-sm flex-wrap">
          <span className="font-semibold" style={{ color: '#374151' }}>오늘 처리 현황</span>
          <span className="px-3 py-1 rounded-full font-bold bg-[#DBEAFE] text-[#1D4ED8]">대기 {waitingOrders.length}건</span>
          <span className="px-3 py-1 rounded-full font-bold bg-[#FEF9C3] text-[#854D0E]">진행중 {pickingOrders.length}건</span>
          <span className="px-3 py-1 rounded-full font-bold bg-[#DCFCE7] text-[#166534]">완료 {doneOrders.length}건</span>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-5">
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === tab.key
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`} style={activeTab !== tab.key ? { color: '#374151' } : {}}>
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.key ? 'bg-white/30 text-white' : 'bg-[#F1F5F9] text-[#64748B]'
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Order cards */}
          {loading ? (
            <div className="text-center py-16 text-lg" style={{ color: '#94A3B8' }}>로딩 중...</div>
          ) : tabOrders.length === 0 ? (
            <div className="text-center py-16" style={{ color: '#94A3B8' }}>
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
                    className={`bg-white rounded-xl shadow-sm border-2 p-5 transition-all ${
                      isPicking ? 'border-[#2563EB] bg-[#EFF6FF]' : isDone ? 'border-[#DCFCE7]' : 'border-[#E2E8F0]'
                    }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-mono text-sm" style={{ color: '#64748B' }}>{o.order_number}</span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CHANNEL_CLS[o.channel] || 'bg-[#F1F5F9] text-[#64748B]'}`}>
                            {CHANNEL_LABELS[o.channel] || o.channel}
                          </span>
                          {hasCold && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#ECFEFF] text-[#0E7490]">❄️ 냉장포함</span>
                          )}
                          {isPicking && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#DBEAFE] text-[#1D4ED8]">피킹중</span>}
                          {o.status === 'PACKED' && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FED7AA] text-[#9A3412]">패킹완료</span>}
                          {o.status === 'SHIPPED' && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534]">출고완료</span>}
                        </div>
                      </div>
                      <span className="text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>
                        {new Date(o.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>

                    <div className="mb-3">
                      <p className="text-lg font-bold" style={{ color: '#0F172A' }}>{o.receiver_name}</p>
                      <p className="text-sm mt-0.5 truncate" style={{ color: '#64748B' }}>{o.receiver_address}</p>
                    </div>

                    {/* Product list */}
                    {o.items && o.items.length > 0 && (
                      <div className="mb-3 bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0]">
                        <p className="text-xs mb-1.5 font-medium" style={{ color: '#94A3B8' }}>상품 {totalQty}개</p>
                        <div className="flex flex-col gap-1">
                          {o.items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-1" style={{ color: '#374151' }}>
                                {it.storage_type === 'COLD' && <span className="text-xs" style={{ color: '#0E7490' }}>❄️</span>}
                                {it.product_name}
                              </span>
                              <span className="font-semibold ml-2 shrink-0" style={{ color: '#0F172A' }}>× {it.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {o.status === 'RECEIVED' && (
                      <button
                        onClick={() => handleAction(o.id, 'PICKING')}
                        disabled={isActing}
                        className="w-full py-4 bg-[#D97706] hover:bg-[#B45309] active:bg-[#92400E] text-white text-base font-bold rounded-lg transition-colors disabled:opacity-50">
                        {isActing ? '처리 중...' : '📦 피킹 시작'}
                      </button>
                    )}
                    {o.status === 'PICKING' && (
                      <button
                        onClick={() => setConfirmPackId(o.id)}
                        disabled={isActing}
                        className="w-full py-4 bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-base font-bold rounded-lg transition-colors disabled:opacity-50">
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
                <h3 className="text-xl font-bold" style={{ color: '#0F172A' }}>패킹 완료 처리</h3>
                <p className="mt-2" style={{ color: '#64748B' }}>패킹 완료 처리하시겠습니까?</p>
              </div>
              <div className="bg-[#EFF6FF] rounded-xl p-4 mb-5 border border-[#BFDBFE]">
                <p className="font-mono text-sm" style={{ color: '#64748B' }}>{confirmOrder.order_number}</p>
                <p className="text-lg font-bold mt-1" style={{ color: '#0F172A' }}>{confirmOrder.receiver_name}</p>
                <p className="text-sm truncate" style={{ color: '#64748B' }}>{confirmOrder.receiver_address}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setConfirmPackId(null)}
                  className="py-4 border-2 border-[#E2E8F0] rounded-xl text-base font-semibold hover:bg-[#F8FAFC] transition-colors" style={{ color: '#374151' }}>
                  취소
                </button>
                <button onClick={() => { setConfirmPackId(null); handleAction(confirmPackId, 'PACKED') }}
                  className="py-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-base font-bold transition-colors">
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
