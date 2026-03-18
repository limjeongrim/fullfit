import { useEffect, useState } from 'react'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

function ExpiryBadge({ days }) {
  if (days <= 30) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">만료임박</span>
  if (days <= 60) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">주의</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">정상</span>
}

function DaysCell({ days }) {
  const cls = days <= 30 ? 'text-red-600 font-semibold' : days <= 60 ? 'text-yellow-600 font-semibold' : 'text-green-700'
  return <span className={cls}>{days}일</span>
}

const STORAGE_LABEL = { ROOM_TEMP: '상온', COLD: '냉장' }

function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
      <span className="text-xs text-green-600 font-medium">실시간</span>
    </span>
  )
}

function LastUpdated({ time }) {
  const [display, setDisplay] = useState('—')
  useEffect(() => {
    const update = () => {
      if (!time) { setDisplay('—'); return }
      const diff = Math.floor((Date.now() - time) / 1000)
      if (diff < 10) setDisplay('방금 전')
      else if (diff < 60) setDisplay(`${diff}초 전`)
      else if (diff < 3600) setDisplay(`${Math.floor(diff / 60)}분 전`)
      else setDisplay(new Date(time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [time])
  return <span className="text-xs text-gray-400">마지막 업데이트: {display}</span>
}

export default function SellerInventoryPage() {
  const [inventory, setInventory] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [alertCount, setAlertCount] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [tick, setTick] = useState(0)

  const fetchInventory = async () => {
    try {
      const res = await api.get('/inventory/seller')
      setInventory(res.data)
      setAlertCount(res.data.filter((r) => r.days_until_expiry <= 30).length)
      setLastUpdated(Date.now())
    } catch (e) { console.error(e) }
  }

  useEffect(() => { fetchInventory() }, [tick])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const filtered = inventory.filter((row) => {
    if (filter === 'expiring' && row.days_until_expiry > 30) return false
    if (filter === 'cold' && row.storage_type !== 'COLD') return false
    if (search) {
      const q = search.toLowerCase()
      if (!row.product_name.toLowerCase().includes(q) && !row.sku.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-purple-50">
        <div className="px-6 py-6">
          {alertCount > 0 && (
            <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-300 text-red-700 rounded-xl px-5 py-3">
              <span className="text-lg">⚠️</span>
              <span className="font-semibold">주의: {alertCount}개 상품의 유통기한이 30일 이내입니다</span>
            </div>
          )}

          {/* Live bar */}
          <div className="flex items-center justify-between mb-4">
            <LiveIndicator />
            <LastUpdated time={lastUpdated} />
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {[{ key: 'all', label: '전체' }, { key: 'expiring', label: '만료임박' }, { key: 'cold', label: '냉장보관' }].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === key ? 'bg-purple-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-purple-50'
                }`}>
                {label}
              </button>
            ))}
            <input type="text" placeholder="상품명 또는 SKU 검색" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 w-52" />
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-purple-100">
            <table className="w-full text-sm">
              <thead className="bg-purple-700 text-white">
                <tr>
                  {['상품명', 'SKU', 'LOT번호', '유통기한', '남은일수', '수량', '보관방식', '상태'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">데이터가 없습니다.</td></tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id}
                      className={`border-t border-gray-100 hover:bg-purple-50 transition-colors ${row.days_until_expiry <= 30 ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-800">{row.product_name}</td>
                      <td className="px-4 py-3 text-gray-500">{row.sku}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.lot_number}</td>
                      <td className="px-4 py-3 text-gray-700">{row.expiry_date}</td>
                      <td className="px-4 py-3"><DaysCell days={row.days_until_expiry} /></td>
                      <td className="px-4 py-3 text-gray-700">{row.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.storage_type === 'COLD' ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-600'}`}>
                          {STORAGE_LABEL[row.storage_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3"><ExpiryBadge days={row.days_until_expiry} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
