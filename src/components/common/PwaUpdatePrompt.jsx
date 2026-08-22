import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'
import { onNeedRefresh, applyUpdate } from '../../lib/pwaUpdate'
import { isNativePlatform } from '../../lib/health'
import UpdateSplash from './UpdateSplash'

// 새 버전 알림 배너 — 새 SW 가 대기하면(onNeedRefresh) 하단에 노출.
//   「새로고침」 → 브랜드 스플래시(UpdateSplash) 잠깐 → applyUpdate() (새 SW 활성화 + reload).
//   「나중에」 → 닫기(다음 진입 때 다시). 강제 갱신 X, 사용자가 좋은 시점에 적용.
// props (데모 전용):
//   demo      — true 면 onNeedRefresh 구독 대신 forceShow 로만 노출, 「새로고침」이 reload 안 하고 스플래시만 재생
//   forceShow — 마운트 즉시 배너 노출 (데모/미리보기)
function PwaUpdatePrompt({ demo = false, forceShow = false }) {
  const [show, setShow] = useState(forceShow)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (demo) return          // 데모는 SW 이벤트 구독 안 함
    if (isNativePlatform()) return   // 네이티브(Capacitor)는 APK/스토어로 업데이트 → SW 「새 버전」 배너 불필요
    return onNeedRefresh(() => setShow(true))
  }, [demo])

  const handleRefresh = () => {
    setShow(false)            // 배너 감추고 스플래시로 전환
    setApplying(true)
    if (demo) {
      // 데모: 실제 reload 없이 클립을 끝까지 보여주고 종료 (클립 3초)
      setTimeout(() => setApplying(false), 3000)
      return
    }
    // 3D 새싹 스플래시를 보여준 뒤 새 SW 활성화 + reload
    setTimeout(() => applyUpdate(), 2400)
  }

  return (
    <>
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 108px)' }}
        >
          <div className="flex items-center gap-3 bg-gray-900/95 text-white rounded-2xl shadow-xl px-4 py-3 backdrop-blur-sm">
            <span className="text-xl flex-shrink-0">✨</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">새 버전이 있어요</p>
              <p className="text-[11px] text-gray-300 leading-tight mt-0.5">새로고침하면 최신 기능으로 업데이트돼요</p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={applying}
              className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-full transition disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${applying ? 'animate-spin' : ''}`} />
              {applying ? '업데이트 중...' : '새로고침'}
            </button>
            <button
              type="button"
              onClick={() => setShow(false)}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-white transition"
              title="나중에"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    {applying && <UpdateSplash />}
    </>
  )
}

export default PwaUpdatePrompt
