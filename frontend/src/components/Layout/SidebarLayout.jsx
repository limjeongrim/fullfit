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
      { icon: '🔗', label: '채널 연동',      path: '/admin/channel-sync' },
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
    ],
  },
  {
    section: '운영',
    items: [
      { icon: '↩️', label: '반품 신청',      path: '/seller/returns' },
      { icon: '🧾', label: '정산 내역',      path: '/seller/settlements' },
      { icon: '📅', label: '프로모션 캘린더', path: '/seller/promotions' },
    ],
  },
]

const MENUS_BY_ROLE = { ADMIN: ADMIN_MENUS, WORKER: WORKER_MENUS, SELLER: SELLER_MENUS }

const LOGO_BY_ROLE = {
  ADMIN:  { title: 'FullFit', subtitle: '풀필먼트 운영' },
  WORKER: { title: 'FullFit', subtitle: '창고 운영' },
  SELLER: { title: 'FullFit', subtitle: '셀러 포털' },
}

const ROLE_BADGE = {
  ADMIN:  { label: '관리자', cls: 'bg-blue-100 text-blue-700' },
  WORKER: { label: '작업자', cls: 'bg-green-100 text-green-700' },
  SELLER: { label: '셀러',   cls: 'bg-purple-100 text-purple-700' },
}

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
  '/seller/returns':     '반품 신청',
  '/seller/settlements': '정산 내역',
  '/seller/promotions':  '프로모션 캘린더',
}

export default function SidebarLayout({ children }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const role = user?.role || 'ADMIN'
  const menus = MENUS_BY_ROLE[role] || []
  const logo = LOGO_BY_ROLE[role] || LOGO_BY_ROLE.ADMIN
  const badge = ROLE_BADGE[role] || ROLE_BADGE.ADMIN
  const currentTitle = PAGE_TITLES[location.pathname] || 'FullFit'

  const handleLogout = () => { logout(); navigate('/login') }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-gray-200
        flex flex-col transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100 shrink-0">
          <div className="text-xl font-bold text-gray-900">{logo.title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{logo.subtitle}</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {menus.map((group) => (
            <div key={group.section} className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-3 mb-1">
                {group.section}
              </p>
              {group.items.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); closeSidebar() }}
                    className={`w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm transition-colors mb-0.5 text-left ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-base leading-none w-5 text-center">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-4 border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-2 px-2 mb-2 min-w-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {user?.full_name || user?.email}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* ── Right: navbar + content ── */}
      <div className="flex flex-col flex-1 lg:ml-60 min-w-0">
        {/* Fixed top navbar */}
        <header className="fixed top-0 left-0 right-0 lg:left-60 h-14 z-20 bg-white border-b border-gray-200 flex items-center px-4 justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="메뉴"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-base font-semibold text-gray-800">{currentTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="hidden sm:inline text-sm text-gray-500">{user?.email}</span>
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
