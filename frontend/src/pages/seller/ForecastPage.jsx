import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'

const RISK_META = {
  HIGH:   { label: '위험', cls: 'bg-red-100 text-red-700 font-bold' },
  MEDIUM: { label: '주의', cls: 'bg-yellow-100 text-yellow-700 font-semibold' },
  LOW:    { label: '안전', cls: 'bg-green-100 text-green-700' },
}

function PromoRiskBadge({ risk }) {
  const m = RISK_META[risk] || RISK_META.LOW
  return <span className={`px-2 py-0.5 rounded-full text-xs ${m.cls}`}>{m.label}</span>
}

export default function SellerForecastPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/stats/demand-forecast/seller')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const highRiskCount = data.filter(d => d.promotion_risk === 'HIGH').length
  const reorderCount = data.filter(d => d.reorder_recommended).length
  const criticalCount = data.filter(d => d.days_of_stock < 7 && d.days_of_stock !== 999).length

  const chartData = data.slice(0, 10).map(d => ({
    name: d.product_name.length > 8 ? d.product_name.slice(0, 8) + '…' : d.product_name,
    days: d.days_of_stock === 999 ? 0 : d.days_of_stock,
    raw: d,
  }))

  const getBarColor = (days) => {
    if (days < 7) return '#ef4444'
    if (days < 14) return '#a855f7'
    return '#9333ea'
  }

  return (
    <div className="min-h-screen bg-purple-50">
      <nav className="bg-purple-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/seller/dashboard')} className="text-purple-200 hover:text-white text-sm">← 대시보드</button>
          <span className="text-xl font-bold">수요 예측</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-purple-100">{user?.email}</span>
          <button onClick={handleLogout} className="bg-purple-900 hover:bg-purple-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">로그아웃</button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-purple-900">수요 예측 분석</h2>
          <p className="text-purple-600 mt-1 text-sm">최근 30일 판매 데이터 기반 재고 소진 예측</p>
        </div>

        {/* Promotion HIGH risk banner */}
        {highRiskCount > 0 && (
          <div className="mb-5 flex items-center gap-3 bg-red-50 border-2 border-red-300 text-red-700 rounded-xl px-5 py-4">
            <span className="text-xl">⚠️</span>
            <span className="font-semibold">
              {highRiskCount}개 상품이 예정된 프로모션 기간 동안 재고 부족이 예상됩니다.
            </span>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-purple-100 p-4">
            <p className="text-sm text-gray-500 mb-1">내 상품</p>
            <p className="text-3xl font-bold text-purple-700">{data.length}</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <p className="text-sm text-red-600 mb-1">프로모션 위험</p>
            <p className="text-3xl font-bold text-red-700">{highRiskCount}</p>
          </div>
          <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
            <p className="text-sm text-orange-600 mb-1">재입고 필요</p>
            <p className="text-3xl font-bold text-orange-700">{reorderCount}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
            <p className="text-sm text-yellow-600 mb-1">긴급 (7일 미만)</p>
            <p className="text-3xl font-bold text-yellow-700">{criticalCount}</p>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">재고 소진일수</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} unit="일" />
                <Tooltip
                  formatter={(v, n, props) => {
                    const d = props.payload.raw
                    return [`${v}일 (재고 ${d.current_stock}개)`, '소진일수']
                  }}
                />
                <Bar dataKey="days" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={getBarColor(entry.days)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-purple-700 text-white">
              <tr>
                {['상품명', 'SKU', '현재재고', '일평균판매', '소진일수', '7일예측', '재고상태', '프로모션 리스크', '조치'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">로딩 중...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">데이터가 없습니다.</td></tr>
              ) : (
                data.map(d => {
                  const isCritical = d.days_of_stock < 7 && d.days_of_stock !== 999
                  const isWarn = d.reorder_recommended && !isCritical
                  return (
                    <tr key={d.product_id}
                      className={`border-t border-gray-100 transition-colors ${
                        d.promotion_risk === 'HIGH' ? 'bg-red-50 hover:bg-red-100' :
                        isCritical ? 'bg-orange-50 hover:bg-orange-100' :
                        isWarn ? 'bg-yellow-50' : 'hover:bg-gray-50'
                      }`}>
                      <td className="px-4 py-3 font-medium text-gray-800">{d.product_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.sku}</td>
                      <td className="px-4 py-3 font-semibold">{d.current_stock.toLocaleString()}개</td>
                      <td className="px-4 py-3 text-gray-600">{d.avg_daily_sales}/일</td>
                      <td className="px-4 py-3 font-bold">
                        {d.days_of_stock === 999 ? <span className="text-gray-400">∞</span> : `${d.days_of_stock}일`}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{d.forecast_7day}개</td>
                      <td className="px-4 py-3">
                        {isCritical
                          ? <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-bold">긴급</span>
                          : isWarn
                          ? <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">재입고필요</span>
                          : <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">정상</span>}
                      </td>
                      <td className="px-4 py-3"><PromoRiskBadge risk={d.promotion_risk} /></td>
                      <td className="px-4 py-3">
                        {(d.reorder_recommended || d.promotion_risk !== 'LOW') && (
                          <button
                            onClick={() => navigate('/seller/inventory')}
                            className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors whitespace-nowrap">
                            재고 확인
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
