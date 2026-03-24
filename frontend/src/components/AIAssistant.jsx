import { useEffect, useRef, useState } from 'react'
import api from '../api/axiosInstance'

const QUICK_PROMPTS = [
  { icon: '📦', label: '오늘 출고 현황', message: '현재 출고 현황을 요약해주세요. 패킹 완료 주문, 출고 준비 중 주문을 알려주세요.' },
  { icon: '⚠️', label: '긴급 처리 항목', message: '지금 당장 처리해야 할 긴급 항목이 있나요? 재고 부족, 미해결 이슈를 중심으로 알려주세요.' },
  { icon: '📊', label: '브랜드별 재고', message: '재고 부족 상품 현황을 브랜드별로 분석하고 위험도를 알려주세요.' },
  { icon: '🔮', label: '입고 추천', message: '현재 재고 부족 상품을 기준으로 우선 입고가 필요한 상품을 추천해주세요.' },
]

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[80%]" style={{ background: '#F1F5F9' }}>
      <span className="text-xs" style={{ color: '#64748B' }}>AI가 분석 중</span>
      <span className="flex gap-1">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#94A3B8] animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
    </div>
  )
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕하세요! FullFit 운영 현황에 대해 무엇이든 물어보세요. 재고, 주문, 이슈 등 실시간 데이터를 기반으로 답변드립니다.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const sendMessage = async (message) => {
    if (!message.trim() || loading) return
    const text = message.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    try {
      const contextRes = await api.get('/ai/context')
      const res = await api.post('/ai/chat', {
        message: text,
        context: JSON.stringify(contextRes.data, null, 2),
      })
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Ollama 서버에 연결할 수 없습니다. `ollama run llama3.2` 명령어로 서버를 시작해주세요.',
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-5 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-semibold text-white transition-transform hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #7C3AED, #2563EB)' }}
      >
        <span className="text-base leading-none">✨</span>
        AI 어시스턴트
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed bottom-5 right-5 z-50 flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
          style={{ width: '400px', height: '580px', border: '1px solid #E2E8F0' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 shrink-0 flex items-start justify-between"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #2563EB)' }}>
            <div>
              <h3 className="font-bold text-white text-[15px] leading-tight">FullFit AI 어시스턴트 🤖</h3>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>Powered by Ollama llama3.2</p>
            </div>
            <button onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white text-xl leading-none ml-3 mt-0.5">×</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: '#F8FAFC' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mr-2 mt-0.5"
                    style={{ background: 'linear-gradient(135deg, #7C3AED, #2563EB)' }}>
                    🤖
                  </div>
                )}
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[78%] whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'rounded-tr-sm text-white'
                      : 'rounded-tl-sm'
                  }`}
                  style={msg.role === 'user'
                    ? { background: '#2563EB', color: 'white' }
                    : { background: 'white', color: '#1E293B', border: '1px solid #E2E8F0' }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mr-2 mt-0.5"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #2563EB)' }}>
                  🤖
                </div>
                <TypingIndicator />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          <div className="px-3 py-2 shrink-0 flex gap-1.5 overflow-x-auto" style={{ borderTop: '1px solid #F1F5F9', background: 'white' }}>
            {QUICK_PROMPTS.map(q => (
              <button key={q.label} onClick={() => sendMessage(q.message)} disabled={loading}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-[#E2E8F0] hover:border-[#7C3AED] hover:bg-[#F5F3FF] transition-colors disabled:opacity-50"
                style={{ color: '#374151' }}>
                <span>{q.icon}</span>
                <span>{q.label}</span>
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-3 py-3 shrink-0 flex gap-2 items-end" style={{ borderTop: '1px solid #E2E8F0', background: 'white' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="운영 현황에 대해 질문하세요... (Enter 전송)"
              rows={1}
              disabled={loading}
              className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:border-[#7C3AED] disabled:opacity-50"
              style={{ '--tw-ring-color': '#7C3AED40', maxHeight: '80px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #2563EB)', minWidth: '52px' }}
            >
              전송
            </button>
          </div>
        </div>
      )}
    </>
  )
}
