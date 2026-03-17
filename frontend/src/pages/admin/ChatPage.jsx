import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import api from '../../api/axiosInstance'

const ROOM_TYPE_LABEL = { ORDER: '주문 관련', GENERAL: '일반 문의' }

function fmtTime(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminChatPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')
  const messagesEndRef = useRef(null)
  const pollRef = useRef(null)

  const fetchRooms = async () => {
    try {
      const res = await api.get('/chat/rooms')
      setRooms(res.data)
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
    if (activeRoom) fetchMessages(activeRoom.id)
  }, [rooms])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const openRoom = (room) => {
    setActiveRoom(room)
    setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, unread_count: 0 } : r))
    markRead(room.id)
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  const filteredRooms = rooms.filter((r) => {
    if (filterType && r.room_type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !r.seller_name.toLowerCase().includes(q) &&
        !(r.reference_id || '').toLowerCase().includes(q) &&
        !(r.last_message || '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const totalUnread = rooms.reduce((s, r) => s + r.unread_count, 0)

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center shadow shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/dashboard')} className="text-blue-200 hover:text-white text-sm">← 대시보드</button>
          <span className="text-xl font-bold">채팅 관리</span>
          {totalUnread > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{totalUnread}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-blue-100">{user?.email}</span>
          <button onClick={handleLogout} className="bg-blue-900 hover:bg-blue-800 text-white text-sm px-4 py-1.5 rounded-lg">로그아웃</button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full px-6 py-6 gap-4">
        {/* Left panel — room list */}
        <div className="w-80 shrink-0 bg-white rounded-xl shadow-sm border border-blue-100 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <input
              type="text" placeholder="셀러명, 주문번호 검색" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex gap-1">
              {['', 'ORDER', 'GENERAL'].map((t) => (
                <button key={t}
                  onClick={() => setFilterType(t)}
                  className={`flex-1 text-xs py-1 rounded-lg font-medium transition-colors ${
                    filterType === t ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t === '' ? '전체' : ROOM_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredRooms.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-10">채팅방 없음</div>
            ) : (
              filteredRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => openRoom(room)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors flex flex-col gap-0.5 ${
                    activeRoom?.id === room.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        room.room_type === 'ORDER' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {ROOM_TYPE_LABEL[room.room_type]}
                      </span>
                      <span className="text-xs font-semibold text-gray-800">{room.seller_name}</span>
                    </div>
                    {room.unread_count > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                        {room.unread_count}
                      </span>
                    )}
                  </div>
                  {room.reference_id && (
                    <span className="text-[10px] text-blue-500 font-mono">{room.reference_id}</span>
                  )}
                  <p className="text-xs text-gray-500 truncate">{room.last_message || '메시지 없음'}</p>
                  <p className="text-[10px] text-gray-400">{fmtDate(room.last_message_at)}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel — message view */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-blue-100 flex flex-col overflow-hidden">
          {!activeRoom ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-2">
              <span className="text-5xl">💬</span>
              <p className="text-sm">채팅방을 선택하세요</p>
            </div>
          ) : (
            <>
              {/* Room header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      activeRoom.room_type === 'ORDER' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {ROOM_TYPE_LABEL[activeRoom.room_type]}
                    </span>
                    <span className="font-semibold text-gray-800">{activeRoom.seller_name}</span>
                  </div>
                  {activeRoom.reference_id && (
                    <p className="text-xs text-gray-500 font-mono mt-0.5">주문번호: {activeRoom.reference_id}</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                {messages.length === 0 && (
                  <p className="text-center text-gray-400 text-sm mt-10">메시지가 없습니다.</p>
                )}
                {messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      <span className="text-xs text-gray-400 mb-1">
                        {msg.sender_name} ({msg.sender_role === 'ADMIN' ? '관리자' : '셀러'}) · {fmtTime(msg.created_at)}
                      </span>
                      <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-4 border-t border-gray-100 flex gap-2 shrink-0">
                <input
                  type="text" value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="답장 입력 (Enter로 전송)..."
                  className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  답장
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
