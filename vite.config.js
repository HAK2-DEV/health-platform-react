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
    //   registerType: 'autoUpdate' + skipWaiting/clientsClaim = 새 배포 감지 시 새 SW 를 즉시 활성화하고
    //     페이지를 자동 갱신 → 배너 클릭 없이 새로고침/재진입만으로 최신 버전. (모바일이 옛 빌드에 머무는 문제 해결)
    //     청크404 는 vite:preloadError 자가복구가 커버. main.jsx 에서 주기적 update() 로 오래 켠 세션도 감지.
    VitePWA({
      registerType: 'autoUpdate',
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
        skipWaiting: true,      // 새 SW 대기 없이 즉시 활성화
        clientsClaim: true,     // 활성화 즉시 열린 탭 제어 → 새 precache(최신 빌드) 서빙
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
