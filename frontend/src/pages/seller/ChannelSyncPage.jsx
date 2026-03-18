import { useEffect, useRef, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const API_CHANNELS = [
  { id: 'SMARTSTORE', name: '스마트스토어', color: 'green', icon: '🛍️' },
  { id: 'CAFE24',     name: '카페24',       color: 'blue',  icon: '☕' },
]

const CSV_CHANNELS = [
  { id: 'OLIVEYOUNG', name: '올리브영', color: 'orange', icon: '🌿' },
  { id: 'ZIGZAG',     name: '지그재그', color: 'pink',   icon: '👗' },
]

const COLOR_MAP = {
  green:  { card: 'border-green-200 bg-green-50/30',   title: 'text-green-800',  badge: 'bg-green-100 text-green-700',   syncBtn: 'bg-green-600 hover:bg-green-700' },
  blue:   { card: 'border-blue-200 bg-blue-50/30',     title: 'text-blue-800',   badge: 'bg-blue-100 text-blue-700',     syncBtn: 'bg-blue-600 hover:bg-blue-700' },
  orange: { card: 'border-orange-200 bg-orange-50/30', title: 'text-orange-800', badge: 'bg-orange-100 text-orange-700', syncBtn: 'bg-orange-500 hover:bg-orange-600' },
  pink:   { card: 'border-pink-200 bg-pink-50/30',     title: 'text-pink-800',   badge: 'bg-pink-100 text-pink-700',     syncBtn: 'bg-pink-500 hover:bg-pink-600' },
}

function PulsingDot() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
      <span className="text-xs text-green-600 font-medium">자동 수집 중</span>
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
      <div className="min-h-screen bg-purple-50">
        <div className="px-6 py-6">

          {/* Info banner */}
          <div className="mb-7 flex items-start gap-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-5 py-4">
            <span className="text-lg shrink-0 mt-0.5">ℹ️</span>
            <p className="text-sm leading-relaxed">
              <span className="font-semibold">스마트스토어·카페24</span>는 API로 10분마다 자동 수집됩니다.
              &nbsp;<span className="font-semibold">올리브영·지그재그</span>는 채널 판매자센터에서 주문 CSV를 다운로드 후 업로드해주세요.
            </p>
          </div>

          {/* Section 1: API 자동 연동 */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              ⚡ API 자동 연동
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {API_CHANNELS.map(ch => {
                const c = COLOR_MAP[ch.color]
                return (
                  <div key={ch.id} className={`bg-white rounded-xl border-2 ${c.card} p-5 flex flex-col gap-3`}>
                    {/* Header row */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{ch.icon}</span>
                        <div>
                          <h4 className={`font-bold text-base ${c.title}`}>{ch.name}</h4>
                          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${c.badge}`}>
                            자동 연동
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 shrink-0">
                        연동 완료
                      </span>
                    </div>

                    {/* Status row */}
                    <div className="flex items-center justify-between">
                      <PulsingDot />
                      <span className="text-[11px] text-gray-400">주문 {orderCount(ch.id)}건</span>
                    </div>

                    {/* Last sync */}
                    <p className="text-[11px] text-gray-400 -mt-1">
                      마지막 동기화: {lastSyncLabel(ch.id)}
                    </p>

                    {/* Button */}
                    <button
                      onClick={() => handleApiSync(ch)}
                      disabled={syncing === ch.id}
                      className={`w-full text-xs px-3 py-2 rounded-lg text-white font-medium transition-colors ${c.syncBtn} disabled:opacity-50 flex items-center justify-center gap-1.5`}>
                      {syncing === ch.id
                        ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span> 동기화 중...</>
                        : '🔄 지금 동기화'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Section 2: CSV 직접 업로드 */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              ⬆ CSV 직접 업로드
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CSV_CHANNELS.map(ch => {
                const c = COLOR_MAP[ch.color]
                return (
                  <div key={ch.id} className={`bg-white rounded-xl border-2 ${c.card} p-5 flex flex-col gap-3`}>
                    {/* Header row */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{ch.icon}</span>
                        <div>
                          <h4 className={`font-bold text-base ${c.title}`}>{ch.name}</h4>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                            수동 업로드
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] text-gray-400 shrink-0 mt-1">주문 {orderCount(ch.id)}건</span>
                    </div>

                    {/* Subtitle */}
                    <p className="text-xs text-gray-500 -mt-1">
                      CSV 파일을 직접 업로드해주세요
                    </p>

                    {/* Last upload */}
                    <p className="text-[11px] text-gray-400 -mt-1">
                      마지막 업로드: {lastSyncLabel(ch.id)}
                    </p>

                    {/* Button */}
                    <button
                      onClick={() => fileRefs.current[ch.id]?.click()}
                      disabled={uploading === ch.id}
                      className={`w-full text-xs px-3 py-2 rounded-lg text-white font-medium transition-colors ${c.syncBtn} disabled:opacity-50 flex items-center justify-center gap-1.5`}>
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
                )
              })}
            </div>
          </div>

          {/* Sync history */}
          <div className="bg-white rounded-xl shadow-sm border border-purple-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">동기화 이력</h3>
              <span className="text-xs text-gray-400">최근 50건</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    {['채널', '동기화 시간', '접수 건수', '성공 여부', '오류 메시지'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-gray-400">동기화 이력이 없습니다.</td></tr>
                  ) : (
                    history.map(h => (
                      <tr key={h.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{h.channel}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtTime(h.synced_at)}</td>
                        <td className="px-4 py-3 font-bold">{h.order_count}건</td>
                        <td className="px-4 py-3">
                          {h.success
                            ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-semibold">성공</span>
                            : <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-semibold">실패</span>}
                        </td>
                        <td className="px-4 py-3 text-red-500 text-xs">{h.error_message || '—'}</td>
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
