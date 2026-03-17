import { useEffect, useRef, useState } from 'react'
import api from '../api/axiosInstance'

const TYPE_ICON = {
  ORDER_RECEIVED:   '📦',
  STOCK_LOW:        '⚠️',
  EXPIRY_ALERT:     '🕐',
  DELIVERY_UPDATE:  '🚚',
  SETTLEMENT_READY: '💰',
  PROMOTION_ALERT:  '🎯',
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
  const ref = useRef(null)

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
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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

  return (
    <div ref={ref} className="relative">
      <button onClick={handleOpen}
        className="relative p-1.5 rounded-full hover:bg-white/20 transition-colors">
        <span className="text-xl leading-none">🔔</span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">알림</h3>
            {count > 0 && (
              <button onClick={markAll} className="text-xs text-blue-600 hover:underline">
                모두 읽음
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">알림이 없습니다.</p>
            ) : (
              notifications.map(n => (
                <div key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`flex gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${n.is_read ? '' : 'bg-blue-50'}`}>
                  <span className="text-lg mt-0.5 shrink-0">{TYPE_ICON[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${n.is_read ? 'text-gray-500' : 'text-gray-900'}`}>{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
