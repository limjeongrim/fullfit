import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import NotificationBell from '../NotificationBell'
import ChatWidget from '../ChatWidget'

const ADMIN_MENUS = [
  {
    section: '개요',
    items: [
      { icon: '📊', label: '대시보드', path: '/admin/dashboard' },
    ],
  },
  {
    section: '주문/배송',
    items: [
      { icon: '📦', label: '주문 관리',  path: '/admin/orders' },
      { icon: '🚚', label: '배송 관리',  path: '/admin/deliveries' },
      { icon: '🗺️', label: '배송 지도',  path: '/admin/delivery-map' },
      { icon: '🔄', label: '반품 관리',  path: '/admin/returns' },
    ],
  },
  {
    section: '재고',
    items: [
      { icon: '🏭', label: '재고 관리', path: '/admin/inventory' },
      { icon: '📈', label: '수요 예측', path: '/admin/forecast' },
    ],
  },
  {
    section: '운영',
    items: [
      { icon: '📅', label: '프로모션 캘린더', path: '/admin/promotions' },
      { icon: '💰', label: '정산 관리',      path: '/admin/settlements' },
      { icon: '💬', label: '채팅 관리',      path: '/admin/chat' },
    ],
  },
  {
    section: '셀러',
    items: [
      { icon: '👥', label: '셀러 관리', path: '/admin/sellers' },
    ],
  },
]

const WORKER_MENUS = [
  {
    section: '작업',
    items: [
      { icon: '✅', label: '피킹 목록', path: '/worker/picking' },
      { icon: '📥', label: '입고 등록', path: '/worker/inbound' },
      { icon: '📤', label: '출고 처리', path: '/worker/outbound' },
    ],
  },
]

const SELLER_MENUS = [
  {
    section: '주문/배송',
    items: [
      { icon: '📋', label: '주문 현황', path: '/seller/orders' },
      { icon: '📍', label: '배송 추적', path: '/seller/deliveries' },
    ],
  },
  {
    section: '재고',
    items: [
      { icon: '🔍', label: '재고 조회', path: '/seller/inventory' },
      { icon: '📈', label: '수요 예측', path: '/seller/forecast' },
      { icon: '📥', label: '입고 요청', path: '/seller/inbound-request' },
    ],
  },
  {
    section: '운영',
    items: [
      { icon: '🔗', label: '채널 연동',       path: '/seller/channel-sync' },
      { icon: '↩️', label: '반품 신청',       path: '/seller/returns' },
      { icon: '🧾', label: '정산 내역',       path: '/seller/settlements' },
      { icon: '📅', label: '프로모션 캘린더', path: '/seller/promotions' },
    ],
  },
]

const MENUS_BY_ROLE = { ADMIN: ADMIN_MENUS, WORKER: WORKER_MENUS, SELLER: SELLER_MENUS }

const LOGO_BY_ROLE = {
  ADMIN:  { subtitle: '풀필먼트 운영' },
  WORKER: { subtitle: '창고 운영' },
  SELLER: { subtitle: '셀러 포털' },
}

const ROLE_LABEL = { ADMIN: '관리자', WORKER: '작업자', SELLER: '셀러' }

const PAGE_TITLES = {
  '/admin/dashboard':    '대시보드',
  '/admin/orders':       '주문 관리',
  '/admin/deliveries':   '배송 관리',
  '/admin/delivery-map': '배송 지도',
  '/admin/returns':      '반품 관리',
  '/admin/inventory':    '재고 관리',
  '/admin/forecast':     '수요 예측',
  '/admin/channel-sync': '채널 연동',
  '/admin/promotions':   '프로모션 캘린더',
  '/admin/settlements':  '정산 관리',
  '/admin/chat':         '채팅 관리',
  '/admin/sellers':      '셀러 관리',
  '/worker/dashboard':   '대시보드',
  '/worker/picking':     '피킹 목록',
  '/worker/inbound':     '입고 등록',
  '/worker/outbound':    '출고 처리',
  '/seller/dashboard':   '대시보드',
  '/seller/orders':      '주문 현황',
  '/seller/deliveries':  '배송 추적',
  '/seller/inventory':   '재고 조회',
  '/seller/forecast':    '수요 예측',
  '/seller/returns':          '반품 신청',
  '/seller/settlements':      '정산 내역',
  '/seller/promotions':       '프로모션 캘린더',
  '/seller/channel-sync':     '채널 연동',
  '/seller/inbound-request':  '입고 요청',
}

export default function SidebarLayout({ children }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const role = user?.role || 'ADMIN'
  const menus = MENUS_BY_ROLE[role] || []
  const logo = LOGO_BY_ROLE[role] || LOGO_BY_ROLE.ADMIN
  const roleLabel = ROLE_LABEL[role] || ''
  const currentTitle = PAGE_TITLES[location.pathname] || 'FullFit'

  const handleLogout = () => { logout(); navigate('/login') }
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-60 flex flex-col
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        `}
        style={{ background: '#0F172A', borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Logo */}
        <div className="px-5 shrink-0 flex items-center" style={{ height: '56px' }}>
          <div>
            <div className="text-xl font-bold text-white leading-none">FullFit</div>
            <div className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>{logo.subtitle}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {menus.map((group) => (
            <div key={group.section} className="mb-4">
              <p
                className="px-3 mb-1 text-[11px] font-semibold uppercase"
                style={{ color: '#475569', letterSpacing: '0.05em' }}
              >
                {group.section}
              </p>
              {group.items.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); closeSidebar() }}
                    className={`w-full flex items-center gap-2.5 h-9 text-sm transition-colors mb-0.5 text-left ${
                      isActive
                        ? 'rounded-r-lg border-l-[3px] border-[#3B82F6] bg-[#1E293B] text-white'
                        : 'rounded-lg border-l-[3px] border-transparent text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#CBD5E1]'
                    }`}
                    style={{ paddingLeft: '9px', paddingRight: '12px' }}
                  >
                    <span className="text-base leading-none w-5 text-center shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-1 min-w-0" style={{ background: '#1E293B' }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate leading-tight">
                {user?.full_name || user?.email}
              </p>
              <p className="text-xs truncate mt-0.5" style={{ color: '#64748B' }}>{roleLabel}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)]"
            style={{ color: '#94A3B8' }}
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* ── Right: navbar + content ── */}
      <div className="flex flex-col flex-1 lg:ml-60 min-w-0">
        {/* Fixed top navbar */}
        <header
          className="fixed top-0 left-0 right-0 lg:left-60 z-20 bg-white border-b border-[#E2E8F0] flex items-center px-4 justify-between"
          style={{ height: '56px' }}
        >
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors text-[#64748B]"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="메뉴"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="font-semibold" style={{ fontSize: '18px', color: '#0F172A' }}>{currentTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="hidden sm:inline text-sm" style={{ color: '#64748B' }}>{user?.email}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="mt-14 flex-1">
          {children}
        </main>
      </div>

      {/* Floating chat widget (admin + seller only) */}
      {(role === 'ADMIN' || role === 'SELLER') && <ChatWidget />}
    </div>
  )
}
