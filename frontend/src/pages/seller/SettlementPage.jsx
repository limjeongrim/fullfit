import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'

function StatusBadge({ status }) {
  return status === 'CONFIRMED'
    ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">확정</span>
    : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">미확정</span>
}

const fmt = (n) => `₩${Number(n).toLocaleString()}`

export default function SellerSettlementPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [settlements, setSettlements] = useState([])

  useEffect(() => {
    api.get('/settlements/seller').then((r) => setSettlements(r.data))
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const handleDownload = () => {
    alert('다운로드 기능 준비 중입니다.')
  }

  // Summary totals
  const totalConfirmed = settlements
    .filter((s) => s.status === 'CONFIRMED')
    .reduce((sum, s) => sum + Number(s.total_fee), 0)

  return (
    <div className="min-h-screen bg-purple-50">
      <nav className="bg-purple-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/seller/dashboard')} className="text-purple-200 hover:text-white text-sm">← 대시보드</button>
          <span className="text-xl font-bold">정산 내역</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-purple-100">{user?.email}</span>
          <button onClick={handleLogout} className="bg-purple-900 hover:bg-purple-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">로그아웃</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Summary card */}
        {settlements.length > 0 && (
          <div className="bg-purple-700 text-white rounded-xl p-5 mb-6 flex items-center justify-between">
            <div>
              <p className="text-purple-200 text-sm">확정 정산 누계</p>
              <p className="text-3xl font-bold mt-1">{fmt(totalConfirmed)}</p>
            </div>
            <div className="text-right">
              <p className="text-purple-200 text-sm">정산 건수</p>
              <p className="text-3xl font-bold mt-1">{settlements.length}건</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-purple-100">
          <table className="w-full text-sm">
            <thead className="bg-purple-700 text-white">
              <tr>
                {['정산월', '보관료', '입고비', '출고비', '부가작업비', '합계', '상태', '다운로드'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">정산 내역이 없습니다.</td></tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100 hover:bg-purple-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-700">{s.year_month}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(s.storage_fee)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(s.inbound_fee)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(s.outbound_fee)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(s.extra_fee)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{fmt(s.total_fee)}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3">
                      <button onClick={handleDownload}
                        className="px-3 py-1 border border-purple-300 text-purple-600 hover:bg-purple-50 text-xs rounded-lg transition-colors font-medium">
                        📄 다운로드
                      </button>
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
