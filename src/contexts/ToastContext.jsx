import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// 토스트 시스템 — 어디서든 useToast().show(msg, opts) 호출 가능 (Day 65).
// 사용 사례:
//   - 마일스톤 도달 「🔥 7일 연속 달성!」
//   - 인증 성공 보조 메시지 「💧 +물 / ☀️ +햇빛」
//   - 일반 알림 「저장 완료」 등

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Provider 미장착이면 noop — 호출 측 안전.
    return { show: () => {}, dismiss: () => {} }
  }
  return ctx
}

// 토스트 변형
const VARIANTS = {
  success: { bg: 'bg-emerald-600', icon: '✓' },
  achievement: { bg: 'bg-gradient-to-r from-amber-500 to-orange-500', icon: '🏆' },
  info: { bg: 'bg-sky-600', icon: 'ℹ️' },
  warning: { bg: 'bg-amber-600', icon: '⚠️' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // show(message, { variant, duration, icon })
  //   variant: 'success' | 'achievement' | 'info' | 'warning'
  //   duration: ms (default 3000). 'achievement' 는 4500.
  //   icon: 변형 기본 아이콘 override
  const show = useCallback((message, options = {}) => {
    const id = ++idRef.current
    const variant = options.variant || 'success'
    const duration = options.duration ?? (variant === 'achievement' ? 4500 : 3000)
    const icon = options.icon ?? VARIANTS[variant]?.icon
    setToasts(prev => [...prev, { id, message, variant, icon }])
    setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      {/* 토스트 컨테이너 — 화면 상단 중앙 (BottomTabBar 회피). 모바일·데스크탑 공통 */}
      <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => {
            const v = VARIANTS[t.variant] || VARIANTS.success
            return (
              <motion.div
                key={t.id}
                initial={{ y: -20, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -20, opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                onClick={() => dismiss(t.id)}
                className={`pointer-events-auto cursor-pointer ${v.bg} text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium max-w-md`}
                role="status"
              >
                {t.icon && <span className="text-base">{t.icon}</span>}
                <span>{t.message}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
