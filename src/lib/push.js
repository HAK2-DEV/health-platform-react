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

  // 웹 알림 권한(Notification.permission)은 크롬이 "사이트(origin)별"로 저장한다.
  //   설치된 WebAPK/PWA 도 이 사이트 권한을 물려받음. 프리뷰/프로드처럼 도메인이 다르면
  //   권한도 따로라, 다른 도메인에서 허용해도 이 도메인엔 안 먹힘 → 메시지에 현재 host 표시.
  const host = typeof window !== 'undefined' ? window.location.hostname : '이 사이트'
  const standalone = typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )

  // 이미 차단(denied)이면 requestPermission 이 프롬프트 없이 즉시 denied 반환 → 설정에서 풀어야 함.
  if (Notification.permission === 'denied') {
    throw new Error(
      standalone
        ? `알림이 차단돼 있어요.\n크롬 브라우저 앱 → ⋮ → 설정 → 사이트 설정 → 알림 →\n차단됨 목록의 '${host}'를 '허용'으로 바꾼 뒤\n도담을 다시 열어 「알림 켜기」를 눌러주세요.`
        : `알림이 차단돼 있어요.\n주소창 자물쇠(또는 크롬 설정 → 사이트 설정 → 알림) →\n'${host}' → 허용 으로 바꾼 뒤 다시 눌러주세요.`
    )
  }

  const perm = await Notification.requestPermission()
  if (perm === 'denied') {
    throw new Error('알림을 차단하셨어요. 설정에서 이 앱 알림을 허용으로 바꾼 뒤 다시 시도해주세요.')
  }
  if (perm !== 'granted') {
    // 'default' — 팝업을 안 띄웠거나(조용한 요청) 닫음. 도메인 불일치도 흔한 원인.
    throw new Error(
      `아직 '${host}' 알림이 켜지지 않았어요.\n「알림 켜기」를 다시 눌러 뜨는 팝업에서 「허용」을 선택해주세요.\n※ 설정에서 허용했는데도 계속 이러면, 지금 이 앱 주소('${host}')가 아닌 다른 주소를 허용한 것일 수 있어요.`
    )
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
