/**
 * 「오늘 할 일」 — 데이터·규칙(화면은 components/program/TodayTodoCard.jsx). 표준 카드홈의 참여자에게(ProgramDetailPage).
 *   2026-10-06 dev 시안(/dev/program)에서 다듬고 2026-10-08 실제 화면에 붙였다(본인 「실배선」).
 *   항목: 다시 확인(반려 24시간) → 지금 할 일(오늘 열린 미션·풀 퀴즈) → 기다리는 일(심사 중 2주·채점 중) → 오늘 끝낸 일.
 *   쿼리는 상세 화면과 «같은 키»(미션·오늘 인증 수·퀴즈) → 요청이 늘지 않고, 인증 제출 뒤 무효화도 함께 탄다.
 *   화면 파일과 나눈 건 빠른 새로고침 규칙(부품 파일은 부품만 내보낸다) 때문.
 *
 * 만회 인증(본인 결정 2026-10-06, 마이그 283): 반려 뒤 24시간 안에 다시 올리면 원래 날로 인정.
 *   «다시 확인» 목록은 hooks/useRedoVerifications(규칙은 lib/makeup.js)에서 받는다 — 24시간·3번 마감·그날 몫을
 *   여기서 다시 계산하지 않는다(카드홈 «다시 인증» 카드와 이 칸이 서로 다른 말을 하지 않게).
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { queryKeys, fetchProgramMissions, fetchTodayCounts, fetchParticipantQuizzes } from './queries'
import { checkMissionToday } from './formatters'
import { resolveMissionIcon } from './missionIcons'
import { useRedoVerifications } from '../hooks/useRedoVerifications'

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

// 만회(다시 확인) 규칙은 lib/makeup.js + hooks/useRedoVerifications 가 «한 벌»로 갖고 있다 — 여기선 목록을 항목으로 바꾸기만.

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
//   redoItems = useRedoVerifications 결과(지금 다시 올릴 수 있는 반려 인증) — 반려 규칙 판정은 거기서 끝났다.
function buildTodo({ pid, ownerName, missions, todayCounts, myVerifs, quizzes, redoItems = [] }) {
  const act = []
  const wait = []
  const done = []
  // 오늘 올린 것이 반려된 미션 — 같은 미션의 「인증」 항목과 겹치지 않게(「다시 인증」 하나로 충분)
  const redoToday = new Set(redoItems.filter(it => it.dayWord === '오늘').map(it => it.missionId))
  const memoBy = ownerName ? `${ownerName} 운영자` : '운영자'
  const redo = redoItems.map((it) => ({
    key: `r-${it.id}`, kind: 'redo', title: it.title,
    icon: resolveMissionIcon(missions.find(x => x.id === it.missionId)?.icon_path) || '/icons/feature/mission.png',
    sub: `${it.dayWord} 인증`,
    memoNote: it.lastChance ? `${it.left} 안에 다시 올려 주세요 · 마지막 기회예요` : `${it.left} 안에 다시 올리면 인정돼요`,
    memoBy, memo: it.reason,
    action: '다시 인증', primary: true, go: `/programs/${pid}/missions/${it.missionId}?redo=${it.id}`, steps: missionSteps('MANUAL', 'redo'),
  }))

  for (const v of myVerifs) {   // 내 인증 — 심사 중(최근 2주) / 오늘 승인된 것. 반려는 위 redoItems 가 맡는다
    const m = v.missions || {}
    const val = v.numeric_value != null ? `${fmtNum(v.numeric_value)}${m.metric_unit || ''}` : null
    const when = `${dayWord(v.submitted_at)} ${koClock(new Date(v.submitted_at))}`
    const icon = resolveMissionIcon(m.icon_path) || '/icons/feature/mission.png'
    if (v.status === 'REJECTED') continue   // 반려는 위 redoItems 가 맡는다
    if (v.status === 'PENDING_REVIEW') {
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

const EMPTY = []   // 빈 목록은 늘 같은 배열 — 메모 의존성이 매번 바뀌지 않게

/**
 * 실제 데이터 묶음 — 그 프로그램의 미션·오늘 인증 수·내 인증(2주)·퀴즈·오늘 인증한 사람 수.
 *   enabled=false 면 아무것도 부르지 않고 빈 목록(운영자·둘러보기·다른 홈·종료된 프로그램).
 */
export function useTodayTodo({ programId, userId, ownerName = null, quizEnabled = false, enabled = true }) {
  const pid = programId
  const on = enabled && !!pid && !!userId
  // 다시 확인(반려 만회) — 카드홈 «다시 인증» 카드와 같은 훅·같은 키 → 같은 캐시, 같은 판정
  const redoItems = useRedoVerifications(pid, userId, { enabled: on })
  // 상세 화면과 같은 키·같은 함수 — 캐시를 함께 쓴다
  const { data: missionsRaw = [] } = useQuery({ queryKey: queryKeys.programMissions(pid), queryFn: () => fetchProgramMissions(pid), enabled: on })
  const { data: todayCounts = {} } = useQuery({ queryKey: queryKeys.todayCounts(userId), queryFn: () => fetchTodayCounts(userId), enabled: on })
  const { data: quizzes = [] } = useQuery({ queryKey: queryKeys.participantQuizzes(pid, userId), queryFn: () => fetchParticipantQuizzes(pid), enabled: on && quizEnabled })
  // 내 인증(심사 중·승인) — 'verifications' 아래 키라 인증 제출·심사 뒤 무효화(앞자리 일치)를 함께 탄다
  const { data: myVerifs = [] } = useQuery({
    queryKey: ['verifications', 'todayTodo', pid, userId],
    queryFn: async () => {
      // 최근 2주 — 제출·심사·만회 중 하나라도 2주 안이면. 만회 행은 제출 시각이 원래 날이라 제출 시각만 보면 빠진다.
      const since = new Date(Date.now() - 14 * 86400000).toISOString()
      const { data, error } = await supabase
        .from('verifications')
        .select('id, mission_id, status, submitted_at, numeric_value, makeup_of, missions!inner(title, point, icon_path, metric_unit, verification_type, program_id)')
        .eq('user_id', userId).eq('missions.program_id', pid)
        .in('status', ['PENDING_REVIEW', 'APPROVED'])
        .or(`submitted_at.gte.${since},reviewed_at.gte.${since},makeup_at.gte.${since}`)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: on,
  })
  // 오늘 이 프로그램에서 인증한 사람 수 — 서버 집계(마이그 286). 참여자는 남의 «심사 중·비공개» 인증을 읽지 못해
  //   화면에서 세면 적게 나온다. 함수가 아직 없거나(286 적용 전) 실패하면 0 → 그 줄만 그리지 않는다.
  const { data: verifierCount = 0 } = useQuery({
    queryKey: ['verifications', 'todayVerifiers', pid],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_program_today_verifier_count', { p_program_id: pid })
      return error ? 0 : (Number(data) || 0)
    },
    enabled: on,
    staleTime: 60_000,
  })
  // 미션 순서 — 상세 화면 미션 탭과 같게(sort_order 우선, 없으면 만든 순)
  const missions = useMemo(() => [...missionsRaw].sort((a, b) =>
    ((a.sort_order ?? 1e9) - (b.sort_order ?? 1e9)) || (new Date(a.created_at) - new Date(b.created_at))), [missionsRaw])
  // 퀴즈가 꺼진 프로그램 — 캐시에 남은 퀴즈 목록이 있어도 넣지 않는다(꺼진 쿼리도 캐시 값은 돌려준다)
  const quizList = quizEnabled ? quizzes : EMPTY
  const items = useMemo(
    () => (on ? buildTodo({ pid, ownerName, missions, todayCounts, myVerifs, quizzes: quizList, redoItems }) : EMPTY),
    [on, pid, ownerName, missions, todayCounts, myVerifs, quizList, redoItems],
  )
  return { items, verifierCount: on ? verifierCount : 0 }
}
