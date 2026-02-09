import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import { useChatStore } from './store/chatStore'
import { ChatLayout } from './ChatLayout'

function PrivateRoute({ children }) {
  const user = useChatStore((s) => s.user)
  if (!user) {
    // 简单路由守卫：未登录时重定向到登录页
    return <Navigate to="/login" replace />
  }
  return children
}

function LoginPage() {
  const setUser = useChatStore((s) => s.setUser)
  const navigate = useNavigate()

  const handleLogin = () => {
    setUser({ id: 'demo-user', name: 'Demo User' })
    navigate('/chat', { replace: true })
  }

  return (
    <div className="page login-page">
      <h1>YuanAI 智能对话助手</h1>
      <p>当前为 Demo 模式，点击下方按钮快速登录体验对话能力。</p>
      <button type="button" onClick={handleLogin}>
        一键登录（Demo）
      </button>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/chat/*"
        element={
          <PrivateRoute>
            <ChatLayout />
          </PrivateRoute>
        }
      />
    </Routes>
  )
}

export default App
