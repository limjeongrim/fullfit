import { useEffect, useState } from 'react'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const STATUS_META = {
  RECEIVED:  { label: '주문 접수',  cls: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  PICKING:   { label: '출고 준비중', cls: 'bg-[#FEF9C3] text-[#854D0E]' },
  PACKED:    { label: '패킹 완료',  cls: 'bg-[#FED7AA] text-[#9A3412]' },
  SHIPPED:   { label: '출고 완료',  cls: 'bg-[#E0E7FF] text-[#3730A3]' },
  DELIVERED: { label: '배송 완료',  cls: 'bg-[#DCFCE7] text-[#166534]' },
  CANCELLED: { label: '취소',      cls: 'bg-[#F1F5F9] text-[#64748B]' },
}

const CHANNEL_META = {
  SMARTSTORE: { label: '스마트스토어', cls: 'bg-[#DCFCE7] text-[#166534]' },
  OLIVEYOUNG: { label: '올리브영',    cls: 'bg-[#FEF3C7] text-[#92400E]' },
  ZIGZAG:     { label: '지그재그',    cls: 'bg-[#FDF4FF] text-[#7E22CE]' },
  CAFE24:     { label: '카페24',      cls: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  MANUAL:     { label: '수동',        cls: 'bg-[#F1F5F9] text-[#64748B]' },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function ChannelBadge({ channel }) {
  const m = CHANNEL_META[channel] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
      </span>
      <span className="text-xs font-medium" style={{ color: '#64748B' }}>실시간</span>
    </span>
  )
}

function LastUpdated({ time }) {
  const [display, setDisplay] = useState('—')
  useEffect(() => {
    const update = () => {
      if (!time) { setDisplay('—'); return }
      const diff = Math.floor((Date.now() - time) / 1000)
      if (diff < 10) setDisplay('방금 전')
      else if (diff < 60) setDisplay(`${diff}초 전`)
      else if (diff < 3600) setDisplay(`${Math.floor(diff / 60)}분 전`)
      else setDisplay(new Date(time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [time])
  return <span className="text-xs" style={{ color: '#94A3B8' }}>마지막 업데이트: {display}</span>
}

export default function SellerOrderPage() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [search, setSearch] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [tick, setTick] = useState(0)

  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderHistory, setOrderHistory] = useState([])
  const [detailTab, setDetailTab] = useState('info')
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterChannel) params.set('channel', filterChannel)
      if (search) params.set('search', search)
      params.set('limit', '100')
      const res = await api.get(`/orders/seller?${params}`)
      setOrders(res.data.items)
      setTotal(res.data.total)
      setLastUpdated(Date.now())
    } catch (e) { console.error(e) }
  }

  const openOrderDetail = async (order) => {
    setSelectedOrder(order)
    setDetailTab('info')
    setOrderHistory([])
    setDetailLoading(true)
    try {
      const [detRes, histRes] = await Promise.all([
        api.get(`/orders/${order.id}`),
        api.get(`/orders/${order.id}/history`),
      ])
      setSelectedOrder(detRes.data)
      setOrderHistory(histRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => { fetchOrders() }, [filterStatus, filterChannel, search, tick])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000)
    return () => clearInterval(id)
  }, [])

  const count = (s) => orders.filter((o) => o.status === s).length

  const downloadOrderCSV = () => {
    const esc = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s }
    const headers = ['주문번호','채널','수령인','주소','상품명','수량','금액','상태','주문일시','송장번호']
    const rows = orders.map(o => [
      o.order_number,
      CHANNEL_META[o.channel]?.label || o.channel,
      o.receiver_name,
      o.receiver_address,
      o.items?.map(it => it.product_name).join(' / ') || '',
      o.items?.map(it => it.quantity).join(' / ') || '',
      o.total_amount,
      STATUS_META[o.status]?.label || o.status,
      new Date(o.created_at).toLocaleString('ko-KR'),
      o.tracking_number || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `주문내역_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const channelBreakdown = Object.entries(CHANNEL_META).map(([key, meta]) => ({
    key, label: meta.label, count: orders.filter(o => o.channel === key).length,
  })).filter(c => c.count > 0)

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="px-6 py-6 flex gap-5">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Live bar */}
            <div className="flex items-center justify-between mb-4">
              <LiveIndicator />
              <LastUpdated time={lastUpdated} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              {[
                { label: '전체 주문',    value: total },
                { label: '접수/처리중',  value: count('RECEIVED') + count('PICKING') + count('PACKED') },
                { label: '배송 완료',    value: count('DELIVERED') },
                { label: '취소',         value: count('CANCELLED') },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-lg border border-[#E2E8F0] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <p className="text-sm font-medium" style={{ color: '#64748B' }}>{s.label}</p>
                  <p className="text-3xl font-bold mt-1" style={{ color: '#0F172A' }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Filters + export */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]">
                <option value="">전체 상태</option>
                {Object.entries(STATUS_META).map(([s, m]) => (
                  <option key={s} value={s}>{m.label}</option>
                ))}
              </select>
              <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)}
                className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]">
                <option value="">전체 채널</option>
                {Object.entries(CHANNEL_META).map(([c, m]) => (
                  <option key={c} value={c}>{m.label}</option>
                ))}
              </select>
              <input type="text" placeholder="주문번호 또는 수신자 검색" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] w-56" />
            </div>
            <button onClick={downloadOrderCSV}
              className="border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] px-4 py-1.5 rounded-[6px] text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0" style={{ color: '#374151' }}>
              ↓ 주문 내보내기
            </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    {['주문번호', '채널', '수신자', '주소', '금액', '상태', '주문일시'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>주문이 없습니다.</td></tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id}
                        onClick={() => openOrderDetail(o)}
                        className="border-b border-[#F1F5F9] hover:bg-[#F0F4FF] transition-colors cursor-pointer">
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#374151' }}>{o.order_number}</td>
                        <td className="px-4 py-3"><ChannelBadge channel={o.channel} /></td>
                        <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{o.receiver_name}</td>
                        <td className="px-4 py-3 max-w-[180px] truncate" style={{ color: '#64748B' }}>{o.receiver_address}</td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#374151' }}>₩{Number(o.total_amount).toLocaleString()}</td>
                        <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                          {new Date(o.created_at).toLocaleString('ko-KR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>총 {total}건 · 행 클릭 시 상세 보기</p>
          </div>

          {/* Right panel */}
          <div className="w-64 shrink-0 space-y-4">
            <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>처리 현황</h4>
              <div className="space-y-2">
                {[
                  { label: '주문 접수',   value: count('RECEIVED'),  color: '#1D4ED8' },
                  { label: '출고 준비중', value: count('PICKING'),   color: '#854D0E' },
                  { label: '패킹 완료',  value: count('PACKED'),    color: '#9A3412' },
                  { label: '출고 완료',  value: count('SHIPPED'),   color: '#3730A3' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: '#64748B' }}>{s.label}</span>
                    <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {channelBreakdown.length > 0 && (
              <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>채널별 주문</h4>
                <div className="space-y-2">
                  {channelBreakdown.map(c => (
                    <div key={c.key} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: '#64748B' }}>{c.label}</span>
                      <span className="text-sm font-bold" style={{ color: '#0F172A' }}>{c.count}건</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-lg" style={{ color: '#0F172A' }}>주문 상세</h3>
                <p className="text-xs mt-0.5 font-mono" style={{ color: '#64748B' }}>{selectedOrder.order_number}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)}
                className="text-[#94A3B8] hover:text-[#475569] text-2xl font-light leading-none">×</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#E2E8F0] px-6 shrink-0">
              {[['info', '주문 정보'], ['history', '처리 이력']].map(([key, label]) => (
                <button key={key} onClick={() => setDetailTab(key)}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    detailTab === key ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-[#64748B] hover:text-[#374151]'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <div className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>로딩 중...</div>
              ) : detailTab === 'info' ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>채널</p>
                      <ChannelBadge channel={selectedOrder.channel} />
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>주문번호</p>
                      <p className="font-mono text-xs" style={{ color: '#374151' }}>{selectedOrder.order_number}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>주문일시</p>
                      <p style={{ color: '#374151' }}>{new Date(selectedOrder.created_at).toLocaleString('ko-KR')}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>현재 상태</p>
                      <StatusBadge status={selectedOrder.status} />
                      <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                        {{
                          RECEIVED:  '채널 주문이 수집되어 출고 대기 중입니다',
                          PICKING:   '피킹/포장 작업이 진행 중입니다',
                          PACKED:    '포장이 완료되어 출고 대기 중입니다',
                          SHIPPED:   '택배사에 인계되었습니다',
                          DELIVERED: '고객에게 배송 완료되었습니다',
                          CANCELLED: '주문이 취소되었습니다',
                        }[selectedOrder.status]}
                      </p>
                    </div>
                    {selectedOrder.tracking_number && (
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>송장번호</p>
                        <p className="font-mono text-xs font-semibold" style={{ color: '#374151' }}>{selectedOrder.tracking_number}</p>
                      </div>
                    )}
                    {selectedOrder.carrier && (
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>택배사</p>
                        <p style={{ color: '#374151' }}>{{ CJ: 'CJ대한통운', HANJIN: '한진택배', LOTTE: '롯데택배', ROSEN: '로젠택배', ETC: '기타' }[selectedOrder.carrier] || selectedOrder.carrier}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>수령인</p>
                      <p className="font-medium" style={{ color: '#0F172A' }}>{selectedOrder.receiver_name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>연락처</p>
                      <p style={{ color: '#374151' }}>{selectedOrder.receiver_phone}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>주소</p>
                      <p style={{ color: '#374151' }}>{selectedOrder.receiver_address}</p>
                    </div>
                    {selectedOrder.note && (
                      <div className="col-span-2">
                        <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>메모</p>
                        <p style={{ color: '#374151' }}>{selectedOrder.note}</p>
                      </div>
                    )}
                  </div>

                  {selectedOrder.items?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>주문 상품</p>
                      <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-[#F8FAFC]">
                            <tr>
                              {['상품명', '수량', '단가', '소계'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#64748B' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrder.items.map(it => (
                              <tr key={it.id} className="border-t border-[#F1F5F9]">
                                <td className="px-3 py-2" style={{ color: '#0F172A' }}>{it.product_name}</td>
                                <td className="px-3 py-2" style={{ color: '#374151' }}>{it.quantity}</td>
                                <td className="px-3 py-2" style={{ color: '#374151' }}>₩{Number(it.unit_price).toLocaleString()}</td>
                                <td className="px-3 py-2 font-medium" style={{ color: '#0F172A' }}>₩{(it.quantity * it.unit_price).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-end mt-2">
                        <span className="text-sm font-bold" style={{ color: '#0F172A' }}>
                          합계: ₩{Number(selectedOrder.total_amount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {orderHistory.length === 0 ? (
                    <p className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>처리 이력이 없습니다.</p>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-[5px] top-2 bottom-2 w-px bg-[#E2E8F0]" />
                      <div className="space-y-4 pl-6">
                        {orderHistory.map((h) => (
                          <div key={h.id} className="relative">
                            <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-[#2563EB] border-2 border-white shadow-sm" />
                            <div className="bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] px-4 py-3">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-xs font-semibold" style={{ color: '#64748B' }}>
                                  {h.created_at ? new Date(h.created_at).toLocaleString('ko-KR') : '—'}
                                </span>
                                <span className="text-xs font-medium" style={{ color: '#374151' }}>{h.changed_by_name}</span>
                              </div>
                              <p className="text-sm" style={{ color: '#0F172A' }}>
                                <span className="font-medium">{h.field_changed}</span>{': '}
                                <span style={{ color: '#64748B' }}>{h.old_value || '—'}</span>
                                {' → '}
                                <span className="font-semibold" style={{ color: '#2563EB' }}>{h.new_value}</span>
                              </p>
                              {h.note && <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{h.note}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  )
}
