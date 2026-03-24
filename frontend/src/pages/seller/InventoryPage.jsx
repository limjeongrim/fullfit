import { useEffect, useState } from 'react'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

function ExpiryBadge({ days }) {
  if (days <= 30) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#991B1B]">만료임박</span>
  if (days <= 60) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FEF9C3] text-[#854D0E]">주의</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534]">정상</span>
}

function DaysCell({ days }) {
  const color = days <= 30 ? '#991B1B' : days <= 60 ? '#854D0E' : '#166534'
  return <span className="font-semibold" style={{ color }}>{days}일</span>
}

const STORAGE_LABEL = { ROOM_TEMP: '상온', COLD: '냉장' }

function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
      </span>
      <span className="text-xs font-medium" style={{ color: '#64748B' }}>실시간</span>
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
  return <span className="text-xs" style={{ color: '#94A3B8' }}>마지막 업데이트: {display}</span>
}

function StockCell({ quantity, allocatedStock, pendingInbound }) {
  const available = Math.max(0, quantity - allocatedStock)
  const isLow = available < quantity * 0.2 && quantity > 0
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        {isLow && <span title="가용 재고 부족" className="text-orange-500 text-sm">⚠</span>}
        <span className="text-base font-bold" style={{ color: '#16A34A' }}>{available.toLocaleString()}개</span>
        <span className="text-xs" style={{ color: '#94A3B8' }}>가용</span>
      </div>
      {allocatedStock > 0 && (
        <div className="text-xs" style={{ color: '#94A3B8' }}>
          할당 <span className="font-medium" style={{ color: '#64748B' }}>{allocatedStock}개</span>
        </div>
      )}
      {pendingInbound > 0 && (
        <div className="text-xs" style={{ color: '#94A3B8' }}>
          입고예정 <span className="font-medium" style={{ color: '#2563EB' }}>{pendingInbound}개</span>
        </div>
      )}
    </div>
  )
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
    if (filter === 'low') {
      const avail = Math.max(0, row.quantity - (row.allocated_stock || 0))
      if (avail >= row.quantity * 0.2 || row.quantity === 0) return false
    }
    if (search) {
      const q = search.toLowerCase()
      if (!row.product_name.toLowerCase().includes(q) && !row.sku.toLowerCase().includes(q)) return false
    }
    return true
  })

  const lowStockCount = inventory.filter(row => {
    const avail = Math.max(0, row.quantity - (row.allocated_stock || 0))
    return row.quantity > 0 && avail < row.quantity * 0.2
  }).length

  const downloadInventoryCSV = () => {
    const esc = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s }
    const headers = ['상품명','SKU','LOT번호','유통기한','남은일수','가용재고','할당재고','입고예정','보관방식','상태']
    const rows = filtered.map(r => {
      const avail = Math.max(0, r.quantity - (r.allocated_stock || 0))
      return [
        r.product_name, r.sku, r.lot_number, r.expiry_date, r.days_until_expiry,
        avail, r.allocated_stock || 0, r.pending_inbound || 0,
        STORAGE_LABEL[r.storage_type] || r.storage_type,
        r.days_until_expiry <= 30 ? '만료임박' : r.days_until_expiry <= 60 ? '주의' : '정상',
      ]
    })
    const csv = [headers, ...rows].map(row => row.map(esc).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `재고현황_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="px-6 py-6">
          {alertCount > 0 && (
            <div className="mb-4 flex items-center gap-3 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg px-5 py-3">
              <span className="text-lg">⚠️</span>
              <span className="font-semibold text-sm">주의: {alertCount}개 상품의 유통기한이 30일 이내입니다</span>
            </div>
          )}

          {/* Live bar */}
          <div className="flex items-center justify-between mb-4">
            <LiveIndicator />
            <LastUpdated time={lastUpdated} />
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-3">
            {[
              { key: 'all',      label: '전체' },
              { key: 'expiring', label: '만료임박' },
              { key: 'cold',     label: '냉장보관' },
              { key: 'low',      label: `가용 부족 (${lowStockCount})` },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-4 py-1.5 rounded-[6px] text-sm font-medium transition-colors ${
                  filter === key ? 'bg-[#2563EB] text-white' : 'bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`} style={filter !== key ? { color: '#374151' } : {}}>
                {label}
              </button>
            ))}
            <input type="text" placeholder="상품명 또는 SKU 검색" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] w-52" />
            </div>
            <button onClick={downloadInventoryCSV}
              className="border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] px-4 py-1.5 rounded-[6px] text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0" style={{ color: '#374151' }}>
              ↓ 재고 내보내기
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['상품명', 'SKU', 'LOT번호', '유통기한', '남은일수', '재고 현황', '보관방식', '상태'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>데이터가 없습니다.</td></tr>
                ) : (
                  filtered.map((row) => {
                    const available = Math.max(0, row.quantity - (row.allocated_stock || 0))
                    const isLowStock = row.quantity > 0 && available < row.quantity * 0.2
                    return (
                      <tr key={row.id}
                        className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors ${
                          row.days_until_expiry <= 30 ? 'bg-[#FEF2F2]' : isLowStock ? 'bg-[#FFF7ED]' : ''
                        }`}>
                        <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{row.product_name}</td>
                        <td className="px-4 py-3" style={{ color: '#64748B' }}>{row.sku}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: '#374151' }}>{row.lot_number}</td>
                        <td className="px-4 py-3" style={{ color: '#374151' }}>{row.expiry_date}</td>
                        <td className="px-4 py-3"><DaysCell days={row.days_until_expiry} /></td>
                        <td className="px-4 py-3">
                          <StockCell
                            quantity={row.quantity}
                            allocatedStock={row.allocated_stock || 0}
                            pendingInbound={row.pending_inbound || 0}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.storage_type === 'COLD' ? 'bg-[#ECFEFF] text-[#0E7490]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                            {STORAGE_LABEL[row.storage_type]}
                          </span>
                        </td>
                        <td className="px-4 py-3"><ExpiryBadge days={row.days_until_expiry} /></td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>
            가용 재고 = 전체 재고 - 할당 재고 (출고 진행 중인 주문)
          </p>
        </div>
      </div>
    </SidebarLayout>
  )
}
