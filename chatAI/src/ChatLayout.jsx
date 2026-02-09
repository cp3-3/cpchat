import { Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { useChatStore, useSessions } from './store/chatStore'
import { ChatSidebar } from './components/ChatSidebar'
import { ChatView } from './components/ChatView'

export function ChatLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  // 从路径中提取 chatId: /chat/xxx -> xxx
  const chatId = useMemo(() => {
    const match = location.pathname.match(/^\/chat\/([^/]+)/)
    return match ? match[1] : null
  }, [location.pathname])
  
  const sessions = useSessions()
  const ensureSession = useChatStore((s) => s.ensureSession)
  const setActiveChatId = useChatStore((s) => s.setActiveChatId)
  const createSession = useChatStore((s) => s.createSession)

  // URL 作为单一事实来源：监听 chatId 变化，同步到 Zustand
  useEffect(() => {
    if (!chatId) return
    ensureSession(chatId)
    setActiveChatId(chatId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]) // 只依赖 chatId，函数引用是稳定的

  // 初始进入 /chat 时，自动创建或跳转到第一个会话
  if (!chatId) {
    const first = sessions[0]
    const id = first?.id ?? createSession()
    return <Navigate to={`/chat/${id}`} replace />
  }

  return (
    <div className="chat-layout">
      <ChatSidebar
        activeChatId={chatId}
        onSelectSession={(id) => navigate(`/chat/${id}`)}
      />
      <div className="chat-view-container">
        <ChatView chatId={chatId} />
      </div>
    </div>
  )
}

