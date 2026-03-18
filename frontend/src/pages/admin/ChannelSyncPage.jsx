import { useEffect, useRef, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const CHANNELS = [
  { id: 'SMARTSTORE', name: '스마트스토어', icon: '🛍️', desc: '네이버 스마트스토어 주문 CSV' },
  { id: 'CAFE24',     name: '카페24',       icon: '☕', desc: '카페24 쇼핑몰 주문 CSV' },
  { id: 'OLIVEYOUNG', name: '올리브영',     icon: '🌿', desc: '올리브영 온라인 주문 CSV' },
  { id: 'ZIGZAG',     name: '지그재그',     icon: '👗', desc: '지그재그 패션몰 주문 CSV' },
]

const CHANNEL_BADGE = {
  SMARTSTORE: 'bg-[#DCFCE7] text-[#166534]',
  CAFE24:     'bg-[#DBEAFE] text-[#1D4ED8]',
  OLIVEYOUNG: 'bg-[#FEF3C7] text-[#92400E]',
  ZIGZAG:     'bg-[#FDF4FF] text-[#7E22CE]',
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
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="mb-7">
            <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>채널 주문 동기화</h2>
            <p className="mt-1 text-sm" style={{ color: '#64748B' }}>각 판매 채널에서 주문 CSV를 업로드하여 주문을 일괄 등록하세요.</p>
          </div>

          {/* Channel cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {CHANNELS.map(ch => (
              <div key={ch.id} className="bg-white rounded-lg border border-[#E2E8F0] p-5 flex flex-col shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="text-3xl mb-2">{ch.icon}</div>
                <h3 className="font-bold text-base mb-0.5" style={{ color: '#0F172A' }}>{ch.name}</h3>
                <p className="text-xs mb-2" style={{ color: '#64748B' }}>{ch.desc}</p>
                <span className={`self-start px-2 py-0.5 rounded-full text-xs font-semibold mb-3 ${CHANNEL_BADGE[ch.id] || 'bg-[#F1F5F9] text-[#64748B]'}`}>{ch.id}</span>
                <p className="text-[10px] mb-3" style={{ color: '#94A3B8' }}>마지막 동기화: {lastSync(ch.id)}</p>
                <div className="flex flex-col gap-2 mt-auto">
                  <button
                    onClick={() => fileRefs.current[ch.id]?.click()}
                    disabled={uploading === ch.id}
                    className="w-full text-xs px-3 py-2 rounded-[6px] text-white font-medium transition-colors bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50">
                    {uploading === ch.id ? '업로드 중...' : '⬆ CSV 업로드'}
                  </button>
                  <input
                    type="file" accept=".csv" className="hidden"
                    ref={el => fileRefs.current[ch.id] = el}
                    onChange={e => handleUpload(ch, e.target.files[0])}
                  />
                </div>
              </div>
            ))}
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
                        <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>
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
