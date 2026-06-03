import * as Sentry from '@sentry/react'

// Day 65 — Sentry 에러 추적 초기화.
// VITE_SENTRY_DSN 이 .env / Vercel 환경변수에 있을 때만 활성화 — 없으면 no-op.
// 본인 후속 액션:
//   1) sentry.io 가입 → 새 프로젝트 (React) 생성 → DSN 복사
//   2) .env.local 에 VITE_SENTRY_DSN=... 추가
//   3) Vercel Environment Variables 에도 동일하게 추가 (Production + Preview)
//   4) 로컬에선 의도적 에러 발생시켜 Sentry 대시보드에 표시되는지 확인
//
// 무료 tier: 5,000 events/month, 7-day retention — 베타 단계 충분.

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.info('[sentry] DSN 미설정 — 에러 추적 비활성. VITE_SENTRY_DSN 환경변수 확인.')
    }
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,  // 'development' | 'production'
    // 사용자가 보낸 prop·error stack 그대로 — 개인정보 X (이메일/닉네임 같은 PII 는 자동 마스킹 권장)
    sendDefaultPii: false,
    // 베타 단계엔 모든 트랜잭션 추적 — 본격 출시 시 0.1 로 낮춰 비용 절감
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    // 에러 메시지 무시 패턴 — 사용자 환경 잡음 차단
    ignoreErrors: [
      // 네트워크 오류 — 사용자 wifi 끊김 등
      'Network request failed',
      'Failed to fetch',
      // 브라우저 확장 프로그램 노이즈
      /chrome-extension/,
      /moz-extension/,
      // ResizeObserver 잡음 (Chrome 의 알려진 무해 경고)
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],
  })
}

// React Error Boundary 컴포넌트 — main.jsx 에서 <App/> 감싸 사용.
export const SentryErrorBoundary = Sentry.ErrorBoundary
