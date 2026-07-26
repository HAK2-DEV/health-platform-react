import * as Sentry from '@sentry/react'

// Sentry 에러 추적 — eager(정적) import 로 유지.
//   지연(동적 import)도 검토했으나 트리쉐이킹이 깨져 29kB→153kB(gzip)로 커져 손해.
//   대신 vendor 청크 분할(vite.config)로 'sentry' 청크가 별도 캐시 → 배포 시 재다운로드 X.
//   에러 바운더리는 ErrorBoundary(경량 클래스)가 담당하고 captureException 으로 전달.
//
// VITE_SENTRY_DSN 없으면 완전 no-op.

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.info('[sentry] DSN 미설정 — 에러 추적 비활성. VITE_SENTRY_DSN 확인.')
    }
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    ignoreErrors: [
      'Network request failed',
      'Failed to fetch',
      /chrome-extension/,
      /moz-extension/,
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],
  })
}

// 에러 바운더리/전역에서 호출 — DSN 미설정이면 init 안 돼도 안전(no-op).
export function captureException(error) {
  if (error) Sentry.captureException(error)
}

// 대규모 유저 목록 경고 — 한 화면에 유저(아바타)가 임계 이상 렌더되면 관리자에게 1회 알림.
//   신호: 아바타 이미지가 많아 앱이 느려질 수 있음 → 아바타 썸네일/Supabase 이미지 변환(유료 플랜) 검토.
//   세션당 컨텍스트별 1회만(스팸 방지). DSN 미설정이면 dev 콘솔만.
const _scaleWarned = new Set()
export function warnLargeUserList(context, count, threshold = 200) {
  if (!count || count < threshold || _scaleWarned.has(context)) return
  _scaleWarned.add(context)
  const msg = `대규모 유저 목록: ${context} ${count}명(임계 ${threshold}) — 아바타 이미지 과다로 지연 우려. 썸네일/이미지 변환(유료 플랜) 검토 권장.`
  if (import.meta.env.DEV) console.warn('[scale]', msg)
  try {
    Sentry.captureMessage(msg, { level: 'warning', tags: { kind: 'scale_warning', context }, extra: { count, threshold } })
  } catch { /* DSN 미설정 등 — no-op */ }
}
