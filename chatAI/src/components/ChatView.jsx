import { useCallback, useEffect, useRef, useState } from 'react'
import { useChatStore, useMessagesByChatId, useStreamingState } from '../store/chatStore'
import { ChatMessageList } from './ChatMessageList'
import { useChatStream } from '../sse/useChatStream'

export function ChatView({ chatId }) {
  const [input, setInput] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const listContainerRef = useRef(null)

  const messages = useMessagesByChatId(chatId)
  const appendMessage = useChatStore((s) => s.appendMessage)
  const { isStreaming, streamingChatId } = useStreamingState()
  const isStreamingForThisChat = isStreaming && streamingChatId === chatId

  const { startStream, stopStream } = useChatStream(chatId)

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || !chatId) return

    const now = Date.now()
    appendMessage(chatId, {
      id: `${now}-user`,
      role: 'user',
      content: trimmed,
      createdAt: now,
    })
    setInput('')

    await startStream(trimmed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, input]) // appendMessage 和 startStream 是稳定的，不需要依赖

  // 滚动锁定逻辑：用户手动上滚则关闭自动滚动
  useEffect(() => {
    const el = listContainerRef.current
    if (!el) return
    const handleScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
      setAutoScroll(nearBottom)
    }
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="chat-view">
      <div className="chat-view-main" ref={listContainerRef}>
        <ChatMessageList
          chatId={chatId}
          messages={messages}
          scrollContainerRef={listContainerRef}
          autoScroll={autoScroll}
          isStreamingForThisChat={isStreamingForThisChat}
        />
      </div>
      <div className="chat-view-footer">
        <textarea
          value={input}
          placeholder="输入你的问题，按 Enter 发送（Shift+Enter 换行）"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <div className="chat-view-footer-actions">
          <button type="button" onClick={handleSend} disabled={!input.trim() || isStreaming}>
            发送
          </button>
          <button type="button" onClick={stopStream} disabled={!isStreaming}>
            停止生成
          </button>
        </div>
      </div>
    </div>
  )
}

