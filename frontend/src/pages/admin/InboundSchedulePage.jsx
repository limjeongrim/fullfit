import { useEffect, useState } from 'react'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const TIME_SLOTS = [
  '09:00-10:00', '10:00-11:00', '11:00-12:00',
  '14:00-15:00', '15:00-16:00', '16:00-17:00',
]

function today() {
  return new Date().toISOString().split('T')[0]
}
function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function PriorityBadge({ score }) {
  if (score >= 30) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FEE2E2] text-[#991B1B]">긴급</span>
  if (score >= 15) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FEF9C3] text-[#854D0E]">우선</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#F1F5F9] text-[#475569]">일반</span>
}

function StatusBadge({ status }) {
  const map = {
    SCHEDULED:  { cls: 'bg-[#EFF6FF] text-[#1D4ED8]', label: '배정됨' },
    CONFIRMED:  { cls: 'bg-[#F0FDF4] text-[#15803D]', label: '확정' },
    COMPLETED:  { cls: 'bg-[#F8FAFC] text-[#475569]', label: '완료' },
    CANCELLED:  { cls: 'bg-[#FEF2F2] text-[#DC2626]', label: '취소' },
  }
  const { cls, label } = map[status] || { cls: 'bg-[#F1F5F9] text-[#475569]', label: status }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
}

function SlotCard({ entry, onCancel }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-3 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-semibold text-[#0F172A] truncate">{entry.seller_name}</span>
        <PriorityBadge score={entry.priority_score} />
      </div>
      <p className="text-xs text-[#374151] mb-1 truncate">{entry.product_name}</p>
      <p className="text-xs text-[#64748B] mb-2">
        {entry.lot_number} · {entry.total_units.toLocaleString()}개
      </p>
      {entry.priority_reason && (
        <p className="text-[11px] text-[#94A3B8] mb-2 italic">{entry.priority_reason}</p>
      )}
      <div className="flex items-center justify-between">
        <StatusBadge status={entry.status} />
        {entry.status !== 'COMPLETED' && entry.status !== 'CANCELLED' && (
          <button
            onClick={() => onCancel(entry.id)}
            className="text-xs text-[#DC2626] hover:underline"
          >
            취소
          </button>
        )}
      </div>
    </div>
  )
}

function EmptySlot() {
  return (
    <div className="border-2 border-dashed border-[#E2E8F0] rounded-lg p-3 flex items-center justify-center h-full min-h-[80px]">
      <span className="text-xs text-[#CBD5E1]">비어있음</span>
    </div>
  )
}

export default function InboundSchedulePage() {
  const addToast = useToastStore((s) => s.addToast)
  const [selectedDate, setSelectedDate] = useState(tomorrow())
  const [schedule, setSchedule] = useState(null)   // { date, slots_used, slots_available, schedule, overflow }
  const [loading, setLoading]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [pendingCount, setPendingCount] = useState(null)

  const fetchSchedule = async (d) => {
    setLoading(true)
    try {
      const res = await api.get(`/inbound-schedule/list?target_date=${d}`)
      const dayData = res.data.schedules[d] || []
      setSchedule({
        date:            d,
        slots_used:      dayData.length,
        slots_available: 12 - dayData.length,
        schedule:        dayData,
        overflow:        [],
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSchedule(selectedDate) }, [selectedDate])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await api.post(`/inbound-schedule/generate?target_date=${selectedDate}`)
      const data = res.data
      setSchedule({
        date:            data.date,
        slots_used:      data.slots_used,
        slots_available: data.slots_available,
        schedule:        data.schedule,
        overflow:        data.overflow || [],
      })
      if (data.total_requests === 0) {
        addToast('info', data.message || '배정할 입고 요청이 없습니다.')
      } else {
        addToast('success', `${data.schedule.length}건 시간대 배정 완료 (이월 ${data.overflow?.length || 0}건)`)
      }
    } catch (e) {
      addToast('error', '스케줄 생성에 실패했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  const handleCancel = async (scheduleId) => {
    if (!window.confirm('이 시간대 배정을 취소하시겠습니까?')) return
    try {
      await api.post(`/inbound-schedule/${scheduleId}/cancel`)
      addToast('success', '스케줄이 취소되었습니다.')
      fetchSchedule(selectedDate)
    } catch (e) {
      addToast('error', '취소에 실패했습니다.')
    }
  }

  // Build timetable: TIME_SLOTS × DOCKS lookup
  const slotMap = {}
  if (schedule?.schedule) {
    for (const entry of schedule.schedule) {
      const key = `${entry.time_slot}__${entry.dock_number}`
      slotMap[key] = entry
    }
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="px-6 py-6 max-w-6xl mx-auto">

          {/* Header bar */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-[#374151]">날짜</label>
              <div className="flex gap-1">
                {[{ label: '오늘', val: today() }, { label: '내일', val: tomorrow() }].map(({ label, val }) => (
                  <button key={val}
                    onClick={() => setSelectedDate(val)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedDate === val ? 'bg-[#2563EB] text-white' : 'bg-white border border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC]'
                    }`}>
                    {label}
                  </button>
                ))}
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="ml-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 py-2 rounded-[6px] text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {generating ? '생성 중...' : '🗓 스케줄 생성'}
            </button>
          </div>

          {/* Stats bar */}
          {schedule && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: '총 슬롯', value: '12', sub: `도크 2 × 6시간대` },
                { label: '배정된 슬롯', value: schedule.slots_used, sub: '건 입고 예정', color: '#2563EB' },
                { label: '남은 슬롯', value: schedule.slots_available, sub: '건 추가 가능', color: schedule.slots_available === 0 ? '#DC2626' : '#16A34A' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <p className="text-xs font-medium text-[#64748B] mb-1">{label}</p>
                  <p className="text-2xl font-bold" style={{ color: color || '#0F172A' }}>{value}</p>
                  <p className="text-xs text-[#94A3B8] mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* Timetable */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[#0F172A]">
                입고 시간표 — {selectedDate}
              </h3>
              {loading && <span className="text-xs text-[#94A3B8]">불러오는 중...</span>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] w-36 border-b border-[#E2E8F0]">시간대</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] border-b border-[#E2E8F0]">
                      🚛 도크 1 (소량)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] border-b border-[#E2E8F0]">
                      🚚 도크 2 (대량)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map((slot, idx) => {
                    const isBreak = idx === 3
                    return (
                      <>
                        {isBreak && (
                          <tr key="break" className="bg-[#F8FAFC]">
                            <td colSpan={3} className="px-4 py-2 text-center text-xs text-[#94A3B8] italic border-y border-[#E2E8F0]">
                              — 점심 휴식 (12:00–14:00) —
                            </td>
                          </tr>
                        )}
                        <tr key={slot} className="border-b border-[#F1F5F9] hover:bg-[#FAFBFC] transition-colors">
                          <td className="px-4 py-3 text-sm font-mono font-medium text-[#374151] whitespace-nowrap">
                            {slot}
                          </td>
                          {[1, 2].map((dock) => {
                            const entry = slotMap[`${slot}__${dock}`]
                            return (
                              <td key={dock} className="px-3 py-3 align-top w-[45%]">
                                {entry
                                  ? <SlotCard entry={entry} onCancel={handleCancel} />
                                  : <EmptySlot />
                                }
                              </td>
                            )
                          })}
                        </tr>
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overflow section */}
          {schedule?.overflow?.length > 0 && (
            <div className="bg-white rounded-xl border border-[#FECACA] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
              <h3 className="font-semibold text-sm text-[#991B1B] mb-3 flex items-center gap-2">
                <span>⚠️</span>
                다음날로 이월된 요청 {schedule.overflow.length}건
              </h3>
              <div className="space-y-2">
                {schedule.overflow.map((item) => (
                  <div key={item.inbound_id}
                    className="flex items-center justify-between px-4 py-2.5 bg-[#FEF2F2] rounded-lg text-sm">
                    <span className="text-[#374151]">
                      LOT: {item.lot_number} · {item.quantity.toLocaleString()}개
                    </span>
                    <span className="text-xs text-[#DC2626]">{item.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && schedule && schedule.schedule.length === 0 && schedule.overflow?.length === 0 && (
            <div className="text-center py-16 text-[#94A3B8] text-sm">
              <p className="text-4xl mb-3">📭</p>
              <p className="font-medium">배정된 입고 스케줄이 없습니다</p>
              <p className="mt-1 text-xs">"스케줄 생성" 버튼으로 미배정 입고 요청을 자동 배정하세요</p>
            </div>
          )}

        </div>
      </div>
    </SidebarLayout>
  )
}
