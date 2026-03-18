import { useEffect, useState } from 'react'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

const CHANNEL_META = {
  SMARTSTORE: { label: '스마트스토어', cls: 'bg-green-100 text-green-700' },
  CAFE24:     { label: '카페24',       cls: 'bg-blue-100 text-blue-700' },
  OLIVEYOUNG: { label: '올리브영',     cls: 'bg-orange-100 text-orange-700' },
  ZIGZAG:     { label: '지그재그',     cls: 'bg-pink-100 text-pink-700' },
  ALL:        { label: '전체 채널',    cls: 'bg-purple-100 text-purple-700' },
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

function dDay(startDate) {
  const diff = Math.ceil((new Date(startDate) - new Date()) / 86400000)
  if (diff < 0) return null
  if (diff === 0) return 'D-Day'
  return `D-${diff}`
}

function isActive(p) {
  const today = new Date().toISOString().slice(0, 10)
  return p.start_date <= today && p.end_date >= today
}

function CalendarGrid({ year, month, promotions }) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const dateStr = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const today = new Date().toISOString().slice(0, 10)

  const getPromos = (d) =>
    promotions.filter(p => p.start_date <= dateStr(d) && p.end_date >= dateStr(d))

  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
      {WEEKDAYS.map(w => (
        <div key={w} className={`bg-gray-50 text-center text-xs font-semibold py-2 ${w === '일' ? 'text-red-500' : w === '토' ? 'text-blue-500' : 'text-gray-600'}`}>{w}</div>
      ))}
      {cells.map((d, i) => {
        if (!d) return <div key={`e-${i}`} className="bg-white min-h-[60px]" />
        const promos = getPromos(d)
        const ds = dateStr(d)
        const isToday = ds === today
        const col = (firstDay + d - 1) % 7
        return (
          <div key={d} className={`bg-white min-h-[60px] p-1 ${isToday ? 'bg-purple-50' : ''}`}>
            <span className={`text-xs font-semibold inline-flex w-6 h-6 items-center justify-center rounded-full
              ${isToday ? 'bg-purple-600 text-white' : col === 0 ? 'text-red-500' : col === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
              {d}
            </span>
            <div className="mt-0.5 space-y-0.5">
              {promos.map(p => (
                <div key={p.id}
                  className={`text-[9px] px-1 py-0.5 rounded font-medium truncate leading-tight ${CHANNEL_META[p.channel]?.cls || 'bg-gray-100 text-gray-700'}`}>
                  {p.name}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function SellerPromotionPage() {
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [promotions, setPromotions] = useState([])
  const [alerts, setAlerts] = useState([])
  const [activeTab, setActiveTab] = useState('calendar')

  useEffect(() => {
    api.get('/promotions/').then(r => setPromotions(r.data)).catch(() => {})
    api.get('/promotions/alerts').then(r => setAlerts(r.data)).catch(() => {})
  }, [])

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-purple-50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-purple-900">프로모션 캘린더</h2>
            <p className="text-purple-600 mt-1 text-sm">채널별 프로모션 일정과 내 상품 수요 예측을 확인하세요.</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-white rounded-xl border border-purple-100 p-1 w-fit">
            {[['calendar', '📅 캘린더'], ['list', '📋 목록'], [`alerts`, `⚠️ 수요 알림 ${alerts.length > 0 ? `(${alerts.length})` : ''}`]].map(([k, v]) => (
              <button key={k} onClick={() => setActiveTab(k)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === k ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {v}
              </button>
            ))}
          </div>

          {activeTab === 'calendar' && (
            <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="px-3 py-1 rounded-lg hover:bg-gray-100 text-gray-600">‹</button>
                <h3 className="text-lg font-bold text-gray-800">{calYear}년 {MONTH_NAMES[calMonth]}</h3>
                <button onClick={nextMonth} className="px-3 py-1 rounded-lg hover:bg-gray-100 text-gray-600">›</button>
              </div>
              <CalendarGrid year={calYear} month={calMonth} promotions={promotions} />
              <div className="flex flex-wrap gap-3 mt-4">
                {Object.entries(CHANNEL_META).map(([k, v]) => (
                  <span key={k} className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.cls}`}>{v.label}</span>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'list' && (
            <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-purple-700 text-white">
                  <tr>
                    {['프로모션명', '채널', '시작일', '종료일', '배수', 'D-Day', '상태'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {promotions.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400">프로모션이 없습니다.</td></tr>
                  ) : (
                    promotions.map(p => {
                      const dd = dDay(p.start_date)
                      const active = isActive(p)
                      return (
                        <tr key={p.id} className={`border-t border-gray-100 hover:bg-gray-50 ${active ? 'bg-yellow-50' : ''}`}>
                          <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CHANNEL_META[p.channel]?.cls}`}>
                              {CHANNEL_META[p.channel]?.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{p.start_date}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{p.end_date}</td>
                          <td className="px-4 py-3 font-semibold text-purple-700">×{p.expected_order_multiplier}</td>
                          <td className="px-4 py-3">
                            {active
                              ? <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-200 text-yellow-800 font-bold">진행중</span>
                              : dd
                              ? <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-semibold">{dd}</span>
                              : <span className="text-gray-400 text-xs">종료</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            {active && <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">활성</span>}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="bg-white rounded-xl border border-purple-100 p-10 text-center text-gray-400">
                  향후 30일 내 수요 알림이 없습니다.
                </div>
              ) : (
                alerts.map((a, i) => (
                  <div key={i} className="bg-white rounded-xl border-l-4 border-orange-400 shadow-sm p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-orange-500 font-bold text-sm">⚠️ 재고 부족 예상</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CHANNEL_META[a.channel]?.cls}`}>
                            {CHANNEL_META[a.channel]?.label}
                          </span>
                        </div>
                        <p className="font-semibold text-gray-800">{a.product_name} <span className="font-mono text-xs text-gray-400">({a.sku})</span></p>
                        <p className="text-sm text-gray-600 mt-1">프로모션: <span className="font-medium">{a.promotion_name}</span> ({a.start_date} ~ {a.end_date})</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-gray-500">현재 재고: <span className="font-bold text-gray-800">{a.current_stock}개</span></p>
                        <p className="text-orange-600">예상 수요: <span className="font-bold">{a.expected_demand}개</span></p>
                        <p className="text-red-600 font-bold mt-0.5">부족 예상: {a.shortage}개</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  )
}
