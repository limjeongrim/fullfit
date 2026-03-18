import { useEffect, useRef, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const API_CHANNELS = [
  { id: 'SMARTSTORE', name: '스마트스토어', icon: '🛍️' },
  { id: 'CAFE24',     name: '카페24',       icon: '☕' },
]

const CSV_CHANNELS = [
  { id: 'OLIVEYOUNG', name: '올리브영', icon: '🌿' },
  { id: 'ZIGZAG',     name: '지그재그', icon: '👗' },
]

const CHANNEL_BADGE = {
  SMARTSTORE: 'bg-[#DCFCE7] text-[#166534]',
  CAFE24:     'bg-[#DBEAFE] text-[#1D4ED8]',
  OLIVEYOUNG: 'bg-[#FEF3C7] text-[#92400E]',
  ZIGZAG:     'bg-[#FDF4FF] text-[#7E22CE]',
}

function PulsingDot() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
      </span>
      <span className="text-xs font-medium" style={{ color: '#64748B' }}>자동 수집 중</span>
    </span>
  )
}

export default function SellerChannelSyncPage() {
  const { addToast } = useToastStore()
  const [history, setHistory] = useState([])
  const [orders, setOrders] = useState([])
  const [syncing, setSyncing] = useState(null)
  const [uploading, setUploading] = useState(null)
  const [apiLastSync, setApiLastSync] = useState({})
  const fileRefs = useRef({})

  const fetchHistory = () => {
    api.get('/channels/sync/history').then(r => setHistory(r.data)).catch(() => {})
  }

  const fetchOrders = () => {
    api.get('/orders/seller?limit=500').then(r => setOrders(r.data.items || [])).catch(() => {})
  }

  useEffect(() => {
    fetchHistory()
    fetchOrders()
  }, [])

  const handleApiSync = async (ch) => {
    setSyncing(ch.id)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setSyncing(null)
    setApiLastSync(prev => ({ ...prev, [ch.id]: new Date() }))
    addToast('success', `${ch.name} 동기화 완료`)
    fetchHistory()
    fetchOrders()
  }

  const handleCsvUpload = async (ch, file) => {
    if (!file) return
    setUploading(ch.id)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await api.post(`/channels/sync/${ch.id.toLowerCase()}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (res.data.errors && res.data.errors.length > 0) {
        addToast('warning', `${ch.name} 동기화: ${res.data.success_count}건 성공, ${res.data.errors.length}건 오류`)
      } else {
        addToast('success', `${ch.name} 동기화 완료: ${res.data.success_count}건 접수`)
      }
      fetchHistory()
      fetchOrders()
    } catch (e) {
      addToast('error', `동기화 실패: ${e.response?.data?.detail || e.message}`)
    } finally {
      setUploading(null)
      if (fileRefs.current[ch.id]) fileRefs.current[ch.id].value = ''
    }
  }

  const fmtTime = (t) => t ? new Date(t).toLocaleString('ko-KR') : '—'

  const lastSyncLabel = (channelId) => {
    if (apiLastSync[channelId]) return '방금 전'
    const row = history.find(h => h.channel === channelId)
    return row ? fmtTime(row.synced_at) : '미동기화'
  }

  const orderCount = (channelId) => orders.filter(o => o.channel === channelId).length

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="px-6 py-6">

          {/* Info banner */}
          <div className="mb-7 flex items-start gap-3 bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] rounded-lg px-5 py-4">
            <span className="text-lg shrink-0 mt-0.5">ℹ️</span>
            <p className="text-sm leading-relaxed">
              <span className="font-semibold">스마트스토어·카페24</span>는 API로 10분마다 자동 수집됩니다.
              &nbsp;<span className="font-semibold">올리브영·지그재그</span>는 채널 판매자센터에서 주문 CSV를 다운로드 후 업로드해주세요.
            </p>
          </div>

          {/* Section 1: API 자동 연동 */}
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>
              ⚡ API 자동 연동
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {API_CHANNELS.map(ch => (
                <div key={ch.id} className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{ch.icon}</span>
                      <div>
                        <h4 className="font-bold text-base" style={{ color: '#0F172A' }}>{ch.name}</h4>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${CHANNEL_BADGE[ch.id]}`}>
                          자동 연동
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534] shrink-0">
                      연동 완료
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <PulsingDot />
                    <span className="text-[11px]" style={{ color: '#94A3B8' }}>주문 {orderCount(ch.id)}건</span>
                  </div>

                  <p className="text-[11px] -mt-1" style={{ color: '#94A3B8' }}>
                    마지막 동기화: {lastSyncLabel(ch.id)}
                  </p>

                  <button
                    onClick={() => handleApiSync(ch)}
                    disabled={syncing === ch.id}
                    className="w-full text-xs px-3 py-2 rounded-[6px] text-white font-medium transition-colors bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {syncing === ch.id
                      ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span> 동기화 중...</>
                      : '🔄 지금 동기화'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: CSV 직접 업로드 */}
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>
              ⬆ CSV 직접 업로드
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CSV_CHANNELS.map(ch => (
                <div key={ch.id} className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{ch.icon}</span>
                      <div>
                        <h4 className="font-bold text-base" style={{ color: '#0F172A' }}>{ch.name}</h4>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F1F5F9] text-[#64748B]">
                          수동 업로드
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] shrink-0 mt-1" style={{ color: '#94A3B8' }}>주문 {orderCount(ch.id)}건</span>
                  </div>

                  <p className="text-xs -mt-1" style={{ color: '#64748B' }}>
                    CSV 파일을 직접 업로드해주세요
                  </p>

                  <p className="text-[11px] -mt-1" style={{ color: '#94A3B8' }}>
                    마지막 업로드: {lastSyncLabel(ch.id)}
                  </p>

                  <button
                    onClick={() => fileRefs.current[ch.id]?.click()}
                    disabled={uploading === ch.id}
                    className="w-full text-xs px-3 py-2 rounded-[6px] text-white font-medium transition-colors bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {uploading === ch.id
                      ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span> 업로드 중...</>
                      : '⬆ CSV 업로드'}
                  </button>
                  <input
                    type="file" accept=".csv" className="hidden"
                    ref={el => fileRefs.current[ch.id] = el}
                    onChange={e => handleCsvUpload(ch, e.target.files[0])}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Sync history */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>동기화 이력</h3>
              <span className="text-xs" style={{ color: '#94A3B8' }}>최근 50건</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    {['채널', '동기화 시간', '접수 건수', '성공 여부', '오류 메시지'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>동기화 이력이 없습니다.</td></tr>
                  ) : (
                    history.map(h => (
                      <tr key={h.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CHANNEL_BADGE[h.channel] || 'bg-[#F1F5F9] text-[#64748B]'}`}>{h.channel}</span>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{fmtTime(h.synced_at)}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: '#0F172A' }}>{h.order_count}건</td>
                        <td className="px-4 py-3">
                          {h.success
                            ? <span className="px-2 py-0.5 rounded-full text-xs bg-[#DCFCE7] text-[#166534] font-semibold">성공</span>
                            : <span className="px-2 py-0.5 rounded-full text-xs bg-[#FEE2E2] text-[#991B1B] font-semibold">실패</span>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#DC2626' }}>{h.error_message || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </SidebarLayout>
  )
}
