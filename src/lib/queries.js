// React Query 키 + 쿼리 함수 모음
// 본인이 인증 등으로 데이터를 바꾸면 invalidateQueries(queryKeys.xxx) 한 줄로 모든 화면 갱신.
//
// 키 설계 원칙:
//   - 계층형 ['domain', 'subdomain', ...params]
//   - 같은 prefix 면 invalidate 시 한꺼번에 무효화 가능 (예: ['programs'] 무효화 → 모든 program 관련 캐시 갱신)
//   - userId 가 필요한 키는 항상 user 인자 포함 — 로그인 다른 계정이면 캐시 자동 분리
import { supabase } from '../supabaseClient'

export const queryKeys = {
  // 본인이 만든 프로그램 (대시보드 "내 프로그램" 섹션)
  myPrograms: (userId) => ['programs', 'mine', userId],
  // 본인이 참여 중인 프로그램 (대시보드 "참여 중" / 랭킹 / 오늘의 미션 기준)
  activePrograms: (userId) => ['programs', 'active', userId],
  // 공개 프로그램 (둘러보기) — 대시보드는 본인 것 제외, 프로그램 탭은 전체. excludeUserId 로 캐시 분리.
  publicPrograms: (excludeUserId) => ['programs', 'public', excludeUserId || 'all'],
  // 특정 프로그램 상세
  program: (programId) => ['programs', 'detail', programId],
  // 특정 프로그램의 미션 목록
  programMissions: (programId) => ['missions', 'byProgram', programId],
  // 특정 미션 상세 (인증 페이지)
  mission: (missionId) => ['missions', 'detail', missionId],
  // 본인 ACTIVE 참여 모든 프로그램의 오늘 활성 미션 통합 (대시보드 "오늘의 미션")
  todayMissions: (userId) => ['missions', 'today', userId],
  // 본인의 누적 점수 (모든 프로그램 합산)
  totalPoints: (userId) => ['scores', 'total', userId],
  // 본인의 프로그램별 점수 (오늘/누적)
  programScores: (programId, userId) => ['scores', 'byProgram', programId, userId],
  // 본인의 KST 오늘 미션별 인증 횟수
  todayCounts: (userId) => ['verifications', 'todayCounts', userId],
  // 특정 프로그램의 랭킹
  programRanking: (programId) => ['rankings', 'byProgram', programId],
  // 운영자 PENDING_REVIEW 목록
  pendingReviews: (programId) => ['verifications', 'pending', programId],
}

// ─── 쿼리 함수들 ─────────────────────────────────────────────

// KST 'YYYY-MM-DD' (Intl 가 timezone 안전)
export const formatKstDate = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

export const fetchMyPrograms = async (userId) => {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export const fetchActivePrograms = async (userId) => {
  const { data, error } = await supabase
    .from('program_participants')
    .select('program_id, programs!inner(*)')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
  if (error) throw error
  return (data || []).map(row => row.programs)
}

export const fetchPublicPrograms = async (excludeUserId) => {
  let query = supabase
    .from('programs')
    .select('*')
    .eq('status', 'PUBLISHED')
    .eq('is_public', true)
  if (excludeUserId) query = query.neq('owner_id', excludeUserId)
  const { data, error } = await query.order('published_at', { ascending: false })
  if (error) throw error
  return data || []
}

export const fetchProgram = async (programId) => {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('id', programId)
    .maybeSingle()
  if (error) throw error
  return data
}

export const fetchMission = async (missionId) => {
  const { data, error } = await supabase
    .from('missions')
    .select('*, programs!inner(id, name, categories)')
    .eq('id', missionId)
    .maybeSingle()
  if (error) throw error
  return data
}

export const fetchProgramMissions = async (programId) => {
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .eq('program_id', programId)
    .order('feature')
  if (error) throw error
  return data || []
}

export const fetchTodayMissions = async (programIds) => {
  if (!programIds || programIds.length === 0) return []
  const nowISO = new Date().toISOString()
  const { data, error } = await supabase
    .from('missions')
    .select('*, programs!inner(id, name, categories)')
    .in('program_id', programIds)
    .lte('active_from', nowISO)
    .gte('active_until', nowISO)
    .order('point', { ascending: false })
  if (error) throw error
  return data || []
}

export const fetchTotalPoints = async (userId) => {
  const { data, error } = await supabase
    .from('score_ledgers')
    .select('point')
    .eq('user_id', userId)
  if (error) throw error
  return (data || []).reduce((sum, row) => sum + row.point, 0)
}

// 프로그램별 본인 점수 (오늘/누적 합산해서 반환)
export const fetchProgramScores = async (programId, userId) => {
  const { data, error } = await supabase
    .from('score_ledgers')
    .select('point, created_at')
    .eq('program_id', programId)
    .eq('user_id', userId)
  if (error) throw error
  const rows = data || []
  const total = rows.reduce((s, r) => s + r.point, 0)
  const todayKst = formatKstDate(new Date())
  const today = rows
    .filter(r => formatKstDate(new Date(r.created_at)) === todayKst)
    .reduce((s, r) => s + r.point, 0)
  return { total, today }
}

// KST 오늘 본인의 mission_id 별 인증 횟수 — { total, pending } 분리 반환
//   total: APPROVED + PENDING_REVIEW 합산 (daily_limit 검사용)
//   pending: PENDING_REVIEW 만 (라벨 분기용 — "심사 대기" vs "완료")
// 운영자가 승인하면 PENDING_REVIEW → APPROVED 로 빠지므로 pending 이 0 이 됨 → 라벨이 "완료"로 전환.
export const fetchTodayCounts = async (userId) => {
  const { data, error } = await supabase
    .from('verifications')
    .select('mission_id, submitted_at, status')
    .eq('user_id', userId)
    .in('status', ['APPROVED', 'PENDING_REVIEW'])
  if (error) throw error
  const todayKst = formatKstDate(new Date())
  const counts = {}
  ;(data || []).forEach(v => {
    if (formatKstDate(new Date(v.submitted_at)) === todayKst) {
      if (!counts[v.mission_id]) counts[v.mission_id] = { total: 0, pending: 0 }
      counts[v.mission_id].total += 1
      if (v.status === 'PENDING_REVIEW') counts[v.mission_id].pending += 1
    }
  })
  return counts
}

export const fetchProgramRanking = async (programId) => {
  const { data, error } = await supabase
    .rpc('get_program_ranking', { p_program_id: programId })
  if (error) throw error
  return data || []
}

export const fetchPendingReviews = async (programId) => {
  const { data, error } = await supabase
    .rpc('get_pending_reviews', { p_program_id: programId })
  if (error) throw error
  return data || []
}
