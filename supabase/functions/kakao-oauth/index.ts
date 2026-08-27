// Kakao OAuth Edge Function — Day 65 본인 결정.
// 흐름:
//   1) 프론트가 redirect_uri 로 받은 code 를 이 함수에 POST
//   2) Kakao 토큰 엔드포인트에 code → access_token 교환
//   3) Kakao 사용자 정보 조회 (email/nickname/profile_image)
//   4) Supabase Admin API 로 auth.users 조회 또는 생성
//   5) generateLink(magiclink) 로 token_hash 발급 후 프론트에 반환
//   6) 프론트는 supabase.auth.verifyOtp({ email, token_hash, type: 'magiclink' }) 로 로그인 완료
//
// 필요한 환경변수 (Supabase Dashboard > Edge Functions > Secrets):
//   - KAKAO_REST_API_KEY    : Kakao 앱의 REST API 키 (Kakao Developers)
//   - KAKAO_REDIRECT_URI    : 등록된 redirect URI (예: https://본인도메인/auth/callback)
//   - KAKAO_CLIENT_SECRET   : (선택) Client Secret 활성화 시
//   - SUPABASE_URL          : (자동 주입)
//   - SUPABASE_SERVICE_ROLE_KEY : (자동 주입)
//
// 배포: supabase functions deploy kakao-oauth

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, jsonError } from '../_shared/cors.ts'
import { ensureSocialUser } from '../_shared/socialUser.ts'

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token'
const KAKAO_USER_URL = 'https://kapi.kakao.com/v2/user/me'

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonError('POST 만 허용돼요', 405)
  }

  try {
    const { code, redirect_uri: bodyRedirectUri } = await req.json().catch(() => ({}))
    if (!code) {
      return jsonError('code 가 필요해요', 400)
    }

    const restApiKey = Deno.env.get('KAKAO_REST_API_KEY')
    const clientSecret = Deno.env.get('KAKAO_CLIENT_SECRET') ?? ''
    const envRedirectUri = Deno.env.get('KAKAO_REDIRECT_URI')
    const redirectUri = bodyRedirectUri ?? envRedirectUri

    if (!restApiKey) {
      return jsonError('서버 설정 누락: KAKAO_REST_API_KEY', 500)
    }
    if (!redirectUri) {
      return jsonError('서버 설정 누락: KAKAO_REDIRECT_URI', 500)
    }

    // ─── 1) code → access_token ───────────────────────────
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: restApiKey,
      redirect_uri: redirectUri,
      code,
    })
    if (clientSecret) tokenParams.set('client_secret', clientSecret)

    const tokenRes = await fetch(KAKAO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: tokenParams,
    })
    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      console.error('[kakao-oauth] Kakao 토큰 교환 실패. status:', tokenRes.status, 'body:', errText)
      return jsonError(`Kakao 토큰 교환 실패: ${errText}`, 502)
    }
    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token as string
    if (!accessToken) {
      return jsonError('Kakao access_token 없음', 502)
    }

    // ─── 2) access_token → user info ──────────────────────
    const userRes = await fetch(KAKAO_USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!userRes.ok) {
      const errText = await userRes.text()
      console.error('Kakao 사용자 조회 실패:', errText)
      return jsonError(`Kakao 사용자 조회 실패: ${errText}`, 502)
    }
    const kakaoUser = await userRes.json()
    const kakaoId = String(kakaoUser?.id ?? '')
    const kakaoAccount = kakaoUser?.kakao_account ?? {}
    const rawEmail = (kakaoAccount?.email as string | undefined)?.trim()
    const nickname = kakaoAccount?.profile?.nickname as string | undefined
    const avatarUrl = kakaoAccount?.profile?.profile_image_url as string | undefined

    if (!kakaoId) {
      return jsonError('Kakao 사용자 ID 가 없어요', 400)
    }

    // 이메일 접근 권한이 없거나(비즈 앱 미전환) 사용자가 미동의한 경우 — 가상 이메일 생성.
    // 같은 Kakao 계정은 항상 같은 가상 이메일 → Supabase 사용자 식별 일관성 유지.
    // 나중에 비즈 앱 전환 + 실제 이메일 수집 시 user_metadata 의 placeholder_email 플래그로 마이그레이션 가능.
    const email = rawEmail || `kakao_${kakaoId}@kakao.local`
    const isPlaceholderEmail = !rawEmail

    // ─── 3) Supabase Admin — find or create user ──────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 사용자 수와 무관하게 동작 — 이전의 listUsers 1페이지(1000명) 스캔은
    //   1000명을 넘는 순간 기존 사용자를 못 찾아 로그인이 막혔다. (_shared/socialUser.ts 주석 참고)
    try {
      await ensureSocialUser(supabase, email, {
        full_name: nickname ?? null,
        avatar_url: avatarUrl ?? null,
        provider: 'kakao',
        kakao_id: kakaoId,
        // 가상 이메일 여부 — 나중에 비즈 앱 전환 후 진짜 이메일로 마이그레이션 시 식별용
        placeholder_email: isPlaceholderEmail,
      })
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : String(e), 500)
    }

    // ─── 4) magic link 토큰 생성 → 프론트가 verifyOtp 로 로그인 ──
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error('generateLink 실패:', linkErr)
      return jsonError(`로그인 토큰 생성 실패: ${linkErr?.message ?? '알 수 없음'}`, 500)
    }

    return jsonResponse({
      email,
      token_hash: linkData.properties.hashed_token,
      verification_type: 'magiclink',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('kakao-oauth 내부 오류:', msg)
    return jsonError(`내부 오류: ${msg}`, 500)
  }
})
