import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'
import { onNeedRefresh, applyUpdate } from '../../lib/pwaUpdate'

// 새 버전 알림 배너 — 새 SW 가 대기하면(onNeedRefresh) 하단에 노출.
//   「새로고침」 → applyUpdate() (새 SW 활성화 + reload). 「나중에」 → 닫기(다음 진입 때 다시).
//   bottom-24 — BottomTabBar 위로 띄움. 강제 갱신 X, 사용자가 좋은 시점에 적용.
function PwaUpdatePrompt() {
  const [show, setShow] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => onNeedRefresh(() => setShow(true)), [])

  const handleRefresh = () => {
    setApplying(true)
    applyUpdate()
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md"
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
  )
}

export default PwaUpdatePrompt
