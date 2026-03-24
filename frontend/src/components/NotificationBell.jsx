import { useEffect, useRef, useState } from 'react'
import api from '../api/axiosInstance'

const TYPE_ICON = {
  ORDER_RECEIVED:    '📦',
  STOCK_LOW:         '⚠️',
  EXPIRY_ALERT:      '🕐',
  DELIVERY_UPDATE:   '🚚',
  SETTLEMENT_READY:  '💰',
  PROMOTION_ALERT:   '🎯',
  INBOUND_SCHEDULED: '📥',
  RETURN_PROCESSED:  '🔄',
  ORDER_DELAYED:     '⏰',
  ISSUE_CREATED:     '🚨',
  RESTOCK_REQUESTED: '🛒',
}

const TYPE_COLOR = {
  ORDER_RECEIVED:    'bg-[#DBEAFE] text-[#1D4ED8]',
  STOCK_LOW:         'bg-[#FEF3C7] text-[#92400E]',
  EXPIRY_ALERT:      'bg-[#FEE2E2] text-[#991B1B]',
  DELIVERY_UPDATE:   'bg-[#ECFEFF] text-[#0E7490]',
  SETTLEMENT_READY:  'bg-[#DCFCE7] text-[#166534]',
  PROMOTION_ALERT:   'bg-[#FDF4FF] text-[#7E22CE]',
  INBOUND_SCHEDULED: 'bg-[#EFF6FF] text-[#1D4ED8]',
  RETURN_PROCESSED:  'bg-[#F0FDF4] text-[#166534]',
  ORDER_DELAYED:     'bg-[#FEF2F2] text-[#991B1B]',
  ISSUE_CREATED:     'bg-[#FEF2F2] text-[#991B1B]',
  RESTOCK_REQUESTED: 'bg-[#FFF7ED] text-[#9A3412]',
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export default function NotificationBell() {
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const panelRef = useRef(null)

  const fetchCount = () => {
    api.get('/notifications/unread-count').then(r => setCount(r.data.count)).catch(() => {})
  }

  const fetchNotifications = () => {
    api.get('/notifications/').then(r => setNotifications(r.data)).catch(() => {})
  }

  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleOpen = () => {
    if (!open) fetchNotifications()
    setOpen(o => !o)
  }

  const markRead = (id) => {
    api.patch(`/notifications/${id}/read`).then(() => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setCount(prev => Math.max(0, prev - 1))
    }).catch(() => {})
  }

  const markAll = () => {
    api.patch('/notifications/read-all').then(() => {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setCount(0)
    }).catch(() => {})
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <>
      <button onClick={handleOpen}
        className="relative p-1.5 rounded-full hover:bg-[#F1F5F9] transition-colors">
        <span className="text-xl leading-none">🔔</span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#EF4444] text-white text-[10px] font-bold px-1">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ borderLeft: '1px solid #E2E8F0' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[15px]" style={{ color: '#0F172A' }}>알림</h3>
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-[#EF4444] text-white text-[11px] font-bold px-1.5">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button onClick={markAll} className="text-xs font-medium hover:underline" style={{ color: '#2563EB' }}>
                모두 읽음
              </button>
            )}
            <button onClick={() => setOpen(false)}
              className="text-xl leading-none" style={{ color: '#94A3B8' }}>×</button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: '#94A3B8' }}>
              <span className="text-3xl">🔕</span>
              <p className="text-sm">알림이 없습니다</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={`flex gap-3 px-5 py-4 cursor-pointer transition-colors hover:bg-[#F8FAFC] ${!n.is_read ? 'bg-[#EFF6FF]' : ''}`}
                style={{ borderBottom: '1px solid #F1F5F9' }}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${TYPE_COLOR[n.type] || 'bg-[#F1F5F9] text-[#64748B]'}`}>
                  {TYPE_ICON[n.type] || '🔔'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${n.is_read ? '' : ''}`} style={{ color: n.is_read ? '#64748B' : '#0F172A' }}>
                    {n.title}
                  </p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#64748B' }}>{n.message}</p>
                  <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#2563EB] mt-1.5 shrink-0" />}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
