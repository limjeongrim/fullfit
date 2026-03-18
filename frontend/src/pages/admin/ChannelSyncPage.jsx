import { useEffect, useRef, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const CHANNELS = [
  {
    id: 'SMARTSTORE',
    name: '스마트스토어',
    color: 'green',
    icon: '🛍️',
    desc: '네이버 스마트스토어 주문 CSV',
  },
  {
    id: 'CAFE24',
    name: '카페24',
    color: 'blue',
    icon: '☕',
    desc: '카페24 쇼핑몰 주문 CSV',
  },
  {
    id: 'OLIVEYOUNG',
    name: '올리브영',
    color: 'orange',
    icon: '🌿',
    desc: '올리브영 온라인 주문 CSV',
  },
  {
    id: 'ZIGZAG',
    name: '지그재그',
    color: 'pink',
    icon: '👗',
    desc: '지그재그 패션몰 주문 CSV',
  },
]

const COLOR_MAP = {
  green:  { card: 'border-green-200',  badge: 'bg-green-100 text-green-700',   btn: 'bg-green-600 hover:bg-green-700',   title: 'text-green-800' },
  blue:   { card: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',     btn: 'bg-blue-600 hover:bg-blue-700',     title: 'text-blue-800' },
  orange: { card: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', btn: 'bg-orange-600 hover:bg-orange-700', title: 'text-orange-800' },
  pink:   { card: 'border-pink-200',   badge: 'bg-pink-100 text-pink-700',     btn: 'bg-pink-600 hover:bg-pink-700',     title: 'text-pink-800' },
}

export default function ChannelSyncPage() {
  const { addToast } = useToastStore()
  const [history, setHistory] = useState([])
  const [uploading, setUploading] = useState(null)
  const fileRefs = useRef({})

  const fetchHistory = () => {
    api.get('/channels/sync/history').then(r => setHistory(r.data)).catch(() => {})
  }

  useEffect(() => { fetchHistory() }, [])

  const handleUpload = async (ch, file) => {
    if (!file) return
    setUploading(ch.id)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await api.post(`/channels/sync/${ch.id.toLowerCase()}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const { created, errors } = res.data
      if (errors.length > 0) {
        addToast('warning', `${ch.name} 동기화: ${created}건 성공, ${errors.length}건 오류`)
      } else {
        addToast('success', `${ch.name} 동기화 완료: ${created}건 접수`)
      }
      fetchHistory()
    } catch (e) {
      addToast('error', `동기화 실패: ${e.response?.data?.detail || e.message}`)
    } finally {
      setUploading(null)
      if (fileRefs.current[ch.id]) fileRefs.current[ch.id].value = ''
    }
  }

  const fmtTime = (t) => t ? new Date(t).toLocaleString('ko-KR') : '—'

  const lastSync = (channelId) => {
    const row = history.find(h => h.channel === channelId)
    return row ? fmtTime(row.synced_at) : '미동기화'
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-blue-50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-blue-900">채널 주문 동기화</h2>
            <p className="text-blue-600 mt-1 text-sm">각 판매 채널에서 주문 CSV를 업로드하여 주문을 일괄 등록하세요.</p>
          </div>

          {/* Channel cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {CHANNELS.map(ch => {
              const c = COLOR_MAP[ch.color]
              return (
                <div key={ch.id} className={`bg-white rounded-xl border-2 ${c.card} p-5 flex flex-col`}>
                  <div className="text-3xl mb-2">{ch.icon}</div>
                  <h3 className={`font-bold text-lg mb-0.5 ${c.title}`}>{ch.name}</h3>
                  <p className="text-gray-500 text-xs mb-2">{ch.desc}</p>
                  <span className={`self-start px-2 py-0.5 rounded-full text-xs font-semibold ${c.badge} mb-3`}>{ch.id}</span>
                  <p className="text-[10px] text-gray-400 mb-3">마지막 동기화: {lastSync(ch.id)}</p>
                  <div className="flex flex-col gap-2 mt-auto">
                    <button
                      onClick={() => fileRefs.current[ch.id]?.click()}
                      disabled={uploading === ch.id}
                      className={`w-full text-xs px-3 py-2 rounded-lg text-white font-medium transition-colors ${c.btn} disabled:opacity-50`}>
                      {uploading === ch.id ? '업로드 중...' : '⬆ CSV 업로드'}
                    </button>
                    <input
                      type="file" accept=".csv" className="hidden"
                      ref={el => fileRefs.current[ch.id] = el}
                      onChange={e => handleUpload(ch, e.target.files[0])}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Sync history */}
          <div className="bg-white rounded-xl shadow-sm border border-blue-100">
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
