import { useCallback } from 'react'
import { useChatStore, useSessions } from '../store/chatStore'

export function ChatSidebar({ activeChatId, onSelectSession }) {
  const sessions = useSessions()
  const createSession = useChatStore((s) => s.createSession)
  const deleteSession = useChatStore((s) => s.deleteSession)

  const handleCreate = useCallback(() => {
    const id = createSession()
    onSelectSession(id)
  }, [createSession, onSelectSession])

  const handleDelete = useCallback(
    (id) => {
      const nextActive = deleteSession(id)
      if (nextActive) {
        onSelectSession(nextActive)
      }
    },
    [deleteSession, onSelectSession],
  )

  return (
    <aside className="chat-sidebar">
      <div className="chat-sidebar-header">
        <h2>会话</h2>
        <button type="button" onClick={handleCreate}>
          新建
        </button>
      </div>
      <div className="chat-sidebar-list">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            className={s.id === activeChatId ? 'sidebar-item active' : 'sidebar-item'}
            onClick={() => onSelectSession(s.id)}
          >
            <span className="sidebar-item-title">{s.title}</span>
          </button>
        ))}
        {sessions.length === 0 && <div className="sidebar-empty">暂无会话，点击“新建”开始对话</div>}
      </div>
    </aside>
  )
}

