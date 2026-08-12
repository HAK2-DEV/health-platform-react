/* push-sw.js — workbox generateSW 에 importScripts 로 병합되는 Web Push 핸들러.
   서버(Edge Function send-push)가 보낸 payload({title,body,link,tag})로 시스템 알림 표시. */

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} }
  catch { data = { title: '도담', body: event.data ? event.data.text() : '' } }

  const title = data.title || '도담'
  const options = {
    body: data.body || '',
    // 큰 아이콘: 풀블리드 초록(모서리 회색 제거). 배지: 흰 실루엣(투명) — 안드로이드 상태바/앱명 옆.
    icon: '/notification-icon.png',
    badge: '/notification-badge.png',
    data: { link: data.link || '/' },
    tag: data.tag || undefined,       // 같은 tag 는 알림 합쳐짐(스팸 방지)
    renotify: !!data.tag,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of all) {
      // 이미 열린 앱 창이 있으면 그쪽으로 포커스 + 이동
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) { try { await client.navigate(link) } catch { /* cross-origin 등 무시 */ } }
        return
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(link)
  })())
})
