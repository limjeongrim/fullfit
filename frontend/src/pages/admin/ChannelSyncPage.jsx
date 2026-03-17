import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'

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

const SAMPLE_ROWS = {
  SMARTSTORE: `channel,receiver_name,receiver_phone,receiver_address,total_amount,seller_id,note
SMARTSTORE,김민준,010-1234-5678,서울시 강남구 테헤란로 123,35000,2,스마트스토어 주문
SMARTSTORE,이서연,010-9876-5432,경기도 성남시 분당구 판교역로 45,48000,2,`,
  CAFE24: `channel,receiver_name,receiver_phone,receiver_address,total_amount,seller_id,note
CAFE24,박지훈,010-5555-1234,부산시 해운대구 센텀시티로 55,29000,2,카페24 주문
CAFE24,최수아,010-3333-7777,대구시 수성구 동대구로 100,67000,2,`,
  OLIVEYOUNG: `channel,receiver_name,receiver_phone,receiver_address,total_amount,seller_id,note
OLIVEYOUNG,정하은,010-7777-2222,인천시 남동구 인주대로 30,25000,2,올리브영 주문
OLIVEYOUNG,강도윤,010-8888-4444,광주시 북구 무등로 200,43000,2,`,
  ZIGZAG: `channel,receiver_name,receiver_phone,receiver_address,total_amount,seller_id,note
ZIGZAG,윤지아,010-2222-8888,대전시 유성구 대학로 99,55000,2,지그재그 주문
ZIGZAG,임현우,010-6666-3333,울산시 남구 삼산로 60,38000,2,`,
}

export default function ChannelSyncPage() {
  const { user, logout } = useAuthStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [uploading, setUploading] = useState(null)
  const fileRefs = useRef({})

  const fetchHistory = () => {
    api.get('/channels/sync/history').then(r => setHistory(r.data)).catch(() => {})
  }

  useEffect(() => { fetchHistory() }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const downloadSample = (ch) => {
    const blob = new Blob([SAMPLE_ROWS[ch.id]], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${ch.id.toLowerCase()}_sample.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
    <div className="min-h-screen bg-blue-50">
      <nav className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/dashboard')} className="text-blue-200 hover:text-white text-sm">← 대시보드</button>
          <span className="text-xl font-bold">채널 연동</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-blue-100">{user?.email}</span>
          <button onClick={handleLogout} className="bg-blue-900 hover:bg-blue-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">로그아웃</button>
        </div>
      </nav>

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
                  <button onClick={() => downloadSample(ch)}
                    className="w-full text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700">
                    📄 샘플 CSV 다운로드
                  </button>
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
  )
}
