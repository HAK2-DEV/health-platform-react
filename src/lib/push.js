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
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('알림 권한을 허용해야 폰 푸시를 받을 수 있어요')

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
