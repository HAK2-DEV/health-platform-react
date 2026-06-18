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
    .select('program_id, programs!inner(*)')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
  if (error) throw error
  return (data || []).map(row => row.programs)
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
    .select('*, programs!inner(id, name, categories, feed_enabled, owner_id)')
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

  return { streak, hasToday, activeDays, recent, totalCount }
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
    .select('*, quiz_questions(count), quiz_submissions(count)')
    .eq('program_id', programId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(q => ({
    ...q,
    questionCount: q.quiz_questions?.[0]?.count || 0,
    submissionCount: q.quiz_submissions?.[0]?.count || 0,
  }))
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
  return (data || []).map(q => ({
    ...q,
    mySubmission: q.quiz_submissions?.[0] || null,
  }))
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
export const joinByInviteCode = async (code) => {
  const { data, error } = await supabase.rpc('join_by_invite_code', { p_code: code })
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
    .select('id, mission_id, status, submitted_at, image_path, numeric_value, note, missions!inner(title, bundle_title, program_id, requires_note)')
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
  const disabled = await fetchDisabledNotificationTypes()
  let query = supabase
    .from('notifications')
    .select('*')
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
  const disabled = await fetchDisabledNotificationTypes()
  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
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
    .select('id, mission_id, user_id, submitted_at, image_path, numeric_value, note, missions!inner(program_id, title, bundle_title, requires_note)')
    .eq('missions.program_id', programId)
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
    .select('id, verification_id, user_id, content, created_at, updated_at')
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
