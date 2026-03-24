import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

export default function OutboundPage() {
  const addToast = useToastStore((s) => s.addToast)
  const navigate = useNavigate()
  const [packedOrders, setPackedOrders] = useState([])
  const [shippedToday, setShippedToday] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [trackingNum, setTrackingNum] = useState('')
  const [courier, setCourier] = useState('')
  const [boxCount, setBoxCount] = useState(1)
  const [checkQty, setCheckQty] = useState(false)
  const [checkPacking, setCheckPacking] = useState(false)
  const [checkLabel, setCheckLabel] = useState(false)
  const [modalErr, setModalErr] = useState('')

  const todayStr = new Date().toISOString().slice(0, 10)

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await api.get('/orders/?limit=200')
      const packed = res.data.items
        .filter((o) => o.status === 'PACKED')
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      const shipped = res.data.items
        .filter((o) => o.status === 'SHIPPED' && o.created_at.slice(0, 10) === todayStr)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setPackedOrders(packed)
      setShippedToday(shipped)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrders() }, [])

  const openConfirmModal = (orderId) => {
    setTrackingNum('')
    setCourier('')
    setBoxCount(1)
    setCheckQty(false)
    setCheckPacking(false)
    setCheckLabel(false)
    setModalErr('')
    setConfirmId(orderId)
  }

  const handleOutbound = async (orderId) => {
    if (!trackingNum.trim()) { setModalErr('송장번호를 입력해주세요'); return }
    if (!courier) { setModalErr('택배사를 선택해주세요'); return }
    if (!checkQty || !checkPacking || !checkLabel) { setModalErr('모든 항목을 확인해주세요'); return }
    setConfirmId(null)
    setActing(orderId)
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'SHIPPED' })
      try {
        await api.post('/deliveries/', {
          order_id: orderId,
          tracking_number: trackingNum.trim(),
          carrier: courier,
        })
      } catch { /* delivery creation may require admin role */ }
      await fetchOrders()
      addToast('success', '출고 처리가 완료되었습니다')
    } catch (err) {
      addToast('error', err.response?.data?.detail || '처리 실패')
    } finally {
      setActing(null)
    }
  }

  const confirmOrder = packedOrders.find((o) => o.id === confirmId)

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        {/* Sticky stats bar */}
        <div className="sticky top-14 z-10 bg-white border-b border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-5 py-3 flex items-center gap-4 text-sm flex-wrap">
          <span className="font-semibold" style={{ color: '#374151' }}>출고 현황</span>
          <span className="px-3 py-1 rounded-full font-bold bg-[#FED7AA] text-[#9A3412]">출고 대기 {packedOrders.length}건</span>
          <span className="px-3 py-1 rounded-full font-bold bg-[#DCFCE7] text-[#166534]">오늘 출고 완료 {shippedToday.length}건</span>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-5">
          {/* Info banner */}
          <div className="mb-4 flex items-center gap-2 bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] rounded-lg px-5 py-3 text-sm">
            <span>ℹ️</span>
            <span>출고 완료 후 배송 관리에서 송장을 등록해주세요.</span>
          </div>

          {/* Count banner */}
          {!loading && (
            <div className={`mb-4 rounded-lg px-5 py-3 font-semibold text-base border ${
              packedOrders.length > 0
                ? 'bg-[#FFF7ED] border-[#FED7AA] text-[#9A3412]'
                : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
            }`}>
              {packedOrders.length > 0
                ? `📤 ${packedOrders.length}건 출고 대기 중`
                : '✅ 출고 대기 주문이 없습니다'}
            </div>
          )}

          {loading ? (
            <div className="text-center py-16 text-lg" style={{ color: '#94A3B8' }}>로딩 중...</div>
          ) : packedOrders.length === 0 ? (
            <div className="text-center py-16" style={{ color: '#94A3B8' }}>
              <div className="text-5xl mb-4">✅</div>
              <p className="text-lg font-semibold">출고 대기 주문이 없습니다</p>
              <p className="text-sm mt-2" style={{ color: '#94A3B8' }}>피킹 중인 주문이 있다면 피킹 페이지를 확인하세요.</p>
              <button onClick={() => navigate('/worker/picking')}
                className="mt-4 px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-sm font-semibold transition-colors">
                피킹 페이지로 이동
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {packedOrders.map((o) => {
                const isActing = acting === o.id
                return (
                  <div key={o.id}
                    className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border-2 border-[#FED7AA] p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-mono text-sm" style={{ color: '#64748B' }}>{o.order_number}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CHANNEL_CLS[o.channel] || 'bg-[#F1F5F9] text-[#64748B]'}`}>
                            {CHANNEL_LABELS[o.channel] || o.channel}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FED7AA] text-[#9A3412]">패킹완료</span>
                        </div>
                      </div>
                      <span className="text-base font-bold whitespace-nowrap" style={{ color: '#374151' }}>
                        ₩{Number(o.total_amount).toLocaleString()}
                      </span>
                    </div>

                    <div className="mb-4">
                      <p className="text-lg font-bold" style={{ color: '#0F172A' }}>{o.receiver_name}</p>
                      <p className="text-sm mt-0.5 truncate" style={{ color: '#64748B' }}>{o.receiver_address}</p>
                    </div>

                    <button
                      onClick={() => openConfirmModal(o.id)}
                      disabled={isActing}
                      className="w-full py-4 bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-base font-bold rounded-lg transition-colors disabled:opacity-50">
                      {isActing ? '처리 중...' : '🚚 출고 완료 처리'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Completion history */}
          {shippedToday.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#64748B' }}>오늘 출고 완료 ({shippedToday.length}건)</h3>
              <div className="flex flex-col gap-2">
                {shippedToday.map((o) => (
                  <div key={o.id} className="bg-white rounded-lg border border-[#E2E8F0] px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs" style={{ color: '#94A3B8' }}>{o.order_number}</span>
                      <p className="text-sm font-semibold" style={{ color: '#374151' }}>{o.receiver_name}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534]">출고완료</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Outbound confirmation modal */}
        {confirmId && confirmOrder && (
          <div
            className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4"
            onClick={() => setConfirmId(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>출고 처리 확인</h3>
                <button onClick={() => setConfirmId(null)} className="text-2xl leading-none" style={{ color: '#94A3B8' }}>×</button>
              </div>

              {/* Order summary */}
              <div className="bg-[#F0FDF4] rounded-xl p-3 mb-4 border border-[#BBF7D0]">
                <p className="font-mono text-xs" style={{ color: '#64748B' }}>{confirmOrder.order_number}</p>
                <p className="text-base font-bold mt-0.5" style={{ color: '#0F172A' }}>{confirmOrder.receiver_name}</p>
                <p className="text-xs truncate" style={{ color: '#64748B' }}>{confirmOrder.receiver_address}</p>
              </div>

              {/* 송장번호 */}
              <div className="mb-3">
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#374151' }}>
                  송장번호 <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={trackingNum}
                  onChange={e => setTrackingNum(e.target.value)}
                  placeholder="송장번호를 입력하세요"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2563EB]"
                  style={{ color: '#0F172A' }}
                />
              </div>

              {/* 택배사 */}
              <div className="mb-3">
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#374151' }}>
                  택배사 <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={courier}
                  onChange={e => setCourier(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2563EB]"
                  style={{ color: courier ? '#0F172A' : '#94A3B8' }}
                >
                  <option value="">선택하세요</option>
                  <option value="CJ대한통운">CJ대한통운</option>
                  <option value="롯데택배">롯데택배</option>
                  <option value="한진택배">한진택배</option>
                  <option value="로젠택배">로젠택배</option>
                </select>
              </div>

              {/* 박스 수량 */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#374151' }}>
                  박스 수량 <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="number"
                  value={boxCount}
                  onChange={e => setBoxCount(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2563EB]"
                  style={{ color: '#0F172A' }}
                />
              </div>

              {/* 체크리스트 */}
              <div className="mb-4 bg-[#F8FAFC] rounded-xl p-4 border border-[#E2E8F0] flex flex-col gap-3">
                {[
                  { key: 'qty', checked: checkQty, set: setCheckQty, label: '상품 수량 확인 완료' },
                  { key: 'pack', checked: checkPacking, set: setCheckPacking, label: '포장 상태 확인 완료' },
                  { key: 'label', checked: checkLabel, set: setCheckLabel, label: '송장 부착 완료' },
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={e => item.set(e.target.checked)}
                      className="w-5 h-5 rounded border-[#D1D5DB] accent-[#2563EB] cursor-pointer"
                    />
                    <span className="text-sm font-medium" style={{ color: '#374151' }}>{item.label}</span>
                  </label>
                ))}
              </div>

              {/* Validation error */}
              {modalErr && (
                <p className="text-sm font-semibold mb-3" style={{ color: '#EF4444' }}>{modalErr}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setConfirmId(null)}
                  className="py-3.5 border-2 border-[#E2E8F0] rounded-xl text-sm font-semibold hover:bg-[#F8FAFC] transition-colors" style={{ color: '#374151' }}>
                  취소
                </button>
                <button onClick={() => handleOutbound(confirmId)}
                  className="py-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-bold transition-colors">
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
