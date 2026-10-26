// 걸음 일꾼(네이티브 StepCounter 플러그인) 래퍼 (2026-10-26, 자체 만보기 1차).
//   안드로이드 앱만 동작. 웹/PWA 는 항상 'web'. 옛 앱(플러그인 없음, v52 이하)은 'plugin_missing'.
//   네이티브 쪽: android/app/src/main/java/com/healthplatform/app/steps/ (서비스·장부·플러그인).
//   ⚠️ 플러그인 객체는 정적 바인딩을 직접 쓴다 — async 로 감싸 return/await 하면 thenable 함정 [[feedback_capacitor_proxy_thenable]].
//   ⚠️ requestStepPermission() 을 부르기 «직전» 에 걸음 데이터 사용 안내(prominent disclosure)를 보여줘야 한다 — StepsVerify.
import { Capacitor, registerPlugin } from '@capacitor/core'

const StepCounter = registerPlugin('StepCounter')

export function isNativePlatform() {
  return Capacitor.isNativePlatform()
}

function isUnimplemented(e) {
  return e?.code === 'UNIMPLEMENTED' || /not implemented/i.test(e?.message || '')
}

// 상태 — kind: 'web' | 'plugin_missing'(옛 앱) | 'no_sensor' | 'noperm' | 'ready' | 'error'
//   ready 여도 enabled/running 이 false 면 아직 일꾼을 안 켠 것(걷기 프로그램 참여 전).
export async function getStepStatus() {
  if (!isNativePlatform()) return { kind: 'web' }
  try {
    const s = await StepCounter.getStatus()
    const kind = !s?.supported ? 'no_sensor' : s.permission !== 'granted' ? 'noperm' : 'ready'
    return { kind, ...s }
  } catch (e) {
    return { kind: isUnimplemented(e) ? 'plugin_missing' : 'error', error: e?.message || '' }
  }
}

// 신체활동(+안드13 알림) 권한 요청 — { granted: 신체활동 허용, notifications: 'granted'|'denied'|'prompt' }.
//   알림 권한이 없으면 일꾼은 돌지만 «알림 한 줄이 안 보인다»(에뮬 실측) → 함께 묻고, 거절이면 화면이 설정 안내.
export async function requestStepPermission() {
  if (!isNativePlatform()) return { granted: false, notifications: 'denied' }
  try {
    const r = await StepCounter.requestPermissions()
    return { granted: r?.activity === 'granted', notifications: r?.notifications || 'granted' }
  } catch {
    return { granted: false, notifications: 'denied' }
  }
}

export async function openNotificationSettings() {
  try { await StepCounter.openNotificationSettings() } catch { /* 무시 */ }
}

// 일꾼 켜기 — { goal, activeDays:[1..7](비면 매일), programName, until(ms, 0=기한 없음) }. 권한이 없으면 켜지지 않고 상태만 온다.
//   돌려주는 kind: 'running' = 켬(서비스는 비동기로 뜨므로 running 대신 enabled 로 판단) · 'ready' = 권한·센서 때문에 못 켬
export async function startStepWorker({ goal = 0, activeDays = [], programName = '', until = 0 } = {}) {
  if (!isNativePlatform()) return { kind: 'web' }
  try {
    const s = await StepCounter.start({ goal: Math.max(0, Math.round(goal) || 0), activeDays, programName, until: Math.max(0, Math.round(until) || 0) })
    return { kind: s?.enabled ? 'running' : 'ready', ...s }
  } catch (e) {
    return { kind: isUnimplemented(e) ? 'plugin_missing' : 'error', error: e?.message || '' }
  }
}

export async function stopStepWorker() {
  if (!isNativePlatform()) return
  try { await StepCounter.stop() } catch { /* 무시 */ }
}

// 오늘 걸음(폰 센서) — 일꾼이 돌고 있으면 최신값(배칭 큐 비움). 못 읽으면 null.
export async function getTodayStepCount() {
  if (!isNativePlatform()) return null
  try {
    const r = await StepCounter.getToday()
    return Number.isFinite(r?.steps) ? r.steps : null
  } catch {
    return null
  }
}

// 최근 n일 [{ date:'YYYY-MM-DD', steps }]
export async function getDailyStepCounts(days = 7) {
  if (!isNativePlatform()) return []
  try {
    const r = await StepCounter.getDaily({ days })
    return Array.isArray(r?.daily) ? r.daily : []
  } catch {
    return []
  }
}

export async function openBatterySettings() {
  try { await StepCounter.openBatterySettings() } catch { /* 무시 */ }
}

// 디버그 빌드 전용(에뮬엔 걸음 센서가 없다) — 릴리스에선 네이티브가 거부한다.
export async function debugAddSteps(steps) {
  try { const r = await StepCounter.debugAddSteps({ steps }); return r?.steps ?? null } catch { return null }
}
