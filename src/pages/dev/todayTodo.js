/**
 * 🔧 dev 전용 — 「오늘 할 일」 칸의 데이터·규칙(화면은 TodayTodoCard.jsx). 2026-10-06
 *   실제 데이터: 그 프로그램의 미션(오늘 열림·할당량 남음) · 내 인증(반려 24시간 / 심사 중 2주 / 오늘 승인)
 *   · 퀴즈(열림·채점 중) · 오늘 인증한 사람 수. 화면 파일과 나눈 건 빠른 새로고침 규칙(부품 파일은 부품만 내보낸다) 때문.
 *
 * 만회 인증(본인 결정 2026-10-06, 마이그 283): 반려 뒤 24시간 안에 다시 올리면 원래 날로 인정.
 *   악용 방지(본인 정의) — 같은 인증(첫 인증 + 그 만회들 = 묶음)이 운영자에게 3번 반려되면 의도로 보고 그날은 마감.
 *   판정은 서버. 여기선 같은 규칙으로 «다시 확인» 항목을 보이거나 내린다(만회 행은 제출 시각이 원래 날이라 makeup_of 로 잇는다).
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../supabaseClient'
import { fetchProgramMissions, fetchTodayCounts, fetchParticipantQuizzes, formatKstDate } from '../../lib/queries'
import { checkMissionToday } from '../../lib/formatters'
import { resolveMissionIcon } from '../../lib/missionIcons'

// ─── 시각 표기 — 시계는 이 함수들 안에서만 읽는다(렌더 본문에서 직접 읽지 않는다) ───
const KST = 'Asia/Seoul'
const dayIdx = (d) => {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: KST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).split('-')
  return Math.floor(Date.UTC(+s[0], +s[1] - 1, +s[2]) / 86400000)
}
const kstHm = (d) => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: KST, hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(d)
  return { h: Number(p.find(x => x.type === 'hour').value) % 24, m: Number(p.find(x => x.type === 'minute').value) }
}
const koTime = (d) => { const { h, m } = kstHm(d); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${m ? ` ${m}분` : ''}` }   // 오후 8시
const koClock = (d) => { const { h, m } = kstHm(d); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}` }   // 오후 7:40
const dayWord = (iso) => { const n = dayIdx(new Date()) - dayIdx(new Date(iso)); return n <= 0 ? '오늘' : n === 1 ? '어제' : `${n}일 전` }
const isTodayKst = (iso) => dayIdx(new Date(iso)) === dayIdx(new Date())
const inWindowNow = (m) => {
  const now = Date.now()
  return (!m.active_from || new Date(m.active_from).getTime() <= now) && (!m.active_until || new Date(m.active_until).getTime() >= now)
}
// 미션 마감 — 기간 끝이 오늘이면 그 시각(「오후 8시까지」), 아니면 「오늘까지」
const missionDue = (m) => (m.active_until && isTodayKst(m.active_until) ? `${koTime(new Date(m.active_until))}까지` : '오늘까지')
const isQuizOpen = (q) => { const now = Date.now(); return (!q.start_at || new Date(q.start_at).getTime() <= now) && (!q.due_at || new Date(q.due_at).getTime() >= now) }
const quizDue = (q) => {
  if (!q.due_at) return null
  const n = dayIdx(new Date(q.due_at)) - dayIdx(new Date())
  return n <= 0 ? '오늘까지' : n === 1 ? '내일까지' : `D-${n}`
}
const fmtNum = (v) => Number(v).toLocaleString('ko-KR', { maximumFractionDigits: 1 })

// 만회 인증 — 반려 시각부터 24시간. 남은 시간(「20시간」·「35분」), 지났으면 null
const MAKEUP_HOURS = 24
const MAKEUP_MAX_REJECTS = 3
const makeupLeft = (reviewedAt) => {
  const ms = new Date(reviewedAt).getTime() + MAKEUP_HOURS * 3600000 - Date.now()
  if (ms <= 0) return null
  const h = Math.floor(ms / 3600000)
  return h >= 1 ? `${h}시간` : `${Math.max(1, Math.floor(ms / 60000))}분`
}

// ─── 진행 단계 — now(지금 할 차례) / wait(기다리는 중) / redo(다시 확인 필요) / done / todo ───
export function missionSteps(type, phase) {
  // 다시 확인(반려)은 운영자가 한 번 본 것 — 자동 승인 미션의 «점수 제외»도 심사 단계를 거친 셈이라 늘 3단계
  const labels = (type === 'AUTO' && phase !== 'redo') ? ['인증', '점수'] : ['인증', '심사', '점수']
  if (phase === 'act') return labels.map((label, i) => ({ label, state: i === 0 ? 'now' : 'todo' }))
  if (phase === 'wait') return labels.map((label, i) => ({ label: i === 1 ? '심사 중' : label, state: i === 0 ? 'done' : i === 1 ? 'wait' : 'todo' }))
  if (phase === 'redo') return labels.map((label, i) => ({ label: i === 1 ? '다시 확인' : label, state: i === 0 ? 'done' : i === 1 ? 'redo' : 'todo' }))
  return labels.map((label) => ({ label, state: 'done' }))
}
export function quizSteps(phase) {
  const labels = ['풀기', '채점', '점수']
  if (phase === 'act') return labels.map((label, i) => ({ label, state: i === 0 ? 'now' : 'todo' }))
  if (phase === 'wait') return labels.map((label, i) => ({ label: i === 1 ? '채점 중' : label, state: i === 0 ? 'done' : i === 1 ? 'wait' : 'todo' }))
  return labels.map((label) => ({ label, state: 'done' }))
}

// 예시(?todo=demo, 또는 오늘 할 일이 없는 계정에서 시안 확인용) — 레퍼런스 3건 + 반려(다시 확인) 1건
export const TODO_DEMO = {
  verifierCount: 27,
  items: [
    {
      key: 'd0', kind: 'redo', icon: '/icons/feature/mission.png', title: '아침 스트레칭 10분', sub: '어제 인증',
      memoBy: '김코치 운영자', memo: '동작이 보이게 전신이 나온 사진으로 다시 올려 주세요', memoNote: '20시간 안에 다시 올리면 인정돼요', action: '다시 인증', primary: true, go: null, steps: missionSteps('MANUAL', 'redo'),
    },
    { key: 'd1', kind: 'mission', icon: '/icons/running/shoe.png', title: '오늘 3km 달리기', sub: '오후 8시까지 · 10P', action: '인증', primary: true, go: null, steps: missionSteps('MANUAL', 'act') },
    { key: 'd2', kind: 'review', icon: '/icons/feature/mission.png', title: '어제 3km 달리기', sub: '5.2km · 어제 오후 7:40', action: '보기', primary: false, go: null, steps: missionSteps('MANUAL', 'wait') },
    { key: 'd3', kind: 'quiz', icon: '/icons/feature/quiz.png', title: '이번 주 건강 퀴즈', sub: '5문항 · 오늘까지 · 5P', action: '풀기', primary: true, go: null, steps: quizSteps('act') },
  ],
}

// 실제 데이터 → 항목. 다시 확인(만회 시간 제한) → 지금 할 일 → 기다리는 일 → 오늘 끝낸 일 순서.
function buildTodo({ pid, ownerName, missions, todayCounts, myVerifs, quizzes }) {
  const redo = []
  const act = []
  const wait = []
  const done = []
  const redoToday = new Set()   // 오늘 올린 것이 반려된 미션 — 같은 미션의 「인증」 항목과 겹치지 않게

  for (const v of myVerifs) {   // 내 인증 — 반려(만회 24시간) / 심사 중(최근 2주) / 오늘 승인된 것
    const m = v.missions || {}
    const val = v.numeric_value != null ? `${fmtNum(v.numeric_value)}${m.metric_unit || ''}` : null
    const when = `${dayWord(v.submitted_at)} ${koClock(new Date(v.submitted_at))}`
    const icon = resolveMissionIcon(m.icon_path) || '/icons/feature/mission.png'
    if (v.status === 'REJECTED') {
      const left = v.reviewed_at ? makeupLeft(v.reviewed_at) : null
      if (!left) continue   // 만회 시간이 지났으면 오늘 할 일에서 내린다(지난 기록은 마이페이지 「내 기록」)
      // 이미 다시 올렸으면 그 결과(심사 중·승인·또 반려)가 따로 보인다 — 만회 행은 제출 시각이 원래 날이라 시각 비교로는 못 찾는다
      if (myVerifs.some(o => o.makeup_of === v.id)) continue
      // 같은 인증 3번 반려 = 그날은 마감(알림으로 안내됨). 오늘 것이면 같은 미션 「인증」도 내린다
      const root = v.makeup_root || v.id
      const rejects = myVerifs.filter(o => (o.id === root || o.makeup_root === root) && o.status === 'REJECTED').length
      const today = isTodayKst(v.submitted_at)
      if (rejects >= MAKEUP_MAX_REJECTS) { if (today) redoToday.add(v.mission_id); continue }
      // 그날 몫이 이미 찼으면(그날 다른 인증이 들어감) 만회 자리가 없다 — 서버 하루 한도(169)와 같은 셈
      if (m.daily_limit != null && myVerifs.filter(o => o.mission_id === v.mission_id && o.status !== 'REJECTED'
        && dayIdx(new Date(o.submitted_at)) === dayIdx(new Date(v.submitted_at))).length >= m.daily_limit) continue
      if (today) redoToday.add(v.mission_id)
      redo.push({
        key: `r-${v.id}`, kind: 'redo', icon, title: m.title,
        sub: `${dayWord(v.submitted_at)} 인증`,
        memoNote: rejects >= MAKEUP_MAX_REJECTS - 1 ? `${left} 안에 다시 올려 주세요 · 마지막 기회예요` : `${left} 안에 다시 올리면 인정돼요`,
        memoBy: ownerName ? `${ownerName} 운영자` : '운영자',
        memo: (v.rejection_reason || '').trim() || null,
        action: '다시 인증', primary: true, go: `/programs/${pid}/missions/${v.mission_id}?redo=${v.id}`, steps: missionSteps('MANUAL', 'redo'),
      })
    } else if (v.status === 'PENDING_REVIEW') {
      // 만회는 제출 시각이 원래 날이라 「어제 오전 7:40」이 올린 시각처럼 보인다 → 「어제 인증 · 다시 올렸어요」
      const sub = v.makeup_of ? [val, `${dayWord(v.submitted_at)} 인증 · 다시 올렸어요`] : [val, when]
      wait.push({ key: `v-${v.id}`, kind: 'review', icon, title: m.title, sub: sub.filter(Boolean).join(' · '), action: '보기', primary: false, go: `/programs/${pid}?tab=missions`, steps: missionSteps('MANUAL', 'wait') })
    } else if (v.status === 'APPROVED' && isTodayKst(v.submitted_at)) {
      done.push({ key: `d-${v.id}`, kind: 'done', icon, title: m.title, sub: [val, `+${m.point || 0}P 받았어요`].filter(Boolean).join(' · '), action: '보기', primary: false, go: `/programs/${pid}?tab=missions`, steps: missionSteps(m.verification_type, 'done') })
    }
  }
  for (const m of missions) {   // 지금 인증할 미션 — 오늘 열려 있고(기간·요일·제외기간) 오늘 할당량이 남은 것
    if (!inWindowNow(m) || !checkMissionToday(m).active) continue
    if ((todayCounts[m.id]?.total || 0) >= (m.daily_limit || 1)) continue
    if (redoToday.has(m.id)) continue   // 오늘 것이 반려됐으면 「다시 인증」 하나로 충분
    act.push({
      key: `m-${m.id}`, kind: 'mission', icon: resolveMissionIcon(m.icon_path) || '/icons/feature/mission.png',
      title: m.title, sub: `${missionDue(m)} · ${m.point || 0}P`, action: '인증', primary: true,
      go: `/programs/${pid}/missions/${m.id}`, steps: missionSteps(m.verification_type, 'act'),
    })
  }
  for (const q of quizzes) {    // 퀴즈 — 지금 풀 수 있고 안 낸 것 / 낸 뒤 채점 중
    const go = `/programs/${pid}/quiz/${q.id}`
    if (!q.mySubmission && isQuizOpen(q)) {
      act.push({
        key: `q-${q.id}`, kind: 'quiz', icon: '/icons/feature/quiz.png', title: q.title,
        sub: [q.questionCount ? `${q.questionCount}문항` : null, quizDue(q), q.totalPoint ? `${q.totalPoint}P` : null].filter(Boolean).join(' · '),
        action: '풀기', primary: true, go, steps: quizSteps('act'),
      })
    } else if (q.mySubmission?.status === 'PENDING') {
      wait.push({ key: `qw-${q.id}`, kind: 'quiz', icon: '/icons/feature/quiz.png', title: q.title, sub: '제출했어요 · 운영자 채점을 기다려요', action: '보기', primary: false, go, steps: quizSteps('wait') })
    }
  }
  return [...redo, ...act, ...wait, ...done]
}

/** 실제 데이터 묶음 — 그 프로그램의 미션·오늘 인증 수·내 인증(2주)·퀴즈·오늘 인증한 사람 수 */
export function useTodayTodo(program, userId) {
  const pid = program?.id
  const ownerName = program?.owner_nickname || null
  const on = !!pid && !!userId
  const { data: missions = [] } = useQuery({ queryKey: ['dev-todo-missions', pid], queryFn: () => fetchProgramMissions(pid), enabled: on })
  const { data: todayCounts = {} } = useQuery({ queryKey: ['dev-todo-today-counts', userId], queryFn: () => fetchTodayCounts(userId), enabled: on })
  const { data: myVerifs = [] } = useQuery({
    queryKey: ['dev-todo-my-verifs', pid, userId],
    queryFn: async () => {
      // 최근 2주 — 제출·심사·만회 중 하나라도 2주 안이면. 만회 행은 제출 시각이 원래 날이라 제출 시각만 보면 빠진다.
      const since = new Date(Date.now() - 14 * 86400000).toISOString()
      const run = (withMakeup) => supabase
        .from('verifications')
        .select(`id, mission_id, status, submitted_at, reviewed_at, rejection_reason, numeric_value${withMakeup ? ', makeup_of, makeup_root' : ''}, missions!inner(title, point, icon_path, metric_unit, verification_type, daily_limit, program_id)`)
        .eq('user_id', userId).eq('missions.program_id', pid)
        .in('status', ['PENDING_REVIEW', 'APPROVED', 'REJECTED'])
        .or(withMakeup ? `submitted_at.gte.${since},reviewed_at.gte.${since},makeup_at.gte.${since}` : `submitted_at.gte.${since},reviewed_at.gte.${since}`)
        .order('submitted_at', { ascending: false })
      let { data, error } = await run(true)
      if (error?.code === '42703') ({ data, error } = await run(false))   // 마이그 283 적용 전(만회 열 없음) — 만회 없이
      if (error) throw error
      return data || []
    },
    enabled: on,
  })
  const { data: quizzes = [] } = useQuery({
    queryKey: ['dev-todo-quizzes', pid], queryFn: () => fetchParticipantQuizzes(pid), enabled: on && program?.quiz_enabled === true,
  })
  // 오늘 이 프로그램에서 인증한 사람 수 — 내가 볼 수 있는 인증 범위에서 센다(시안). 실제 반영 땐 집계 함수(RPC)로.
  const { data: verifierCount = 0 } = useQuery({
    queryKey: ['dev-todo-verifiers', pid],
    queryFn: async () => {
      const start = new Date(`${formatKstDate(new Date())}T00:00:00+09:00`).toISOString()
      const { data, error } = await supabase
        .from('verifications')
        .select('user_id, missions!inner(program_id)')
        .eq('missions.program_id', pid)
        .in('status', ['PENDING_REVIEW', 'APPROVED'])
        .gte('submitted_at', start)
      if (error) throw error
      return new Set((data || []).map(v => v.user_id)).size
    },
    enabled: on,
  })
  const items = useMemo(
    () => buildTodo({ pid, ownerName, missions, todayCounts, myVerifs, quizzes }),
    [pid, ownerName, missions, todayCounts, myVerifs, quizzes],
  )
  return { items, verifierCount }
}
