import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'

function ExpiryBadge({ days }) {
  if (days <= 30)
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        만료임박
      </span>
    )
  if (days <= 60)
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
        주의
      </span>
    )
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      정상
    </span>
  )
}

function DaysCell({ days }) {
  const cls =
    days <= 30
      ? 'text-red-600 font-semibold'
      : days <= 60
      ? 'text-yellow-600 font-semibold'
      : 'text-green-700'
  return <span className={cls}>{days}일</span>
}

const STORAGE_LABEL = { ROOM_TEMP: '상온', COLD: '냉장' }

export default function SellerInventoryPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const [inventory, setInventory] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    api.get('/inventory/seller').then((res) => {
      setInventory(res.data)
      setAlertCount(res.data.filter((r) => r.days_until_expiry <= 30).length)
    })
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const filtered = inventory.filter((row) => {
    if (filter === 'expiring' && row.days_until_expiry > 30) return false
    if (filter === 'cold' && row.storage_type !== 'COLD') return false
    if (search) {
      const q = search.toLowerCase()
      if (!row.product_name.toLowerCase().includes(q) && !row.sku.toLowerCase().includes(q))
        return false
    }
    return true
  })

  return (
    <div className="min-h-screen bg-purple-50">
      {/* Navbar */}
      <nav className="bg-purple-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/seller/dashboard')} className="text-purple-200 hover:text-white text-sm">
            ← 대시보드
          </button>
          <span className="text-xl font-bold">재고 조회</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-purple-100">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="bg-purple-900 hover:bg-purple-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
          >
            로그아웃
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {alertCount > 0 && (
          <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-300 text-red-700 rounded-xl px-5 py-3">
            <span className="text-lg">⚠️</span>
            <span className="font-semibold">
              주의: {alertCount}개 상품의 유통기한이 30일 이내입니다
            </span>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {[
            { key: 'all', label: '전체' },
            { key: 'expiring', label: '만료임박' },
            { key: 'cold', label: '냉장보관' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-purple-700 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-purple-50'
              }`}
            >
              {label}
            </button>
          ))}
          <input
            type="text"
            placeholder="상품명 또는 SKU 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 w-52"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-purple-100">
          <table className="w-full text-sm">
            <thead className="bg-purple-700 text-white">
              <tr>
                {['상품명', 'SKU', 'LOT번호', '유통기한', '남은일수', '수량', '보관방식', '상태'].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400">
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t border-gray-100 hover:bg-purple-50 transition-colors ${
                      row.days_until_expiry <= 30 ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">{row.product_name}</td>
                    <td className="px-4 py-3 text-gray-500">{row.sku}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.lot_number}</td>
                    <td className="px-4 py-3 text-gray-700">{row.expiry_date}</td>
                    <td className="px-4 py-3">
                      <DaysCell days={row.days_until_expiry} />
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.storage_type === 'COLD'
                            ? 'bg-cyan-100 text-cyan-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {STORAGE_LABEL[row.storage_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ExpiryBadge days={row.days_until_expiry} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
