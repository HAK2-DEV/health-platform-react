// 릴리스 AAB/APK 의 «머지된» 매니페스트 권한 검증 — health 권한 재유입 방지.
//   배경: capacitor-health 가 package.json 에 남아 있어 capacitor.config.ts 의 includePlugins 를 건드리면
//   Health Connect 권한 7종이 조용히 되살아난다. 그러면 Play 에서 건강 데이터 권한 선언·근거 심사가 붙는다.
//   사용: `npm run verify:manifest` (gradlew bundleRelease/assembleRelease 뒤에). health 권한이 있으면 exit 1.
import fs from 'node:fs'
import path from 'node:path'

const CANDIDATES = [
  'android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml',
  'android/app/build/intermediates/merged_manifests/release/AndroidManifest.xml',
]
const EXPECTED = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.WAKE_LOCK',
  'com.google.android.c2dm.permission.RECEIVE',
  'com.healthplatform.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
]

const file = CANDIDATES.map((p) => path.resolve(p)).find((p) => fs.existsSync(p))
if (!file) {
  console.error('❌ 머지 매니페스트를 찾지 못했습니다. 먼저 `cd android && ./gradlew assembleRelease` 를 실행하세요.')
  process.exit(2)
}
const xml = fs.readFileSync(file, 'utf8')
const perms = [...xml.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)].map((m) => m[1])
const health = perms.filter((p) => p.includes('permission.health'))
const extra = perms.filter((p) => !EXPECTED.includes(p))
const missing = EXPECTED.filter((p) => !perms.includes(p))

console.log(`머지 매니페스트: ${path.relative(process.cwd(), file)}`)
console.log(`uses-permission ${perms.length}개:`)
for (const p of perms) console.log(`  ${health.includes(p) ? '🚫' : extra.includes(p) ? '⚠️' : '✅'} ${p}`)

let code = 0
if (health.length) { console.error(`\n❌ health 권한 ${health.length}개가 되살아났습니다 — capacitor.config.ts includePlugins / AndroidManifest tools:node="remove" 확인.`); code = 1 }
if (extra.length) { console.warn(`\n⚠️ 예상 밖 권한 ${extra.length}개: ${extra.join(', ')} — 의도한 변경이면 EXPECTED 갱신 + Play 데이터 안전·권한 선언 재검토.`); code = code || 1 }
if (missing.length) console.warn(`\n⚠️ 예상 권한 누락: ${missing.join(', ')}`)
if (code === 0) console.log('\n✅ 권한 구성이 v1.0 기대값과 일치합니다 (health 0개).')
process.exit(code)
