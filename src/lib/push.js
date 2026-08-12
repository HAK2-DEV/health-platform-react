import { supabase } from '../supabaseClient'

// Web Push 구독 — 권한 요청 → PushManager.subscribe(VAPID) → push_subscriptions 저장.
//   dev 에선 SW 비활성(devOptions.enabled:false)이라 동작 안 함 → 배포본에서만.
const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'nokey'
export async function getPushState() {
  if (!pushSupported()) return 'unsupported'
  if (!VAPID_PUBLIC) return 'nokey'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  return sub ? 'subscribed' : 'unsubscribed'
}

export async function subscribeToPush() {
  if (!pushSupported()) throw new Error('이 브라우저는 푸시 알림을 지원하지 않아요')
  if (!VAPID_PUBLIC) throw new Error('푸시 설정(VAPID 키)이 아직 준비되지 않았어요')

  // 이미 차단(denied)된 상태면 requestPermission 이 프롬프트 없이 즉시 denied 를 반환 →
  //   설정에서 직접 허용해야 하므로 구체적으로 안내. 실행 형태별로 경로가 다름:
  //   설치된 PWA(standalone)엔 주소창/자물쇠가 없으므로 안드로이드 앱 설정으로 안내.
  if (Notification.permission === 'denied') {
    const standalone = typeof window !== 'undefined' && (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    )
    throw new Error(
      standalone
        ? '알림이 차단돼 있어요.\n설정 → 앱 → 도담 → 알림 → 허용으로 바꾼 뒤\n다시 「알림 켜기」를 눌러주세요.\n(또는 홈 화면 앱 아이콘을 길게 눌러 → 앱 정보 → 알림)'
        : '알림이 차단돼 있어요.\n① 주소창 왼쪽 자물쇠(또는 ⋮ → 사이트 설정) → 알림 → 허용\n② 안드로이드: 설정 → 앱 → 크롬 → 알림 켜기\n바꾼 뒤 다시 「알림 켜기」를 눌러주세요.'
    )
  }

  const perm = await Notification.requestPermission()
  if (perm === 'denied') {
    throw new Error('알림을 차단하셨어요. 브라우저·휴대폰 설정에서 이 앱 알림을 허용으로 바꾼 뒤 다시 시도해주세요.')
  }
  if (perm !== 'granted') {
    // 'default' — 허용/차단 없이 프롬프트를 닫음
    throw new Error('알림 허용 창을 닫으셨어요. 「알림 켜기」를 다시 눌러 「허용」을 선택해주세요.')
  }

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    })
  }
  const json = sub.toJSON()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요해요')
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: navigator.userAgent.slice(0, 300),
  }, { onConflict: 'endpoint' })
  if (error) throw error
  return true
}

export async function unsubscribeFromPush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    try { await sub.unsubscribe() } catch { /* 무시 */ }
  }
  return true
}
