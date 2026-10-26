// 릴리스 AAB/APK 의 «머지된» 매니페스트 검증 — 권한이 의도 밖으로 늘거나 줄지 않았는지, 걸음 일꾼 선언이 있는지,
//   그리고 «지금 build.gradle 의 versionCode 로 빌드된 산출물»인지(옛 빌드가 ✅ 로 통과하지 않게) 본다.
//   배경: 2026-10-26 자체 만보기 — 신체활동(ACTIVITY_RECOGNITION) + health 타입 포그라운드 서비스 + 재부팅 리시버.
//   Health Connect(capacitor-health)는 보관(끔): includePlugins 에 없고, 실수로 돌아와도 매니페스트 tools:node="remove" 가
//   건강 권한 7종을 걷어낸다 — 그래도 여기서 health.* 권한 0개를 다시 확인한다.
//   사용: `npm run verify:manifest` (gradlew bundleRelease/assembleRelease 뒤에). 기대값과 다르면 exit 1.
//   달리기(B안) 등으로 권한이 늘면 EXPECTED/EXPECTED_MARKERS 를 갱신하고 Play 선언(Health apps·데이터 보안·FGS)을 재제출.
import fs from 'node:fs'
import path from 'node:path'

const CANDIDATES = [
  'android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml',
  'android/app/build/intermediates/merged_manifests/release/AndroidManifest.xml',
]
// 2026-10-26 자체 만보기: Health Connect(health.*) 권한은 0개, 대신 신체활동 + health 타입 포그라운드 서비스.
const ALLOWED_HEALTH = []
const EXPECTED = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.WAKE_LOCK',
  'android.permission.ACTIVITY_RECOGNITION',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_HEALTH',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'com.google.android.c2dm.permission.RECEIVE',
  'com.healthplatform.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
  ...ALLOWED_HEALTH,
]
// 걸음 일꾼 선언 — 서비스 타입이 health 가 아니면 안드14+ 에서 시작 자체가 거부된다.
const EXPECTED_MARKERS = [
  'com.healthplatform.app.steps.StepCounterService',
  'android:foregroundServiceType="health"',
  'com.healthplatform.app.steps.BootReceiver',
]

const file = CANDIDATES.map((p) => path.resolve(p)).find((p) => fs.existsSync(p))
if (!file) {
  console.error('❌ 머지 매니페스트를 찾지 못했습니다. 먼저 `cd android && ./gradlew assembleRelease` 를 실행하세요.')
  process.exit(2)
}
const xml = fs.readFileSync(file, 'utf8')
const perms = [...new Set([...xml.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)].map((m) => m[1]))]
const health = perms.filter((p) => p.includes('permission.health'))
const badHealth = health.filter((p) => !ALLOWED_HEALTH.includes(p))
const extra = perms.filter((p) => !EXPECTED.includes(p))
const missing = EXPECTED.filter((p) => !perms.includes(p))
const missingMarkers = EXPECTED_MARKERS.filter((m) => !xml.includes(m))

console.log(`머지 매니페스트: ${path.relative(process.cwd(), file)}`)
console.log(`uses-permission ${perms.length}개:`)
for (const p of perms) console.log(`  ${badHealth.includes(p) ? '🚫' : extra.includes(p) ? '⚠️' : '✅'} ${p}`)

let code = 0
if (badHealth.length) { console.error(`\n❌ 선언 밖 health 권한 ${badHealth.length}개: ${badHealth.join(', ')} — AndroidManifest tools:node="remove" 확인.`); code = 1 }
if (extra.length) { console.warn(`\n⚠️ 예상 밖 권한 ${extra.length}개: ${extra.join(', ')} — 의도한 변경이면 EXPECTED 갱신 + Play 데이터 안전·권한 선언 재검토.`); code = code || 1 }
if (missing.length) { console.error(`\n❌ 예상 권한 누락: ${missing.join(', ')} — capacitor.config.ts includePlugins / 매니페스트 확인.`); code = 1 }
if (missingMarkers.length) { console.error(`\n❌ 걸음 일꾼 선언 누락: ${missingMarkers.join(', ')} — AndroidManifest 의 <service .steps.StepCounterService foregroundServiceType="health"> 와 <receiver .steps.BootReceiver> 확인.`); code = 1 }
// 옛 산출물 방지 — 머지 매니페스트의 versionCode 가 build.gradle 의 현재 값과 같아야 한다
const gradleVc = Number((fs.readFileSync(path.resolve('android/app/build.gradle'), 'utf8').match(/versionCode\s+(\d+)/) || [])[1])
const builtVc = Number((xml.match(/android:versionCode="(\d+)"/) || [])[1])
if (!gradleVc || !builtVc || gradleVc !== builtVc) { console.error(`\n❌ versionCode 불일치: build.gradle=${gradleVc} / 머지 매니페스트=${builtVc} — 버전을 올린 뒤 다시 빌드했는지 확인.`); code = 1 }
else console.log(`versionCode ${builtVc} (build.gradle 과 일치)`)
if (code === 0) console.log(`\n✅ 권한 구성이 자체 만보기 기대값과 일치합니다 (health 권한 ${health.length}개, 걸음 일꾼 선언 있음).`)
process.exit(code)
