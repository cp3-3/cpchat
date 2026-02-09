import { createContext, useContext, useMemo, useState } from 'react'

// 全局配置：主题、语言等（低频变化，用 Context 管理）

const ConfigContext = createContext(null)

export function ConfigProvider({ children }) {
  const [theme, setTheme] = useState('light') // 'light' | 'dark'
  const [locale, setLocale] = useState('zh-CN')

  const value = useMemo(
    () => ({
      theme,
      locale,
      setTheme,
      setLocale,
    }),
    [theme, locale],
  )

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}

export function useConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) {
    throw new Error('useConfig must be used within ConfigProvider')
  }
  return ctx
}

