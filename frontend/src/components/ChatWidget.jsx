import { useEffect, useRef, useState } from 'react'
import api from '../api/axiosInstance'
import useAuthStore from '../store/authStore'

const ROOM_TYPE_LABEL = { ORDER: '주문 관련', GENERAL: '일반 문의' }

function fmtTime(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export default function ChatWidget() {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [unread, setUnread] = useState(0)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newForm, setNewForm] = useState({ room_type: 'GENERAL', reference_id: '' })
  const [orders, setOrders] = useState([])
  const messagesEndRef = useRef(null)
  const pollRef = useRef(null)

  const fetchRooms = async () => {
    try {
      const [roomsRes, unreadRes] = await Promise.all([
        api.get('/chat/rooms'),
        api.get('/chat/unread-count'),
      ])
      setRooms(roomsRes.data)
      setUnread(unreadRes.data.count)
    } catch {}
  }

  const fetchMessages = async (roomId) => {
    try {
      const res = await api.get(`/chat/rooms/${roomId}/messages`)
      setMessages(res.data)
    } catch {}
  }

  const markRead = async (roomId) => {
    try { await api.patch(`/chat/rooms/${roomId}/read`) } catch {}
  }

  useEffect(() => {
    fetchRooms()
    pollRef.current = setInterval(fetchRooms, 10000)
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    if (activeRoom) {
      fetchMessages(activeRoom.id)
      markRead(activeRoom.id)
    }
  }, [activeRoom])

  useEffect(() => {
    if (activeRoom) {
      fetchMessages(activeRoom.id)
    }
  }, [rooms])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const openRoom = (room) => {
    setActiveRoom(room)
    markRead(room.id)
    setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, unread_count: 0 } : r))
  }

  const sendMessage = async () => {
    if (!input.trim() || !activeRoom) return
    try {
      await api.post(`/chat/rooms/${activeRoom.id}/messages`, { message: input.trim() })
      setInput('')
      await fetchMessages(activeRoom.id)
      await fetchRooms()
    } catch {}
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const fetchOrders = async () => {
    try {
      const res = await api.get('/orders/?limit=50')
      setOrders(res.data.items || [])
    } catch {}
  }

  const createRoom = async () => {
    try {
      await api.post('/chat/rooms', {
        room_type: newForm.room_type,
        reference_id: newForm.room_type === 'ORDER' ? newForm.reference_id || null : null,
      })
      setShowNewModal(false)
      setNewForm({ room_type: 'GENERAL', reference_id: '' })
      await fetchRooms()
    } catch {}
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        title="채팅"
      >
        <span className="text-2xl">💬</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#DC2626] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] h-[560px] bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#0F172A] text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {activeRoom && (
                <button
                  onClick={() => setActiveRoom(null)}
                  className="text-[#94A3B8] hover:text-white text-sm mr-1"
                >←</button>
              )}
              <span className="font-semibold text-sm">
                {activeRoom
                  ? activeRoom.room_type === 'ORDER'
                    ? `주문 ${activeRoom.reference_id || ''}`
                    : '일반 문의'
                  : '채팅'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!activeRoom && user?.role === 'SELLER' && (
                <button
                  onClick={() => { setShowNewModal(true); fetchOrders() }}
                  className="text-xs bg-[#1E293B] hover:bg-[#334155] px-2 py-1 rounded-[6px] transition-colors text-[#94A3B8] hover:text-white"
                >
                  새 문의
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-[#94A3B8] hover:text-white text-xl leading-none">×</button>
            </div>
          </div>

          {!activeRoom ? (
            /* Room list */
            <div className="flex-1 overflow-y-auto">
              {rooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-sm gap-2" style={{ color: '#94A3B8' }}>
                  <span className="text-3xl">💬</span>
                  <p>채팅방이 없습니다.</p>
                  {user?.role === 'SELLER' && (
                    <button
                      onClick={() => { setShowNewModal(true); fetchOrders() }}
                      className="mt-2 bg-[#2563EB] text-white px-4 py-1.5 rounded-[6px] text-sm hover:bg-[#1D4ED8] transition-colors"
                    >
                      새 문의 시작
                    </button>
                  )}
                </div>
              ) : (
                rooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => openRoom(room)}
                    className="w-full text-left px-4 py-3 border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          room.room_type === 'ORDER'
                            ? 'bg-[#DBEAFE] text-[#1D4ED8]'
                            : 'bg-[#F1F5F9] text-[#64748B]'
                        }`}>
                          {ROOM_TYPE_LABEL[room.room_type]}
                        </span>
                        {room.room_type === 'ORDER' && room.reference_id && (
                          <span className="text-xs font-mono" style={{ color: '#64748B' }}>{room.reference_id}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {room.unread_count > 0 && (
                          <span className="bg-[#DC2626] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                            {room.unread_count}
                          </span>
                        )}
                        <span className="text-[10px]" style={{ color: '#94A3B8' }}>{fmtDate(room.last_message_at)}</span>
                      </div>
                    </div>
                    <p className="text-xs truncate" style={{ color: '#64748B' }}>
                      {user?.role === 'ADMIN' && (
                        <span className="font-medium" style={{ color: '#374151' }}>{room.seller_name}: </span>
                      )}
                      {room.last_message || '메시지 없음'}
                    </p>
                  </button>
                ))
              )}
            </div>
          ) : (
            /* Message view */
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
                {messages.length === 0 && (
                  <p className="text-center text-xs mt-8" style={{ color: '#94A3B8' }}>메시지가 없습니다.</p>
                )}
                {messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] mb-0.5" style={{ color: '#94A3B8' }}>
                        {msg.sender_name} · {fmtTime(msg.created_at)}
                      </span>
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        isMine
                          ? 'bg-[#2563EB] text-white rounded-br-sm'
                          : 'bg-[#F1F5F9] rounded-bl-sm'
                      }`} style={isMine ? {} : { color: '#0F172A' }}>
                        {msg.message}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-3 border-t border-[#E2E8F0] flex gap-2 shrink-0">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지 입력..."
                  className="flex-1 px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-3 py-2 rounded-[6px] text-sm font-medium transition-colors disabled:opacity-40"
                >
                  전송
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* New room modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold mb-4" style={{ color: '#0F172A' }}>새 문의 시작</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>문의 유형</label>
                <select
                  value={newForm.room_type}
                  onChange={(e) => setNewForm((f) => ({ ...f, room_type: e.target.value, reference_id: '' }))}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                >
                  <option value="GENERAL">일반 문의</option>
                  <option value="ORDER">주문 관련</option>
                </select>
              </div>
              {newForm.room_type === 'ORDER' && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>주문 선택</label>
                  <select
                    value={newForm.reference_id}
                    onChange={(e) => setNewForm((f) => ({ ...f, reference_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                  >
                    <option value="">주문을 선택하세요</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.order_number}>
                        {o.order_number} — {o.receiver_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowNewModal(false)}
                className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-[6px] text-sm hover:bg-[#F8FAFC] transition-colors" style={{ color: '#374151' }}
              >취소</button>
              <button
                onClick={createRoom}
                className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-[6px] text-sm font-semibold transition-colors"
              >문의 시작</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
