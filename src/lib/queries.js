// React Query 키 + 쿼리 함수 모음
// 본인이 인증 등으로 데이터를 바꾸면 invalidateQueries(queryKeys.xxx) 한 줄로 모든 화면 갱신.
//
// 키 설계 원칙:
//   - 계층형 ['domain', 'subdomain', ...params]
//   - 같은 prefix 면 invalidate 시 한꺼번에 무효화 가능 (예: ['programs'] 무효화 → 모든 program 관련 캐시 갱신)
//   - userId 가 필요한 키는 항상 user 인자 포함 — 로그인 다른 계정이면 캐시 자동 분리
import { supabase } from '../supabaseClient'
import { getPreset, expandPresetMission } from './programLibrary'

export const queryKeys = {
  // 본인이 만든 프로그램 (대시보드 "내 프로그램" 섹션)
  myPrograms: (userId) => ['programs', 'mine', userId],
  // 본인이 참여 중인 프로그램 (대시보드 "참여 중" / 랭킹 / 오늘의 미션 기준)
  activePrograms: (userId) => ['programs', 'active', userId],
  // 여러 프로그램의 ACTIVE 참여자 수 (Dashboard 카드용) — programIds 정렬 후 키 생성
  activeParticipantCounts: (programIds) => ['programs', 'participant-counts', [...(programIds || [])].sort().join(',')],
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
  // 특정 프로그램의 랭킹 — period: 'all' | '7d' | '30d'
  programRanking: (programId, period = 'all') => ['rankings', 'byProgram', programId, period],
  // 특정 프로그램의 팀 랭킹 (127)
  programTeamRanking: (programId, period = 'all') => ['rankings', 'teamByProgram', programId, period],
  // 본인의 프로그램별 최근 N일 일별 점수 시계열 (스파크라인용)
  myRecentScores: (programId, userId, days = 14) => ['scores', 'recentSeries', programId, userId, days],
  // 어제 vs 현재 등수 비교 (rank_snapshots — 071)
  myRankChange: (programId, userId) => ['rankings', 'myChange', programId, userId],
  // 알림 환경설정 (notification_preferences — 072)
  myNotificationPreferences: (userId) => ['notifications', 'preferences', userId],
  // 운영자 PENDING_REVIEW 목록
  pendingReviews: (programId) => ['verifications', 'pending', programId],
  // 운영자 참여자 통계
  programStats: (programId) => ['stats', 'program', programId],
  // 커뮤니티 피드 — verifications + likes + comments 통합
  feedPosts: (programId) => ['feed', 'posts', programId],
  postComments: (verificationId) => ['post-comments', verificationId],
  // 알림
  notifications: (userId) => ['notifications', 'list', userId],
  notificationsUnread: (userId) => ['notifications', 'unread', userId],
  // 프로그램 퀴즈 목록 (운영자 게시물 관리)
  programQuizzes: (programId) => ['quizzes', 'byProgram', programId],
  // 참가자용 퀴즈 목록 (프로그램 상세 퀴즈 섹션) — 본인 제출 상태 포함
  participantQuizzes: (programId, userId) => ['quizzes', 'participant', programId, userId],
  communityPosts: (programId, boardId) => ['community-posts', programId, boardId || 'all'],
  // 게시판별 검토 대기(pending) 글 수 — 운영자 승인 배지
  communityPending: (programId) => ['community-pending', programId],
  // 커뮤니티 글 1개의 좋아요/댓글 (상세 펼치기) — 105
  communityPostSocial: (postId) => ['community-post-social', postId],
  // 퀴즈 편집용 단건 (운영자) — 문항 정답 포함
  quizEdit: (quizId) => ['quizzes', 'edit', quizId],
  // 퀴즈 상세 (참가자 풀이/결과) — RPC 기반
  quizDetail: (quizId, userId) => ['quizzes', 'detail', quizId, userId],
  // 운영자 퀴즈 결과 (제출 목록 + 답안 + 사용자) — 수동 채점/통계용
  quizResults: (quizId) => ['quizzes', 'results', quizId],
  // 운영자 통계: 프로그램 퀴즈별 요약 (제출 수/평균/정답률/채점 대기)
  programQuizStats: (programId) => ['quizzes', 'stats', programId],
  // 본인 활동 (인증 현황) — 프로그램별
  myActivity: (programId, userId) => ['my-activity', programId, userId],
  // 본인 인증 카드 (한 묶음 내, 페이지네이션)
  myVerificationsByBundle: (programId, userId, bundleParam) =>
    ['my-activity', 'verifications', programId, userId, bundleParam],
  // 본인의 프로그램별 개요 (streak + activeDays + recent — 개요 탭 모의도)
  programOverview: (programId, userId) => ['program-overview', programId, userId],
  // 프로그램 참여 모달용 정보 (운영자 닉네임 + 참여자 수 + 미션 정보)
  programJoinInfo: (programId) => ['program-join-info', programId],
  // 홈 통계 카드 (Day 67 초안) — 참여자 관점 / 운영자 관점
  myParticipantStats: (userId) => ['home-stats', 'participant', userId],
  myOperatorStats: (userId, programIds) =>
    ['home-stats', 'operator', userId, [...(programIds || [])].sort().join(',')],
  // 홈 「오늘의 활동 요약」 (Day 68)
  myTodayActivity: (userId) => ['home-stats', 'today-activity', userId],
  // 대시보드 운영중 프로그램 카드 — 오늘 참여율 + 누적 인증
  programOperatorPulse: (programId) => ['home-stats', 'op-pulse', programId],
}

// 이번 주 시작(월요일 00:00 KST)의 절대 시점 — 통계 "이번 주" 경계용.
//   KST 는 DST 없음 → 일 단위 빼기 안전.
const kstWeekStart = () => {
  const now = new Date()
  const todayKst = formatKstDate(now)
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(now)
  const order = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const offset = order[wd] ?? 0
  const monday = new Date(`${todayKst}T00:00:00+09:00`)
  monday.setTime(monday.getTime() - offset * 24 * 60 * 60 * 1000)
  return monday
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
    .order('updated_at', { ascending: false })   // 최근 수정순 (098 트리거)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// 베타 한도용 — 본인 소유의 운영 중(PUBLISHED) 프로그램 수.
//   DRAFT(작성 중)·ENDED(종료)·ARCHIVED(숨김)는 제외 → 종료/삭제 시 슬롯 회수.
export const fetchMyLiveProgramCount = async (userId) => {
  const { count, error } = await supabase
    .from('programs')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('status', 'PUBLISHED')
  if (error) throw error
  return count || 0
}

export const fetchActivePrograms = async (userId) => {
  const { data, error } = await supabase
    .from('program_participants')
    .select('program_id, joined_at, programs!inner(*)')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
  if (error) throw error
  // 가입 시각(_joinedAt) 첨부 — "최근 참여 프로그램" 정렬용. 다른 소비자는 무시.
  return (data || []).map(row => ({ ...row.programs, _joinedAt: row.joined_at }))
}

// 본인의 프로그램별 마지막 인증 시각 맵 { program_id: ISO } — "최근 인증순" 정렬용.
//   verifications 에 program_id 가 없어 missions 조인으로 program_id 획득.
// 프로그램별 마지막 활동 시각 — 인증 + 게시물 작성 + 댓글 작성 중 가장 최근.
//   { program_id: ISO timestamp }. (각 소스 RLS 로 본인 것만 조회됨)
export const fetchProgramLastActivity = async (userId) => {
  const [vRes, pRes, cRes] = await Promise.all([
    supabase.from('verifications').select('submitted_at, missions!inner(program_id)').eq('user_id', userId),
    supabase.from('community_posts').select('created_at, program_id').eq('author_id', userId),
    supabase.from('community_post_comments').select('created_at, community_posts!inner(program_id)').eq('user_id', userId),
  ])
  const map = {}
  const put = (pid, ts) => {
    if (!pid || !ts) return
    if (!map[pid] || new Date(ts).getTime() > new Date(map[pid]).getTime()) map[pid] = ts
  }
  for (const r of (vRes.data || [])) put(r.missions?.program_id, r.submitted_at)
  for (const r of (pRes.data || [])) put(r.program_id, r.created_at)
  for (const r of (cRes.data || [])) put(r.community_posts?.program_id, r.created_at)
  return map
}

// 여러 프로그램의 ACTIVE 참여자 수 — SECURITY DEFINER RPC(082)로 한 번에.
//   직접 COUNT 는 RLS(015) 때문에 본인 소유/참여 외 프로그램은 0~1 로 잘못 나옴 → RPC 로 정확 집계.
//   N+1 도 제거(프로그램 N개 → 1쿼리).
export const fetchActiveParticipantCounts = async (programIds) => {
  if (!programIds || programIds.length === 0) return {}
  const { data, error } = await supabase.rpc('get_active_participant_counts', {
    p_program_ids: programIds,
  })
  if (error) throw error
  const map = {}
  for (const row of (data || [])) map[row.program_id] = row.participant_count
  // 0명 프로그램은 RPC 결과에 없음 → 0 보정
  for (const id of programIds) if (map[id] == null) map[id] = 0
  return map
}

// 홈 통계 — 참여자 관점 (Day 67 초안)
//   이번주 인증 횟수 / 연속 인증 일수(전 프로그램 통합) / 누적 포인트 / 이번주 포인트
export const fetchMyParticipantStats = async (userId) => {
  const [verifRes, ledgerRes] = await Promise.all([
    supabase.from('verifications').select('submitted_at').eq('user_id', userId).eq('status', 'APPROVED'),
    supabase.from('score_ledgers').select('point, created_at').eq('user_id', userId),
  ])
  if (verifRes.error) throw verifRes.error
  if (ledgerRes.error) throw ledgerRes.error

  const verifs = verifRes.data || []
  const ledgers = ledgerRes.data || []
  const weekStart = kstWeekStart()

  // 이번주 인증
  const weekVerifs = verifs.filter(v => new Date(v.submitted_at) >= weekStart).length

  // 연속 인증 일수 — 오늘(없으면 어제)부터 거꾸로 KST 일자 연속 카운트
  const approvedDates = new Set(verifs.map(v => formatKstDate(new Date(v.submitted_at))))
  const todayKst = formatKstDate(new Date())
  const cursor = new Date(`${todayKst}T00:00:00+09:00`)
  if (!approvedDates.has(todayKst)) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  for (let i = 0; i < 400; i++) {
    if (approvedDates.has(formatKstDate(cursor))) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else break
  }

  // 포인트
  const totalPoints = ledgers.reduce((s, r) => s + (r.point || 0), 0)
  const weekPoints = ledgers
    .filter(r => new Date(r.created_at) >= weekStart)
    .reduce((s, r) => s + (r.point || 0), 0)

  return { weekVerifs, streak, totalPoints, weekPoints }
}

// 홈 통계 — 운영자 관점 (Day 67 초안)
//   총 참여자수(내 모든 프로그램 합) / 이번주 인증률(이번주 인증한 참여자 ÷ 총 참여자)
export const fetchMyOperatorStats = async (userId, programIds) => {
  if (!programIds || programIds.length === 0) return { totalParticipants: 0, weekVerifyRate: 0 }
  const weekStart = kstWeekStart()

  const counts = await fetchActiveParticipantCounts(programIds)
  const totalParticipants = Object.values(counts).reduce((s, c) => s + (c || 0), 0)

  const { data: verifs, error } = await supabase
    .from('verifications')
    .select('user_id, missions!inner(program_id)')
    .in('missions.program_id', programIds)
    .eq('status', 'APPROVED')
    .gte('submitted_at', weekStart.toISOString())
  if (error) throw error

  const activeUsersThisWeek = new Set((verifs || []).map(v => v.user_id)).size
  const weekVerifyRate = totalParticipants > 0
    ? Math.round((activeUsersThisWeek / totalParticipants) * 100)
    : 0

  return { totalParticipants, weekVerifyRate }
}

// 대시보드 운영중 프로그램 카드 지표 — 한 프로그램의 오늘 참여(고유 인증자) + 누적 인증 수.
//   todayActiveUsers: 오늘(KST) 인증한 고유 참여자 수 → 컴포넌트에서 참여자수로 나눠 '오늘 참여율'
//   totalVerifs: APPROVED + PENDING_REVIEW 누적 인증 건수
//   (참여자 수백↑ 되면 서버측 집계로 전환 — 현재는 단일 쿼리 클라 집계)
export const fetchProgramOperatorPulse = async (programId) => {
  if (!programId) return { todayActiveUsers: 0, totalVerifs: 0 }
  const { data, error } = await supabase
    .from('verifications')
    .select('user_id, submitted_at, missions!inner(program_id)')
    .eq('missions.program_id', programId)
    .in('status', ['APPROVED', 'PENDING_REVIEW'])
  if (error) throw error
  const rows = data || []
  const todayKst = formatKstDate(new Date())
  const todayUsers = new Set()
  for (const r of rows) {
    if (formatKstDate(new Date(r.submitted_at)) === todayKst) todayUsers.add(r.user_id)
  }
  return { todayActiveUsers: todayUsers.size, totalVerifs: rows.length }
}

// 홈 「오늘의 활동 요약」 (Day 68) — 오늘(KST) 기준
//   미션 완료(APPROVED+PENDING 인증 수) / 기록 작성(numeric|note 있는 인증) / 댓글 활동 / 획득 점수
export const fetchMyTodayActivity = async (userId) => {
  const todayKst = formatKstDate(new Date())
  const startISO = new Date(`${todayKst}T00:00:00+09:00`).toISOString()
  const [vRes, cRes, lRes] = await Promise.all([
    supabase.from('verifications')
      .select('id, numeric_value, note, status')
      .eq('user_id', userId)
      .gte('submitted_at', startISO),
    supabase.from('post_comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startISO),
    supabase.from('score_ledgers')
      .select('point')
      .eq('user_id', userId)
      .gte('created_at', startISO),
  ])
  if (vRes.error) throw vRes.error
  if (lRes.error) throw lRes.error

  const verifs = (vRes.data || []).filter(v => v.status === 'APPROVED' || v.status === 'PENDING_REVIEW')
  const missionCount = verifs.length
  const recordCount = verifs.filter(v => v.numeric_value != null || (v.note && v.note.trim())).length
  const commentCount = cRes.count || 0
  const points = (lRes.data || []).reduce((s, r) => s + (r.point || 0), 0)
  return { missionCount, recordCount, commentCount, points }
}

export const fetchPublicPrograms = async (excludeUserId) => {
  // KST 오늘 (YYYY-MM-DD) — 종료된 프로그램 필터용
  const todayKst = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

  let query = supabase
    .from('programs')
    .select('*')
    .eq('status', 'PUBLISHED')
    .eq('is_public', true)
    // Day 65 — 종료된 프로그램은 둘러보기에서 제외.
    // end_date 없으면 (상시) 노출, end_date 가 오늘 이전이면 숨김.
    // 본인이 만든 프로그램은 「내 프로그램」, 참여한 프로그램은 「참여 중인 프로그램」 에서 보임.
    .or(`end_date.is.null,end_date.gte.${todayKst}`)
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
    .select('*, programs!inner(id, name, categories, feed_enabled, owner_id, community_settings, theme, ranking_enabled)')
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

// 본인 프로그램 개요 (Day 65 본인 결정 — 「개요」 탭 모의도)
// 한 번의 fetch 로 3가지 지표 반환:
//   1) streak: 연속 인증 일수
//        - 오늘 인증 있음 → 오늘부터 거꾸로 카운트
//        - 오늘 미인증 → 어제부터 시작 (오늘 끊김으로 0 처리 X)
//   2) activeDays: 최근 60일 내 인증한 고유 일수 (참여율 계산용)
//   3) recent: 최근 5개 APPROVED 인증 카드 (mission title + note + point + date)
// 범위 60일 — 베타 프로그램 대부분 30일 미만이라 충분.
export const fetchProgramOverview = async (programId, userId) => {
  // Day 65: 60일 제한 제거 — 누적 보너스 (50/100), 정원 단계, 도감 정확성 위해
  // 프로그램 시작부터 모든 인증을 가져옴 (program_id 필터로 다른 프로그램 섞임 방지).
  // streak 계산은 자연스럽게 끊기는 지점이 있어 60일 데이터 부족해도 무방.
  const { data, error } = await supabase
    .from('verifications')
    .select('id, submitted_at, note, numeric_value, missions!inner(title, point, program_id, bundle_title)')
    .eq('user_id', userId)
    .eq('status', 'APPROVED')
    .eq('missions.program_id', programId)
    .order('submitted_at', { ascending: false })
  if (error) throw error

  const rows = data || []

  // 1) streak 계산
  const approvedDates = new Set(rows.map(v => formatKstDate(new Date(v.submitted_at))))
  const todayKst = formatKstDate(new Date())
  const hasToday = approvedDates.has(todayKst)

  let cursor = new Date(`${todayKst}T00:00:00+09:00`)
  if (!hasToday) cursor.setDate(cursor.getDate() - 1)

  let streak = 0
  for (let i = 0; i < 60; i++) {
    const dateStr = formatKstDate(cursor)
    if (approvedDates.has(dateStr)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }

  // 1-1) maxStreak — 전체 기간 최장 연속 일수 (달리기 「최고 기록」)
  let maxStreak = 0
  {
    const sortedDs = [...approvedDates].sort() // 'YYYY-MM-DD' = 사전식 = 시간순
    let run = 0
    let prevDs = null
    for (const ds of sortedDs) {
      if (prevDs) {
        const diff = Math.round((new Date(`${ds}T00:00:00+09:00`) - new Date(`${prevDs}T00:00:00+09:00`)) / 86400000)
        run = diff === 1 ? run + 1 : 1
      } else {
        run = 1
      }
      if (run > maxStreak) maxStreak = run
      prevDs = ds
    }
  }

  // 2) activeDays (60일 내 고유 일수)
  const activeDays = approvedDates.size

  // 3) recent (최근 5개)
  const recent = rows.slice(0, 5).map(v => ({
    id: v.id,
    submitted_at: v.submitted_at,
    title: v.missions?.title || '(삭제된 미션)',
    bundle_title: v.missions?.bundle_title || null,
    note: v.note,
    numeric_value: v.numeric_value,
    point: v.missions?.point || 0,
  }))

  // 4) totalCount (60일 내 APPROVED 인증 총 횟수) — 게이미피케이션 「물」
  const totalCount = rows.length

  // 5) weekDays — 이번 주(월~일) 요일별 인증 여부 (달리기 「주간 스트릭」). 오늘 이후는 미달성.
  const weekLabels = ['월', '화', '수', '목', '금', '토', '일']
  const base = new Date(`${todayKst}T00:00:00+09:00`)
  const dow = (base.getDay() + 6) % 7 // 월=0 … 일=6
  const monday = new Date(base)
  monday.setDate(base.getDate() - dow)
  const weekDays = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const ds = formatKstDate(d)
    weekDays.push({ label: weekLabels[i], done: ds <= todayKst && approvedDates.has(ds), today: ds === todayKst })
  }

  return { streak, maxStreak, hasToday, activeDays, recent, totalCount, weekDays }
}

// 프로그램 참여 모달용 정보 (Day 65 본인 결정 — UX 강화)
//   - 운영자 닉네임 (신뢰성)
//   - ACTIVE 참여자 수 (사회적 증거)
//   - 미션 개수 + 일일 최대 획득 점수 (점수 구조 미리보기)
// RLS: 모두 PUBLISHED + is_public 또는 운영자/참여자에게 SELECT 허용된 데이터 위주
export const fetchProgramJoinInfo = async (programId) => {
  const [ownerRes, countRes, missionsRes] = await Promise.all([
    supabase
      .from('programs')
      .select('users:owner_id (nickname, avatar_path)')
      .eq('id', programId)
      .maybeSingle(),
    // 참여자 수 — RPC(082)로 RLS 우회 (남의 프로그램도 정확). 직접 COUNT 는 RLS 로 0~1 오집계.
    supabase.rpc('get_active_participant_counts', { p_program_ids: [programId] }),
    supabase
      .from('missions')
      .select('id, point, daily_limit')
      .eq('program_id', programId),
  ])

  if (ownerRes.error) console.warn('[fetchProgramJoinInfo] owner:', ownerRes.error.message)
  if (countRes.error) console.warn('[fetchProgramJoinInfo] count:', countRes.error.message)
  if (missionsRes.error) console.warn('[fetchProgramJoinInfo] missions:', missionsRes.error.message)

  const missions = missionsRes.data || []
  const dailyMaxScore = missions.reduce(
    (sum, m) => sum + (m.point || 0) * (m.daily_limit || 1),
    0
  )

  return {
    ownerNickname: ownerRes.data?.users?.nickname || null,
    ownerAvatarPath: ownerRes.data?.users?.avatar_path || null,
    participantCount: countRes.data?.[0]?.participant_count || 0,
    missionCount: missions.length,
    dailyMaxScore,
  }
}

// 랭킹 — periodStart 가 null 이면 전체, ISO 문자열이면 그 시점부터 집계
// period('all' | '7d' | '30d') 를 ISO 시작점으로 변환하는 헬퍼는 페이지에서 사용
export const fetchProgramRanking = async (programId, periodStart = null) => {
  const { data, error } = await supabase
    .rpc('get_program_ranking', {
      p_program_id: programId,
      p_period_start: periodStart,
    })
  if (error) throw error
  return data || []
}

// 팀 랭킹 (127) — 팀원 개인 점수 라이브 집계. 합계·인당 평균·인원·멤버목록 + 활성/순위.
// 비활성(모집중) 팀은 rank=null 로 함께 반환(목록 하단에 별도 표시).
export const fetchProgramTeamRanking = async (programId, periodStart = null) => {
  const { data, error } = await supabase
    .rpc('get_team_ranking', {
      p_program_id: programId,
      p_period_start: periodStart,
    })
  if (error) throw error
  return data || []
}

// 팀 생성 (128) — 원자적 RPC. 팀장 자동 합류. 반환: 새 team_id.
// 규칙 위반(이미 팀 소속, 정원 범위 등)은 RPC가 한글 메시지로 throw.
export const createTeam = async (programId, name, emoji, capacity) => {
  const { data, error } = await supabase
    .rpc('create_team', {
      p_program_id: programId,
      p_name: name,
      p_emoji: emoji,
      p_capacity: capacity,
    })
  if (error) throw error
  return data // team_id
}

// 팀 초대 발송 (129) — 팀장이 참여자 초대. 반환: invite_id.
export const inviteToTeam = async (teamId, inviteeId) => {
  const { data, error } = await supabase
    .rpc('invite_to_team', { p_team_id: teamId, p_invitee_id: inviteeId })
  if (error) throw error
  return data
}

// 팀 초대 응답 (129) — 받은 사람이 수락(true)/거절(false).
export const respondTeamInvite = async (inviteId, accept) => {
  const { error } = await supabase
    .rpc('respond_team_invite', { p_invite_id: inviteId, p_accept: accept })
  if (error) throw error
}

// 초대 후보 목록 (129) — 팀장 전용. 미소속 ACTIVE 참여자 + invited 플래그.
export const fetchTeamInviteCandidates = async (teamId) => {
  const { data, error } = await supabase
    .rpc('get_team_invite_candidates', { p_team_id: teamId })
  if (error) throw error
  return data || []
}

// ─── 전역 문의 게시판 (134) ──────────────────────────────────
// 문의 작성 — 비번은 RPC가 서버측 해싱. 반환: inquiry id.
export const createInquiry = async (title, body, isPrivate, password) => {
  const { data, error } = await supabase.rpc('create_inquiry', {
    p_title: title, p_body: body, p_is_private: isPrivate, p_password: password,
  })
  if (error) throw error
  return data
}

// 문의 목록 — RLS 가 가시성 처리(공개=모두 / 비공개=작성자·관리자).
export const fetchInquiries = async () => {
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, title, is_private, status, created_at, author_id, users(nickname)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// 문의 단건
export const fetchInquiry = async (id) => {
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, title, body, is_private, status, created_at, author_id, users(nickname)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// 문의 댓글 스레드
export const fetchInquiryComments = async (inquiryId) => {
  const { data, error } = await supabase
    .from('inquiry_comments')
    .select('id, body, is_admin, created_at, user_id, users(nickname, avatar_path)')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// 댓글 작성 — is_admin/상태/알림은 트리거가 처리.
export const addInquiryComment = async (inquiryId, userId, body) => {
  const { error } = await supabase
    .from('inquiry_comments')
    .insert({ inquiry_id: inquiryId, user_id: userId, body })
  if (error) throw error
}

// 비공개 문의 비번 확인 (관리자는 통과).
export const checkInquiryPassword = async (id, password) => {
  const { data, error } = await supabase.rpc('check_inquiry_password', { p_id: id, p_password: password })
  if (error) throw error
  return data === true
}

// 문의 삭제 (작성자/관리자)
export const deleteInquiry = async (id) => {
  const { error } = await supabase.from('inquiries').delete().eq('id', id)
  if (error) throw error
}

// 현재 사용자 role (ADMIN 여부 판별)
export const fetchMyRole = async (userId) => {
  const { data, error } = await supabase.from('users').select('role').eq('id', userId).maybeSingle()
  if (error) throw error
  return data?.role || 'USER'
}

// 팀원 내보내기 (130) — 팀장만.
export const removeTeamMember = async (teamId, userId) => {
  const { error } = await supabase
    .rpc('remove_team_member', { p_team_id: teamId, p_user_id: userId })
  if (error) throw error
}

// 팀 나가기 (130) — 본인 탈퇴. 팀장이면 자동 승계 또는 해체.
export const leaveTeam = async (teamId) => {
  const { error } = await supabase.rpc('leave_team', { p_team_id: teamId })
  if (error) throw error
}

// 팀장 위임 (130) — 현재 팀원에게.
export const transferTeamLeader = async (teamId, newLeaderId) => {
  const { error } = await supabase
    .rpc('transfer_team_leader', { p_team_id: teamId, p_new_leader_id: newLeaderId })
  if (error) throw error
}

// 내가 받은 pending 팀 초대 (특정 프로그램). teams inner join 으로 프로그램 필터.
export const fetchMyTeamInvites = async (programId, userId) => {
  const { data, error } = await supabase
    .from('team_invites')
    .select('id, team_id, created_at, teams!inner(name, emoji, program_id)')
    .eq('invitee_id', userId)
    .eq('status', 'pending')
    .eq('teams.program_id', programId)
  if (error) throw error
  return data || []
}

// 본인 N일 일별 점수 시계열 — RLS 본인 SELECT 허용 (019) 이라 직접 fetch
// 반환: [{ date: 'YYYY-MM-DD' (KST), point: number }] (오늘 포함 오래된→최근 순)
// 빈 날도 point:0 으로 채워서 sparkline 이 끊기지 않게 함.
// 알림 환경설정 — 072 notification_preferences
// 본인 row 없으면 기본값(모두 ON)으로 자동 생성 후 반환.
export const fetchMyNotificationPreferences = async () => {
  const { data, error } = await supabase.rpc('get_or_create_my_notification_preferences')
  if (error) throw error
  return data
}

// 알림 type → preference 컬럼 매핑 (072 트리거와 동일)
const NOTIF_PREF_COLUMN = {
  POST_LIKE: 'like_enabled',
  POST_COMMENT: 'comment_enabled',
  REVIEW_APPROVED: 'verify_enabled',
  REVIEW_REJECTED: 'verify_enabled',
  VERIFICATION_SUBMITTED: 'verify_enabled',
  PARTICIPANT_JOINED: 'request_enabled',
}

// 현재 사용자가 OFF 한 알림 type 목록 — 조회·카운트에서 제외용.
// 트리거(072)는 생성 시점만 막으므로, 끄기 이전 알림이나 트리거 미적용 환경에서도
// "설정 OFF → 화면·배지에서 즉시 사라짐" 을 보장하려고 조회 시점에 한 번 더 필터.
// preferences 조회 실패/없음 → 빈 배열(전부 표시) 로 안전 동작.
const fetchDisabledNotificationTypes = async () => {
  const { data, error } = await supabase.rpc('get_or_create_my_notification_preferences')
  if (error || !data) return []
  return Object.entries(NOTIF_PREF_COLUMN)
    .filter(([, col]) => data[col] === false)
    .map(([type]) => type)
}

// 알림 환경설정 갱신 — UPDATE 본인 row (RLS 로 본인만 가능)
export const updateMyNotificationPreferences = async (patch) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증 필요')
  const { data, error } = await supabase
    .from('notification_preferences')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) throw error
  return data
}

// 회원 탈퇴 — 073 delete_my_account RPC
// auth.users DELETE → public.users 등 모든 관련 데이터 CASCADE 삭제.
export const deleteMyAccount = async () => {
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw error
}

// 어제 vs 현재 등수 비교 — rank_snapshots (071)
// 반환: { yesterday_rank, current_rank, rank_change } | null
//   rank_change 양수 = 상승 (어제 5등 → 오늘 3등 이면 +2)
//   0 = 변동 없음, 음수 = 하락, NULL = 어제 데이터 없음 (신규)
export const fetchMyRankChange = async (programId) => {
  if (!programId) return null
  const { data, error } = await supabase
    .rpc('get_my_rank_change', { p_program_id: programId })
  if (error) {
    console.error('get_my_rank_change RPC 실패:', error)
    return null
  }
  return Array.isArray(data) ? (data[0] || null) : data
}

export const fetchMyRecentScoreSeries = async (programId, userId, days = 14) => {
  // 14일 전 + 안전 마진 1일 = 15일 전부터 fetch (KST↔UTC 경계 안전)
  const startUtc = new Date()
  startUtc.setDate(startUtc.getDate() - days)

  const { data, error } = await supabase
    .from('score_ledgers')
    .select('point, created_at')
    .eq('program_id', programId)
    .eq('user_id', userId)
    .gte('created_at', startUtc.toISOString())
  if (error) throw error

  // KST 일자별 합산
  const byDate = {}
  for (const row of data || []) {
    const key = formatKstDate(new Date(row.created_at))
    byDate[key] = (byDate[key] || 0) + row.point
  }

  // 오래된→최근 순으로 days 일 채우기
  const series = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = formatKstDate(d)
    series.push({ date: key, point: byDate[key] || 0 })
  }
  return series
}

// 프로그램 퀴즈 목록 (운영자용) — 문제 수 + 제출 수 집계 포함
//   quiz_questions / quiz_submissions count 는 owner RLS 로 허용됨
export const fetchProgramQuizzes = async (programId) => {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*, quiz_questions(point, type), quiz_submissions(count)')
    .eq('program_id', programId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(q => {
    const qs = q.quiz_questions || []
    return {
      ...q,
      questionCount: qs.length,
      totalPoint: qs.reduce((s, r) => s + (r.point || 0), 0),
      typeBreakdown: qs.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc }, {}),
      submissionCount: q.quiz_submissions?.[0]?.count || 0,
    }
  })
}

// 편집용 퀴즈 단건 — 운영자 RLS 로 문항(정답 포함) + 제출 수까지 조회.
//   QuizCreatePage 편집 모드에서 prefill. submissionCount>0 이면 문항 잠금(응답 보존).
export const fetchQuizForEdit = async (quizId) => {
  const { data: quiz, error: qErr } = await supabase
    .from('quizzes')
    .select('*, quiz_submissions(count)')
    .eq('id', quizId)
    .maybeSingle()
  if (qErr) throw qErr
  if (!quiz) return null
  const { data: questions, error: qqErr } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('order_index')
  if (qqErr) throw qqErr
  return {
    quiz,
    questions: questions || [],
    submissionCount: quiz.quiz_submissions?.[0]?.count || 0,
  }
}

// 퀴즈 복제 — 원본 퀴즈 + 문항을 그대로 복사한 새 퀴즈 생성.
//   일정(start_at/due_at)은 비워 새로 잡도록 함. 제목 뒤 "(복사)".
export const duplicateQuiz = async ({ quizId, programId, userId }) => {
  const src = await fetchQuizForEdit(quizId)
  if (!src) throw new Error('원본 퀴즈를 찾을 수 없어요')
  const { quiz, questions } = src
  const { data: newQuiz, error } = await supabase
    .from('quizzes')
    .insert({
      program_id: programId,
      title: `${quiz.title} (복사)`.slice(0, 60),
      description: quiz.description,
      start_at: null,
      due_at: null,
      reveal_answers: quiz.reveal_answers,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  if (questions.length) {
    const rows = questions.map((q, idx) => ({
      quiz_id: newQuiz.id,
      type: q.type,
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      point: q.point,
      award_mode: q.award_mode,
      grading_mode: q.grading_mode,
      explanation: q.explanation,
      order_index: idx,
    }))
    const { error: qqErr } = await supabase.from('quiz_questions').insert(rows)
    if (qqErr) {
      await supabase.from('quizzes').delete().eq('id', newQuiz.id)  // 롤백
      throw qqErr
    }
  }
  return newQuiz
}

// 참가자용 퀴즈 목록 — quizzes(RLS: 참여자 SELECT 허용) + 본인 제출 상태
//   quiz_submissions 는 RLS 로 본인 것만 조인됨 → mySubmission 으로 풀이 여부 판단
export const fetchParticipantQuizzes = async (programId) => {
  const { data, error } = await supabase
    .from('quizzes')
    .select('id, title, description, start_at, due_at, reveal_answers, created_at, quiz_submissions(id, total_score, status)')
    .eq('program_id', programId)
    .order('created_at', { ascending: false })
  if (error) throw error
  // 문항 수·총점·유형은 RLS 로 참여자가 직접 못 읽어 RPC(150)로 집계만 받아 병합 (정답 비노출)
  const metaMap = {}
  try {
    const { data: meta } = await supabase.rpc('get_program_quiz_meta', { p_program_id: programId })
    for (const m of meta || []) metaMap[m.quiz_id] = m
  } catch { /* RPC 미적용(마이그 150 전) — 0 으로 폴백 */ }
  return (data || []).map(q => {
    const m = metaMap[q.id]
    return {
      ...q,
      mySubmission: q.quiz_submissions?.[0] || null,
      questionCount: m?.question_count || 0,
      totalPoint: m?.total_point || 0,
      typeBreakdown: m?.type_counts || {},
    }
  })
}

// ─── 커뮤니티 게시판 글 (096) ─────────────────────────────
// 게시판 글 목록 — boardId 없거나 'all' 이면 전체. 작성자 정보 조인.
export const fetchCommunityPosts = async (programId, boardId) => {
  let q = supabase
    .from('community_posts')
    .select('*, author:users(id, nickname, avatar_path)')
    .eq('program_id', programId)
    .order('pinned_at', { ascending: false, nullsFirst: false })  // 고정 글 먼저 (104)
    .order('created_at', { ascending: false })
  if (boardId && boardId !== 'all') q = q.eq('board_id', boardId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export const createCommunityPost = async ({ programId, boardId, title, body, imagePath }) => {
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id
  const { data, error } = await supabase
    .from('community_posts')
    .insert({ program_id: programId, board_id: boardId, author_id: uid, title: title || null, body, image_path: imagePath || null })
    .select()
    .single()
  if (error) throw error
  return data  // status 는 트리거가 결정 (approval→pending)
}

export const updateCommunityPost = async ({ id, boardId, title, body, imagePath }) => {
  const patch = { title: title || null, body, image_path: imagePath ?? null }
  if (boardId) patch.board_id = boardId
  const { data, error } = await supabase.from('community_posts').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export const deleteCommunityPost = async (id) => {
  const { error } = await supabase.from('community_posts').delete().eq('id', id)
  if (error) throw error
}

// 글 상단 고정/해제 (104) — 운영자만 (DB 트리거가 owner 외 변경을 무효화).
//   같은 게시판 단일 고정: 새로 고정하면 기존 고정 글은 자동 해제.
export const setCommunityPostPin = async ({ id, pinned, programId, boardId }) => {
  if (pinned) {
    // 같은 게시판의 다른 고정 글 먼저 해제 (한 게시판에 1개만 고정)
    if (programId && boardId) {
      const { error: clearErr } = await supabase
        .from('community_posts')
        .update({ pinned_at: null })
        .eq('program_id', programId)
        .eq('board_id', boardId)
        .neq('id', id)
        .not('pinned_at', 'is', null)
      if (clearErr) throw clearErr
    }
    const { error } = await supabase
      .from('community_posts')
      .update({ pinned_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('community_posts')
      .update({ pinned_at: null })
      .eq('id', id)
    if (error) throw error
  }
}

// ─── 커뮤니티 글 좋아요/댓글 (105) ───────────────────────
// 글 1개의 좋아요 수 + 내 좋아요 여부 + 댓글(작성자 포함) — 상세 펼치기 시 조회.
export const fetchCommunityPostSocial = async (postId, myUserId) => {
  const [likesRes, commentsRes] = await Promise.all([
    supabase.from('community_post_likes').select('user_id').eq('post_id', postId),
    supabase.from('community_post_comments').select('id, post_id, user_id, content, created_at, parent_id').eq('post_id', postId).order('created_at', { ascending: true }),
  ])
  if (likesRes.error) throw likesRes.error
  if (commentsRes.error) throw commentsRes.error
  const likes = likesRes.data || []
  const comments = commentsRes.data || []
  const userIds = Array.from(new Set(comments.map(c => c.user_id)))
  let userMap = new Map()
  if (userIds.length) {
    const { data: uData } = await supabase.from('users').select('id, nickname, avatar_path').in('id', userIds)
    userMap = new Map((uData || []).map(u => [u.id, u]))
  }
  return {
    likeCount: likes.length,
    likedByMe: likes.some(l => l.user_id === myUserId),
    comments: comments.map(c => ({ ...c, user: userMap.get(c.user_id) || null })),
  }
}

export const toggleCommunityPostLike = async ({ postId, liked, userId }) => {
  if (liked) {
    const { error } = await supabase.from('community_post_likes').insert({ post_id: postId, user_id: userId })
    if (error && error.code !== '23505') throw error   // 23505=중복 좋아요는 무시
  } else {
    const { error } = await supabase.from('community_post_likes').delete().eq('post_id', postId).eq('user_id', userId)
    if (error) throw error
  }
}

export const addCommunityPostComment = async ({ postId, content, parentId = null }) => {
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id
  const { data, error } = await supabase.from('community_post_comments')
    .insert({ post_id: postId, user_id: uid, content, parent_id: parentId })
    .select().single()
  if (error) throw error
  return data
}

export const deleteCommunityPostComment = async (id) => {
  const { error } = await supabase.from('community_post_comments').delete().eq('id', id)
  if (error) throw error
}

// 댓글 좋아요 — 모든 종류 댓글(답글 포함)에 좋아요. (141 인증댓글 / 142 게시판댓글)
//   kind: 'post' → post_comment_likes(인증글 댓글) / 'community' → community_post_comment_likes(게시판 댓글)
//   답글도 같은 테이블의 row(parent_id) 라 comment_id 만으로 커버.
const COMMENT_LIKE_TABLE = { post: 'post_comment_likes', community: 'community_post_comment_likes' }

// 주어진 댓글 id들의 좋아요 수 + 내가 누른 것 집합.
export const fetchCommentLikes = async ({ kind, commentIds, userId }) => {
  const table = COMMENT_LIKE_TABLE[kind]
  if (!table || !commentIds || commentIds.length === 0) return { counts: {}, mine: new Set() }
  const { data, error } = await supabase.from(table).select('comment_id, user_id').in('comment_id', commentIds)
  if (error) throw error
  const counts = {}; const mine = new Set()
  for (const r of (data || [])) {
    counts[r.comment_id] = (counts[r.comment_id] || 0) + 1
    if (r.user_id === userId) mine.add(r.comment_id)
  }
  return { counts, mine }
}

// 베스트 응원 — 프로그램 인증글 댓글(post_comments) 중 좋아요(141) 최다 N개.
//   금연 「응원」 탭 상단 노출용. 좋아요 0인 댓글은 제외. 동점이면 최신순.
//   반환: [{ id, content, user_id, verification_id, likeCount, user:{nickname,avatar_path} }]
export const fetchBestCheers = async (programId, { limit = 3 } = {}) => {
  // 1) 프로그램 미션 → 인증 id
  const { data: missions } = await supabase.from('missions').select('id').eq('program_id', programId)
  const mIds = (missions || []).map(m => m.id)
  if (mIds.length === 0) return []
  const { data: vers } = await supabase.from('verifications').select('id').in('mission_id', mIds)
  const vIds = (vers || []).map(v => v.id)
  if (vIds.length === 0) return []
  // 2) 댓글
  const { data: comments } = await supabase
    .from('post_comments')
    .select('id, content, user_id, verification_id, created_at')
    .in('verification_id', vIds)
  if (!comments || comments.length === 0) return []
  const cIds = comments.map(c => c.id)
  // 3) 좋아요 집계
  const { data: likes } = await supabase.from('post_comment_likes').select('comment_id').in('comment_id', cIds)
  const countMap = {}
  for (const l of (likes || [])) countMap[l.comment_id] = (countMap[l.comment_id] || 0) + 1
  // 4) 좋아요 1↑만, 좋아요 desc → 최신 desc
  const ranked = comments
    .map(c => ({ ...c, likeCount: countMap[c.id] || 0 }))
    .filter(c => c.likeCount > 0)
    .sort((a, b) => b.likeCount - a.likeCount || new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)
  if (ranked.length === 0) return []
  // 5) 작성자
  const uIds = Array.from(new Set(ranked.map(c => c.user_id)))
  const { data: users } = await supabase.from('users').select('id, nickname, avatar_path').in('id', uIds)
  const uMap = new Map((users || []).map(u => [u.id, u]))
  return ranked.map(c => ({ ...c, user: uMap.get(c.user_id) || null }))
}

// 화면 체류 로깅 (자체 분석, 마이그 146) — 콘텐츠 없이 화면 키 + 체류시간만.
//   프로드 빌드에서만(본인 dev 테스트 데이터 제외). 비로그인/실패는 조용히 skip.
//   화면 키: ID/민감 파라미터 제거 — '/programs/abc123?tab=missions' → '/programs/:id?tab=missions'
export const screenKeyOf = (pathname, search = '') => {
  const p = String(pathname || '/').replace(/\/[0-9a-fA-F-]{6,}/g, '/:id')  // uuid/긴 id 제거
  let tab = ''
  try { tab = new URLSearchParams(search).get('tab') || '' } catch { tab = '' }
  return tab ? `${p}?tab=${tab}` : p
}
// 화면별 체류 집계 (관리자 분석, RPC 147) — 최근 N일. 관리자만 데이터 반환(RLS).
export const fetchScreenStats = async (days = 30) => {
  const { data, error } = await supabase.rpc('get_screen_stats', { p_days: days })
  if (error) throw error
  return data || []
}
export const logScreenEvent = async (screen, durationMs) => {
  if (!import.meta.env.PROD) return
  if (!screen || !(durationMs > 0)) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return
    await supabase.from('screen_events').insert({ user_id: uid, screen, duration_ms: Math.round(durationMs) })
  } catch {
    // no-op (테이블 미적용/오프라인 등 — 분석은 best-effort)
  }
}

// 최근 응원글 — 프로그램 인증글 댓글 최신 N개 + 좋아요 수. (응원 콜라주 「최근 응원글」)
//   반환: [{ id, content, user_id, verification_id, created_at, likeCount, user }]
export const fetchRecentCheers = async (programId, { limit = 4 } = {}) => {
  const { data: missions } = await supabase.from('missions').select('id').eq('program_id', programId)
  const mIds = (missions || []).map(m => m.id)
  if (mIds.length === 0) return []
  const { data: vers } = await supabase.from('verifications').select('id').in('mission_id', mIds)
  const vIds = (vers || []).map(v => v.id)
  if (vIds.length === 0) return []
  const { data: comments } = await supabase
    .from('post_comments')
    .select('id, content, user_id, verification_id, created_at')
    .in('verification_id', vIds)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!comments || comments.length === 0) return []
  const cIds = comments.map(c => c.id)
  const { data: likes } = await supabase.from('post_comment_likes').select('comment_id').in('comment_id', cIds)
  const countMap = {}
  for (const l of (likes || [])) countMap[l.comment_id] = (countMap[l.comment_id] || 0) + 1
  const uIds = Array.from(new Set(comments.map(c => c.user_id)))
  const { data: users } = await supabase.from('users').select('id, nickname, avatar_path').in('id', uIds)
  const uMap = new Map((users || []).map(u => [u.id, u]))
  return comments.map(c => ({ ...c, likeCount: countMap[c.id] || 0, user: uMap.get(c.user_id) || null }))
}

// 운영자 한마디 저장 — programs.community_settings.cheerNotice (JSONB 머지, 마이그레이션 불필요).
//   text 비면 null 로 제거. currentSettings: 기존 community_settings(다른 필드 보존용).
export const updateCheerNotice = async (programId, currentSettings, text) => {
  const t = (text || '').trim()
  const next = { ...(currentSettings || {}), cheerNotice: t || null }
  const { error } = await supabase.from('programs').update({ community_settings: next }).eq('id', programId)
  if (error) throw error
  return next
}

// 댓글 좋아요 토글. liked=현재 내가 누른 상태(true면 취소).
export const toggleCommentLike = async ({ kind, commentId, userId, liked }) => {
  const table = COMMENT_LIKE_TABLE[kind]
  if (!table) throw new Error('unknown comment kind')
  if (liked) {
    const { error } = await supabase.from(table).delete().eq('comment_id', commentId).eq('user_id', userId)
    if (error) throw error
  } else {
    const { error } = await supabase.from(table).insert({ comment_id: commentId, user_id: userId })
    if (error && error.code !== '23505') throw error  // 중복은 무시
  }
}

// 운영자 — 승인 필요(approval) 게시판의 검토 대기 글 승인/거절.
//   승인: status='visible' (노출). 거절: 글 삭제. (RLS: 운영자 UPDATE/DELETE 허용 — 096)
export const setCommunityPostStatus = async ({ id, status }) => {
  const { error } = await supabase.from('community_posts').update({ status }).eq('id', id)
  if (error) throw error
}

// 거절 — 사유와 함께 작성자에게 알림 후 글 삭제 (110 RPC, 운영자만)
export const rejectCommunityPost = async ({ id, reason }) => {
  const { error } = await supabase.rpc('reject_community_post', { p_post_id: id, p_reason: reason || '' })
  if (error) throw error
}

// 검토 대기(pending) 글 전체 — 운영자 통합 검토함용. 오래된 순(대기열). (운영자만 RLS)
export const fetchCommunityPendingPosts = async (programId) => {
  const { data, error } = await supabase
    .from('community_posts')
    .select('*, author:users(id, nickname, avatar_path)')
    .eq('program_id', programId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// 신고 (100) — targetType: 'post' | 'verification'. 누적 시 트리거가 자동 숨김.
export const createReport = async ({ programId, targetType, targetId, reason }) => {
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id
  const { error } = await supabase.from('reports').insert({
    program_id: programId, target_type: targetType, target_id: targetId, reporter_id: uid, reason: reason || null,
  })
  if (error) throw error
}

// 운영자 신고 관리 — 프로그램의 모든 신고를 대상별로 묶어, 신고자(닉네임)·사유·횟수 +
//   대상 콘텐츠 현재 상태까지 한 번에. 신고자 신원은 운영자에게만(RLS: owner SELECT).
//   반환: [{ targetType, targetId, target, deleted, hidden, reporters:[{id,nickname,avatar_path,reason,created_at}], latestAt }]
export const fetchProgramReports = async (programId) => {
  const { data: reports, error } = await supabase
    .from('reports')
    .select('id, target_type, target_id, reason, created_at, resolved, reporter:users!reporter_id(id, nickname, avatar_path)')
    .eq('program_id', programId)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!reports?.length) return []

  const postIds = [...new Set(reports.filter(r => r.target_type === 'post').map(r => r.target_id))]
  const verIds = [...new Set(reports.filter(r => r.target_type === 'verification').map(r => r.target_id))]

  const postMap = {}, verMap = {}
  if (postIds.length) {
    const { data } = await supabase
      .from('community_posts')
      .select('id, title, body, status, board_id, image_path, author:users(nickname)')
      .in('id', postIds)
    for (const p of (data || [])) postMap[p.id] = p
  }
  if (verIds.length) {
    const { data } = await supabase
      .from('verifications')
      .select('id, note, image_path, feed_visible, mission_id, missions(title), user:users(nickname)')
      .in('id', verIds)
    for (const v of (data || [])) verMap[v.id] = v
  }

  const groups = new Map()
  for (const r of reports) {
    const key = `${r.target_type}:${r.target_id}`
    if (!groups.has(key)) {
      const isPost = r.target_type === 'post'
      const t = isPost ? postMap[r.target_id] : verMap[r.target_id]
      const hidden = isPost ? (t?.status === 'hidden') : (t ? t.feed_visible === false : false)
      groups.set(key, {
        targetType: r.target_type,
        targetId: r.target_id,
        target: t || null,
        deleted: !t,
        hidden,
        reporters: [],
        unresolved: 0,        // 미처리 신고 수
        latestAt: r.created_at,
      })
    }
    const g = groups.get(key)
    if (!r.resolved) g.unresolved += 1
    g.reporters.push({
      id: r.id,
      nickname: r.reporter?.nickname || '(알 수 없음)',
      avatar_path: r.reporter?.avatar_path || null,
      reason: r.reason || null,
      created_at: r.created_at,
      resolved: !!r.resolved,
    })
  }
  // 미처리(처리 대기) 먼저, 그 안에서 최근 신고 순
  return Array.from(groups.values()).sort((a, b) => {
    const ar = a.unresolved > 0 ? 0 : 1
    const br = b.unresolved > 0 ? 0 : 1
    if (ar !== br) return ar - br
    return a.latestAt < b.latestAt ? 1 : -1
  })
}

// 운영자 — 콘텐츠의 미처리 신고를 일괄 처리(resolved=true). RPC(116, owner 검증).
export const resolveReports = async (programId, targetType, targetId) => {
  const { error } = await supabase.rpc('resolve_reports', {
    p_program_id: programId, p_target_type: targetType, p_target_id: targetId,
  })
  if (error) throw error
}

// 운영자 메뉴 배지 — 미처리 신고가 있는 '콘텐츠 수'. (행 수가 아니라 대상 기준)
export const fetchUnresolvedReportCount = async (programId) => {
  const { data, error } = await supabase
    .from('reports')
    .select('target_type, target_id')
    .eq('program_id', programId)
    .eq('resolved', false)
  if (error) throw error
  const set = new Set((data || []).map(r => `${r.target_type}:${r.target_id}`))
  return set.size
}

// 퀴즈 상세 (정답 제외) + 본인 제출/답안 — RPC
export const fetchQuizForParticipant = async (quizId) => {
  const { data, error } = await supabase.rpc('get_quiz_for_participant', { p_quiz_id: quizId })
  if (error) throw error
  return data
}

// 퀴즈 제출 + 자동 채점 — RPC. answers: [{ question_id, answer }]
export const submitQuiz = async (quizId, answers) => {
  const { data, error } = await supabase.rpc('submit_quiz', { p_quiz_id: quizId, p_answers: answers })
  if (error) throw error
  return data
}

// 운영자 퀴즈 결과 — 퀴즈/문제/모든 제출/답/사용자 통합 fetch
//   owner RLS 로 quiz_questions/submissions/answers 모두 SELECT 가능
export const fetchQuizResults = async (quizId) => {
  const { data: quiz, error: qErr } = await supabase
    .from('quizzes').select('*').eq('id', quizId).maybeSingle()
  if (qErr) throw qErr
  if (!quiz) return null

  const [questionsRes, submissionsRes] = await Promise.all([
    supabase.from('quiz_questions').select('*').eq('quiz_id', quizId).order('order_index'),
    supabase.from('quiz_submissions').select('*').eq('quiz_id', quizId).order('submitted_at', { ascending: false }),
  ])
  if (questionsRes.error) throw questionsRes.error
  if (submissionsRes.error) throw submissionsRes.error

  const questions = questionsRes.data || []
  const submissions = submissionsRes.data || []

  if (submissions.length === 0) {
    return { quiz, questions, submissions: [] }
  }

  const subIds = submissions.map(s => s.id)
  const userIds = Array.from(new Set(submissions.map(s => s.user_id)))

  const [answersRes, usersRes] = await Promise.all([
    supabase.from('quiz_answers').select('*').in('submission_id', subIds),
    supabase.from('users').select('id, nickname, avatar_path').in('id', userIds),
  ])
  if (answersRes.error) throw answersRes.error
  if (usersRes.error) throw usersRes.error

  const userMap = new Map((usersRes.data || []).map(u => [u.id, u]))
  const answersMap = new Map()
  for (const a of answersRes.data || []) {
    if (!answersMap.has(a.submission_id)) answersMap.set(a.submission_id, [])
    answersMap.get(a.submission_id).push(a)
  }

  return {
    quiz,
    questions,
    submissions: submissions.map(s => ({
      ...s,
      user: userMap.get(s.user_id) || null,
      answers: answersMap.get(s.id) || [],
    })),
  }
}

// 초대 코드 — 코드로 프로그램 미리보기 (가입 X)
export const lookupInviteProgram = async (code) => {
  const { data, error } = await supabase.rpc('lookup_invite_program', { p_code: code })
  if (error) throw error
  return data
}

// 초대 코드 — 가입 (code 단독)
export const joinByInviteCode = async (code, entryAnswer = null) => {
  const { data, error } = await supabase.rpc('join_by_invite_code', { p_code: code, p_entry_answer: entryAnswer || null })
  if (error) throw error
  return data
}

// 본인 인증 현황 — 한 프로그램에서 본인의 활동 통합 (통계용 — 가벼운 필드만)
//   image_path/note 같은 무거운 필드 제외 (카드 fetch 는 fetchMyVerificationsByBundle 별도)
//   집계만 필요: 4지표, 14일 차트, 미션별 분포, 묶음 그룹 카운트
//   RLS: 본인 SELECT 모두 허용
export const fetchMyActivity = async (programId, userId) => {
  const { data: verifs, error: vErr } = await supabase
    .from('verifications')
    .select('id, mission_id, status, submitted_at, missions!inner(title, bundle_title, point, program_id)')
    .eq('user_id', userId)
    .eq('missions.program_id', programId)
    .order('submitted_at', { ascending: false })
  if (vErr) throw vErr

  const { data: scores, error: sErr } = await supabase
    .from('score_ledgers')
    .select('point, created_at')
    .eq('user_id', userId)
    .eq('program_id', programId)
  if (sErr) throw sErr

  const rows = verifs || []
  const totalCount = rows.length
  const approvedCount = rows.filter(v => v.status === 'APPROVED').length
  const pendingCount = rows.filter(v => v.status === 'PENDING_REVIEW').length
  const rejectedCount = rows.filter(v => v.status === 'REJECTED').length
  const totalScore = (scores || []).reduce((s, l) => s + (l.point || 0), 0)

  // 활동 일수 (KST, APPROVED 기준)
  const dateSet = new Set(
    rows.filter(v => v.status === 'APPROVED').map(v => formatKstDate(new Date(v.submitted_at)))
  )
  const activeDays = dateSet.size

  // 미션별 분포 (APPROVED 만 카운트)
  const missionMap = new Map()
  for (const v of rows) {
    if (v.status !== 'APPROVED') continue
    const mId = v.mission_id
    if (!missionMap.has(mId)) {
      missionMap.set(mId, {
        mission_id: mId,
        title: v.missions?.title || '(삭제된 미션)',
        bundleTitle: v.missions?.bundle_title || null,
        point: v.missions?.point || 0,
        count: 0,
      })
    }
    missionMap.get(mId).count += 1
  }
  const missionStats = Array.from(missionMap.values()).sort((a, b) => b.count - a.count)

  return {
    verifications: rows,
    totalCount, approvedCount, pendingCount, rejectedCount,
    totalScore, activeDays,
    missionStats,
  }
}

// 본인 인증 카드 — 한 묶음 내, 페이지네이션 (이미지/소감 포함 무거운 필드)
//   bundleParam: 'solo' (단독 미션) 또는 bundle_title (encoded 되기 전 원본)
//   참여자 많아도 본인 묶음당 fetch 양만큼만 부담
export const MY_VERIFICATIONS_PAGE_SIZE = 10
export const fetchMyVerificationsByBundle = async (programId, userId, bundleParam, page = 0, pageSize = MY_VERIFICATIONS_PAGE_SIZE) => {
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('verifications')
    .select('id, mission_id, status, submitted_at, image_path, numeric_value, metric_values, note, missions!inner(title, bundle_title, program_id, requires_note, metrics)')
    .eq('user_id', userId)
    .eq('missions.program_id', programId)
    .order('submitted_at', { ascending: false })
    .range(from, to)

  // bundleParam='solo' → bundle_title IS NULL / 그 외 → 정확 일치
  if (bundleParam === 'solo') {
    query = query.is('missions.bundle_title', null)
  } else {
    query = query.eq('missions.bundle_title', bundleParam)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

// 본인 인증의 소감(note)만 수정 — 전용 RPC (status/point 불변 → 랭킹 영향 X)
//   서버측에서 user_id = auth.uid() 검증 + 300자 제한 + 필수 미션 빈값 방지
export const updateVerificationNote = async (verificationId, note) => {
  const { data, error } = await supabase.rpc('update_verification_note', {
    p_verification_id: verificationId,
    p_note: note,
  })
  if (error) throw error
  return data
}

// 운영자 사후 점수 제외 — 부적절한 인증을 점수에서 회수 + 반려 처리 + 참가자 알림.
//   서버(RPC)에서 프로그램 owner 검증. AUTO 어뷰징 대응(자동승인이라도 사후 조치 가능).
export const excludeVerificationScore = async (verificationId, reason) => {
  const { data, error } = await supabase.rpc('exclude_verification_score', {
    p_verification_id: verificationId,
    p_reason: reason || null,
  })
  if (error) throw error
  return data
}

// 운영자 — 인증의 커뮤니티 피드 노출 토글 (점수·승인은 유지, 노출만 차단/복구).
//   owner RLS(verifications UPDATE)로 허용됨. status 미변경이라 점수/알림 트리거 안 울림.
export const setVerificationFeedVisible = async (verificationId, visible) => {
  const { error } = await supabase
    .from('verifications')
    .update({ feed_visible: visible })
    .eq('id', verificationId)
  if (error) throw error
}

// 운영자 — 피드에서 가려진 게시물 모아보기 (feed_visible=false 인 APPROVED 인증).
//   게시물 관리에서 복구(피드 표시)용. owner SELECT RLS 로 본인 프로그램 인증 조회.
export const fetchHiddenVerifications = async (programId) => {
  const { data: rows, error } = await supabase
    .from('verifications')
    .select('id, user_id, submitted_at, image_path, numeric_value, note, status, feed_visible, missions!inner(program_id, title, bundle_title)')
    .eq('missions.program_id', programId)
    .eq('status', 'APPROVED')
    .eq('feed_visible', false)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  const list = rows || []
  if (list.length === 0) return []

  const userIds = Array.from(new Set(list.map(r => r.user_id)))
  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, nickname, avatar_path')
    .in('id', userIds)
  if (uErr) throw uErr
  const userMap = new Map((users || []).map(u => [u.id, u]))
  return list.map(r => ({ ...r, user: userMap.get(r.user_id) || null }))
}

// 6자리 영숫자 코드 자동 생성 (혼동 글자 제외 — 0/O, 1/I, L 제외)
export const generateInviteCode = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// 운영자 수동 채점 — RPC
export const gradeQuizAnswer = async (answerId, isCorrect) => {
  const { data, error } = await supabase.rpc('grade_quiz_answer', {
    p_answer_id: answerId,
    p_is_correct: isCorrect,
  })
  if (error) throw error
  return data
}

// 운영자 통계 — 프로그램 퀴즈별 요약
//   각 퀴즈마다: 제출 수 / 참여율 / 평균 점수 / 채점 대기 / 정답률(자동채점 답 기준)
//   참여율 분모 = ACTIVE 참여자 수
export const fetchProgramQuizStats = async (programId) => {
  // 1) 퀴즈 + 문제 + 제출 + 답안 한 번에
  const { data: quizzes, error: qErr } = await supabase
    .from('quizzes')
    .select(`
      id, title, start_at, due_at, reveal_answers, created_at,
      quiz_questions(id, point),
      quiz_submissions(id, total_score, status, quiz_answers(is_correct))
    `)
    .eq('program_id', programId)
    .order('created_at', { ascending: false })
  if (qErr) throw qErr

  // 2) ACTIVE 참여자 수 (참여율 분모)
  const { count: participantCount, error: pErr } = await supabase
    .from('program_participants')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', programId)
    .eq('status', 'ACTIVE')
  if (pErr) throw pErr

  return (quizzes || []).map(q => {
    const subs = q.quiz_submissions || []
    const submissionCount = subs.length
    const avgScore = submissionCount > 0
      ? Math.round(subs.reduce((s, sub) => s + (sub.total_score || 0), 0) / submissionCount)
      : 0
    const pendingCount = subs.filter(s => s.status === 'PENDING').length

    // 정답률 — 자동 채점된 답안(is_correct !== null)만 집계
    let totalGraded = 0
    let correctCount = 0
    for (const sub of subs) {
      for (const a of (sub.quiz_answers || [])) {
        if (a.is_correct !== null) {
          totalGraded++
          if (a.is_correct === true) correctCount++
        }
      }
    }
    const correctRate = totalGraded > 0 ? Math.round((correctCount / totalGraded) * 100) : null

    return {
      id: q.id,
      title: q.title,
      start_at: q.start_at,
      due_at: q.due_at,
      created_at: q.created_at,
      questionCount: q.quiz_questions?.length || 0,
      totalPoints: (q.quiz_questions || []).reduce((s, qq) => s + (qq.point || 0), 0),
      submissionCount,
      participantCount: participantCount || 0,
      participationRate: participantCount ? Math.round((submissionCount / participantCount) * 100) : 0,
      avgScore,
      pendingCount,
      correctRate,
    }
  })
}

export const fetchPendingReviews = async (programId) => {
  const { data, error } = await supabase
    .rpc('get_pending_reviews', { p_program_id: programId })
  if (error) throw error
  return data || []
}

// 인증 심사 — 승인/거절 (운영자). 직접 UPDATE → grant_score(승인)/notify_on_verification_review 트리거 발화.
export const approveVerification = async ({ id, reviewerId }) => {
  const { error } = await supabase.from('verifications')
    .update({ status: 'APPROVED', reviewed_at: new Date().toISOString(), reviewer_id: reviewerId })
    .eq('id', id)
  if (error) throw error
}
export const rejectVerification = async ({ id, reason, reviewerId }) => {
  const { error } = await supabase.from('verifications')
    .update({ status: 'REJECTED', reviewed_at: new Date().toISOString(), reviewer_id: reviewerId, rejection_reason: reason })
    .eq('id', id)
  if (error) throw error
}

// 운영자 심사 디테일 — RPC 결과에 bundle_title 추가 (묶음 그루핑용)
// RPC 가 m_id 까지 반환 → missions 에서 bundle_title 별도 fetch + 매핑
export const fetchPendingReviewsEnriched = async (programId) => {
  const { data: rpcData, error: rpcErr } = await supabase
    .rpc('get_pending_reviews', { p_program_id: programId })
  if (rpcErr) throw rpcErr
  const rows = rpcData || []

  if (rows.length === 0) return []

  const missionIds = Array.from(new Set(rows.map(r => r.m_id)))
  const { data: missionData, error: mErr } = await supabase
    .from('missions')
    .select('id, bundle_title')
    .in('id', missionIds)
  if (mErr) throw mErr

  const bundleMap = new Map((missionData || []).map(m => [m.id, m.bundle_title]))
  return rows.map(r => ({ ...r, m_bundle_title: bundleMap.get(r.m_id) || null }))
}

// 알림 목록 — RLS 가 본인 알림만 SELECT 허용 (040). 최신순 + 최근 50개
export const fetchNotifications = async () => {
  // 본인 알림만 — RLS에 admin 전체 열람 정책이 있어 명시적으로 user_id 필터 필수.
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) return []
  const disabled = await fetchDisabledNotificationTypes()
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(50)
  if (disabled.length) {
    query = query.not('type', 'in', `(${disabled.map(t => `"${t}"`).join(',')})`)
  }
  const { data, error } = await query
  if (error) throw error
  return data || []
}

// 안 읽은 알림 수 — Bell 배지용 (OFF 한 type 은 제외 → 설정과 배지 일치)
export const fetchUnreadNotificationsCount = async () => {
  // 본인 알림만 — RLS admin 전체 열람 정책 때문에 user_id 명시 필터 필수.
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) return 0
  const disabled = await fetchDisabledNotificationTypes()
  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('is_read', false)
  if (disabled.length) {
    query = query.not('type', 'in', `(${disabled.map(t => `"${t}"`).join(',')})`)
  }
  const { count, error } = await query
  if (error) throw error
  return count || 0
}

// 커뮤니티 피드 — verifications + users + post_likes + post_comments 통합
// 같은 프로그램의 ACTIVE 참여자만 SELECT (037 RLS) — feed_enabled=true 인 경우
// 반환: [{ ...verification, user, likeCount, likedUserIds: Set, comments: [{ ...comment, user }] }]
//   likedByMe 는 호출 측에서 likedUserIds.has(myUserId) 로 결정 (캐시는 user 무관)
//
// 페이지네이션: 참여자 많아질 때 한 번에 전부 fetch 부담 → 10개씩 cursor-based
//   page=0 → 최신 10개, page=1 → 다음 10개...
export const FEED_PAGE_SIZE = 10
export const fetchFeedPosts = async (programId, page = 0, pageSize = FEED_PAGE_SIZE) => {
  const from = page * pageSize
  const to = from + pageSize - 1

  // 1) APPROVED + feed_visible 인증만 — range 로 페이지네이션
  const { data: vData, error: vErr } = await supabase
    .from('verifications')
    .select('id, mission_id, user_id, submitted_at, image_path, numeric_value, metric_values, note, missions!inner(program_id, title, bundle_title, requires_note, metrics)')
    .eq('missions.program_id', programId)
    .eq('missions.feed_excluded', false)   // 운영자 전용 미션(욕구 순간 등) 제외
    .eq('status', 'APPROVED')
    .eq('feed_visible', true)
    .order('submitted_at', { ascending: false })
    .range(from, to)
  if (vErr) throw vErr

  const rows = vData || []
  if (rows.length === 0) return []

  const verifIds = rows.map(r => r.id)

  // 2) post_likes + post_comments 병렬
  const [likesRes, commentsRes] = await Promise.all([
    supabase
      .from('post_likes')
      .select('verification_id, user_id')
      .in('verification_id', verifIds),
    supabase
      .from('post_comments')
      .select('verification_id')  // 댓글 수만 — 본문은 펼칠 때 lazy fetch (fetchPostComments)
      .in('verification_id', verifIds),
  ])
  if (likesRes.error) throw likesRes.error
  if (commentsRes.error) throw commentsRes.error

  const likes = likesRes.data || []
  const comments = commentsRes.data || []

  // 3) 인증 작성자 + 댓글 작성자 unique user_ids → nickname 한 번에 fetch
  const allUserIds = Array.from(new Set(rows.map(r => r.user_id)))
  const { data: uData, error: uErr } = await supabase
    .from('users')
    .select('id, nickname, avatar_path')
    .in('id', allUserIds)
  if (uErr) throw uErr
  const userMap = new Map((uData || []).map(u => [u.id, u]))

  // 4) likeMap (verification_id → { count, userIds })
  const likeMap = new Map()
  for (const l of likes) {
    if (!likeMap.has(l.verification_id)) {
      likeMap.set(l.verification_id, { count: 0, userIds: new Set() })
    }
    const b = likeMap.get(l.verification_id)
    b.count += 1
    b.userIds.add(l.user_id)
  }

  // 5) commentCountMap (verification_id → 댓글 수). 본문은 펼칠 때 fetchPostComments 로.
  const commentCountMap = new Map()
  for (const c of comments) {
    commentCountMap.set(c.verification_id, (commentCountMap.get(c.verification_id) || 0) + 1)
  }

  // 6) 조립
  return rows.map(r => ({
    ...r,
    user: userMap.get(r.user_id) || null,
    likeCount: likeMap.get(r.id)?.count || 0,
    likedUserIds: likeMap.get(r.id)?.userIds || new Set(),
    commentCount: commentCountMap.get(r.id) || 0,
  }))
}

// 한 게시물의 댓글 — 댓글 아이콘 클릭(펼침) 시 lazy fetch. 작성자 닉네임/아바타 포함.
export const fetchPostComments = async (verificationId) => {
  const { data, error } = await supabase
    .from('post_comments')
    .select('id, verification_id, user_id, content, created_at, updated_at, parent_id')
    .eq('verification_id', verificationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const list = data || []
  if (list.length === 0) return []
  const userIds = Array.from(new Set(list.map(c => c.user_id)))
  const { data: uData } = await supabase
    .from('users')
    .select('id, nickname, avatar_path')
    .in('id', userIds)
  const userMap = new Map((uData || []).map(u => [u.id, u]))
  return list.map(c => ({ ...c, user: userMap.get(c.user_id) || null }))
}

// 운영자 참여자 통계 — 4가지 핵심 지표 + 묶음 그루핑된 미션 통계
//   participantsCount: ACTIVE 참여자 수
//   totalVerifications: 누적 APPROVED 인증
//   todayVerifications: KST 오늘 APPROVED 인증
//   todayActiveParticipants: KST 오늘 인증한 unique 참여자 수
//   bundleStats: [{ bundleTitle, totalCount, missions: [{ mission_id, title, count }] }]
//                bundleTitle=null = 단독 미션 그룹. totalCount 내림차순.
// 내 주요 기록 요약 (122/Phase2) — 다중 지표(metric_values) 를 지표별로 합산 + 최근 7일 증감 + 달성 횟수.
//   승인된 본인 인증만(RLS 로 본인 것 조회 가능). metric_aggregate=true 미션만.
//   반환: { metrics: [{ key, label, unit, icon, total, recent }], count, recentCount }
export const fetchMyMetricSummary = async (programId, userId) => {
  if (!userId) return { metrics: [], count: 0, recentCount: 0 }
  const { data, error } = await supabase
    .from('verifications')
    .select('metric_values, submitted_at, missions!inner(program_id, metric_aggregate, metrics)')
    .eq('missions.program_id', programId)
    .eq('missions.metric_aggregate', true)
    .eq('user_id', userId)
    .eq('status', 'APPROVED')
    .not('metric_values', 'is', null)
  if (error) throw error
  const rows = data || []

  // 지표 정의(라벨/단위/아이콘 + 통계 표시 옵션). 표시는 카드에서 처리.
  //   sumDivide: 변환계수(예: 분→시간 60), sumUnit: 변환 단위, sumFormat: 'hm'(H:MM)
  const defs = {}
  for (const r of rows) {
    for (const d of (r.missions?.metrics || [])) {
      if (d?.key && !defs[d.key]) defs[d.key] = {
        key: d.key,
        label: d.label || d.key,
        icon: d.icon || '',
        unit: d.unit || '',
        sumUnit: d.sumUnit || '',
        divide: Number(d.sumDivide) > 0 ? Number(d.sumDivide) : 1,
        format: d.sumFormat || null,
      }
    }
  }
  // 전체 누적 합
  const totals = {}
  let count = 0
  for (const r of rows) {
    count += 1
    for (const [k, v] of Object.entries(r.metric_values || {})) {
      totals[k] = (totals[k] || 0) + (Number(v) || 0)
    }
  }
  // recent = '이전 기록 대비 증가분' = 가장 최근 1건의 값 (지표별 가장 최근 기록값)
  const recents = {}
  const sorted = [...rows].sort(
    (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
  )
  for (const r of sorted) {
    for (const [k, v] of Object.entries(r.metric_values || {})) {
      if (recents[k] === undefined) recents[k] = Number(v) || 0  // 첫(=최근) 값만 채택
    }
  }
  const recentCount = count > 0 ? 1 : 0  // 최근 1건이 더한 횟수

  // 정의 순서 유지하기 어려워 — 미션 metrics 첫 등장 순서대로
  const orderedKeys = Object.keys(defs)
  const metrics = orderedKeys
    .filter(k => (totals[k] || 0) > 0)
    .map(k => ({ ...defs[k], total: totals[k] || 0, recent: recents[k] || 0 }))  // total=누적 / recent=최근 1건(증가분)
  return { metrics, count, recentCount }
}

// 금연 테마 — 오늘의 흡연/아낀 담배 개비 합산 (히어로 "오늘 절약" 계산용).
//   metric_values 의 'cigarettes'(흡연)·'saved'(아낀) 키를 오늘(KST) 제출분에서 합산.
//   거부(REJECTED) 제외 — 승인/대기 모두 즉시 반영(제출 직후 보이게).
export const fetchTodaySmokingStats = async ({ programId, userId }) => {
  if (!programId || !userId) return { saved: 0, smoked: 0 }
  const { data, error } = await supabase
    .from('verifications')
    .select('metric_values, submitted_at, missions!inner(program_id)')
    .eq('missions.program_id', programId)
    .eq('user_id', userId)
    .neq('status', 'REJECTED')
    .not('metric_values', 'is', null)
  if (error) throw error
  const today = formatKstDate(new Date())
  let saved = 0, smoked = 0
  for (const r of data || []) {
    if (formatKstDate(new Date(r.submitted_at)) !== today) continue
    const mv = r.metric_values || {}
    smoked += Number(mv.cigarettes) || 0
    saved += Number(mv.saved) || 0
  }
  return { saved, smoked }
}

// 누적 지표 합산 (121) — 단위별 '함께(전체) + 내 누적'. 승인된 numeric 만. RPC(SECURITY DEFINER).
//   반환: [{ unit, total, mine }] (합계 0 인 단위는 제외)
export const fetchMetricTotals = async (programId) => {
  const { data, error } = await supabase.rpc('get_metric_totals', { p_program_id: programId })
  if (error) throw error
  return (data || [])
    .map(r => ({ unit: r.unit || '', total: Number(r.total) || 0, mine: Number(r.mine) || 0 }))
    .filter(r => r.total > 0)
}

// 한 유저의 누적 점수 요인 — score_ledgers 를 미션별/퀴즈별로 집계. (운영자 RLS 로 본인 프로그램 조회)
//   { missions: [{id, title, point, count}], quiz: {point,count}, other: {point,count}, total }
export const fetchUserScoreBreakdown = async (programId, userId) => {
  const { data, error } = await supabase
    .from('score_ledgers')
    .select('point, reason, verification_id, quiz_submission_id, verifications(mission_id, missions(id, title, bundle_title)), quiz_submissions(quiz_id, quizzes(id, title))')
    .eq('program_id', programId)
    .eq('user_id', userId)
  if (error) throw error
  const missionMap = {}
  let quizPoint = 0, quizCount = 0, otherPoint = 0, otherCount = 0, total = 0
  for (const r of (data || [])) {
    const p = r.point || 0
    total += p
    const mission = r.verifications?.missions
    if (mission) {
      const mid = mission.id
      if (!missionMap[mid]) missionMap[mid] = { id: mid, title: mission.title, bundleTitle: mission.bundle_title || null, point: 0, count: 0 }
      missionMap[mid].point += p
      missionMap[mid].count += 1
    } else if (r.quiz_submission_id) {
      quizPoint += p; quizCount += 1
    } else {
      otherPoint += p; otherCount += 1
    }
  }
  const missions = Object.values(missionMap).sort((a, b) => b.point - a.point)
  return { missions, quiz: { point: quizPoint, count: quizCount }, other: { point: otherPoint, count: otherCount }, total }
}

export const fetchProgramStats = async (programId) => {
  // 1) ACTIVE 참여자 — head:false 로 user_id 전체 fetch (인증 0건도 목록에 포함시키기 위해).
  // Day 65: 위젯 「휴면」 카운트와 실제 목록 일치 위해 변경 (이전엔 count 만 가져옴).
  const { data: ppData, error: pErr } = await supabase
    .from('program_participants')
    .select('user_id, joined_at')
    .eq('program_id', programId)
    .eq('status', 'ACTIVE')
  if (pErr) throw pErr
  const activeParticipants = ppData || []
  const participantsCount = activeParticipants.length

  // 2-4) verifications + 미션 JOIN (program_id 필터)
  //   users 는 따로 fetch — verifications 에 user_id + reviewer_id 둘 다 users 참조라
  //   `users!inner` 가 ambiguous. unique user_id 만 모은 후 별도 SELECT.
  const { data: vData, error: vErr } = await supabase
    .from('verifications')
    .select('id, mission_id, user_id, submitted_at, missions!inner(program_id, title, bundle_title)')
    .eq('missions.program_id', programId)
    .eq('status', 'APPROVED')
  if (vErr) throw vErr

  const rows = vData || []
  const totalVerifications = rows.length

  const todayKst = formatKstDate(new Date())
  const todayRows = rows.filter(r => formatKstDate(new Date(r.submitted_at)) === todayKst)
  const todayVerifications = todayRows.length
  const todayActiveParticipants = new Set(todayRows.map(r => r.user_id)).size

  // 미션 단위 카운트
  const missionCountMap = new Map()
  for (const r of rows) {
    const mId = r.mission_id
    if (!missionCountMap.has(mId)) {
      missionCountMap.set(mId, {
        mission_id: mId,
        title: r.missions?.title || '(삭제된 미션)',
        bundleTitle: r.missions?.bundle_title || null,
        count: 0,
      })
    }
    missionCountMap.get(mId).count += 1
  }

  // 묶음 단위 그루핑
  const bundleMap = new Map() // bundleTitle (string|null) -> { bundleTitle, totalCount, missions: [] }
  for (const m of missionCountMap.values()) {
    const key = m.bundleTitle
    if (!bundleMap.has(key)) {
      bundleMap.set(key, { bundleTitle: key, totalCount: 0, missions: [] })
    }
    const bucket = bundleMap.get(key)
    bucket.totalCount += m.count
    bucket.missions.push({ mission_id: m.mission_id, title: m.title, count: m.count })
  }

  // 각 묶음 안 미션도 count 내림차순 + 묶음 자체도 totalCount 내림차순
  // 단독 그룹(null)은 항상 맨 아래로 (운영자가 묶음 단위 인식 우선)
  for (const bucket of bundleMap.values()) {
    bucket.missions.sort((a, b) => b.count - a.count)
  }
  const bundleStats = Array.from(bundleMap.values()).sort((a, b) => {
    if (a.bundleTitle === null) return 1
    if (b.bundleTitle === null) return -1
    return b.totalCount - a.totalCount
  })

  // 유저별 통계 — { user_id, nickname, totalCount, todayCount, totalScore, activeDays, lastActiveAt }
  //   verifications 가 있는 유저만 표시 (인증 0건 ACTIVE 참여자는 제외 — 단순화)
  //   totalCount: 누적 APPROVED 인증 횟수 (daily_limit 초과 포함)
  //   totalScore: 실제 부여된 점수 합 (score_ledgers — 한도 초과 인증은 점수 0)
  //   activeDays: unique KST 인증 일자 수 (지속성 지표)
  //   lastActiveAt: 가장 최근 submitted_at (활성/비활성 판별)
  const userMap = new Map()
  for (const r of rows) {
    const uId = r.user_id
    if (!userMap.has(uId)) {
      userMap.set(uId, {
        user_id: uId,
        nickname: '(알 수 없음)',
        totalCount: 0,
        todayCount: 0,
        totalScore: 0,
        activeDays: 0,
        lastActiveAt: null,
        _dateSet: new Set(),  // 활동 일수 계산용
      })
    }
    const bucket = userMap.get(uId)
    bucket.totalCount += 1
    bucket._dateSet.add(formatKstDate(new Date(r.submitted_at)))
    if (!bucket.lastActiveAt || r.submitted_at > bucket.lastActiveAt) {
      bucket.lastActiveAt = r.submitted_at
    }
  }
  for (const r of todayRows) {
    const u = userMap.get(r.user_id)
    if (u) u.todayCount += 1
  }
  // _dateSet 을 activeDays 로 변환
  for (const u of userMap.values()) {
    u.activeDays = u._dateSet.size
    delete u._dateSet
  }

  // 실제 부여된 점수 — score_ledgers 별도 fetch (033 트리거 통과한 점수만)
  const { data: ledgerData, error: lErr } = await supabase
    .from('score_ledgers')
    .select('user_id, point')
    .eq('program_id', programId)
  if (lErr) throw lErr
  for (const l of ledgerData || []) {
    const u = userMap.get(l.user_id)
    if (u) u.totalScore += (l.point || 0)
  }

  // 인증 0건 ACTIVE 참여자도 userMap 에 추가 — Day 65 위젯 「휴면」 일치성
  for (const pp of activeParticipants) {
    if (!userMap.has(pp.user_id)) {
      userMap.set(pp.user_id, {
        user_id: pp.user_id,
        nickname: '(닉네임 없음)',
        totalCount: 0,
        todayCount: 0,
        totalScore: 0,
        activeDays: 0,
        lastActiveAt: null,
        joinedAt: pp.joined_at || null,
        _dateSet: new Set(),
      })
    }
  }

  // nickname + avatar_path 별도 fetch — RLS 가 모든 authenticated SELECT 허용 (003)
  const userIds = Array.from(userMap.keys())
  if (userIds.length > 0) {
    const { data: uData, error: uErr } = await supabase
      .from('users')
      .select('id, nickname, avatar_path')
      .in('id', userIds)
    if (uErr) throw uErr
    for (const u of uData || []) {
      const bucket = userMap.get(u.id)
      if (bucket) {
        bucket.nickname = u.nickname || '(닉네임 없음)'
        bucket.avatar_path = u.avatar_path || null
      }
    }
  }

  // 정렬: totalCount 내림차순. totalCount 동일하면 lastActiveAt 최근 우선 (null 은 가장 아래).
  const userStats = Array.from(userMap.values()).sort((a, b) => {
    if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount
    if (!a.lastActiveAt && b.lastActiveAt) return 1
    if (a.lastActiveAt && !b.lastActiveAt) return -1
    return 0
  })

  return {
    participantsCount: participantsCount || 0,
    totalVerifications,
    todayVerifications,
    todayActiveParticipants,
    bundleStats,
    userStats,
    // Day 65 — ProgramInsightsSummary 위젯이 시계열·분포 계산용으로 사용.
    // 원본 verification rows (id/mission_id/user_id/submitted_at + missions JOIN).
    _raw: rows,
  }
}

// 다음 기수 열기 — 프로그램 복제 (2026-06-28 본인 결정).
//   복사 O: programs 설정 전부 + missions + quizzes/quiz_questions (날짜는 새 시작일 기준 평행 이동)
//   복사 X: participants · verifications · score_ledgers · posts · teams (런타임 데이터)
//   결과: DRAFT 새 프로그램 (소유자=본인). PUBLISH 는 운영자가 검토 후 → 그때만 베타 한도 검사.
//   원자성: 미션/퀴즈 복사 중 실패하면 새 프로그램 삭제(cascade)로 롤백.
//   newStart: 'YYYY-MM-DD' (새 기수 시작일). 기존 시작일과의 일수 차이만큼 전체·미션 날짜 평행 이동.
export const cloneProgram = async ({ sourceId, newStart }) => {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (!uid) throw new Error('로그인이 필요합니다')

  // 1) 원본 프로그램
  const { data: src, error: srcErr } = await supabase.from('programs').select('*').eq('id', sourceId).single()
  if (srcErr) throw srcErr
  if (src.owner_id !== uid) throw new Error('내가 운영하는 프로그램만 복제할 수 있어요')

  // 평행 이동 오프셋 (일 단위)
  const offsetDays = src.start_date
    ? Math.round((new Date(`${newStart}T00:00:00+09:00`) - new Date(`${src.start_date}T00:00:00+09:00`)) / 86400000)
    : 0
  const shiftDateStr = (dateStr) => {
    if (!dateStr) return dateStr
    const d = new Date(`${dateStr}T00:00:00+09:00`)
    d.setDate(d.getDate() + offsetDays)
    return formatKstDate(d)
  }
  const shiftTs = (ts) => {
    if (!ts) return ts
    const d = new Date(ts)
    d.setDate(d.getDate() + offsetDays)
    return d.toISOString()
  }

  // 2) 새 프로그램 row — 설정 전부 복사 + 런타임/식별 필드 재설정
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = src
  const newProgram = {
    ...rest,
    owner_id: uid,
    status: 'DRAFT',
    invite_code: null,        // unique 제약 — 발행 시 재생성
    published_at: null,
    start_date: src.start_date ? newStart : null,
    end_date: src.end_date ? shiftDateStr(src.end_date) : null,
  }
  const { data: created, error: insErr } = await supabase.from('programs').insert(newProgram).select('id').single()
  if (insErr) throw insErr
  const newId = created.id

  try {
    // 3) 미션 복사 (날짜 평행 이동)
    const { data: missions, error: mErr } = await supabase.from('missions').select('*').eq('program_id', sourceId)
    if (mErr) throw mErr
    if (missions?.length) {
      const rows = missions.map(({ id, created_at, updated_at, ...m }) => ({
        ...m,
        program_id: newId,
        active_from: shiftTs(m.active_from),
        active_until: shiftTs(m.active_until),
      }))
      const { error } = await supabase.from('missions').insert(rows)
      if (error) throw error
    }

    // 4) 퀴즈 + 문항 복사 (due_at 평행 이동)
    const { data: quizzes, error: qErr } = await supabase.from('quizzes').select('*').eq('program_id', sourceId)
    if (qErr) throw qErr
    for (const q of quizzes || []) {
      const { id: oldQuizId, created_at, ...qr } = q
      const { data: nq, error: nqErr } = await supabase.from('quizzes')
        .insert({ ...qr, program_id: newId, due_at: shiftTs(q.due_at), created_by: uid })
        .select('id').single()
      if (nqErr) throw nqErr
      const { data: questions, error: qqErr } = await supabase.from('quiz_questions').select('*').eq('quiz_id', oldQuizId)
      if (qqErr) throw qqErr
      if (questions?.length) {
        const qrows = questions.map(({ id, created_at: _qc, ...qq }) => ({ ...qq, quiz_id: nq.id }))
        const { error } = await supabase.from('quiz_questions').insert(qrows)
        if (error) throw error
      }
    }
  } catch (err) {
    // 부분 복제 롤백 — 새 프로그램 삭제 시 missions/quizzes 는 cascade 삭제
    await supabase.from('programs').delete().eq('id', newId)
    throw err
  }

  return newId
}

// 프리셋별 「운영자 수」 집계 — 라이브러리 화면 표시용 (마이그 135 RPC).
//   반환: { [presetKey]: operatorCount }. RPC(SECURITY DEFINER)라 남의 프로그램 직접 조회 없이 수치만.
export const fetchPresetUsageCounts = async () => {
  const { data, error } = await supabase.rpc('get_preset_usage_counts')
  if (error) throw error
  const map = {}
  for (const row of data || []) map[row.preset_key] = row.operator_count || 0
  return map
}

// 오늘의 기분 체크 (마이그 137) — 금연 테마 위젯. 하루 1건(upsert).
export const fetchTodayMood = async ({ programId, userId }) => {
  if (!programId || !userId) return null
  const today = formatKstDate(new Date())
  const { data, error } = await supabase
    .from('mood_logs')
    .select('mood')
    .eq('program_id', programId)
    .eq('user_id', userId)
    .eq('logged_date', today)
    .maybeSingle()
  if (error) throw error
  return data?.mood ?? null
}

// 금연 「내 변화」 — 내 기분 추세 (mood_logs, 날짜 오름차순 전체)
export const fetchMyMoodTrend = async ({ programId, userId }) => {
  if (!programId || !userId) return []
  const { data, error } = await supabase
    .from('mood_logs')
    .select('mood, logged_date')
    .eq('program_id', programId)
    .eq('user_id', userId)
    .order('logged_date', { ascending: true })
  if (error) throw error
  return data || []
}

// 금연 「내 변화」 — 흡연 추세 + 자주 피는 시간대 + 욕구 시간대.
//   흡연 기록 미션(metrics.cigarettes 보유): 일자별 흡연 개비 합 + 핀 시각(smoke_hour, 자정기준 분→시) 히스토그램.
//   욕구 순간 미션(metrics 없는 note 미션): 제출 시각(KST) 히스토그램.
//   거부 제외(본인 데이터 즉시 반영).
export const fetchMyChangeStats = async ({ programId, userId, days = 14 }) => {
  const empty = { smokingTrend: [], smokeHourHist: new Array(24).fill(0), cravingHourHist: new Array(24).fill(0), smokeTotal: 0, cravingTotal: 0, cravingNotes: [] }
  if (!programId || !userId) return empty
  const { data, error } = await supabase
    .from('verifications')
    .select('metric_values, submitted_at, note, missions!inner(program_id, metrics)')
    .eq('missions.program_id', programId)
    .eq('user_id', userId)
    .neq('status', 'REJECTED')
  if (error) throw error
  const kstHour = (ts) => (new Date(ts).getUTCHours() + 9) % 24
  const byDay = {}
  const smokeHourHist = new Array(24).fill(0)
  const cravingHourHist = new Array(24).fill(0)
  let smokeTotal = 0, cravingTotal = 0
  const cravingNotes = []
  for (const r of data || []) {
    const mv = r.metric_values || {}
    const metrics = r.missions?.metrics || []
    const hasCig = metrics.some(m => m?.key === 'cigarettes')
    if (hasCig) {
      const day = formatKstDate(new Date(r.submitted_at))
      byDay[day] = (byDay[day] || 0) + (Number(mv.cigarettes) || 0)
      smokeTotal += Number(mv.cigarettes) || 0
      // 핀 시각 — clock_multi 는 배열, 구버전은 단일 숫자. 각각 시간대 히스토그램에 반영.
      const times = Array.isArray(mv.smoke_hour) ? mv.smoke_hour : (mv.smoke_hour != null ? [mv.smoke_hour] : [])
      for (const t of times) {
        const h = Math.floor((Number(t) || 0) / 60)
        if (h >= 0 && h < 24) smokeHourHist[h] += 1
      }
    } else if (metrics.length === 0) {
      // 욕구 순간(note-only) — 제출 시각 + 적은 내용(욕구 요인)
      const h = kstHour(r.submitted_at)
      if (h >= 0 && h < 24) { cravingHourHist[h] += 1; cravingTotal += 1 }
      if (r.note && r.note.trim()) cravingNotes.push({ text: r.note.trim(), at: r.submitted_at })
    }
  }
  cravingNotes.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const smokingTrend = []
  const base = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base); d.setDate(d.getDate() - i)
    const ds = formatKstDate(d)
    smokingTrend.push({ date: ds, cigarettes: byDay[ds] || 0 })
  }
  return { smokingTrend, smokeHourHist, cravingHourHist, smokeTotal, cravingTotal, cravingNotes: cravingNotes.slice(0, 50) }
}

// 금연 「참가자 추세」(운영자) — 참가자별 최근 기분·누적 흡연·욕구 기록 집계.
//   RLS: 운영자는 자기 프로그램 mood_logs(137 owner_read)·verifications·users 조회 가능.
//   신경 쓸 사람 먼저(흡연 많은 순 → 기분 낮은 순).
export const fetchParticipantChangeTrends = async (programId) => {
  if (!programId) return []
  const [ppRes, moodRes, vRes] = await Promise.all([
    supabase.from('program_participants').select('user_id').eq('program_id', programId).eq('status', 'ACTIVE'),
    supabase.from('mood_logs').select('user_id, mood, logged_date').eq('program_id', programId).order('logged_date', { ascending: true }),
    supabase.from('verifications').select('user_id, metric_values, missions!inner(program_id, metrics)').eq('missions.program_id', programId).neq('status', 'REJECTED'),
  ])
  if (ppRes.error) throw ppRes.error
  const map = new Map()
  const ensure = (uid) => {
    if (!map.has(uid)) map.set(uid, { user_id: uid, nickname: '(닉네임 없음)', moods: [], smokeTotal: 0, cravingCount: 0 })
    return map.get(uid)
  }
  for (const p of ppRes.data || []) ensure(p.user_id)
  for (const r of moodRes.data || []) ensure(r.user_id).moods.push(r.mood)
  for (const r of vRes.data || []) {
    const mv = r.metric_values || {}
    const metrics = r.missions?.metrics || []
    const u = ensure(r.user_id)
    if (metrics.some(m => m?.key === 'cigarettes')) u.smokeTotal += Number(mv.cigarettes) || 0
    else if (metrics.length === 0) u.cravingCount += 1
  }
  const ids = Array.from(map.keys())
  if (ids.length) {
    const { data: users } = await supabase.from('users').select('id, nickname').in('id', ids)
    for (const u of users || []) { const e = map.get(u.id); if (e) e.nickname = u.nickname || '(닉네임 없음)' }
  }
  const out = Array.from(map.values()).map(u => ({
    user_id: u.user_id,
    nickname: u.nickname,
    latestMood: u.moods.length ? u.moods[u.moods.length - 1] : null,
    avgMood: u.moods.length ? u.moods.reduce((a, b) => a + b, 0) / u.moods.length : null,
    moodCount: u.moods.length,
    smokeTotal: u.smokeTotal,
    cravingCount: u.cravingCount,
  }))
  out.sort((a, b) => (b.smokeTotal - a.smokeTotal) || ((a.avgMood ?? 99) - (b.avgMood ?? 99)))
  return out
}

export const upsertMood = async ({ programId, userId, mood }) => {
  const today = formatKstDate(new Date())
  const { error } = await supabase
    .from('mood_logs')
    .upsert(
      { program_id: programId, user_id: userId, mood, logged_date: today, updated_at: new Date().toISOString() },
      { onConflict: 'program_id,user_id,logged_date' }
    )
  if (error) throw error
  return mood
}

// 라이브러리에서 시작 — 관리자 프리셋으로 DRAFT 프로그램 생성 (2026-06-28).
//   프리셋(코드 정의) → DRAFT 프로그램 + 미션(전체 기간) 생성. 이후 마법사에서 이름·날짜 마무리.
//   날짜 변경 시 027 트리거가 미션 active_from/until 을 자동 동기화.
//   원자성: 미션 insert 실패 시 새 프로그램 삭제(cascade)로 롤백.
export const createProgramFromPreset = async ({ presetKey, userId, selectedKeys, durationDays }) => {
  if (!userId) throw new Error('로그인이 필요합니다')
  const preset = getPreset(presetKey)
  if (!preset) throw new Error('프리셋을 찾을 수 없어요')
  // selectedKeys 가 있으면 그 미션만, 없으면 전체
  const chosen = Array.isArray(selectedKeys) && selectedKeys.length
    ? (preset.missions || []).filter(m => selectedKeys.includes(m.key))
    : (preset.missions || [])

  // 기간 — 오늘 시작, 선택 기간(없으면 프리셋 기본) (운영자가 마법사에서 조정)
  const today = new Date()
  const start = formatKstDate(today)
  const dur = durationDays || preset.durationDays || 14
  const endD = new Date(today)
  endD.setDate(endD.getDate() + dur - 1)
  const end = formatKstDate(endD)
  const activeFrom = `${start}T00:00:00+09:00`
  const activeUntil = `${end}T23:59:59+09:00`

  // 1) DRAFT 프로그램 (나머지 설정 컬럼은 DB 기본값)
  const { data: created, error } = await supabase.from('programs').insert({
    owner_id: userId,
    status: 'DRAFT',
    name: preset.name,
    description: preset.description || null,
    categories: preset.categories || [],
    start_date: start,
    end_date: end,
    source_preset_key: presetKey,   // 라이브러리 출처 추적 (마이그 135) — 운영자 수 집계용
    theme: preset.theme || null,    // 테마 프로그램(금연 등) — 상세 페이지 변형 (마이그 136)
    // 프리셋이 지정한 메뉴 플래그만 반영 (미지정은 DB 기본값). 금연: 퀴즈/랭킹 OFF, 내 변화 ON
    ...(preset.quizEnabled != null ? { quiz_enabled: preset.quizEnabled } : {}),
    ...(preset.rankingEnabled != null ? { ranking_enabled: preset.rankingEnabled } : {}),
    ...(preset.changeTabEnabled != null ? { change_tab_enabled: preset.changeTabEnabled } : {}),
  }).select('id').single()
  if (error) throw error
  const newId = created.id

  // 2) 미션 심기 (선택된 미션만)
  try {
    if (chosen.length) {
      const rows = chosen.map(m => expandPresetMission(m, {
        programId: newId, activeFrom, activeUntil, bundleTitle: preset.bundleTitle,
      }))
      const { error: mErr } = await supabase.from('missions').insert(rows)
      if (mErr) throw mErr
    }
  } catch (err) {
    await supabase.from('programs').delete().eq('id', newId)
    throw err
  }

  return newId
}
