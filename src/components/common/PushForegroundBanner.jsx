import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { isNativeApp } from '../../lib/installPrompt'
import { initNativePushListeners, ensureNativePushRegistered } from '../../lib/nativePush'

// 네이티브 앱 «사용 중»(포그라운드)에 도착한 푸시를 상단 배너로 표시 + 알림 탭 시 링크 이동.
//   안드로이드는 앱이 화면에 떠 있으면 시스템 배너를 띄우지 않고 앱에 이벤트만 넘긴다 → 앱이 직접 보여줘야 함.
//   이벤트 배선은 lib/nativePush.initNativePushListeners (CustomEvent 'dodam:push' / 'dodam:push-open').
export default function PushForegroundBanner() {
  const navigate = useNavigate()
  const [msg, setMsg] = useState(null)

  // ⚠️ navigate 를 effect 의존성에 넣지 않는다 — BrowserRouter 의 useNavigate 는 «라우트가 바뀔 때마다»
  //   새 함수 참조를 준다. 의존성에 넣으면 이동할 때마다 cleanup 이 돌아 자동닫힘 타이머가 사라지고
  //   배너가 화면에 영구히 남았다(2026-09-14 리뷰 확정). 최신 참조는 ref 로만 읽는다.
  const navRef = useRef(navigate)
  useEffect(() => { navRef.current = navigate })

  // 리스너 배선은 마운트 시 한 번만. 이후 재등록도 여기서 (토큰 회전·소유권 복구).
  useEffect(() => {
    if (!isNativeApp()) return
    initNativePushListeners().then(() => ensureNativePushRegistered())
    const onPush = (e) => setMsg({ title: e.detail?.title || '도담', body: e.detail?.body || '', link: e.detail?.link || '' })
    const onOpen = (e) => { if (e.detail?.link) navRef.current(e.detail.link) }
    window.addEventListener('dodam:push', onPush)
    window.addEventListener('dodam:push-open', onOpen)
    return () => {
      window.removeEventListener('dodam:push', onPush)
      window.removeEventListener('dodam:push-open', onOpen)
    }
  }, [])

  // 자동 닫힘 — msg 가 바뀔 때마다 새로 7초. 라우트 이동과 무관하게 동작한다.
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 7000)
    return () => clearTimeout(t)
  }, [msg])

  if (!msg) return null
  return (
    <div
      role="alert"
      className="fixed left-3 right-3 z-[1000] flex items-start gap-2 rounded-2xl bg-gray-900/95 text-white shadow-elevated pl-4 pr-2 py-3"
      style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
    >
      <button
        type="button"
        onClick={() => { setMsg(null); if (msg.link) navRef.current(msg.link) }}
        className="flex-1 min-w-0 text-left"
      >
        <p className="text-[13px] font-bold leading-snug break-keep">🔔 {msg.title}</p>
        {msg.body && <p className="text-[12px] text-gray-200 mt-0.5 leading-snug break-keep">{msg.body}</p>}
      </button>
      {/* 닫기 — 탭=이동밖에 없어 입력 중 실수로 화면이 바뀌던 문제 보완 */}
      <button
        type="button"
        onClick={() => setMsg(null)}
        aria-label="알림 닫기"
        className="flex-shrink-0 p-1.5 -mt-0.5 text-gray-300 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
