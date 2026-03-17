import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useToastStore from '../../store/toastStore'
import api from '../../api/axiosInstance'

const CHANNEL_META = {
  SMARTSTORE: { label: '스마트스토어', cls: 'bg-green-100 text-green-700' },
  CAFE24:     { label: '카페24',       cls: 'bg-blue-100 text-blue-700' },
  OLIVEYOUNG: { label: '올리브영',     cls: 'bg-orange-100 text-orange-700' },
  ZIGZAG:     { label: '지그재그',     cls: 'bg-pink-100 text-pink-700' },
  ALL:        { label: '전체 채널',    cls: 'bg-purple-100 text-purple-700' },
}

const CHANNELS = ['SMARTSTORE', 'CAFE24', 'OLIVEYOUNG', 'ZIGZAG', 'ALL']
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

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
        if (!d) return <div key={`e-${i}`} className="bg-white min-h-[70px]" />
        const promos = getPromos(d)
        const ds = dateStr(d)
        const isToday = ds === today
        const col = (firstDay + d - 1) % 7
        return (
          <div key={d} className={`bg-white min-h-[70px] p-1 ${isToday ? 'bg-blue-50' : ''}`}>
            <span className={`text-xs font-semibold inline-flex w-6 h-6 items-center justify-center rounded-full
              ${isToday ? 'bg-blue-600 text-white' : col === 0 ? 'text-red-500' : col === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
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

const EMPTY_FORM = {
  name: '', channel: 'SMARTSTORE', start_date: '', end_date: '',
  expected_order_multiplier: 2, note: '',
}

export default function AdminPromotionPage() {
  const { user, logout } = useAuthStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()

  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [promotions, setPromotions] = useState([])
  const [alerts, setAlerts] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('calendar')

  const fetchData = () => {
    api.get('/promotions/').then(r => setPromotions(r.data)).catch(() => {})
    api.get('/promotions/alerts').then(r => setAlerts(r.data)).catch(() => {})
  }

  useEffect(() => { fetchData() }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  const handleCreate = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      addToast('warning', '필수 항목을 입력하세요.')
      return
    }
    setSaving(true)
    try {
      await api.post('/promotions/', {
        ...form,
        expected_order_multiplier: parseFloat(form.expected_order_multiplier),
      })
      addToast('success', `프로모션 "${form.name}" 등록 완료`)
      setShowCreate(false)
      setForm(EMPTY_FORM)
      fetchData()
    } catch (e) {
      addToast('error', e.response?.data?.detail || '등록 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`"${name}" 프로모션을 삭제하시겠습니까?`)) return
    try {
      await api.delete(`/promotions/${id}`)
      addToast('success', '삭제되었습니다.')
      fetchData()
    } catch (e) {
      addToast('error', '삭제 실패')
    }
  }

  const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

  return (
    <div className="min-h-screen bg-blue-50">
      <nav className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/dashboard')} className="text-blue-200 hover:text-white text-sm">← 대시보드</button>
          <span className="text-xl font-bold">프로모션 캘린더</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-blue-100">{user?.email}</span>
          <button onClick={handleLogout} className="bg-blue-900 hover:bg-blue-800 text-white text-sm px-4 py-1.5 rounded-lg">로그아웃</button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h2 className="text-2xl font-bold text-blue-900">프로모션 캘린더</h2>
            <p className="text-blue-600 mt-1 text-sm">판매 채널별 프로모션 일정 및 수요 알림 관리</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + 프로모션 등록
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-blue-100 p-1 w-fit">
          {[['calendar', '📅 캘린더'], ['list', '📋 목록'], ['alerts', `⚠️ 수요 알림 ${alerts.length > 0 ? `(${alerts.length})` : ''}`]].map(([k, v]) => (
            <button key={k} onClick={() => setActiveTab(k)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === k ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {v}
            </button>
          ))}
        </div>

        {/* Calendar tab */}
        {activeTab === 'calendar' && (
          <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="px-3 py-1 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">‹</button>
              <h3 className="text-lg font-bold text-gray-800">{calYear}년 {MONTH_NAMES[calMonth]}</h3>
              <button onClick={nextMonth} className="px-3 py-1 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">›</button>
            </div>
            <CalendarGrid year={calYear} month={calMonth} promotions={promotions} />
            <div className="flex flex-wrap gap-3 mt-4">
              {Object.entries(CHANNEL_META).map(([k, v]) => (
                <span key={k} className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.cls}`}>{v.label}</span>
              ))}
            </div>
          </div>
        )}

        {/* List tab */}
        {activeTab === 'list' && (
          <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-700 text-white">
                <tr>
                  {['프로모션명', '채널', '시작일', '종료일', '배수', 'D-Day', '상태', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {promotions.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">프로모션이 없습니다.</td></tr>
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
                        <td className="px-4 py-3 font-semibold text-blue-700">×{p.expected_order_multiplier}</td>
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
                        <td className="px-4 py-3">
                          <button onClick={() => handleDelete(p.id, p.name)}
                            className="text-xs text-red-500 hover:text-red-700 transition-colors">삭제</button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Alerts tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="bg-white rounded-xl border border-blue-100 p-10 text-center text-gray-400">
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

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-800">프로모션 등록</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">프로모션명 *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="예: 올영데이 봄 세일" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">채널 *</label>
                <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  {CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_META[c]?.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">시작일 *</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">종료일 *</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  예상 주문 배수 <span className="font-normal text-gray-400">(평상시 대비)</span>
                </label>
                <input type="number" min="1" max="20" step="0.5" value={form.expected_order_multiplier}
                  onChange={e => setForm(f => ({ ...f, expected_order_multiplier: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">메모</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  placeholder="프로모션 메모" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
              <button onClick={handleCreate} disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
