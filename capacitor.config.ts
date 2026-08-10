import type { CapacitorConfig } from '@capacitor/cli'

// Day 65 — Capacitor 설정.
// Bundle ID: com.healthplatform.app (절대 변경 X — App Store 제출 후 고정)
// 웹 자산 디렉토리: dist (Vite 빌드 출력)
//
// 변경 시 본인 후속:
//   - appName 바꾸면 npx cap sync 후 빌드 재실행
//   - server.url 활성화하면 native 앱이 원격 URL 로 로드 (개발 편의용 — 프로덕션은 비활성)

const config: CapacitorConfig = {
  appId: 'com.healthplatform.app',
  appName: '건강증진 플랫폼',
  webDir: 'dist',
  // 프로덕션은 번들된 자산 사용 (오프라인 일부 동작 + App Store 가이드라인 통과 유리).
  // 본인이 native 라이브 디버깅 원하면 아래 server.url 일시 활성화:
  // server: { url: 'http://192.168.x.x:5173', cleartext: true },
  ios: {
    // iOS 키보드가 input 가릴 때 자동 스크롤
    contentInset: 'always',
    // 스와이프 뒤로가기 (React Router 와 자연스럽게 연결)
    allowsLinkPreview: false,
  },
  android: {
    // Android WebView 의 mixed content (https + http) 허용 — 외부 이미지 등.
    // 모든 API 호출이 HTTPS 인 경우 false 권장. Supabase 는 HTTPS 라 false OK.
    allowMixedContent: false,
    // 키보드 표시 시 화면 리사이즈 (input focus 시 가림 방지)
    backgroundColor: '#f8fbf9',  // bg-surface-app 토큰과 동일
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0a9d70',  // 도담 초록 — 스플래시 이미지 배경과 동일 톤(민트 플래시 방지)
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // 베이지/민트 배경에 맞춰 아이콘은 어둡게
      style: 'LIGHT',
      backgroundColor: '#d1fae5',
    },
  },
}

export default config
