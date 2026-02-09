import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 稳定的空数组引用
const EMPTY_MESSAGES = []

// 会话与消息的基础数据结构
// session: { id, title, createdAt, updatedAt }
// message: { id, role: 'user' | 'assistant' | 'system', content, createdAt }

const createEmptySession = () => {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const now = Date.now()
  return {
    id,
    title: '新对话',
    createdAt: now,
    updatedAt: now,
  }
}

export const useChatStore = create()(
  persist(
    (set, get) => ({
      user: null, // 简单用户状态，可扩展为完整登录流程

      sessions: [],
      messagesBySession: {}, // { [sessionId]: Message[] }
      activeChatId: null,

      // SSE 请求相关状态
      streamingChatId: null,
      isStreaming: false,

      // 用户登录登出（用于路由守卫）
      setUser(user) {
        set({ user })
      },
      logout() {
        set({ user: null })
      },

      // 会话操作
      ensureSession(chatId) {
        const { sessions } = get()
        const exists = sessions.find((s) => s.id === chatId)
        if (exists) return exists
        // 使用传入的 chatId 创建 session
        const now = Date.now()
        const session = {
          id: chatId,
          title: '新对话',
          createdAt: now,
          updatedAt: now,
        }
        set({
          sessions: [session, ...sessions],
          activeChatId: chatId,
        })
        return session
      },

      createSession() {
        const { sessions } = get()
        const session = createEmptySession()
        set({
          sessions: [session, ...sessions],
          activeChatId: session.id,
        })
        return session.id
      },

      deleteSession(chatId) {
        const { sessions, messagesBySession, activeChatId } = get()
        const nextSessions = sessions.filter((s) => s.id !== chatId)
        const { [chatId]: _removed, ...restMessages } = messagesBySession
        let nextActive = activeChatId
        if (activeChatId === chatId) {
          nextActive = nextSessions[0]?.id ?? null
        }
        set({
          sessions: nextSessions,
          messagesBySession: restMessages,
          activeChatId: nextActive,
        })
        return nextActive
      },

      setActiveChatId(chatId) {
        set({ activeChatId: chatId })
      },

      // 消息操作
      appendMessage(chatId, message) {
        const { messagesBySession } = get()
        const list = messagesBySession[chatId] ?? []
        set({
          messagesBySession: {
            ...messagesBySession,
            [chatId]: [...list, message],
          },
        })
      },

      updateLastAssistantMessage(chatId, updater) {
        const { messagesBySession } = get()
        const list = messagesBySession[chatId] ?? []
        if (!list.length) return
        const lastIndex = list.length - 1
        const last = list[lastIndex]
        if (last.role !== 'assistant') return
        const nextLast = typeof updater === 'function' ? updater(last) : { ...last, ...updater }
        const nextList = [...list]
        nextList[lastIndex] = nextLast
        set({
          messagesBySession: {
            ...messagesBySession,
            [chatId]: nextList,
          },
        })
      },

      setStreamingState(partial) {
        set(partial)
      },
    }),
    {
      name: 'yuan-ai-chat-store',
      partialize: (state) => ({
        sessions: state.sessions,
        messagesBySession: state.messagesBySession,
        // user 一般不持久化（视业务而定），此处只持久化会话数据
      }),
    },
  ),
)

// 常用 selector，避免组件订阅整个 store
export const useSessions = () =>
  useChatStore((s) => s.sessions)

// 使用稳定的空数组引用避免无限循环
export const useMessagesByChatId = (chatId) => {
  return useChatStore((s) => s.messagesBySession[chatId] ?? EMPTY_MESSAGES)
}

// 使用 shallow 比较避免不必要的重渲染
export const useStreamingState = () => {
  const streamingChatId = useChatStore((s) => s.streamingChatId)
  const isStreaming = useChatStore((s) => s.isStreaming)
  return { streamingChatId, isStreaming }
}

