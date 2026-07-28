import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabaseClient'

// 전역 프로필 사진 뷰어 — 어디서든 useAvatarViewer().open({ avatarPath, nickname }) 로 크게 보기.
//   UserAvatar 의 viewable 옵션이 이 컨텍스트를 호출한다. 모달은 앱 루트에 1개만(포털처럼 최상위).
//   avatarPath(=profile-avatars 버킷) 대신 url 을 직접 넘길 수도 있다(예: 강사 사진은 program-covers 버킷).
const AvatarViewerContext = createContext(null)

export function useAvatarViewer() {
  const ctx = useContext(AvatarViewerContext)
  return ctx || { open: () => {} }   // Provider 미장착 시 noop (호출 측 안전)
}

export function AvatarViewerProvider({ children }) {
  const [view, setView] = useState(null)   // { avatarPath, nickname } | null
  const open = useCallback((v) => { if (v) setView(v) }, [])
  const close = useCallback(() => setView(null), [])

  // ESC 로 닫기
  useEffect(() => {
    if (!view) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, close])

  const url = view?.url
    || (view?.avatarPath
      ? supabase.storage.from('profile-avatars').getPublicUrl(view.avatarPath).data?.publicUrl
      : null)
  const initial = (view?.nickname || '?').trim().charAt(0).toUpperCase() || '?'

  return (
    <AvatarViewerContext.Provider value={{ open }}>
      {children}
      <AnimatePresence>
        {view && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={close}
          >
            <motion.div
              className="flex flex-col items-center gap-4"
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-64 h-64 max-w-[80vw] max-h-[80vw] rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-2xl ring-4 ring-white/20">
                {url
                  ? <img src={url} alt={view.nickname || ''} className="w-full h-full object-cover" />
                  : <span className="text-white font-bold text-7xl select-none">{initial}</span>}
              </div>
              {view.nickname && <p className="text-white font-bold text-lg drop-shadow">{view.nickname}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AvatarViewerContext.Provider>
  )
}
