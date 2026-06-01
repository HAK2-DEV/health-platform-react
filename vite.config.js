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
    //   registerType: 'autoUpdate' = 새 배포 감지 시 자동으로 새 SW 활성화 (다음 페이지 진입 시 적용)
    //   사용자가 PWA 를 매번 삭제·재추가할 필요 없음 — 푸시만 하면 다음 실행 시 반영
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Health Platform',
        short_name: 'Health',
        description: '건강증진 프로그램을 함께 만들고 참여하는 PWA',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#10b981',
        lang: 'ko',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
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

})
