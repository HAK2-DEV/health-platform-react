// 사용자 차단 — blocked_users(마이그 262) + 알림 서버 차단 트리거(263).
//   설계: 화면 필터는 «클라이언트»가 한다. 목록 쿼리(게시글·인증 피드·댓글·알림)가 이 모듈의 캐시된 차단 집합으로
//   행을 걸러낸다. RLS 로 모든 SELECT 를 거르는 방식은 정책 8곳+ 회귀 위험이 커서 택하지 않았다.
//   서버가 «반드시» 막는 것: 1:1 인 운영자 응원(RPC 거부) + 차단 사용자가 만드는 «새» 알림 행(263 트리거 → 푸시도 안 감).
//   랭킹은 공적 집계라 숨기지 않는다(본인 결정 2026-09-15).
//
//   필터 방식 2가지:
//   · 페이지네이션 목록(인증 피드) → «쿼리에» not-in 을 넣어 range 가 정확하게(사후 필터는 페이지가 줄어 무한스크롤이 조기 종료됨).
//   · 비페이지 목록(커뮤니티 글·댓글) → 사후 필터. 댓글은 «가림»(maskBlockedComments) — 부모 댓글을 지우면 타인 답글까지 사라지기 때문.
import { supabase } from '../supabaseClient'

export const blockedUsersKey = (userId) => ['blocked-users', userId]

// ─── 모듈 캐시 — 세션당 한 번 받아 두고, 차단/해제 시 세대(gen)를 올려 무효화 ───
const TTL_MS = 60 * 1000
let _cache = { uid: null, set: new Set(), at: 0 }
let _inflight = null       // { uid, gen, promise }
let _gen = 0

export function invalidateBlockedCache() { _gen += 1; _cache = { ..._cache, at: 0 }; _inflight = null }

async function currentUid() {
  try { const { data } = await supabase.auth.getSession(); return data?.session?.user?.id ?? null } catch { return null }
}

// 현재 로그인 사용자의 차단 집합(Set<userId>).
//   실패 시: 같은 사용자의 «직전 집합»을 그대로 쓰고 at=0 으로 두어 다음 호출에 재시도(빈 집합으로 60초 캐시하지 않는다).
//   세대 레이스: 차단 전에 시작된 조회가 차단 후 조회보다 늦게 끝나도, 세대가 다르면 캐시를 덮지 않는다.
export async function getBlockedIdSet() {
  const uid = await currentUid()
  if (!uid) return new Set()
  if (_cache.uid === uid && Date.now() - _cache.at < TTL_MS) return _cache.set
  if (_inflight && _inflight.uid === uid && _inflight.gen === _gen) return _inflight.promise
  const gen = _gen
  const prev = _cache.uid === uid ? _cache.set : new Set()
  const promise = (async () => {
    try {
      const { data, error } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', uid)
      if (error) throw error
      const set = new Set((data || []).map((r) => r.blocked_id))
      if (gen === _gen) _cache = { uid, set, at: Date.now() }
      return set
    } catch {
      if (gen === _gen) _cache = { uid, set: prev, at: 0 }
      return prev
    } finally {
      if (_inflight && _inflight.gen === gen) _inflight = null
    }
  })()
  _inflight = { uid, gen, promise }
  return promise
}

// PostgREST 필터용 "(id1,id2)" 문자열. 비어 있으면 null.
export async function blockedInList() {
  const set = await getBlockedIdSet()
  return set.size ? `(${[...set].join(',')})` : null
}

// rows 에서 차단한 사용자의 행 제거(비페이지 목록용). pick = 행 → 작성자 id
export async function excludeBlocked(rows, pick) {
  if (!rows || rows.length === 0) return rows
  const set = await getBlockedIdSet()
  if (set.size === 0) return rows
  return rows.filter((r) => !set.has(pick(r)))
}

// 댓글 목록 «가림»: 차단 사용자의 답글은 제거, 최상위 댓글은 «남은 답글이 있으면» 자리표시자로 남긴다
//   ({ blocked: true, content: '', user: null }) — 그래야 그 아래 타인 답글이 사라지지 않는다.
export async function maskBlockedComments(list) {
  if (!list || list.length === 0) return list
  const set = await getBlockedIdSet()
  if (set.size === 0) return list
  const kept = list.filter((c) => !(c.parent_id && set.has(c.user_id)))          // 차단 사용자의 답글 제거
  const hasVisibleReply = new Set(kept.filter((c) => c.parent_id).map((c) => c.parent_id))
  return kept
    .filter((c) => c.parent_id || !set.has(c.user_id) || hasVisibleReply.has(c.id))
    .map((c) => (!c.parent_id && set.has(c.user_id)) ? { ...c, blocked: true, content: '', user: null } : c)
}

// ─── 차단 목록 화면용(계정 설정) ───
export async function fetchBlockedUsers(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id, created_at, user:users!blocked_id(id, nickname, avatar_path)')
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function blockUser(userId, targetId) {
  if (!userId || !targetId) throw new Error('로그인이 필요해요')
  if (userId === targetId) throw new Error('본인은 차단할 수 없어요')
  const { error } = await supabase.from('blocked_users').upsert({ blocker_id: userId, blocked_id: targetId }, { onConflict: 'blocker_id,blocked_id' })
  if (error) throw error
  invalidateBlockedCache()
}

export async function unblockUser(userId, targetId) {
  if (!userId || !targetId) throw new Error('로그인이 필요해요')
  const { error } = await supabase.from('blocked_users').delete().eq('blocker_id', userId).eq('blocked_id', targetId)
  if (error) throw error
  invalidateBlockedCache()
}

// 차단/해제 후 다시 그려야 하는 목록들 — 호출 측에서 queryClient.invalidateQueries 로 사용
export const BLOCK_AFFECTED_QUERY_PREFIXES = [['feed'], ['post-comments'], ['community-posts'], ['community-post-social'], ['notifications'], ['blocked-users']]
