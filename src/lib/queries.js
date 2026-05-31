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
  // 특정 프로그램의 랭킹 — period: 'all' | '7d' | '30d'
  programRanking: (programId, period = 'all') => ['rankings', 'byProgram', programId, period],
  // 본인의 프로그램별 최근 N일 일별 점수 시계열 (스파크라인용)
  myRecentScores: (programId, userId, days = 14) => ['scores', 'recentSeries', programId, userId, days],
  // 운영자 PENDING_REVIEW 목록
  pendingReviews: (programId) => ['verifications', 'pending', programId],
  // 운영자 참여자 통계
  programStats: (programId) => ['stats', 'program', programId],
  // 커뮤니티 피드 — verifications + likes + comments 통합
  feedPosts: (programId) => ['feed', 'posts', programId],
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
    .select('*, programs!inner(id, name, categories, feed_enabled)')
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
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data || []
}

// 안 읽은 알림 수 — Bell 배지용
export const fetchUnreadNotificationsCount = async () => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)
  if (error) throw error
  return count || 0
}

// 커뮤니티 피드 — verifications + users + post_likes + post_comments 통합
// 같은 프로그램의 ACTIVE 참여자만 SELECT (037 RLS) — feed_enabled=true 인 경우
// 반환: [{ ...verification, user, likeCount, likedUserIds: Set, comments: [{ ...comment, user }] }]
//   likedByMe 는 호출 측에서 likedUserIds.has(myUserId) 로 결정 (캐시는 user 무관)
export const fetchFeedPosts = async (programId) => {
  // 1) APPROVED + feed_visible 인증만 — 사용자가 노출 끈 인증은 피드에서 숨김
  const { data: vData, error: vErr } = await supabase
    .from('verifications')
    .select('id, mission_id, user_id, submitted_at, image_path, numeric_value, note, missions!inner(program_id, title, bundle_title)')
    .eq('missions.program_id', programId)
    .eq('status', 'APPROVED')
    .eq('feed_visible', true)
    .order('submitted_at', { ascending: false })
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
      .select('id, verification_id, user_id, content, created_at, updated_at')
      .in('verification_id', verifIds)
      .order('created_at', { ascending: true }),
  ])
  if (likesRes.error) throw likesRes.error
  if (commentsRes.error) throw commentsRes.error

  const likes = likesRes.data || []
  const comments = commentsRes.data || []

  // 3) 인증 작성자 + 댓글 작성자 unique user_ids → nickname 한 번에 fetch
  const allUserIds = Array.from(new Set([
    ...rows.map(r => r.user_id),
    ...comments.map(c => c.user_id),
  ]))
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

  // 5) commentMap (verification_id → [comments...])
  const commentMap = new Map()
  for (const c of comments) {
    if (!commentMap.has(c.verification_id)) commentMap.set(c.verification_id, [])
    commentMap.get(c.verification_id).push({
      ...c,
      user: userMap.get(c.user_id) || null,
    })
  }

  // 6) 조립
  return rows.map(r => ({
    ...r,
    user: userMap.get(r.user_id) || null,
    likeCount: likeMap.get(r.id)?.count || 0,
    likedUserIds: likeMap.get(r.id)?.userIds || new Set(),
    comments: commentMap.get(r.id) || [],
  }))
}

// 운영자 참여자 통계 — 4가지 핵심 지표 + 묶음 그루핑된 미션 통계
//   participantsCount: ACTIVE 참여자 수
//   totalVerifications: 누적 APPROVED 인증
//   todayVerifications: KST 오늘 APPROVED 인증
//   todayActiveParticipants: KST 오늘 인증한 unique 참여자 수
//   bundleStats: [{ bundleTitle, totalCount, missions: [{ mission_id, title, count }] }]
//                bundleTitle=null = 단독 미션 그룹. totalCount 내림차순.
export const fetchProgramStats = async (programId) => {
  // 1) ACTIVE 참여자 수
  const { count: participantsCount, error: pErr } = await supabase
    .from('program_participants')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', programId)
    .eq('status', 'ACTIVE')
  if (pErr) throw pErr

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

  const userStats = Array.from(userMap.values()).sort((a, b) => b.totalCount - a.totalCount)

  return {
    participantsCount: participantsCount || 0,
    totalVerifications,
    todayVerifications,
    todayActiveParticipants,
    bundleStats,
    userStats,
  }
}
