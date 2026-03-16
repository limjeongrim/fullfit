import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'

const STATUS_META = {
  RECEIVED:  { label: '접수',    cls: 'bg-blue-100 text-blue-700' },
  PICKING:   { label: '피킹중',  cls: 'bg-yellow-100 text-yellow-700' },
  PACKED:    { label: '패킹완료', cls: 'bg-orange-100 text-orange-700' },
  SHIPPED:   { label: '배송중',  cls: 'bg-purple-100 text-purple-700' },
  DELIVERED: { label: '배송완료', cls: 'bg-green-100 text-green-700' },
  CANCELLED: { label: '취소',    cls: 'bg-gray-100 text-gray-500' },
}

const CHANNEL_META = {
  SMARTSTORE: { label: '스마트스토어', cls: 'bg-green-100 text-green-700' },
  OLIVEYOUNG: { label: '올리브영',    cls: 'bg-orange-100 text-orange-700' },
  ZIGZAG:     { label: '지그재그',    cls: 'bg-pink-100 text-pink-700' },
  CAFE24:     { label: '카페24',      cls: 'bg-blue-100 text-blue-700' },
  MANUAL:     { label: '수동',        cls: 'bg-gray-100 text-gray-500' },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function ChannelBadge({ channel }) {
  const m = CHANNEL_META[channel] || {}
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function StatCard({ label, value, color }) {
  const colorMap = {
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    gray:   'bg-gray-50 border-gray-200 text-gray-600',
  }
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  )
}

export default function SellerOrderPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [search, setSearch] = useState('')

  const fetchOrders = async () => {
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterChannel) params.set('channel', filterChannel)
    if (search) params.set('search', search)
    params.set('limit', '100')
    const res = await api.get(`/orders/seller?${params}`)
    setOrders(res.data.items)
    setTotal(res.data.total)
  }

  useEffect(() => { fetchOrders() }, [filterStatus, filterChannel, search])

  const handleLogout = () => { logout(); navigate('/login') }

  const count = (s) => orders.filter((o) => o.status === s).length
  const stats = [
    { label: '전체 주문', value: total, color: 'purple' },
    { label: '접수/처리중', value: count('RECEIVED') + count('PICKING') + count('PACKED'), color: 'blue' },
    { label: '배송완료', value: count('DELIVERED'), color: 'green' },
    { label: '취소', value: count('CANCELLED'), color: 'gray' },
  ]

  return (
    <div className="min-h-screen bg-purple-50">
      {/* Navbar */}
      <nav className="bg-purple-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/seller/dashboard')} className="text-purple-200 hover:text-white text-sm">← 대시보드</button>
          <span className="text-xl font-bold">주문 현황</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-purple-100">{user?.email}</span>
          <button onClick={handleLogout} className="bg-purple-900 hover:bg-purple-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">로그아웃</button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
          {stats.map((s) => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          >
            <option value="">전체 상태</option>
            {Object.keys(STATUS_META).map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>

          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          >
            <option value="">전체 채널</option>
            {Object.keys(CHANNEL_META).map((c) => (
              <option key={c} value={c}>{CHANNEL_META[c].label}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="주문번호 또는 수신자 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 w-56"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-purple-100">
          <table className="w-full text-sm">
            <thead className="bg-purple-700 text-white">
              <tr>
                {['주문번호', '채널', '수신자', '주소', '금액', '상태', '주문일시'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">주문이 없습니다.</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-purple-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{o.order_number}</td>
                    <td className="px-4 py-3"><ChannelBadge channel={o.channel} /></td>
                    <td className="px-4 py-3 font-medium text-gray-800">{o.receiver_name}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{o.receiver_address}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      ₩{Number(o.total_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(o.created_at).toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">총 {total}건</p>
      </div>
    </div>
  )
}
