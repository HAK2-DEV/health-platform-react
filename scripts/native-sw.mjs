// 네이티브 앱 자산의 sw.js 를 «자기 삭제» 서비스워커로 교체 — `npx cap sync` 직후에 실행.
//
// 배경 (2026-09-15 에뮬레이터 재현):
//   네이티브(Capacitor)도 웹 빌드의 PWA 서비스워커를 등록해 JS 번들을 캐시했다. Play 로 새 빌드를 받아도
//   첫 실행은 옛 서비스워커가 캐시의 «옛 JS» 를 내줘 수정(HEIC 표지 등)이 안 먹었다. 네이티브는 JS 가
//   앱 안에 번들돼 있어 서비스워커로 얻는 게 없다.
//
// 동작:
//   옛 JS 가 서비스워커 등록을 다시 호출하면 브라우저가 이 sw.js 를 새 버전으로 받아 설치한다.
//   → install 즉시 skipWaiting → activate 에서 등록 해제·캐시 삭제 → 열린 화면을 새로고침
//   → 새로고침된 화면은 서비스워커 없이 앱에 번들된 «새 JS» 로 뜬다.
//   새 JS 의 main.jsx 는 네이티브에서 등록 자체를 하지 않으므로 새로고침이 반복되지 않는다.
//
// 웹/PWA(Vercel 빌드)는 dist 를 쓰므로 영향 없음 — 이 스크립트는 네이티브 자산 폴더만 건드린다.
import fs from 'node:fs'
import path from 'node:path'

const SELF_DESTROYING_SW = `// 도담 네이티브 전용 — 자기 삭제 서비스워커 (scripts/native-sw.mjs 가 생성)
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await self.caches.keys()
      await Promise.all(keys.map((k) => self.caches.delete(k)))
    } catch (e) { /* 캐시 삭제 실패는 무시 — 등록 해제가 핵심 */ }
    await self.registration.unregister()
    const clients = await self.clients.matchAll({ type: 'window' })
    clients.forEach((client) => { try { client.navigate(client.url) } catch (e) { /* 무시 */ } })
  })())
})
`

const root = process.cwd()
const targets = [
  path.join(root, 'android', 'app', 'src', 'main', 'assets', 'public'),
  path.join(root, 'ios', 'App', 'App', 'public'),
]

let written = 0
for (const dir of targets) {
  if (!fs.existsSync(dir)) continue
  fs.writeFileSync(path.join(dir, 'sw.js'), SELF_DESTROYING_SW, 'utf8')
  console.log(`✅ 자기 삭제 sw.js 적용: ${path.relative(root, dir)}`)
  written++
}
if (written === 0) {
  console.error('❌ 네이티브 자산 폴더가 없어요 — `npx cap sync` 뒤에 실행해야 합니다.')
  process.exit(1)
}
