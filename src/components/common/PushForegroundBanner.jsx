import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isNativeApp } from '../../lib/installPrompt'
import { initNativePushListeners } from '../../lib/nativePush'

// 네이티브 앱 «사용 중»(포그라운드)에 도착한 푸시를 상단 배너로 표시 + 알림 탭 시 링크 이동.
//   안드로이드는 앱이 화면에 떠 있으면 시스템 배너를 띄우지 않고 앱에 이벤트만 넘긴다 → 앱이 직접 보여줘야 함.
//   이벤트 배선은 lib/nativePush.initNativePushListeners (CustomEvent 'dodam:push' / 'dodam:push-open').
export default function PushForegroundBanner() {
  const navigate = useNavigate()
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!isNativeApp()) return
    initNativePushListeners()
    let timer
    const onPush = (e) => {
      setMsg({ title: e.detail?.title || '도담', body: e.detail?.body || '', link: e.detail?.link || '' })
      clearTimeout(timer)
      timer = setTimeout(() => setMsg(null), 7000)
    }
    const onOpen = (e) => { if (e.detail?.link) navigate(e.detail.link) }
    window.addEventListener('dodam:push', onPush)
    window.addEventListener('dodam:push-open', onOpen)
    return () => { window.removeEventListener('dodam:push', onPush); window.removeEventListener('dodam:push-open', onOpen); clearTimeout(timer) }
  }, [navigate])

  if (!msg) return null
  return (
    <button
      type="button"
      onClick={() => { setMsg(null); if (msg.link) navigate(msg.link) }}
      className="fixed left-3 right-3 z-[1000] rounded-2xl bg-gray-900/95 text-white shadow-elevated px-4 py-3 text-left"
      style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
    >
      <p className="text-[13px] font-bold leading-snug break-keep">🔔 {msg.title}</p>
      {msg.body && <p className="text-[12px] text-gray-200 mt-0.5 leading-snug break-keep">{msg.body}</p>}
    </button>
  )
}
