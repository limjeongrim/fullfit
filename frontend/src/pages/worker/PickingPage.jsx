import { useEffect, useRef, useState } from 'react'
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

const ZONE_COLORS = { A: '#F97316', B: '#2563EB', C: '#7C3AED', D: '#0891B2' }

const ISSUE_TYPE_MAP = {
  '재고 없음':    'STOCK_SHORTAGE',
  '상품 불일치':  'OTHER',
  '파손/오염':    'DAMAGE',
  '위치 오류':    'OTHER',
  '유통기한 이상': 'EXPIRY_HOLD',
  '기타':         'OTHER',
}

const ISSUE_TYPES = ['재고 없음', '상품 불일치', '파손/오염', '위치 오류', '유통기한 이상', '기타']

// ── Exception Modal ────────────────────────────────────────────────────────────

function ExceptionModal({ order, onClose, onSubmit, isSubmitting }) {
  const [type, setType] = useState('')
  const [memo, setMemo] = useState('')

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>예외 상황 신고</h3>
          <button onClick={onClose} className="text-2xl leading-none" style={{ color: '#94A3B8' }}>×</button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1.5" style={{ color: '#374151' }}>
            예외 유형 <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2563EB]"
            style={{ color: type ? '#0F172A' : '#94A3B8' }}
          >
            <option value="">선택하세요</option>
            {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-semibold mb-1.5" style={{ color: '#374151' }}>
            메모 <span className="font-normal" style={{ color: '#94A3B8' }}>(선택)</span>
          </label>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="상세 내용을 입력하세요"
            rows={3}
            className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[#2563EB]"
            style={{ color: '#0F172A' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="py-3.5 border-2 border-[#E2E8F0] rounded-xl text-sm font-semibold hover:bg-[#F8FAFC] transition-colors"
            style={{ color: '#374151' }}
          >
            취소
          </button>
          <button
            onClick={() => onSubmit(type, memo)}
            disabled={!type || isSubmitting}
            className="py-3.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
            style={{ background: '#EF4444', color: 'white' }}
          >
            {isSubmitting ? '신고 중...' : '신고하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Route Overlay Modal ────────────────────────────────────────────────────────

function RouteModal({ routeData, orderId, onComplete, onClose }) {
  const [checked, setChecked] = useState(new Set())

  const toggle = (seq) => setChecked((prev) => {
    const next = new Set(prev)
    next.has(seq) ? next.delete(seq) : next.add(seq)
    return next
  })

  const route   = routeData?.route ?? []
  const total   = route.length
  const done    = checked.size
  const allDone = done === total
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>최적 피킹 경로</h3>
            <button onClick={onClose} className="text-2xl leading-none" style={{ color: '#94A3B8' }}>×</button>
          </div>
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="font-semibold" style={{ color: '#2563EB' }}>
              예상 {routeData?.estimated_minutes}분
            </span>
            <span style={{ color: '#64748B' }}>{routeData?.total_steps}걸음</span>
            <span style={{ color: '#16A34A' }}>이동 {routeData?.distance_saved_vs_random} 절감</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8]">
              구역: {routeData?.zones_visited?.join(' → ')}
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: '#64748B' }}>
              <span>진행률</span>
              <span>{done}/{total} 완료</span>
            </div>
            <div className="h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, background: allDone ? '#16A34A' : '#2563EB' }}
              />
            </div>
          </div>
        </div>

        {/* Route list */}
        <div className="flex-1 overflow-y-auto py-2">
          {route.length === 0 && (
            <div className="py-10 text-center text-sm text-[#94A3B8]">
              경로 데이터를 불러오는 중...
            </div>
          )}
          {route.map((stop) => {
            const isChecked = checked.has(stop.sequence)
            const zoneColor = ZONE_COLORS[stop.zone] || '#64748B'
            return (
              <button
                key={stop.sequence}
                onClick={() => toggle(stop.sequence)}
                className={`w-full text-left px-5 py-3 border-b border-[#F1F5F9] transition-colors ${
                  isChecked ? 'bg-[#F0FDF4]' : 'hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm font-bold mt-0.5 ${
                    isChecked ? 'bg-[#16A34A] text-white' : 'text-white'
                  }`} style={!isChecked ? { background: zoneColor } : {}}>
                    {isChecked ? '✓' : stop.sequence}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ background: zoneColor + '20', color: zoneColor }}>
                        {stop.zone}구역
                      </span>
                      <span className="font-mono text-xs font-semibold" style={{ color: '#374151' }}>
                        📍 {stop.location}
                      </span>
                    </div>
                    <p className={`text-sm font-semibold ${isChecked ? 'line-through text-[#94A3B8]' : ''}`}
                      style={!isChecked ? { color: '#0F172A' } : {}}>
                      {stop.product_name}
                      <span className="font-bold ml-1.5" style={{ color: zoneColor }}>× {stop.quantity}</span>
                    </p>
                    {stop.order_numbers?.length > 0 && (
                      <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                        주문: {stop.order_numbers.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#E2E8F0] flex gap-3 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 border-2 border-[#E2E8F0] rounded-xl text-sm font-semibold hover:bg-[#F8FAFC] transition-colors"
            style={{ color: '#374151' }}>
            닫기
          </button>
          <button
            onClick={() => onComplete(orderId)}
            disabled={!allDone}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
              allDone
                ? 'bg-[#16A34A] hover:bg-[#15803D] text-white'
                : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
            }`}>
            {allDone ? '✅ 패킹 완료' : `패킹 완료 (${done}/${total})`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PickingPage() {
  const addToast = useToastStore((s) => s.addToast)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)
  const [activeTab, setActiveTab] = useState('waiting')
  const [confirmPackId, setConfirmPackId] = useState(null)
  const [routeModal, setRouteModal] = useState(null)
  const [routeLoading, setRouteLoading] = useState(null)
  const [exceptionModal, setExceptionModal] = useState(null) // { orderId, orderNumber }
  const [exceptionSubmitting, setExceptionSubmitting] = useState(false)

  const todayStr = new Date().toISOString().slice(0, 10)
  const prevReceivedCount = useRef(null)

  const fetchOrders = async (isPolling = false) => {
    if (!isPolling) setLoading(true)
    try {
      const res = await api.get('/orders/?limit=200')
      const relevant = res.data.items.filter((o) =>
        o.status === 'RECEIVED' ||
        o.status === 'PICKING' ||
        o.status === 'PACKED' ||
        (o.status === 'SHIPPED' && o.created_at.slice(0, 10) === todayStr)
      )
      if (isPolling && prevReceivedCount.current !== null) {
        const newCount = relevant.filter(o => o.status === 'RECEIVED').length
        const added = newCount - prevReceivedCount.current
        if (added > 0) {
          addToast('info', `새 주문 ${added}건이 추가되었습니다`)
        }
      }
      prevReceivedCount.current = relevant.filter(o => o.status === 'RECEIVED').length
      setOrders(relevant)
    } catch (e) {
      if (!isPolling) console.error(e)
    } finally {
      if (!isPolling) setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    const id = setInterval(() => fetchOrders(true), 15000)
    return () => clearInterval(id)
  }, [])

  const handleStartPicking = async (orderId) => {
    setActing(orderId)
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'PICKING' })
      await fetchOrders()
      addToast('success', '피킹이 시작되었습니다.')
      setRouteLoading(orderId)
      try {
        const r = await api.post('/picking-route/optimize', { order_ids: [orderId] })
        if (r.data.route?.length > 0) {
          setRouteModal({ orderId, data: r.data })
        }
      } catch {
        // Route fetch failed silently
      } finally {
        setRouteLoading(null)
      }
    } catch (err) {
      addToast('error', err.response?.data?.detail || '처리 실패')
    } finally {
      setActing(null)
    }
  }

  const handleViewRoute = async (orderId) => {
    setRouteLoading(orderId)
    try {
      const r = await api.post('/picking-route/optimize', { order_ids: [orderId] })
      if (r.data?.route?.length > 0) {
        setRouteModal({ orderId, data: r.data })
      }
    } catch {
      // Route fetch failed silently
    } finally {
      setRouteLoading(null)
    }
  }

  const handlePackComplete = async (orderId) => {
    setRouteModal(null)
    setActing(orderId)
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'PACKED' })
      await fetchOrders()
      addToast('success', '패킹 완료 처리되었습니다.')
      setActiveTab('done')
    } catch (err) {
      addToast('error', err.response?.data?.detail || '처리 실패')
    } finally {
      setActing(null)
    }
  }

  const handleAction = async (orderId, nextStatus) => {
    setActing(orderId)
    try {
      await api.patch(`/orders/${orderId}/status`, { status: nextStatus })
      await fetchOrders()
      if (nextStatus === 'PACKED') { addToast('success', '패킹 완료 처리되었습니다.'); setActiveTab('done') }
    } catch (err) {
      addToast('error', err.response?.data?.detail || '처리 실패')
    } finally {
      setActing(null)
    }
  }

  const handleReportException = async (type, memo) => {
    setExceptionSubmitting(true)
    try {
      await api.post('/issues', {
        order_id: exceptionModal.orderId,
        issue_type: ISSUE_TYPE_MAP[type] || 'OTHER',
        priority: 'HIGH',
        title: `[피킹 예외] ${exceptionModal.orderNumber} - ${type}`,
        description: memo,
      })
      addToast('success', '예외가 관리자에게 전달되었습니다')
      setExceptionModal(null)
    } catch (err) {
      addToast('error', err.response?.data?.detail || '신고 실패')
    } finally {
      setExceptionSubmitting(false)
    }
  }

  const waitingOrders = orders.filter((o) => o.status === 'RECEIVED')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const pickingOrders = orders.filter((o) => o.status === 'PICKING')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const doneOrders = orders.filter((o) => o.status === 'PACKED' || o.status === 'SHIPPED')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const tabs = [
    { key: 'waiting', label: '대기',   count: waitingOrders.length },
    { key: 'picking', label: '진행중', count: pickingOrders.length },
    { key: 'done',    label: '완료',   count: doneOrders.length },
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
                const hasCold  = o.items?.some((it) => it.storage_type === 'COLD')
                const totalQty = o.items?.reduce((sum, it) => sum + it.quantity, 0) || 0
                const isPicking = o.status === 'PICKING'
                const isDone    = o.status === 'PACKED' || o.status === 'SHIPPED'
                const isRouteLoading = routeLoading === o.id
                const locations = [...new Set((o.items || []).map(it => it.location_code).filter(Boolean))]

                return (
                  <div key={o.id}
                    className={`bg-white rounded-xl shadow-sm border-2 p-5 transition-all ${
                      isPicking ? 'border-[#2563EB] bg-[#EFF6FF]' : isDone ? 'border-[#DCFCE7]' : 'border-[#E2E8F0]'
                    }`}>

                    {/* 1. Location – BIG, top */}
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      {locations.length > 0 ? (
                        locations.map(loc => (
                          <span key={loc} className="text-xl font-bold" style={{ color: '#2563EB' }}>
                            📍 {loc}
                          </span>
                        ))
                      ) : (
                        <span className="text-xl font-bold" style={{ color: '#D97706' }}>
                          📍 위치 확인 필요
                        </span>
                      )}
                      {hasCold && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#DC2626]">
                          ❄️ 냉장포함
                        </span>
                      )}
                    </div>

                    {/* 2. Order number + channel badges */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-mono text-sm" style={{ color: '#64748B' }}>{o.order_number}</span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CHANNEL_CLS[o.channel] || 'bg-[#F1F5F9] text-[#64748B]'}`}>
                            {CHANNEL_LABELS[o.channel] || o.channel}
                          </span>
                          {isPicking && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#DBEAFE] text-[#1D4ED8]">피킹중</span>}
                          {o.status === 'PACKED'  && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FED7AA] text-[#9A3412]">패킹완료</span>}
                          {o.status === 'SHIPPED' && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534]">출고완료</span>}
                        </div>
                      </div>
                      <span className="text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>
                        {new Date(o.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>

                    {/* 3. Product list */}
                    {o.items && o.items.length > 0 && (
                      <div className="mb-3 bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0]">
                        <p className="text-xs mb-1.5 font-medium" style={{ color: '#94A3B8' }}>상품 {totalQty}개</p>
                        <div className="flex flex-col gap-1.5">
                          {o.items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-1.5 min-w-0" style={{ color: '#374151' }}>
                                {it.storage_type === 'COLD' && <span className="text-xs shrink-0" style={{ color: '#0E7490' }}>❄️</span>}
                                <span className="truncate">{it.product_name}</span>
                              </span>
                              <span className="font-semibold ml-2 shrink-0" style={{ color: '#0F172A' }}>× {it.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 4. Receiver info */}
                    <div className="mb-3">
                      <p className="text-sm font-semibold" style={{ color: '#374151' }}>{o.receiver_name}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#94A3B8' }}>{o.receiver_address}</p>
                    </div>

                    {/* 5. Buttons */}
                    {o.status === 'RECEIVED' && (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleStartPicking(o.id)}
                          disabled={isActing || isRouteLoading}
                          className="w-full py-4 bg-[#D97706] hover:bg-[#B45309] active:bg-[#92400E] text-white text-base font-bold rounded-lg transition-colors disabled:opacity-50">
                          {isActing || isRouteLoading ? '처리 중...' : '📦 피킹 시작'}
                        </button>
                        <button
                          onClick={() => setExceptionModal({ orderId: o.id, orderNumber: o.order_number })}
                          className="w-full py-2.5 border-2 rounded-lg text-sm font-semibold transition-colors hover:bg-[#FEF2F2]"
                          style={{ borderColor: '#EF4444', color: '#EF4444' }}>
                          ⚠️ 예외 신고
                        </button>
                      </div>
                    )}
                    {o.status === 'PICKING' && (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewRoute(o.id)}
                            disabled={isRouteLoading}
                            className="flex-1 py-3 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                            {isRouteLoading ? '로딩...' : '🗺 경로 보기'}
                          </button>
                          <button
                            onClick={() => setConfirmPackId(o.id)}
                            disabled={isActing}
                            className="flex-1 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50">
                            {isActing ? '처리 중...' : '✅ 패킹 완료'}
                          </button>
                        </div>
                        <button
                          onClick={() => setExceptionModal({ orderId: o.id, orderNumber: o.order_number })}
                          className="w-full py-2.5 border-2 rounded-lg text-sm font-semibold transition-colors hover:bg-[#FEF2F2]"
                          style={{ borderColor: '#EF4444', color: '#EF4444' }}>
                          ⚠️ 예외 신고
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Packing confirmation modal */}
        {confirmPackId && confirmOrder && (
          <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4"
            onClick={() => setConfirmPackId(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
              onClick={e => e.stopPropagation()}>
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

        {/* Route overlay modal */}
        {routeModal && (
          <RouteModal
            routeData={routeModal.data}
            orderId={routeModal.orderId}
            onComplete={handlePackComplete}
            onClose={() => setRouteModal(null)}
          />
        )}

        {/* Exception modal */}
        {exceptionModal && (
          <ExceptionModal
            order={exceptionModal}
            onClose={() => setExceptionModal(null)}
            onSubmit={handleReportException}
            isSubmitting={exceptionSubmitting}
          />
        )}
      </div>
    </SidebarLayout>
  )
}
