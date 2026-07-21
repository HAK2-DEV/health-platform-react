// Naver OAuth Edge Function — Kakao 와 동일 구조(커스텀 OAuth). 2026-07 도입.
// 흐름:
//   1) 프론트가 redirect_uri 로 받은 code(+state) 를 이 함수에 POST
//   2) Naver 토큰 엔드포인트에 code → access_token 교환 (client_secret + state 필수)
//   3) Naver 사용자 정보 조회 (id/email/nickname/profile_image)
//   4) Supabase Admin API 로 auth.users 조회 또는 생성
//   5) generateLink(magiclink) 로 token_hash 발급 후 프론트에 반환
//   6) 프론트는 supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) 로 로그인 완료
//
// 필요한 환경변수 (Supabase Dashboard > Edge Functions > Secrets):
//   - NAVER_CLIENT_ID          : 네이버 개발자센터 애플리케이션의 Client ID
//   - NAVER_CLIENT_SECRET       : 네이버 Client Secret (토큰 교환 필수 — Kakao 와 달리 필수)
//   - NAVER_REDIRECT_URI        : 등록된 Callback URL (예: https://본인도메인/auth/callback) — body 우선
//   - SUPABASE_URL              : (자동 주입)
//   - SUPABASE_SERVICE_ROLE_KEY : (자동 주입)
//
// 배포: supabase functions deploy naver-oauth
// ※ 네이버 로그인은 앱 등록 후 「검수」 승인 전까지 관리자/지정 테스터 계정만 로그인 가능.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, jsonError } from '../_shared/cors.ts'

const NAVER_TOKEN_URL = 'https://nid.naver.com/oauth2.0/token'
const NAVER_USER_URL = 'https://openapi.naver.com/v1/nid/me'

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonError('POST 만 허용돼요', 405)
  }

  try {
    const { code, state, redirect_uri: bodyRedirectUri } = await req.json().catch(() => ({}))
    if (!code) {
      return jsonError('code 가 필요해요', 400)
    }
    if (!state) {
      return jsonError('state 가 필요해요', 400)
    }

    const clientId = Deno.env.get('NAVER_CLIENT_ID')
    const clientSecret = Deno.env.get('NAVER_CLIENT_SECRET')
    const envRedirectUri = Deno.env.get('NAVER_REDIRECT_URI')
    const redirectUri = bodyRedirectUri ?? envRedirectUri

    if (!clientId) {
      return jsonError('서버 설정 누락: NAVER_CLIENT_ID', 500)
    }
    if (!clientSecret) {
      return jsonError('서버 설정 누락: NAVER_CLIENT_SECRET', 500)
    }
    if (!redirectUri) {
      return jsonError('서버 설정 누락: NAVER_REDIRECT_URI', 500)
    }

    // ─── 1) code → access_token (네이버는 GET + query, client_secret·state 필수) ───
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      state,
    })
    const tokenRes = await fetch(`${NAVER_TOKEN_URL}?${tokenParams.toString()}`, { method: 'GET' })
    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      console.error('[naver-oauth] Naver 토큰 교환 실패. status:', tokenRes.status, 'body:', errText)
      return jsonError(`Naver 토큰 교환 실패: ${errText}`, 502)
    }
    const tokenData = await tokenRes.json()
    if (tokenData?.error) {
      console.error('[naver-oauth] 토큰 응답 오류:', tokenData)
      return jsonError(`Naver 토큰 오류: ${tokenData.error_description ?? tokenData.error}`, 502)
    }
    const accessToken = tokenData.access_token as string
    if (!accessToken) {
      return jsonError('Naver access_token 없음', 502)
    }

    // ─── 2) access_token → user info ──────────────────────
    const userRes = await fetch(NAVER_USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!userRes.ok) {
      const errText = await userRes.text()
      console.error('Naver 사용자 조회 실패:', errText)
      return jsonError(`Naver 사용자 조회 실패: ${errText}`, 502)
    }
    const naverBody = await userRes.json()
    if (naverBody?.resultcode !== '00') {
      console.error('Naver 프로필 응답 이상:', naverBody)
      return jsonError(`Naver 프로필 조회 실패: ${naverBody?.message ?? '알 수 없음'}`, 502)
    }
    const p = naverBody?.response ?? {}
    const naverId = String(p?.id ?? '')
    const rawEmail = (p?.email as string | undefined)?.trim()
    const nickname = (p?.nickname as string | undefined) ?? (p?.name as string | undefined)
    const avatarUrl = p?.profile_image as string | undefined

    if (!naverId) {
      return jsonError('Naver 사용자 ID 가 없어요', 400)
    }

    // 이메일 미제공/미동의 시 가상 이메일. 같은 Naver 계정 → 항상 같은 가상 이메일(식별 일관성).
    const email = rawEmail || `naver_${naverId}@naver.local`
    const isPlaceholderEmail = !rawEmail

    // ─── 3) Supabase Admin — find or create user ──────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    let user: { id: string; email: string | null } | null = null
    {
      const { data, error } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })
      if (error) {
        console.error('listUsers 실패:', error)
        return jsonError(`사용자 조회 실패: ${error.message}`, 500)
      }
      user = data.users.find((u) => u.email === email) ?? null
    }

    if (!user) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true, // 소셜 가입은 이메일 검증 skip
        user_metadata: {
          full_name: nickname ?? null,
          avatar_url: avatarUrl ?? null,
          provider: 'naver',
          naver_id: naverId,
          placeholder_email: isPlaceholderEmail,
        },
      })
      if (createErr) {
        console.error('createUser 실패:', createErr)
        return jsonError(`사용자 생성 실패: ${createErr.message}`, 500)
      }
      user = created.user
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
    console.error('naver-oauth 내부 오류:', msg)
    return jsonError(`내부 오류: ${msg}`, 500)
  }
})
