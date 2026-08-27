// 소셜 로그인(Kakao/Naver 등 커스텀 OAuth) 공용 — 사용자 확보(find or create).
//
// 왜 별도 헬퍼인가 (2026-08-27 수정):
//   이전 구현은 두 함수 모두 `admin.listUsers({ page: 1, perPage: 1000 })` 로 전체 목록을
//   받아 email 을 find() 했다. **1페이지만** 보므로 전체 사용자가 1000명을 넘는 순간
//   오래 가입한 사용자가 1페이지 밖으로 밀려나 "없는 사용자"로 판정된다.
//   → createUser 시도 → 이메일 중복 에러 → **기존 사용자가 로그인 불가**(영구).
//   신규 가입이 아니라 멀쩡히 쓰던 계정이 잠기는 형태라 뒤늦게 발견되는 고약한 버그였다.
//
// 새 방식 (사용자 수와 무관하게 O(1)):
//   1) public.users 를 email 로 직접 조회 (서비스롤 — RLS/컬럼권한 무관). 대부분 여기서 히트.
//   2) 없으면 createUser. 이미 존재하면(트리거 누락분·동시 요청 경합) GoTrue 가 중복 에러를
//      주는데, 이는 "이미 있다"는 뜻이므로 **성공으로 간주**하고 그대로 진행한다.
//
// 호출부가 user.id 를 쓰지 않는 점(마지막 generateLink 는 email 만 필요)을 이용해
//   사용자 객체를 굳이 되찾지 않는다 — 추가 조회 없이 정확성만 보장.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// GoTrue 가 "이미 등록된 이메일" 을 알리는 형태가 버전마다 달라 넉넉히 판정.
//   (code: 'email_exists' | 'user_already_exists', 또는 메시지 문구, 또는 DB 유니크 위반)
function isAlreadyRegistered(err: unknown): boolean {
  const e = err as { code?: string; status?: number; message?: string } | null
  const code = e?.code ?? ''
  const msg = String(e?.message ?? '').toLowerCase()
  return (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    msg.includes('already been registered') ||
    msg.includes('already registered') ||
    msg.includes('duplicate key')
  )
}

export type SocialUserMetadata = Record<string, unknown>

/**
 * 소셜 계정에 대응하는 auth 사용자를 보장한다(없으면 생성).
 * @returns created — 이번 호출로 새로 만들어졌으면 true (신규 가입)
 * @throws 조회/생성이 "이미 존재" 이외의 이유로 실패한 경우
 */
export async function ensureSocialUser(
  supabase: SupabaseClient,
  email: string,
  userMetadata: SocialUserMetadata,
): Promise<{ created: boolean }> {
  // ─── 1) 기존 사용자? public.users 사본으로 확인 ───────────
  //   handle_new_user 트리거가 auth.users → public.users 로 email 을 복사해둔다.
  //   실패하더라도 2)의 중복 처리가 정확성을 보장하므로 에러는 삼키고 넘어간다.
  const { data: existing, error: lookupErr } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle()

  if (lookupErr) {
    console.warn('[socialUser] public.users 조회 실패 — createUser 로 폴백:', lookupErr.message)
  } else if (existing) {
    return { created: false }
  }

  // ─── 2) 없으면 생성 ────────────────────────────────────
  const { error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true, // 소셜 가입은 이메일 검증 skip
    user_metadata: userMetadata,
  })

  if (createErr) {
    // 이미 있는 사용자 = 정상 로그인 경로. (public.users 사본이 없던 케이스)
    if (isAlreadyRegistered(createErr)) return { created: false }
    console.error('[socialUser] createUser 실패:', createErr)
    throw new Error(`사용자 생성 실패: ${createErr.message}`)
  }

  return { created: true }
}
