import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { detectInAppBrowser, IN_APP_BROWSER_NAME, openExternalBrowser } from '../../lib/inAppBrowser'
import GoogleSignInButton from './GoogleSignInButton'

// GIS 인페이지 로그인용 — 있으면 리다이렉트 없는 GIS 버튼, 없으면 기존 리다이렉트 폴백
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// 소셜 로그인/가입 버튼 묶음 — LoginPage / SignupPage 공유.
// Day 65 본인 결정: Google + Kakao + Naver 단계별 도입.
//   1단계: Google (Supabase 기본 지원) — 활성
//   2단계: Kakao (Edge Function Custom OAuth) — 활성 (kakao-oauth Edge Function 필요)
//   3단계: Naver — 준비 중
//
// 소셜 가입 흐름:
//   Kakao: OAuth 인증 → /auth/callback → kakao-oauth Edge Function → verifyOtp → 로그인
//   Google: Supabase 기본 OAuth → /
//   → handle_new_user 트리거가 public.users 자동 생성 (nickname NULL)
//   → HomePage 진입 → nickname 체크 → 미설정이면 /nickname-setup 자동 이동
//
// Kakao 환경변수 (.env / Vercel env):
//   VITE_KAKAO_REST_API_KEY  : Kakao Developers 의 REST API 키 (공개 가능 — redirect_uri 화이트리스트로 보호)
function SocialAuthButtons() {
  const [loading, setLoading] = useState(null)  // 'google' | 'kakao' | 'naver' | null

  // OAuth 리다이렉트 중단(인앱 브라우저 차단) 또는 뒤로가기(bfcache) 로 페이지에
  //   되돌아오면 loading 이 stuck 되어 버튼이 잠긴 채 남는다 → 페이지가 다시 보이면 초기화.
  //   (pageshow 는 최초 로드 + bfcache 복원 모두에서 발생)
  useEffect(() => {
    const reset = () => setLoading(null)
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  const handleGoogle = async () => {
    // 인앱 브라우저(카톡/네이버/인스타 등 웹뷰)에서는 구글 OAuth 가 차단됨
    //   ("403: disallowed_useragent / 보안 브라우저 사용 정책").
    //   → OAuth 시작하지 말고 외부 브라우저로 빠져나가게 유도.
    const inApp = detectInAppBrowser()
    if (inApp) {
      const escaped = openExternalBrowser()
      if (!escaped) {
        // 강제 탈출 불가 (주로 iOS 인스타/페북 등) → 링크 복사 + 안내
        try { await navigator.clipboard.writeText(window.location.href) } catch { /* clipboard 미지원 */ }
        alert(
          `${IN_APP_BROWSER_NAME[inApp] || '현재 앱'} 안에서는 Google 로그인이 막혀 있어요.\n\n` +
          `링크를 복사했어요 — Safari/Chrome 주소창에 붙여넣어 다시 열어주세요.\n` +
          `(또는 우측 상단 메뉴 → '다른 브라우저로 열기')`
        )
      }
      return
    }

    setLoading('google')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // 로그인 성공 시 메인으로. HomePage 가 nickname 체크 후 /nickname-setup 또는 /dashboard
        redirectTo: `${window.location.origin}/`,
      },
    })
    if (error) {
      console.error('Google OAuth 실패:', error)
      alert(`Google 로그인 실패: ${error.message}`)
      setLoading(null)
    }
    // 성공 시 자동으로 OAuth 페이지로 리다이렉트 — loading 유지 (페이지 떠남)
  }

  const handleKakao = () => {
    const restApiKey = import.meta.env.VITE_KAKAO_REST_API_KEY
    if (!restApiKey) {
      alert('Kakao 로그인 설정이 누락됐어요 (VITE_KAKAO_REST_API_KEY).\n.env 또는 호스팅 환경변수를 확인해주세요.')
      return
    }
    setLoading('kakao')
    // Kakao OAuth authorize 페이지로 리다이렉트.
    // scope: profile_nickname, profile_image (이메일은 비즈 앱 권한 필요해 제외)
    //   ※ Kakao Developers > 카카오 로그인 > 동의항목 에서 위 2개 항목 필수 동의로 설정해둬야 함.
    //   ※ account_email 은 비즈 앱 전환 후 추가 가능 — 현재는 가상 이메일(kakao_{id}@kakao.local)로 가입.
    // redirect_uri 에 쿼리스트링 X — Kakao 가 자동 제거하는 경우가 있어 정확 일치 보장 위해 path-only.
    // 어떤 provider 인지는 sessionStorage 로 callback 페이지에 전달.
    sessionStorage.setItem('oauth_provider', 'kakao')
    const redirectUri = `${window.location.origin}/auth/callback`
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: restApiKey,
      redirect_uri: redirectUri,
      scope: 'profile_nickname profile_image',
    })
    window.location.href = `https://kauth.kakao.com/oauth/authorize?${params.toString()}`
  }

  const handleNaver = () => {
    alert('🔧 Naver 로그인은 다음 단계에서 구현됩니다 (Edge Function 도입).')
  }

  return (
    <div className="mt-5">
      {/* 구분선 */}
      <div className="relative flex items-center mb-4">
        <div className="flex-1 border-t border-gray-200" />
        <span className="px-3 text-xs text-gray-400">또는</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* 소셜 버튼 3개 — 세로 배치 (모바일 친화) */}
      <div className="flex flex-col gap-2">
        {/* Google — GIS 인페이지 로그인(리다이렉트 X). client ID 미설정 시 기존 리다이렉트 폴백 */}
        {GOOGLE_CLIENT_ID ? (
          <GoogleSignInButton clientId={GOOGLE_CLIENT_ID} />
        ) : (
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading === 'google'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-medium rounded-xl transition disabled:opacity-50"
          >
            <GoogleIcon className="w-5 h-5" />
            {loading === 'google' ? '연결 중...' : 'Google 로 계속하기'}
          </button>
        )}

        {/* Kakao */}
        <button
          type="button"
          onClick={handleKakao}
          disabled={loading === 'kakao'}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] text-sm font-medium rounded-xl transition disabled:opacity-50"
        >
          <KakaoIcon className="w-5 h-5" />
          {loading === 'kakao' ? '연결 중...' : 'Kakao 로 계속하기'}
        </button>

        {/* Naver */}
        <button
          type="button"
          onClick={handleNaver}
          disabled={loading === 'naver'}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#03C75A] hover:bg-[#02B450] text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
        >
          <NaverIcon className="w-5 h-5" />
          {loading === 'naver' ? '연결 중...' : 'Naver 로 계속하기'}
        </button>
      </div>
    </div>
  )
}

// ─── 아이콘 (인라인 SVG — 외부 의존 X) ─────────────────────────

function GoogleIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.1 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.4-.3-3.5z" />
    </svg>
  )
}

function KakaoIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.79 1.86 5.24 4.66 6.61l-.97 3.55c-.09.31.27.55.55.36L10.6 19c.46.05.93.08 1.4.08 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" />
    </svg>
  )
}

function NaverIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z" />
    </svg>
  )
}

export default SocialAuthButtons
