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
