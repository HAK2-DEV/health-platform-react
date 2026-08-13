// 건강 데이터(걸음) 연동 추상화 — 플랫폼 세부(HealthKit/Health Connect)를 여기 뒤에 숨긴다.
//   앱 코드는 이 인터페이스만 사용 → 플러그인 교체/확장에 영향 없음.
//   현재: Android(Health Connect) 걸음 PoC. iOS(HealthKit)는 같은 플러그인이 지원 → 나중에 활성화.
//   웹(PWA)에서는 항상 unavailable (건강 API 없음) — 호출 측은 isAvailable()로 가드.
import { Capacitor } from '@capacitor/core'
import { Health } from 'capacitor-health'

export function isNativePlatform() {
  return Capacitor.isNativePlatform()
}

// Health Connect(안드)/HealthKit(iOS) 사용 가능 여부. 웹이거나 Health Connect 미설치면 false.
export async function isHealthAvailable() {
  if (!isNativePlatform()) return false
  try {
    const r = await Health.isHealthAvailable()
    return !!r?.available
  } catch {
    return false
  }
}

// 걸음 읽기 권한 요청. (안드: 권한 화면 → 사용자 허용. iOS: 조용히 반환)
export async function requestStepsPermission() {
  if (!isNativePlatform()) return { granted: false, reason: 'web' }
  try {
    const r = await Health.requestHealthPermissions({ permissions: ['READ_STEPS'] })
    return { granted: true, raw: r }
  } catch (e) {
    return { granted: false, reason: e?.message || 'error' }
  }
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

// 최근 N일 일별 걸음 [{ date:'YYYY-MM-DD', steps }] — 나중 추세 그래프/동기화용(현재 PoC 미사용).
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
