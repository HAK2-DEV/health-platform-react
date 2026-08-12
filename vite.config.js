import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA — Service Worker + manifest 자동 생성/등록
    //   registerType: 'prompt' — 새 배포 감지 시 새 SW 가 '대기' 상태가 되고 onNeedRefresh 발생 →
    //     PwaUpdatePrompt 배너("새 버전이 있어요 · 새로고침") 노출. 사용자가 새로고침 누르면 브랜드
    //     스플래시(UpdateSplash) 잠깐 뒤 updateSW(true)(skipWaiting+reload)로 최신 버전 적용.
    //     배너 무시해도 새 화면(lazy chunk) 이동 시 vite:preloadError 자가복구가 최신화 안전망.
    //     ※ 배너를 띄우려면 workbox skipWaiting/clientsClaim 을 켜지 않아야 함(켜면 대기 없이 즉시 활성화됨).
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'app-icon.png'],
      manifest: {
        name: '도담 · 건강증진 플랫폼',
        short_name: '도담',
        description: '운영은 쉽게, 건강은 단단하게 — 건강증진 프로그램을 함께 만들고 참여하는 PWA',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#059669',
        lang: 'ko',
        // getInstalledRelatedApps() 가 "이 PWA 가 실제 설치됐는지" 확인할 수 있도록 자기참조.
        //   상대경로라 프리뷰/프로드 등 어느 도메인에서도 해당 origin 의 manifest 로 해석됨.
        //   설치 유도 배너가 "실제 설치 완료" 시점을 정확히 감지하는 데 사용.
        prefer_related_applications: false,
        related_applications: [
          { platform: 'webapp', url: '/manifest.webmanifest' },
        ],
        // 설치 다이얼로그를 앱스토어 같은 "리치 시트"로 — 크롬은 narrow 스크린샷이 있으면
        //   스크린샷+설명이 담긴 풍부한 설치 UI 를 보여줌. 온보딩 여정 이미지 재활용(모두 440x954 동일 비율).
        screenshots: [
          // 참여자 여정
          { src: '/onboarding/journey/p-browse1.png', sizes: '440x954', type: 'image/png', form_factor: 'narrow', label: '관심 프로그램 둘러보기' },
          { src: '/onboarding/journey/p2-detail.png', sizes: '440x954', type: 'image/png', form_factor: 'narrow', label: '프로그램 참여하기' },
          { src: '/onboarding/journey/p4-cheer.png', sizes: '440x954', type: 'image/png', form_factor: 'narrow', label: '서로 응원하고 좋아요' },
          { src: '/onboarding/journey/p5-growth.png', sizes: '440x954', type: 'image/png', form_factor: 'narrow', label: '연속 인증·랭킹으로 성장 확인' },
          // 운영자 사용법
          { src: '/onboarding/journey/o1-create1.png', sizes: '440x954', type: 'image/png', form_factor: 'narrow', label: '운영자: 프로그램·미션 만들기' },
          { src: '/onboarding/journey/o2-mission.png', sizes: '440x954', type: 'image/png', form_factor: 'narrow', label: '운영자: 미션·퀴즈 구성' },
          { src: '/onboarding/journey/o5-report1.png', sizes: '440x954', type: 'image/png', form_factor: 'narrow', label: '운영자: 참여 통계·종료 리포트' },
        ],
        icons: [
          {
            src: '/app-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/app-icon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        // Web Push 핸들러(push/notificationclick) 를 생성 SW 에 병합 — public/push-sw.js
        importScripts: ['/push-sw.js'],
        // skipWaiting/clientsClaim 은 의도적으로 끔 — prompt 모드에서 새 SW 가 '대기'해야
        //   onNeedRefresh(배너)가 발생. 새로고침 클릭 시 updateSW(true)가 skipWaiting 수행.
        // Supabase API / 이미지 등은 SW 캐시에서 제외 — 항상 최신
        navigateFallbackDenylist: [/^\/api\//, /supabase\.co/],
        runtimeCaching: [
          {
            // 폰트 — CacheFirst 1년
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // dev 에선 SW 비활성 (HMR 충돌 방지)
      },
    }),
  ],

  // 번들 분할 — 단일 거대 index 청크를 vendor 별로 쪼갬.
  //   효과: ① 병렬 다운로드 ② vendor 캐시 유지 → 앱 코드만 바뀌는 배포에서 재다운로드 최소화
  //         ③ markdown 등 일부 라이브러리는 쓰는 라우트에서만 로드.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // 알려진 eager 대형 라이브러리만 분할 — catch-all 금지(lazy 전용 라이브러리를
          //   eager 로 끌어올리는 부작용 방지: 크롭/이미지압축/markdown 은 쓰는 라우트에서만 로드).
          if (id.includes('@sentry')) return 'sentry'
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'motion'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('react-router')) return 'router'
          if (id.includes('@tanstack')) return 'query'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'react'
          return undefined
        },
      },
    },
  },
})
