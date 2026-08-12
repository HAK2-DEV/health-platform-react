import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, Wifi } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

// 오프라인 상태 배너 — 연결이 끊기면 하단에 상시 노출(브랜드 톤).
//   다시 연결되면 "다시 연결됐어요"를 잠깐 보여준 뒤 자동으로 사라짐.
//   React Query refetchOnReconnect(기본 true)로 재연결 시 데이터는 자동 갱신되므로
//   문구("연결되면 자동으로…")와 실제 동작이 일치한다.
//   ※ 오프라인이면 새 SW를 못 받아 PwaUpdatePrompt 와 동시 노출될 일이 없어 위치 충돌 없음.
// props (데모 전용):
//   forceState — 'offline' | 'reconnected' 로 강제 노출 (미리보기)
function OfflineBanner({ forceState = null }) {
  const online = useOnlineStatus()
  // 'hidden' | 'offline' | 'reconnected'
  const [phase, setPhase] = useState(forceState || 'hidden')
  const wasOffline = useRef(false)

  useEffect(() => {
    if (forceState) return                 // 데모: 실제 네트워크 상태 무시
    if (!online) {
      wasOffline.current = true
      setPhase('offline')
      return
    }
    // 온라인으로 전환된 순간에만 "다시 연결됐어요" 노출
    if (wasOffline.current) {
      wasOffline.current = false
      setPhase('reconnected')
      const t = setTimeout(() => setPhase('hidden'), 2200)
      return () => clearTimeout(t)
    }
    setPhase('hidden')
  }, [online, forceState])

  const isOffline = phase === 'offline'
  const show = phase !== 'hidden'

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 108px)' }}
          role="status"
          aria-live="polite"
        >
          <div
            className={`flex items-center gap-3 rounded-2xl shadow-xl px-4 py-3 backdrop-blur-sm text-white ${
              isOffline ? 'bg-gray-900/95' : 'bg-emerald-600/95'
            }`}
          >
            <span className="flex-shrink-0">
              {isOffline ? (
                <WifiOff className="w-5 h-5 text-amber-300" />
              ) : (
                <Wifi className="w-5 h-5 text-white" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              {isOffline ? (
                <>
                  <p className="text-sm font-semibold leading-tight">오프라인 상태예요</p>
                  <p className="text-[11px] text-gray-300 leading-tight mt-0.5">
                    연결되면 자동으로 최신 정보를 불러올게요
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold leading-tight">다시 연결됐어요</p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default OfflineBanner
