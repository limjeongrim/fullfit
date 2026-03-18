import { useEffect, useState } from 'react'
import api from '../../api/axiosInstance'
import SidebarLayout from '../../components/Layout/SidebarLayout'

function StatusBadge({ status }) {
  return status === 'CONFIRMED'
    ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534]">확정</span>
    : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FEF9C3] text-[#854D0E]">미확정</span>
}

const fmt = (n) => `₩${Number(n).toLocaleString()}`

export default function SellerSettlementPage() {
  const [settlements, setSettlements] = useState([])

  useEffect(() => {
    api.get('/settlements/seller').then((r) => setSettlements(r.data))
  }, [])

  const handleDownload = () => {
    alert('다운로드 기능 준비 중입니다.')
  }

  const totalConfirmed = settlements
    .filter((s) => s.status === 'CONFIRMED')
    .reduce((sum, s) => sum + Number(s.total_fee), 0)

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Summary card */}
          {settlements.length > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 mb-6 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <div>
                <p className="text-sm font-medium" style={{ color: '#64748B' }}>확정 정산 누계</p>
                <p className="text-3xl font-bold mt-1" style={{ color: '#0F172A' }}>{fmt(totalConfirmed)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium" style={{ color: '#64748B' }}>정산 건수</p>
                <p className="text-3xl font-bold mt-1" style={{ color: '#0F172A' }}>{settlements.length}건</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['정산월', '보관료', '입고비', '출고비', '부가작업비', '합계', '상태', '다운로드'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settlements.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-sm" style={{ color: '#94A3B8' }}>정산 내역이 없습니다.</td></tr>
                ) : (
                  settlements.map((s) => (
                    <tr key={s.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-3 font-mono font-medium" style={{ color: '#374151' }}>{s.year_month}</td>
                      <td className="px-4 py-3" style={{ color: '#64748B' }}>{fmt(s.storage_fee)}</td>
                      <td className="px-4 py-3" style={{ color: '#64748B' }}>{fmt(s.inbound_fee)}</td>
                      <td className="px-4 py-3" style={{ color: '#64748B' }}>{fmt(s.outbound_fee)}</td>
                      <td className="px-4 py-3" style={{ color: '#64748B' }}>{fmt(s.extra_fee)}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: '#0F172A' }}>{fmt(s.total_fee)}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3">
                        <button onClick={handleDownload}
                          className="px-3 py-1 border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs rounded-[6px] transition-colors font-medium" style={{ color: '#374151' }}>
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
    </SidebarLayout>
  )
}
