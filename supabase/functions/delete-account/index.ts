// 회원 탈퇴 — «파일까지» 지우는 서버측 삭제.
//   왜 엣지 함수인가: 기존 RPC delete_my_account(마이그 073)는 auth.users 만 지워 DB 는 CASCADE 로
//   정리되지만 Storage 의 물리 파일(인증·게시글·프로필·표지 사진)은 그대로 남았다.
//   Storage 삭제는 storage.remove() API 로 해야 물리 파일이 지워진다(storage.objects 행만 SQL 로 지우면
//   고아 파일이 생긴다). 그래서 service role 로 4개 버킷의 `${uid}/` 접두 파일을 지운 뒤 계정을 삭제한다.
//
//   순서: 파일 삭제 → 계정 삭제. 파일 삭제가 중간에 실패하면 계정은 남겨 두고 오류를 돌려줘 재시도하게 한다
//   (계정이 먼저 사라지면 파일을 지울 주체가 없어진다).
//
//   인증: 게이트웨이 verify_jwt(기본 true) 를 통과한 사용자 JWT 로 본인 uid 만 삭제한다. 타인 삭제 불가.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, jsonError } from '../_shared/cors.ts'

// 업로드 경로 규칙: 4개 버킷 모두 `${user.id}/<파일명>` (CoverImageUploader·CommunityPostModal·ProfilePage·MissionVerifyPage)
const BUCKETS = ['verification-images', 'community-posts', 'profile-avatars', 'program-covers'] as const
const PAGE = 1000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonError('POST 만 허용됩니다', 405)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return jsonError('로그인이 필요합니다', 401)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !serviceKey) return jsonError('서버 설정 오류', 500)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  const uid = userData?.user?.id
  if (userErr || !uid) return jsonError('세션이 유효하지 않습니다. 다시 로그인해 주세요.', 401)

  // 1) 파일 삭제 — 버킷별 `${uid}/` 바로 아래 파일(중첩 폴더 없음). 폴더 항목(id 없음)은 건너뛴다.
  const removed: Record<string, number> = {}
  for (const bucket of BUCKETS) {
    let total = 0
    for (;;) {
      const { data: list, error: listErr } = await admin.storage.from(bucket).list(uid, { limit: PAGE })
      if (listErr) return jsonError(`파일 목록 조회 실패(${bucket}): ${listErr.message}`, 500)
      const files = (list ?? []).filter((o) => !!o.id).map((o) => `${uid}/${o.name}`)
      if (files.length === 0) break
      const { error: rmErr } = await admin.storage.from(bucket).remove(files)
      if (rmErr) return jsonError(`파일 삭제 실패(${bucket}): ${rmErr.message}`, 500)
      total += files.length
      if (files.length < PAGE) break
    }
    removed[bucket] = total
  }

  // 2) 계정 삭제 — auth.users DELETE → public.users 이하 전부 FK CASCADE(마이그 073 과 동일 효과)
  const { error: delErr } = await admin.auth.admin.deleteUser(uid)
  if (delErr) return jsonError(`계정 삭제 실패: ${delErr.message}`, 500)

  return jsonResponse({ ok: true, removed })
})
