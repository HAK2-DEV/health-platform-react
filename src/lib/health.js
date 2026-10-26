// ⚠️ (보관, 2026-10-26) Health Connect 읽기 경로 — 본인 결정으로 끔. 지금 걸음은 lib/stepCounter.js(앱 걸음 일꾼)가 센다.
//   아무 데서도 import 하지 않으므로 번들에 들어가지 않는다. 되살릴 땐 capacitor-health 를 includePlugins 에,
//   매니페스트 READ_STEPS·rationale 액티비티(PrivacyPolicyActivity)를 함께. [[docs/PLAY_HEALTH_DECLARATION.md]]
// 건강 데이터(걸음) 연동 추상화 — 플랫폼 세부(HealthKit/Health Connect)를 여기 뒤에 숨긴다.
//   앱 코드는 이 인터페이스만 사용 → 플러그인 교체/확장에 영향 없음.
//   현재: Android(Health Connect) 걸음. iOS(HealthKit)는 같은 플러그인이 지원 → 나중에 활성화.
//   웹(PWA)에서는 항상 사용 불가(건강 API 없음) — 호출 측은 getHealthStatus()/isHealthAvailable() 로 가드.
//
//   켜고 끄는 스위치 (2026-10-25 A안 = 걸음만 재도입):
//     ① capacitor.config.ts includePlugins 의 'capacitor-health'                          — 네이티브 세트 1
//     ② AndroidManifest 의 READ_STEPS + rationale 액티비티 + strings.xml privacy_policy_url — 네이티브 세트 2
//        (①② 중 하나만 있으면 네이티브에서 조용히 실패한다)
//     ③ lib/constants.STEPS_ENABLED — «운영자 노출» 스위치. ①②가 들어간 앱이 Play 에 깔린 «뒤에» 켠다.
//   v1.0(2026-09)엔 ①②③ 모두 꺼서 출시했다(건강 권한 심사 회피). 옛 앱(①② 없음)에서 플러그인을 부르면
//   Capacitor 가 UNIMPLEMENTED 로 거부한다 → getHealthStatus() 가 'plugin_missing' 을 돌려 «앱 업데이트» 안내로 보낸다.
//   ⚠️ 플러그인 객체(Health)는 정적 import 를 직접 쓴다 — async 로 감싸 return/await 하면 thenable 함정에 빠진다.
import { Capacitor } from '@capacitor/core'
import { Health } from 'capacitor-health'

export const STEPS_PERMISSION = 'READ_STEPS'

export function isNativePlatform() {
  return Capacitor.isNativePlatform()
}

// 플러그인이 네이티브에 안 들어간 빌드(v1.0~v52)에서 부르면 Capacitor 가 이 코드로 거부한다.
function isUnimplemented(e) {
  return e?.code === 'UNIMPLEMENTED' || /not implemented/i.test(e?.message || '')
}

// 상태 4가지 — 'web' | 'plugin_missing'(옛 앱) | 'unavailable'(Health Connect 없음·꺼짐) | 'available'
export async function getHealthStatus() {
  if (!isNativePlatform()) return 'web'
  try {
    const r = await Health.isHealthAvailable()
    return r?.available ? 'available' : 'unavailable'
  } catch (e) {
    return isUnimplemented(e) ? 'plugin_missing' : 'unavailable'
  }
}

// Health Connect(안드)/HealthKit(iOS) 사용 가능 여부. 웹이거나 Health Connect 미설치면 false.
export async function isHealthAvailable() {
  return (await getHealthStatus()) === 'available'
}

// 플러그인 응답에서 한 권한의 허용 여부. 모양이 다르면 null(모름).
//   ⚠️ 타입 정의(README)는 { permissions: [{ READ_STEPS: true }] } «배열»이라 하지만, 안드로이드 구현
//   (HealthPlugin.kt grantedPermissionResult)은 { permissions: { READ_STEPS: true } } «객체»를 돌려준다 — 에뮬 실측
//   (2026-10-25, 배열만 읽던 첫 구현은 권한을 허용해도 false 라 안내 단계가 매번 다시 떴다). 두 모양 다 읽는다.
function readGranted(res, key) {
  const p = res?.permissions
  if (Array.isArray(p)) {
    for (const o of p) if (o && typeof o === 'object' && key in o) return o[key] === true
    return null
  }
  if (p && typeof p === 'object' && key in p) return p[key] === true
  return null
}

// 걸음 읽기 권한이 «이미» 허용돼 있나 — 권한 화면을 띄우지 않는다. (안드 전용. iOS 는 false → request 로 간다)
export async function checkStepsPermission() {
  if (!isNativePlatform()) return false
  try {
    const r = await Health.checkHealthPermissions({ permissions: [STEPS_PERMISSION] })
    return readGranted(r, STEPS_PERMISSION) === true
  } catch {
    return false
  }
}

// 걸음 읽기 권한 요청. (안드: Health Connect 권한 화면 → 사용자 허용. iOS: 조용히 반환)
//   ⚠️ 부르기 «직전»에 걸음 데이터 사용 안내(Google Play 의 prominent disclosure)를 보여줘야 한다 — StepsVerify 의 disclose 단계.
export async function requestStepsPermission() {
  if (!isNativePlatform()) return { granted: false, reason: 'web' }
  try {
    const r = await Health.requestHealthPermissions({ permissions: [STEPS_PERMISSION] })
    const g = readGranted(r, STEPS_PERMISSION)
    return { granted: g !== false, reason: g === false ? 'denied' : undefined, raw: r }
  } catch (e) {
    return { granted: false, reason: isUnimplemented(e) ? 'plugin_missing' : (e?.message || 'error') }
  }
}

// Health Connect 설치(Play 스토어)·설정 열기 — 'unavailable'/'noperm' 안내 옆 버튼용. 실패해도 조용히.
export async function openHealthConnectInstall() {
  try { await Health.showHealthConnectInPlayStore() } catch { /* 무시 */ }
}
export async function openHealthConnectSettings() {
  try { await Health.openHealthConnectSettings() } catch { /* 무시 */ }
}

// 오늘(로컬 자정~현재) 걸음 합계.
export async function getTodaySteps() {
  if (!isNativePlatform()) return null
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const res = await Health.queryAggregated({
    startDate: start.toISOString(),
    endDate: now.toISOString(),
    dataType: 'steps',
    bucket: 'day',
  })
  const total = (res?.aggregatedData || []).reduce((s, d) => s + (Number(d?.value) || 0), 0)
  return Math.round(total)
}

// 최근 N일 일별 걸음 [{ date:'YYYY-MM-DD', steps }] — 나중 추세 그래프/동기화용(현재 미사용).
export async function getDailySteps(days = 7) {
  if (!isNativePlatform()) return []
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1), 0, 0, 0, 0)
  const res = await Health.queryAggregated({
    startDate: start.toISOString(),
    endDate: now.toISOString(),
    dataType: 'steps',
    bucket: 'day',
  })
  return (res?.aggregatedData || []).map((d) => ({
    date: (d?.startDate || '').slice(0, 10),
    steps: Math.round(Number(d?.value) || 0),
  }))
}
