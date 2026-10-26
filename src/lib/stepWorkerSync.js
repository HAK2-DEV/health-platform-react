// 걷기 프로그램 참여 상태 ↔ 걸음 일꾼 켜기/끄기 + 미션 날 자동 인증 (2026-10-26, 자체 만보기 1차).
//   언제: 로그인 직후, 앱이 앞으로 돌아올 때(StepWorkerSync 컴포넌트). 네이티브 앱에서만 일한다.
//   규칙(본인 결정 10-26): 스위치 단위는 «프로그램 기간». 걷기 테마(theme='WALKING') 프로그램에 ACTIVE 로 참여 중이고
//   그 프로그램이 «오늘 운영 중»(PUBLISHED + 시작일~종료일)이면 켜고, 아니면 끈다. 미션 요일은 인증 여부만 정한다
//   (쉬는 날도 세되 느리게 — 네이티브가 처리). 종료일은 네이티브에도 넘겨(until) 앱을 안 열어도 그날 밤 스스로 꺼진다.
//   걷기 테마가 아닌 프로그램이라도 «살아 있는 걸음 미션»이 있으면 같이 센다(플래그로 만든 옛 미션이 켜졌다 꺼졌다 하지 않게).
//   권한이 아직 없으면 여기서 묻지 않는다 — 고지(prominent disclosure) 뒤에 StepsVerify 가 묻는다.
import { supabase } from '../supabaseClient'
import { fetchActivePrograms } from './queries'
import { checkMissionToday, getTodayKST } from './formatters'
import { isNativePlatform, getStepStatus, startStepWorker, stopStepWorker, getTodayStepCount } from './stepCounter'

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7]

// 프로그램이 «오늘» 운영 중인가 — PUBLISHED + 날짜 창(KST, 'YYYY-MM-DD' 문자열 비교). 종료일 없으면 상시.
export function isProgramLiveToday(p, todayKst = getTodayKST()) {
  if (p?.status !== 'PUBLISHED') return false
  if (p.start_date && String(p.start_date).slice(0, 10) > todayKst) return false
  if (p.end_date && String(p.end_date).slice(0, 10) < todayKst) return false
  return true
}

export function isWalkingProgram(p) {
  return p?.theme === 'WALKING' && isProgramLiveToday(p)
}

// 미션이 지금 운영 기간 안인가 (active_from ~ active_until)
export function isMissionLive(m, now = new Date()) {
  if (m?.active_from && now < new Date(m.active_from)) return false
  if (m?.active_until && now > new Date(m.active_until)) return false
  return true
}

// 미션의 인증 요일(ISO 1~7). schedule_mode 를 요일 목록으로 편다.
export function missionDays(m) {
  const mode = m?.schedule_mode || 'ALL_DAYS'
  if (mode === 'WEEKDAYS') return [1, 2, 3, 4, 5]
  if (mode === 'WEEKENDS') return [6, 7]
  if (mode === 'CUSTOM') return (m.active_days || []).filter((d) => d >= 1 && d <= 7)
  return ALL_DAYS
}

// 여러 걸음 미션의 요일 합집합 — 7일 전부면 [] (네이티브에서 「매일」)
export function unionDays(missions) {
  const set = new Set()
  for (const m of missions) for (const d of missionDays(m)) set.add(d)
  return set.size >= 7 ? [] : [...set].sort()
}

// 알림에 보여줄 목표 — 오늘 인증하는 미션 중 가장 큰 목표. 오늘 없으면 전체 중 가장 큰 것.
export function todayGoal(missions) {
  const today = missions.filter((m) => checkMissionToday(m).active)
  const pool = today.length ? today : missions
  return pool.reduce((g, m) => Math.max(g, Number(m.step_goal) || 0), 0)
}

// 일꾼 기한(ms) — 걷기 프로그램 종료일 23:59:59 KST 중 가장 늦은 것. 종료일 없는 프로그램이 하나라도 있으면 0(기한 없음).
export function workerUntil(programs) {
  let max = 0
  for (const p of programs) {
    if (!p?.end_date) return 0
    const t = new Date(`${String(p.end_date).slice(0, 10)}T23:59:59+09:00`).getTime()
    if (Number.isFinite(t) && t > max) max = t
  }
  return max
}

// 내 걷기 프로그램과 그 안의 «살아 있는» 걸음 미션 (한 번의 미션 쿼리로)
export async function fetchMyWalkingContext(userId) {
  const live = (await fetchActivePrograms(userId)).filter((p) => isProgramLiveToday(p))
  if (!live.length) return { programs: [], stepMissions: [] }
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .in('program_id', live.map((p) => p.id))
    .eq('verify_style', 'steps')
  if (error) throw error
  const stepMissions = (data || []).filter((m) => isMissionLive(m))
  const withSteps = new Set(stepMissions.map((m) => m.program_id))
  const programs = live.filter((p) => p.theme === 'WALKING' || withSteps.has(p.id))
  return { programs, stepMissions }
}

// 일꾼 동기화 — 돌려주는 kind: 'web'|'plugin_missing'|'no_sensor'|'off'|'noperm'|'running'|'error'
export async function syncStepWorker(userId) {
  if (!isNativePlatform() || !userId) return { kind: 'web' }
  const status = await getStepStatus()
  if (['web', 'plugin_missing', 'no_sensor', 'error'].includes(status.kind)) return status
  const ctx = await fetchMyWalkingContext(userId)
  if (!ctx.programs.length) {
    if (status.enabled) await stopStepWorker()
    return { ...status, kind: 'off', ...ctx }
  }
  if (status.kind !== 'ready') return { ...status, ...ctx }   // noperm — StepsVerify 가 고지 뒤 묻는다
  const st = await startStepWorker({
    goal: todayGoal(ctx.stepMissions),
    activeDays: unionDays(ctx.stepMissions),
    programName: ctx.programs[0]?.name || '',
    until: workerUntil(ctx.programs),
  })
  return { ...st, kind: st.kind === 'running' ? 'running' : st.kind, ...ctx }
}

// 오늘 KST 자정 이후 내가 낸 인증이 있는 미션 id 집합
async function fetchTodayVerifiedMissionIds(userId, missionIds) {
  if (!missionIds.length) return new Set()
  const since = new Date(`${getTodayKST()}T00:00:00+09:00`).toISOString()
  const { data, error } = await supabase
    .from('verifications')
    .select('mission_id')
    .eq('user_id', userId)
    .in('mission_id', missionIds)
    .gte('submitted_at', since)
  if (error) throw error
  return new Set((data || []).map((r) => r.mission_id))
}

// 인증 피드 공개 여부 — MissionVerifyPage 와 같은 규칙: 피드 켜진 프로그램만, 정책(public/private)이 있으면 그대로,
//   참여자 선택이면 기본 공개(제출 화면의 기본값과 동일).
function feedVisibleFor(program) {
  if (!program?.feed_enabled) return undefined
  const boards = program?.community_settings?.boards
  const cert = Array.isArray(boards) ? boards.find((b) => b.id === 'cert') : null
  const policy = cert?.feedVisibility || 'public'
  return policy === 'private' ? false : true
}

// 미션 날 자동 인증 — 오늘 인증하는 걸음 미션 중 목표를 넘겼고 아직 안 낸 것을 낸다.
//   MissionVerifyPage 의 걸음 제출과 같은 모양({id, mission_id, user_id, numeric_value[, feed_visible]}) — 서버 트리거가 점수·상태·하루 한도를 정한다.
//   돌려주는 값: 자동 인증한 미션 배열(없으면 []).
export async function autoVerifyStepMissions(userId, stepMissions, programs = []) {
  if (!isNativePlatform() || !userId || !stepMissions?.length) return []
  const todays = stepMissions.filter((m) => checkMissionToday(m).active && (Number(m.step_goal) || 0) > 0)
  if (!todays.length) return []
  const steps = await getTodayStepCount()
  if (!Number.isFinite(steps) || steps <= 0) return []
  const reached = todays.filter((m) => steps >= Number(m.step_goal))
  if (!reached.length) return []
  const done = await fetchTodayVerifiedMissionIds(userId, reached.map((m) => m.id))
  const byProgram = new Map(programs.map((p) => [p.id, p]))
  const submitted = []
  for (const m of reached) {
    if (done.has(m.id)) continue
    const row = { id: crypto.randomUUID(), mission_id: m.id, user_id: userId, numeric_value: steps }
    const fv = feedVisibleFor(byProgram.get(m.program_id))
    if (fv !== undefined) row.feed_visible = fv
    const { error } = await supabase.from('verifications').insert(row)
    if (!error) submitted.push({ ...m, _steps: steps })
  }
  return submitted
}
