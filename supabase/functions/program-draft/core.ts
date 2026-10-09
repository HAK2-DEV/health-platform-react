// program-draft 핵심 — 프롬프트 · 응답 스키마 · 후처리(결정 규칙) · 검사.
//   「AI와 함께 만들기」 기능 단계 1(2026-10-09). 뼈대는 src/pages/dev/AiBuilderDemo.jsx(/dev/ai-builder) — 화면 규칙은 거기서 정했다.
//
//   ⭐ 원칙(본인 2026-10-09 「우리의 문화는 신뢰와 편의」):
//     · 모델에게는 «글»만 맡긴다 — 미션 이름·설명·짠 이유·안전하게 고친 문구.
//     · 켜고 끄는 것(분위기별 기능)·숫자(기간·점수·심사 시간)·안전 규칙·마음 건강 기본값은 «여기서» 정한다.
//       같은 입력이면 늘 같은 규칙, 모델이 바뀌어도 규칙은 안 바뀐다.
//   ⚠️ Deno(엣지 함수)·Vite(화면)·Node(로컬 검사 스크립트)가 «같은 파일»을 쓴다 → Deno 전용 import 금지, 지워지는 타입 문법만.
//   ⚠️ 앱 쪽 목록(퀴즈 주제·미션 아이콘·이름 길이)을 복사해 둔다 — 엣지 함수는 src/ 를 import 할 수 없다. 동기 검사는 로컬 검사 스크립트가 한다.
//   2026-10-10 리뷰(6관점 + 반박 검증 3표, 확인 31건) 반영: 설계도 정리(길이·마음 건강 판별·금연), 무료 AI 에 처음 적은 문장 안 보냄,
//     심사 선택 존중·많은 날 기준 심사 시간, 금연·달리기 전용 홈의 숫자 칸, 안전 사전 오탐·누락, 고친 문구 검증, 이름 20자, 조사·도담 이름.

// ─── 입력 — 설계도(blueprint). 화면의 질문·계획서·첫 문장이 채운다 ───
export type Blueprint = {
  goal: string                    // 아는 목표(KNOWN_GOALS) 또는 운영자가 적은 말 그대로
  goalRaw?: string | null         // 운영자가 쓴 말(「명상」) — 이름·설명엔 이 말을 쓴다
  target?: string | null          // 직원·동료 / 회원·고객 / 가족 / 친구·모임 / 학생 / 주민 / 직접 적은 말
  org?: 'org' | 'casual' | null
  headcount?: number | null
  mood?: 'growth' | 'compete' | 'team' | null
  moodAsked?: 'growth' | 'compete' | 'team' | null   // 운영자가 고른 분위기 — 엔진이 바꿨을 때만(금연) 남겨 이유를 말한다
  durationDays?: number | null
  mode?: 'AUTO' | 'MANUAL' | null
  freeText?: string | null        // 시작 화면에 적은 말 — 검사에만 쓰고 무료 AI 에는 보내지 않는다
  orgName?: string | null         // 브랜딩(기관일 때)
  kpi?: string[] | null           // 계획서의 성과 지표
  missionHints?: string[] | null  // 계획서의 미션 후보
  claims?: string[] | null        // 계획서에서 읽은 «효과 약속» 문장
  source?: 'plan' | 'text' | null
  join?: 'invite' | 'public_approval' | 'public_free' | null   // 참여 방법(마법사 3단계를 AI 질문으로 옮김, 본인 2026-10-10)
}

// ─── 참여 방법 — 마법사 3단계(공개 여부·참여 승인·정원)를 AI 질문 하나로(본인 2026-10-10: 「이미 정한 걸 또 묻으면 AI로 만든 게 더 귀찮다」) ───
//   invite = 비공개 + 초대 링크·코드로 바로 참여 / public_approval = 공개 + 운영자가 확인하고 받기 / public_free = 공개 + 바로 참여.
//   비공개+승인·참여 전 둘러보기·입장 질문은 묻지 않고 마법사 기본값 — 모두 프로그램 설정에서 바꿀 수 있다(ProgramEditModal).
//   정원은 묻지 않는다 — 마법사처럼 최대값(베타 100명, Step3JoinConditions 의 상한과 같아야 한다). 인원이 넘으면 운영 점검이 알린다.
export const JOINS = ['invite', 'public_approval', 'public_free'] as const
export const PARTICIPANT_MAX = 100
export const JOIN_LABEL: Record<string, string> = {
  invite: '초대 링크로만 · 받은 사람은 바로 참여',
  public_approval: '누구나 찾아서 신청 · 운영자가 확인하고 받기',
  public_free: '누구나 찾아서 바로 참여',
}
const JOIN_WHY: Record<string, string> = {
  invite: '초대 링크를 받은 사람만 바로 참여해요 — 공개·승인·정원은 프로그램 설정에서 바꿀 수 있어요',
  public_approval: '누구나 둘러보기에서 찾아 신청하고, 운영자가 확인해서 받아요 — 설정에서 바꿀 수 있어요',
  public_free: '누구나 둘러보기에서 찾아 바로 참여해요 — 설정에서 바꿀 수 있어요',
}
// 추천 — 주민 대상(보건소 등)은 널리 알리는 경우가 많아 «공개 + 확인하고 받기», 그 밖은 아는 사람끼리라 «초대 링크»
export function recommendedJoin(bp: Blueprint): { join: 'invite' | 'public_approval', why: string } {
  return bp.target === '주민'
    ? { join: 'public_approval', why: '주민 대상은 둘러보기에서 찾아오게 열어 두고, 신청을 확인해서 받는 경우가 많아요' }
    : { join: 'invite', why: '함께할 사람이 정해져 있으면 초대 링크가 가장 간단해요' }
}

export const KNOWN_GOALS = ['걷기', '달리기', '웨이트', '금연', '식단', '스트레칭', '수면', '마음관리']
// 목표 → 프로그램 카테고리(앱 CATEGORY 키). 근력·스트레칭 전용이 없어 「운동」(WALKING).
//   식단은 DIET 가 v1 선택 목록에서 빠져 있고 전용 홈(DietOverview)으로 가서 «초안 스켈레톤(표준 카드홈)»과 다르다 → 기타(ETC). 식단 재도입 때 DIET 로.
export const CATEGORY_OF: Record<string, string> = {
  걷기: 'WALKING', 웨이트: 'WALKING', 스트레칭: 'WALKING', 달리기: 'RUNNING', 금연: 'NO_SMOKING', 식단: 'ETC', 수면: 'SLEEP', 마음관리: 'MINDCARE',
}
export const CATEGORY_LABEL: Record<string, string> = { WALKING: '운동', RUNNING: '달리기', NO_SMOKING: '금연', SLEEP: '수면', MINDCARE: '마음관리', ETC: '기타' }
// 카테고리가 정하는 전용 홈 — 마법사 2단계가 카테고리로 theme 을 정한다(Step2Type: 금연 → QUIT_SMOKING, 달리기 → RUNNING).
//   전용 홈은 정해진 숫자 칸을 모아 보여 준다 — 그래서 이 두 목표의 미션은 그 칸 이름을 쓴다(BANK 참고).
export const HOME_THEME_OF: Record<string, string> = { NO_SMOKING: 'QUIT_SMOKING', RUNNING: 'RUNNING' }
// 프로그램 이름 최대 길이 — src/lib/constants.js PROGRAM.NAME_MAX_LENGTH 와 같아야 한다(마법사 1단계가 넘으면 막는다)
export const NAME_MAX = 20

// 퀴즈 — 문항은 AI 가 쓰지 않는다. 검수된 라이브러리(src/lib/quizLibrary.js QUIZ_AUDIENCES)에서 대상·주제를 «고르기만».
export const AUDIENCE_TOPICS: Record<string, string[]> = {
  general_adult: ['smoking', 'activity', 'nutrition', 'general', 'mind'],
  worker: ['smoking', 'alcohol', 'nutrition', 'activity', 'musculo_eye', 'sleep', 'job_stress', 'oral', 'addiction', 'cardio', 'cancer', 'obesity'],
}
const TOPIC_OF: Record<string, Record<string, string>> = {
  걷기: { general_adult: 'activity', worker: 'activity' },
  달리기: { general_adult: 'activity', worker: 'activity' },
  웨이트: { general_adult: 'activity', worker: 'activity' },
  스트레칭: { general_adult: 'activity', worker: 'musculo_eye' },
  금연: { general_adult: 'smoking', worker: 'smoking' },
  식단: { general_adult: 'nutrition', worker: 'nutrition' },
  수면: { general_adult: 'general', worker: 'sleep' },
  마음관리: { general_adult: 'mind', worker: 'job_stress' },
}
// 미션 아이콘 — src/lib/missionIcons.js MISSION_ICONS 와 같아야 한다
export const MISSION_ICONS = ['diet.png', 'water.png', 'exercise.png', 'walk.png', 'running.png', 'stretching.png', 'sleep.png', 'meditation.png', '/icons/meditation/meditate.png', 'nosmoke.png', 'reading.png', 'diary.png', 'photo.png']
const ICON_OF_GOAL: Record<string, string> = {
  걷기: 'walk.png', 달리기: 'running.png', 웨이트: 'exercise.png', 금연: 'nosmoke.png', 식단: 'diet.png', 스트레칭: 'stretching.png', 수면: 'sleep.png', 마음관리: 'meditation.png',
}

// ─── 목표 말 사전 — 운영자가 적은 말 → 아는 목표(화면·서버 공통) ───
//   마음 건강이 먼저: 109 안내·인증 기본 비공개·사진 금지가 여기에 걸려 있어서, 애매하면 마음 건강 쪽으로 읽는다.
//   「마음」 한 글자로는 보지 않는다(「마음 맞는 동료와 걷기」는 걷기). 「멘탈 헬스」처럼 띄어 쓴 말·「자살예방」「심리」「번아웃」도 본다.
export const MIND_RE = /명상|마음\s*(건강|챙김|돌봄|돌보|관리|치유|회복|근력)|정신\s*건강|정신과|심리|스트레스|불안|우울|번아웃|탈진|멘탈|자살|자해|힐링|감정\s*(관리|돌봄|조절)/
export const GOAL_ALIASES: [RegExp, string][] = [
  [MIND_RE, '마음관리'],
  [/웨이트|근력|헬스/, '웨이트'],
  [/걷기|걷|산책|만보/, '걷기'],
  [/달리기|러닝|조깅|마라톤/, '달리기'],
  [/금연|담배|흡연/, '금연'],
  [/식단|다이어트|식사|식습관/, '식단'],
  [/스트레칭|요가|필라테스/, '스트레칭'],
  [/수면|잠/, '수면'],
]
// 직접 적은 목표 읽기 — 아는 말이면 그 틀로(이해한 내용을 한 줄로 알린다), 모르는 말이면 «적은 그대로»(조용히 다른 목표로 바꾸지 않는다)
export function normalizeGoal(raw: string): { goal: string, goalRaw: string, goalNote: string | null } {
  const t = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)
  for (const [re, g] of GOAL_ALIASES) {
    if (re.test(t)) return { goal: g, goalRaw: t, goalNote: g === t ? null : `「${t}」 — ${g} 프로그램으로 짤게요` }
  }
  return { goal: t, goalRaw: t, goalNote: `「${t}」에 맞춰 미션을 처음부터 짤게요` }
}

// ─── 설계도 정리 — 서버·화면 공통 입구(리뷰 2026-10-10) ───
//   · 글 길이 상한: 긴 글 한 번으로 무료 AI 한도를 다 쓰거나(프롬프트에 들어감) 검사 정규식이 오래 도는 것을 막는다.
//   · 목표 말 다시 읽기: 화면의 말 사전이 놓쳐도 서버가 한 번 더 — 마음 건강 판별에 109 안내·기본 비공개·사진 금지가 걸려 있다.
//   · 금연은 순위·팀을 쓰지 않는다(도담 금연 프로그램 방식 — 마법사 2단계도 끈다). 고른 분위기는 moodAsked 로 남겨 이유를 말한다.
//   같은 값을 두 번 넣어도 결과가 같다(멱등) — 화면에서 한 번, 서버에서 한 번 거친다.
export const LIMITS = { word: 30, freeText: 300, orgName: 40, listItem: 100, listLen: 6 }
const MOODS = ['growth', 'compete', 'team'] as const
const sstr = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v : (typeof v === 'number' && Number.isFinite(v) ? String(v) : '')
  const out = s.replace(/\s+/g, ' ').trim().slice(0, max)
  return out || null
}
const sint = (v: unknown, lo: number, hi: number): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null
}
const slist = (v: unknown): string[] | null => {
  if (!Array.isArray(v)) return null
  const out = v.map((x) => sstr(x, LIMITS.listItem)).filter((x): x is string => !!x).slice(0, LIMITS.listLen)
  return out.length ? out : null
}
function oneOf<T extends string>(v: unknown, list: readonly T[]): T | null {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? v as T : null
}
export function sanitizeBlueprint(input: unknown): Blueprint {
  const r = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  let goal = sstr(r.goal, LIMITS.word) || ''
  let goalRaw = sstr(r.goalRaw, LIMITS.word)
  if (goal && !KNOWN_GOALS.includes(goal)) {
    const n = normalizeGoal(goal)
    if (n.goal !== goal) { goalRaw = goalRaw || goal; goal = n.goal }
  }
  if (goal !== '마음관리' && MIND_RE.test(`${goalRaw || ''} ${goal}`)) { goalRaw = goalRaw || goal; goal = '마음관리' }
  const moodIn = oneOf(r.mood, MOODS)
  const moodAsked = oneOf(r.moodAsked, MOODS) || moodIn
  const mood = goal === '금연' && moodIn && moodIn !== 'growth' ? 'growth' : moodIn
  return {
    goal,
    goalRaw,
    target: sstr(r.target, LIMITS.word),
    org: oneOf(r.org, ['org', 'casual'] as const),
    headcount: sint(r.headcount, 1, 1000000),
    mood,
    moodAsked: moodAsked && moodAsked !== mood ? moodAsked : null,
    durationDays: sint(r.durationDays, 3, 365),
    mode: oneOf(r.mode, ['AUTO', 'MANUAL'] as const),
    freeText: sstr(r.freeText, LIMITS.freeText),
    orgName: sstr(r.orgName, LIMITS.orgName),
    kpi: slist(r.kpi),
    missionHints: slist(r.missionHints),
    claims: slist(r.claims),
    source: oneOf(r.source, ['plan', 'text'] as const),
    join: oneOf(r.join, JOINS),
  }
}

// ─── 분위기 → 기능(실제 프로그램 스위치). 모델이 아니라 여기서 정한다 ───
//   불꽃은 세 분위기 모두 — 결과와 상관없이 꾸준함을 뒤에서 응원(본인 2026-10-09). 시상대·팀은 랭킹에 딸림.
export const MOOD_FEATURES: Record<string, { ranking: boolean, podium: boolean, flame: boolean, team: boolean, cheer: boolean }> = {
  growth: { ranking: false, podium: false, flame: true, team: false, cheer: true },
  compete: { ranking: true, podium: true, flame: true, team: false, cheer: true },
  team: { ranking: true, podium: false, flame: true, team: true, cheer: true },
}
const MOOD_LABEL: Record<string, string> = { growth: '성장형', compete: '경쟁형', team: '팀형' }
const MOOD_WHY: Record<string, string> = {
  growth: '순위표는 끄고, 꾸준함은 불꽃·주간 스트릭으로 응원해요',
  compete: '랭킹·시상대·불꽃을 켰어요. 순위는 기본으로 인증 점수로 매겨요',
  team: '팀과 팀 순위를 켰어요. 팀 점수는 평균이라 인원이 다른 팀끼리도 공정해요',
}
// 분위기에 맞춘 미션 1개 — 어떤 목표에도 어울리게(명상·독서에도). 「분위기 추천」으로 표시된다
const MOOD_MISSION: Record<string, ModelMission> = {
  growth: { title: '이번 주 돌아보기 한 줄', instruction: '한 주를 돌아보며 잘한 점 하나를 한 줄로 남겨요.', icon: 'diary.png', proof: 'note', schedule: 'CUSTOM', activeDays: [7], point: 10 },
  compete: { title: '이번 주 5일 채우기 도전', instruction: '이번 주에 5일 이상 미션을 했다면 인증해요. 한 줄 소감은 선택이에요.', icon: 'photo.png', proof: 'check', schedule: 'CUSTOM', activeDays: [7], point: 10 },
  team: { title: '팀원과 함께 인증', instruction: '이번 주에 팀원과 함께한 순간을 사진으로 남겨요.', icon: 'photo.png', proof: 'photo', schedule: 'WEEKENDS', activeDays: [], point: 10 },
}

// 분위기 미션 고르기 — AI·규칙 엔진 공통.
//   팀형: 직장이면 주말 대신 금요일(동료에게 주말 모임을 요구하지 않는다). 마음 건강이면 사진 없이 «안부 나누기»(마음 건강은 사진 인증 금지).
//   경쟁형 «N일 채우기»: 미션이 매일 열리면 5일, 쉬는 날을 둔 목록(달리기·웨이트)이면 3일 — 쉬는 날까지 채우라고 하지 않는다.
function moodMission(mood: string, bp: Blueprint, mind: boolean, others: { schedule_mode: string, active_days: number[] }[]): ModelMission {
  const m = MOOD_MISSION[mood]
  if (mood === 'compete') {
    const open = [1, 2, 3, 4, 5, 6, 7].filter((dow) => others.some((o) => activeOn(o, dow))).length
    const n = open >= 7 ? 5 : Math.max(1, Math.min(3, open))
    return n === 5 ? m : { ...m, title: `이번 주 ${n}일 채우기 도전`, instruction: `이번 주에 ${n}일 이상 미션을 했다면 인증해요. 한 줄 소감은 선택이에요.` }
  }
  if (mood !== 'team') return m
  const work = bp.target === '직원·동료'
  if (mind) return { title: '팀원과 안부 나누기', instruction: '이번 주에 팀원과 안부를 나눴다면 눌러요. 한 줄 소감은 선택이에요.', icon: 'diary.png', proof: 'check', schedule: 'CUSTOM', activeDays: [work ? 5 : 7], point: 10 }
  if (work) return { ...m, instruction: '금요일엔 이번 주 팀원과 함께한 순간을 사진으로 남겨요.', schedule: 'CUSTOM', activeDays: [5] }
  return m
}

// 마음 건강 프로그램 소개에 «늘» 들어가는 안내(본인 2026-10-09) — 운영자가 고르는 항목이 아니다. 소개글과 따로 저장한다(287 crisis_line_enabled).
export const CRISIS_LINE = '마음이 많이 힘들 때는 혼자 견디지 마세요. 자살예방 상담전화 109(24시간)'

// ─── 모델이 돌려주는 모양(글 위주) ───
export type MetricDef = { key: string, label: string, unit?: string, max?: number, allowZero?: boolean, icon?: string }
export type ModelMission = {
  title: string
  instruction: string
  icon?: string
  proof: 'photo' | 'photo_number' | 'number' | 'note' | 'photo_note' | 'check' | 'meditation'
  metricLabel?: string            // 숫자 기록 이름(걸음 수·거리·무게)
  metricUnit?: string             // 보·km·kg·분
  metricMax?: number
  metrics?: MetricDef[]           // 규칙 엔진 전용 — 전용 홈이 읽는 칸 이름(distance·time·cigarettes·saved 등)을 정해서 쓴다
  meditationMinutes?: number
  schedule: 'ALL_DAYS' | 'WEEKDAYS' | 'WEEKENDS' | 'CUSTOM'
  activeDays?: number[]           // CUSTOM — 1(월)~7(일)
  manual?: boolean                // (예전 칸 — 지금은 쓰지 않는다. 심사 여부는 운영자가 고른 인증 방식이 정한다)
  point?: number
}
export type ModelDraft = {
  thinking?: string
  nameSuggestion?: string
  description?: string
  missions?: ModelMission[]
  quizTopicKey?: string
  reasons?: string[]
  rewrites?: { original: string, rewrite: string }[]
}

// ─── 프롬프트 ───
//   도담 브랜드 퍼소나 v2 「무대에 서지 않는 운영 실장」 — 운영자를 대신해 일을 짜 주되, 앞에 서지 않는다.
//   금지선(docs/BRAND_PERSONA.md): 효과 보장·의학적 단정, 외모·체중 강조, 남과 비교 압박, 광고, 민감 정보 요구.
export function draftPrompt(bp: Blueprint): string {
  const goal = shownGoal(bp)
  const mind = bp.goal === '마음관리'
  const lines = [
    '당신은 건강 프로그램 운영 도구 「도담」의 운영 실장입니다. 운영자가 참여자와 함께할 건강 습관 프로그램의 «미션»을 짭니다.',
    '운영자는 바쁜 겸임 담당자일 수 있습니다. 참여자가 매일 부담 없이 인증할 수 있는 미션을 짜 주세요.',
    '',
    '[설계도]',
    `- 목표: ${goal}${bp.goal !== goal ? ` (도담의 「${bp.goal}」 틀)` : ''}`,
    `- 대상: ${bp.target || '정하지 않음'}${bp.headcount ? ` · 약 ${bp.headcount}명` : ''}`,
    `- 운영 형태: ${bp.org === 'org' ? '회사·기관·학교' : bp.org === 'casual' ? '친구·가족·동호회' : '정하지 않음'}`,
    `- 분위기: ${MOOD_LABEL[bp.mood || 'growth']}`,
    `- 기간: ${bp.durationDays || 28}일`,
    `- 인증 확인: ${bp.mode === 'AUTO' ? '자동 승인(올리면 바로 인정)' : '운영자가 확인(심사)'}`,
    ...(bp.freeText ? [`- 운영자가 처음 적은 말: 「${bp.freeText}」`] : []),
    ...(bp.missionHints?.length ? [`- 계획서의 미션 후보: ${bp.missionHints.join(' / ')}`] : []),
    ...(bp.claims?.length ? [`- 계획서에 있던 문장: ${bp.claims.map((c) => `「${c}」`).join(' ')}`] : []),
    '',
    '[해야 할 일]',
    '1) thinking: 이 대상·목표·분위기에 맞는 미션 구성을 먼저 짧게 생각해 적는다(운영자에게 보이지 않음).',
    '2) missions: 미션 3개. 계획서의 미션 후보가 있으면 그것을 살린다.',
    '   - 하루 부담: 「매일」 미션은 2개까지. 나머지는 평일·주말·주 몇 회로 나눈다. 같은 날 인증할 미션이 3개를 넘지 않게.',
    '   - 인증 방식을 섞는다: 사진만 3개로 짜지 않는다(사진은 찍는 부담이 크다).',
    '   - title: 15자 안팎, 무엇을 하는지 동사로 끝나게(예: 「오늘 8,000보 걷기」). 느낌표·이모지 금지.',
    '   - instruction: 무엇을 하고 «어떻게 인증하는지» 1~2문장, 「~해요」체. 고른 proof 와 맞게 쓴다 — 사진을 받으면 사진을, 숫자를 받으면 무엇을 어떤 단위로 적는지(예: 「읽은 시간(분)을 입력해요」) 말하고, proof 에 없는 것(소감 등)은 요구하지 않는다.',
    '   - proof: photo(사진) / photo_number(사진+숫자) / number(숫자만) / note(글) / photo_note(사진+글) / check(누르기만, 글은 선택) / meditation(명상 타이머).',
    '     숫자를 받으면 metricLabel·metricUnit·metricMax(1회 최대값)를 채운다.',
    '   - schedule: ALL_DAYS(매일) / WEEKDAYS(평일) / WEEKENDS(주말) / CUSTOM(activeDays: 1=월 ~ 7=일).',
    '     쉬는 날이 필요한 운동(웨이트 등)은 매일로 짜지 않는다.',
    '   - icon: 목록에서 고른다.',
    `3) nameSuggestion: 프로그램 이름 제안(${NAME_MAX}자 이내). description: 참여자에게 보일 한 문장 소개, 「~해요」체.`,
    '4) reasons: 이 미션들로 짠 이유 2~3개, 각 50자 안팎, 운영자에게 설명하는 「~해요」체(예: 「처음 하는 분도 시작하기 쉬워요」).',
    '   ※ 모든 글은 「~해요」체. 「~습니다」「~입니다」는 쓰지 않는다.',
    '   ※ 참여자가 보는 글(이름·소개·미션)에 「도담」이라는 이름을 쓰지 않는다 — 앞에 서는 건 운영자다(「명상 타이머로」처럼 기능 이름만).',
    '5) rewrites: 계획서 문장이나 운영자가 적은 말 중 «효과를 약속·보장»하거나 «치료»를 말하는 표현이 있으면, 목표는 살리고 약속만 뺀 문장으로 바꿔 적는다. 없으면 빈 배열.',
    '   숫자 목표는 반드시 그대로 둔다. 예) 「8주 후 체중 3kg 감량 보장」 → 「8주 동안 체중 3kg 감량에 함께 도전해요」.',
    '6) quizTopicKey: 아래 목록 중 이 프로그램에 가장 맞는 주제 하나.',
    '',
    '[절대 하지 않는 것]',
    '- 효과를 약속·보장하는 말(「보장」「완치」「100% 효과」「반드시 빠져요」), 진단·치료를 말하는 표현.',
    '- 외모·체중을 강조하거나 Before/After 비교, 남과 비교해 압박하는 말.',
    '- 신체 노출 사진·체중계·진료 기록처럼 민감한 정보를 인증으로 요구하는 것.',
    '- 광고·외부 링크·상품 구매 유도.',
    '- 단식·금식·급격한 감량처럼 무리한 목표나 강도. 처음 하는 사람 기준으로 짠다.',
    ...(mind ? [
      '',
      '[마음 건강 프로그램 규칙]',
      '- 사진 인증을 쓰지 않는다(check·note·meditation 만). 명상 미션은 proof=meditation, meditationMinutes 3~10.',
      '- 마음 상태를 남에게 공개하게 하지 않는다. 치료가 아니라 «마음을 돌보는 습관»으로 말한다.',
    ] : []),
  ]
  return lines.join('\n')
}

export function draftSchema(bp: Blueprint) {
  const aud = audienceOf(bp)
  return {
    type: 'object',
    properties: {
      thinking: { type: 'string' },
      nameSuggestion: { type: 'string' },
      description: { type: 'string' },
      missions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            instruction: { type: 'string' },
            icon: { type: 'string', enum: MISSION_ICONS },
            proof: { type: 'string', enum: ['photo', 'photo_number', 'number', 'note', 'photo_note', 'check', 'meditation'] },
            metricLabel: { type: 'string' },
            metricUnit: { type: 'string' },
            metricMax: { type: 'number' },
            meditationMinutes: { type: 'integer' },
            schedule: { type: 'string', enum: ['ALL_DAYS', 'WEEKDAYS', 'WEEKENDS', 'CUSTOM'] },
            activeDays: { type: 'array', items: { type: 'integer' } },
            point: { type: 'integer' },
          },
          propertyOrdering: ['title', 'instruction', 'icon', 'proof', 'metricLabel', 'metricUnit', 'metricMax', 'meditationMinutes', 'schedule', 'activeDays', 'point'],
          required: ['title', 'instruction', 'proof', 'schedule'],
        },
      },
      reasons: { type: 'array', items: { type: 'string' } },
      rewrites: { type: 'array', items: { type: 'object', properties: { original: { type: 'string' }, rewrite: { type: 'string' } }, required: ['original', 'rewrite'] } },
      quizTopicKey: { type: 'string', enum: AUDIENCE_TOPICS[aud] },
    },
    propertyOrdering: ['thinking', 'missions', 'nameSuggestion', 'description', 'reasons', 'rewrites', 'quizTopicKey'],   // 생각 먼저, 그다음 답
    required: ['thinking', 'missions', 'nameSuggestion', 'description', 'reasons', 'rewrites', 'quizTopicKey'],
  }
}

// ─── 계획서 읽기 — PDF·사진에서 설계도 칸을 뽑는다. 화면에서 «이렇게 읽었어요»로 확인받은 뒤에만 쓴다 ───
export const PLAN_PROMPT = [
  '첨부한 문서는 건강 프로그램 계획서입니다. 아래 칸을 «문서에 적힌 대로만» 채우세요. 없는 칸은 null 이나 빈 배열로 둡니다(추측하지 않음).',
  '- orgName: 운영 기관·회사 이름.',
  '- target: 대상. 다음 중 하나 — 직원·동료 / 회원·고객 / 가족 / 친구·모임 / 학생 / 주민 / other. other 이면 targetText 에 문서의 말 그대로.',
  '- headcount: 대상 인원(정수).',
  '- goal: 다음 중 하나 — 걷기 / 달리기 / 웨이트 / 금연 / 식단 / 스트레칭 / 수면 / 마음관리 / other. other 이면 goalText 에 문서의 말 그대로.',
  '- durationDays: 기간(일). 「8주」면 56.',
  '- mode: 인증을 누가 확인하는지 적혀 있으면 AUTO(자동) 또는 MANUAL(담당자 확인), 없으면 null.',
  '- kpi: 성과 지표·목표치 문장 그대로(예: 「참여율 70% 이상」).',
  '- missionHints: 계획서에 나온 활동·미션 후보(짧게).',
  '- claims: 효과를 약속·보장하는 문장이 있으면 그대로(예: 「8주 후 체중 3kg 감량 보장」).',
].join('\n')
export const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    orgName: { type: 'string', nullable: true },
    target: { type: 'string', enum: ['직원·동료', '회원·고객', '가족', '친구·모임', '학생', '주민', 'other'], nullable: true },
    targetText: { type: 'string', nullable: true },
    headcount: { type: 'integer', nullable: true },
    goal: { type: 'string', enum: [...KNOWN_GOALS, 'other'], nullable: true },
    goalText: { type: 'string', nullable: true },
    durationDays: { type: 'integer', nullable: true },
    mode: { type: 'string', enum: ['AUTO', 'MANUAL'], nullable: true },
    kpi: { type: 'array', items: { type: 'string' } },
    missionHints: { type: 'array', items: { type: 'string' } },
    claims: { type: 'array', items: { type: 'string' } },
  },
  required: ['kpi', 'missionHints', 'claims'],
}
// 계획서 읽기 결과 → 설계도 조각(화면 확인용). 범위 밖 숫자는 버린다
export function finalizePlan(raw: Record<string, unknown>): Record<string, unknown> {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 60) : null)
  const int = (v: unknown, lo: number, hi: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : null }
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean).slice(0, max) as string[] : [])
  const target = raw.target === 'other' ? str(raw.targetText) : str(raw.target)
  const goal = raw.goal === 'other' ? str(raw.goalText) : str(raw.goal)
  return {
    source: 'plan',
    orgNameHint: str(raw.orgName),
    target,
    org: 'org',   // 계획서를 올렸으면 기관(뼈대 결정)
    headcount: int(raw.headcount, 1, 100000),
    goal,
    goalRaw: goal && !KNOWN_GOALS.includes(goal) ? goal : null,
    durationDays: int(raw.durationDays, 3, 365),
    mode: raw.mode === 'AUTO' || raw.mode === 'MANUAL' ? raw.mode : null,
    kpi: list(raw.kpi, 6),
    missionHints: list(raw.missionHints, 6),
    claims: list(raw.claims, 4),
  }
}

// ─── 결정 규칙 ───
export function audienceOf(bp: Blueprint): string { return bp.target === '직원·동료' ? 'worker' : 'general_adult' }
export function shownGoal(bp: Blueprint): string { return (bp.goalRaw || bp.goal || '').trim() || '건강 습관' }
const DAY_NAMES = ['', '월', '화', '수', '목', '금', '토', '일']
const DAY_FACTOR = { ALL_DAYS: 1, WEEKDAYS: 5 / 7, WEEKENDS: 2 / 7 }
export function scheduleText(schedule: string, activeDays: number[]): string {
  if (schedule === 'WEEKDAYS') return '평일'
  if (schedule === 'WEEKENDS') return '주말'
  if (schedule === 'CUSTOM') return activeDays.length === 1 ? `주 1회(${DAY_NAMES[activeDays[0]]})` : activeDays.map((d) => DAY_NAMES[d]).join('·')
  return '매일'
}
// 그 요일(1=월~7=일)에 열리는 미션인가
function activeOn(m: { schedule_mode: string, active_days: number[] }, dow: number): boolean {
  if (m.schedule_mode === 'WEEKDAYS') return dow <= 5
  if (m.schedule_mode === 'WEEKENDS') return dow >= 6
  if (m.schedule_mode === 'CUSTOM') return m.active_days.includes(dow)
  return true
}
function dayFactor(m: { schedule_mode: string, active_days: number[] }): number {
  if (m.schedule_mode === 'CUSTOM') return m.active_days.length / 7
  return (DAY_FACTOR as Record<string, number>)[m.schedule_mode] ?? 1
}
// 하루 심사 시간(분) — 심사 미션이 «가장 많이 열리는 날» 기준(리뷰 2026-10-10: 주 평균을 내면 금요일·주말에 몰리는 심사가 가려지고
//   30분 점검도 안 떴다). 가정: 그날 열린 심사 미션마다 참여자 절반이 올리고, 1건 20초(화면에 같이 밝힌다). 실제 심사 기록으로 보정할 값.
export const REVIEW_SEC = 20, ACTIVE_RATE = 0.5
export function reviewMinutes(headcount: number, missions: { verification_type: string, schedule_mode: string, active_days: number[] }[]): number {
  const manual = missions.filter((m) => m.verification_type === 'MANUAL')
  const peak = Math.max(0, ...[1, 2, 3, 4, 5, 6, 7].map((dow) => manual.filter((m) => activeOn(m, dow)).length))
  return Math.ceil(headcount * ACTIVE_RATE * peak * REVIEW_SEC / 60)
}

// 안전 사전 — 모델 판단과 «별개로» 늘 돈다(모델이 놓쳐도 잡히게). 막히면 고친 문구를 같이 준다.
//   리뷰 2026-10-10: 「살이 빠지는」「한 달 20kg」 누락, 「맨몸 운동」「구매」 오탐, 「참여율 100%」 같은 목표 숫자 오탐을 고쳤다.
export const CLAIM_RE = /보장|완치|100\s*%\s*(효과|성공|감량|보장|확실|빠)|확실(히|하게)\s*(빠|감량|좋아|낫)|반드시\s*(빠|감량|좋아|낫)|기적|살(이)?\s*(쏙\s*)?빠지는|살\s*빠져|효과\s*만점/
export const CURE_RE = /치료|완치|진단|낫게|낫는|고쳐\s*(드|줘|준)/
export const PRIVACY_RE = /상의\s*탈의|맨몸\s*(사진|인증|촬영|노출)|속옷|노출\s*사진|체중계\s*사진|인바디\s*(결과|사진)|진단서|처방전|진료\s*기록|주민(등록)?\s*번호/
export const AD_RE = /https?:\/\/|www\.|\.(com|kr|net|co)(?![a-z])|쿠폰|할인\s*(코드|쿠폰|가|받)|협찬|광고|구매\s*(링크|하기|하세요|처|대행)|판매\s*(링크|합니다|해요|처)/
//   주 단위: 「주 10kg」「일주일에 3kg」(앞에 숫자가 붙은 「4주 만에」는 기간이라 따로 보지 않는다) · 달 단위: 한 달 5kg 이상
export const INTENSITY_RE = /단식|금식|1일\s*1식|원푸드|(^|[^\d])(일주일|한\s*주|주)\s*(에|당|만에)?\s*([2-9]|[1-9]\d+)\s*(kg|킬로)|(한\s*달|1\s*개월|30\s*일)\s*(에|만에|동안)?\s*([5-9]|[1-9]\d+)\s*(kg|킬로)|하루\s*[1-9]\d{2}\s*(kcal|칼로리)\s*이하/
// 설명과 입력 칸 맞추기에 쓰는 말 — 「인증샷」은 사진, 「사진 없이」는 사진을 말한 게 아니다(리뷰 2026-10-10)
const PHOTO_WORD = /사진|찍|캡처|화면|샷|셀카|촬영|이미지/
const PHOTO_ASK = /사진|찍어|캡처|인증샷|셀카/
const NO_PHOTO = /사진\s*(은|을|는)?\s*(없이|안\s*(올려|찍)|필요\s*없|올리지\s*않|찍지\s*않)/
const NOTE_ASK = /소감|메모|한\s*줄|느낀\s*점/
const NO_NOTE = /(소감|글|메모)\s*(은|을|는)?\s*(없이|안\s*써|필요\s*없|쓰지\s*않)/
// 더해 가는 값이 아닌 숫자(무게·시각·점수·혈압 등) — 누적 표시(metric_aggregate)에서 뺀다
const NON_ADDITIVE = /kg|킬로|몸무게|체중|시각|점수|bpm|혈압|혈당|℃|°/

// 미션 하나 — 모델 출력 → 앱 미션 행(expandPresetMission 이 받는 프리셋 미션 모양). 범위 밖 값은 기본값으로
function toPresetMission(m: ModelMission, i: number, ctx: { goal: string, mind: boolean, auto: boolean, fromMood?: boolean }) {
  const original = m.proof
  let proof = ['photo', 'photo_number', 'number', 'note', 'photo_note', 'check', 'meditation'].includes(m.proof) ? m.proof : 'check'
  // 마음 건강 — 사진 인증 금지(뼈대 결정): 사진이 들어간 인증은 «누르기만»으로 바꾼다
  if (ctx.mind && (proof === 'photo' || proof === 'photo_number' || proof === 'photo_note')) proof = 'check'
  const isMed = proof === 'meditation'
  const needImage = proof === 'photo' || proof === 'photo_number' || proof === 'photo_note'
  const needNumber = proof === 'photo_number' || proof === 'number'
  const needNote = proof === 'note' || proof === 'photo_note' || proof === 'check'
  const days = (Array.isArray(m.activeDays) ? m.activeDays : []).map((d) => Math.round(Number(d))).filter((d) => d >= 1 && d <= 7)
  const uniqDays = [...new Set(days)].sort((a, b) => a - b)
  const schedule = m.schedule === 'CUSTOM' && uniqDays.length === 0 ? 'ALL_DAYS'
    : ['ALL_DAYS', 'WEEKDAYS', 'WEEKENDS', 'CUSTOM'].includes(m.schedule) ? m.schedule : 'ALL_DAYS'
  const point = Math.min(30, Math.max(5, Math.round(Number(m.point) || 10)))
  const icon = m.icon && MISSION_ICONS.includes(m.icon) ? m.icon : (isMed ? '/icons/meditation/meditate.png' : ICON_OF_GOAL[ctx.goal] || 'photo.png')
  const clampMax = (v: unknown) => Math.min(100000, Math.max(1, Math.round(Number(v) || 100000)))
  // 숫자 칸 — 규칙 엔진은 전용 홈이 읽는 칸 이름을 정해서 넘기고(BANK), AI 미션은 미션마다 다른 칸 이름(m1·m2…)을 쓴다
  //   (같은 이름이면 「주요 기록 요약」이 쪽수와 분을 한 칸에 더해 버린다 — 리뷰 2026-10-10)
  const custom = Array.isArray(m.metrics) && m.metrics.length
    ? m.metrics.slice(0, 3).map((x) => ({ key: String(x.key).slice(0, 20), label: clean(x.label, 16) || '기록', unit: clean(x.unit, 6), max: clampMax(x.max), ...(x.allowZero ? { allowZero: true } : {}), ...(x.icon ? { icon: String(x.icon).slice(0, 4) } : {}) }))
    : null
  const label = custom ? custom[0].label : (clean(m.metricLabel, 12) || '기록')
  const unit = custom ? [...new Set(custom.map((x) => x.unit).filter(Boolean))].join('·') : clean(m.metricUnit, 6)
  const metrics = needNumber ? (custom || [{ key: `m${i + 1}`, label, unit, max: clampMax(m.metricMax) }]) : []

  // 설명과 입력 칸 맞추기 — 모델은 인증 방법(proof)과 설명을 따로 쓰다 어긋날 때가 있다
  //   (실측 2026-10-10: 「…가벼운 소감을 함께 남겨요」인데 글 칸 없음 + 사진 칸이 있는데 설명엔 사진이 없음).
  //   설명이 말한 칸이 없으면 «선택» 칸으로 더하고, 칸이 있는데 설명이 말하지 않으면 설명에 한 마디 더한다. 규칙 엔진 목록엔 해당 없음(검사로 확인).
  let instruction = noBrand(clean(m.instruction, 200))
  // 마음 건강 — 사진 칸이 없으니 사진을 말하는 설명은 바꾼다
  if (ctx.mind && /사진/.test(instruction)) instruction = proof === 'note' ? '오늘의 마음을 한 줄로 남겨요. 글은 기본으로 공개되지 않아요.' : '오늘 실천했다면 눌러요. 한 줄 소감은 선택이에요.'
  let reqImage = needImage, reqNote = needNote, imageRequired = true
  let noteRequired = proof !== 'check' && proof !== 'photo_note'
  const added: string[] = []
  if (!isMed) {
    if (!reqNote && NOTE_ASK.test(instruction) && !NO_NOTE.test(instruction)) { reqNote = true; noteRequired = false; added.push('글(선택)') }
    if (!reqImage && !ctx.mind && PHOTO_ASK.test(instruction) && !NO_PHOTO.test(instruction)) { reqImage = true; imageRequired = false; added.unshift('사진(선택)') }
    if (needImage && !PHOTO_WORD.test(instruction)) instruction = `${instruction} 사진도 한 장 올려요.`.slice(0, 200)
    if (needNumber && !/숫자|입력|기록|적어|적고/.test(instruction)) instruction = `${instruction} ${label}${unit ? `(${unit})` : ''}${josa(label, '을', '를')} 숫자로 입력해요.`.slice(0, 200)
  }
  const proofText = PROOF_TEXT[isMed ? 'meditation' : proof] + (needNumber && unit ? `(${unit})` : '')
  // 점수 — 승인되면 «낸 입력»의 점수만 더한다(grant_score_on_approval, 마이그 276). 입력별 점수가 하나도 없으면 미션 점수 하나(옛 방식).
  //   필수 입력끼리 미션 점수를 나눠 갖고(나머지는 첫 입력에), 선택 입력은 0 — 낸다고 점수가 늘지 않게(화면의 점수 = 실제 점수).
  //   «누르기만»(선택 글만)·명상은 필수 입력이 없어 나눌 곳이 없다 → single_point(옛 방식) — 누르면 그대로 점수.
  //   ⚠️ expandPresetMission 의 기본값에 맡기면 숫자만 받는 미션이 0점, 누르기만 미션은 빈칸 제출이 0점이 된다(2026-10-10 확인).
  const reqd = [reqImage && imageRequired ? 'image' : '', needNumber ? 'numeric' : '', reqNote && noteRequired ? 'note' : ''].filter(Boolean)
  const single = isMed || reqd.length === 0
  const share = (k: string) => (!reqd.includes(k) ? 0 : Math.floor(point / reqd.length) + (k === reqd[0] ? point % reqd.length : 0))
  return {
    key: ctx.fromMood ? 'mood' : `ai_${i + 1}`,
    title: noBrand(clean(m.title, 30)),
    instruction,
    icon,
    point,
    // 인증 방식 — 운영자가 고른 대로(리뷰 2026-10-10: 「운영자가 확인」을 골랐는데 심사할 미션이 하나도 없던 문제).
    //   심사를 골랐으면 «볼 것이 있는» 미션(필수 사진·숫자·글)은 모두 심사, 누르기만·명상은 볼 것이 없어 자동. 100명↑ 규칙은 buildDraft.
    verification_type: ctx.auto || single ? 'AUTO' : 'MANUAL',
    verify_style: isMed ? 'meditation' : 'standard',
    meditation_seconds: isMed ? Math.min(20, Math.max(1, Math.round(Number(m.meditationMinutes) || 3))) * 60 : undefined,
    requires_image: reqImage,
    requires_numeric: needNumber,
    requires_note: reqNote,
    image_required: imageRequired,
    numeric_required: true,
    // 「누르기만」 = 글 칸이 있되 비워도 된다 → 빈칸 그대로 인증할 수 있다(일반 미션은 입력 칸이 하나는 있어야 기록 가능)
    note_required: noteRequired,
    single_point: single,
    image_point: single || !reqImage ? null : share('image'),
    numeric_point: single || !needNumber ? null : share('numeric'),
    note_point: single || !reqNote ? null : share('note'),
    metrics,
    // 누적 표시(「주요 기록 요약」·전용 홈) — 더해 가는 숫자만(걸음·거리·분·잔·개비). 무게·시각 같은 건 빼기
    metric_aggregate: needNumber && (!!custom || !NON_ADDITIVE.test(`${label} ${unit}`)),
    schedule_mode: schedule,
    active_days: schedule === 'CUSTOM' ? uniqDays : [],
    daily_limit: 1,
    fromMood: !!ctx.fromMood,
    display: { days: scheduleText(schedule, uniqDays), proof: added.includes('사진(선택)') ? ['사진(선택)', proofText, ...added.filter((a) => a !== '사진(선택)')].join(' + ') : [proofText, ...added].join(' + ') },
    aligned: added.length > 0 || original !== proof,   // 설명·입력 칸을 맞췄거나(선택 칸 추가) 인증 방법을 바꿨음 — 화면 「왜」에 쓸 수 있게
  }
}
const PROOF_TEXT: Record<string, string> = { photo: '사진', photo_number: '사진 + 숫자', number: '숫자', note: '글', photo_note: '사진 + 글', check: '누르기만(글은 선택)', meditation: '명상 타이머' }
function clean(v: unknown, max: number): string {
  return String(v ?? '').replace(/[!！]+/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}
// 참여자가 보는 글에서 «도담» 이름을 뗀다 — 앞에 서는 건 운영자(퍼소나 v2). 프롬프트로 막아도 모델이 쓸 때가 있어 여기서 한 번 더.
//   낱말로 선 「도담」만 뗀다 — 「도담동 주민」의 도담은 동네 이름이라 그대로(리뷰 2026-10-10).
function noBrand(s: string): string {
  return s.replace(/(^|[\s「『"'(])도담(\s*앱)?(의|에서|에|으로|로|이|가|은|는)?(?=$|[\s.,!?」』"')])/g, '$1').replace(/\s+/g, ' ').trim()
}
// 이름은 앱 상한(NAME_MAX) 안으로 — 넘으면 짧은 후보로, 그래도 넘으면 자른다(마법사 1단계가 「최대 20자」로 막지 않게)
function fitName(candidates: (string | null | undefined)[]): string {
  const names = candidates.map((c) => noBrand(clean(c, 200))).filter(Boolean)
  return names.find((n) => n.length <= NAME_MAX) || (names[0] || '').slice(0, NAME_MAX).trim()
}

// ─── 자체 규칙 엔진(본인 2026-10-09: 무료로 가자) — 아는 목표 8개는 AI 없이 «검수된 미션 목록 + 고르는 규칙» ───
//   즉시·무료·늘 같은 결과·실패 없음·개인정보를 어디에도 보내지 않음. 고르는 기준은 대상(직장·가족·학생…)과 분위기.
//   규칙: 매일 미션은 2개까지 · 인증 방식 섞기 · 쉬는 날이 필요한 운동은 월·수·금 · 마음 건강은 사진 없음(명상 타이머·글·누르기만).
//   미션 문장은 「~해요」체, 처음 하는 사람 기준. 숫자 칸 이름은 전용 홈·「주요 기록 요약」이 읽는 이름으로(달리기 distance·time, 금연 cigarettes·saved).
//   together: 목록 안의 «함께하기» 미션을 넣을지 — 팀형은 분위기 미션이 맡으므로 false(같은 날 함께 사진 두 장 방지).
//   직장(work)의 함께하기는 «금요일» — 동료에게 주말에 만나자고 하지 않는다(본인 기준 「신뢰와 편의」).
type Ctx = { work: boolean, family: boolean, student: boolean, together: boolean, compete: boolean, team: boolean, gentle: boolean, steps: string }
function ctxOf(bp: Blueprint): Ctx {
  const t = bp.target || ''
  const work = t === '직원·동료', family = t === '가족', friends = t === '친구·모임', student = t === '학생', resident = t === '주민'
  const mood = bp.mood || 'growth'
  const gentle = resident || family   // 처음 하는 분·어르신이 많을 수 있는 대상 — 강도를 한 단계 낮춘다
  return { work, family, student, together: mood !== 'team' && (family || friends || work), compete: mood === 'compete', team: mood === 'team', gentle, steps: gentle ? '6,000' : '8,000' }
}
const STEPS: MetricDef = { key: 'steps', label: '걸음 수', unit: '보', max: 60000, icon: '👟' }
const DISTANCE: MetricDef = { key: 'distance', label: '거리', unit: 'km', max: 50, icon: '👟' }
const MINUTES: MetricDef = { key: 'time', label: '움직인 시간', unit: '분', max: 180, icon: '⏱️' }   // 달리기 홈은 time 을 분으로 더한다(÷60 = 시간)
const BANK: Record<string, (c: Ctx) => ModelMission[]> = {
  걷기: (c) => [
    { title: `오늘 ${c.steps}보 걷기`, instruction: `하루 ${c.steps}보를 걷고, 휴대폰 걸음 수 화면의 숫자를 입력해요.`, icon: 'walk.png', proof: 'number', metrics: [STEPS], schedule: 'ALL_DAYS', point: 10 },
    c.work ? { title: '점심 산책 15분', instruction: '점심시간에 15분 걷고 산책길 사진을 올려요.', icon: 'walk.png', proof: 'photo', schedule: 'CUSTOM', activeDays: [1, 2, 3, 4], point: 10 }
      : c.student ? { title: '걸어서 등하교하기', instruction: '한 정거장 먼저 내리거나 걸어서 오갔다면 눌러요.', icon: 'walk.png', proof: 'check', schedule: 'WEEKDAYS', point: 5 }
        : c.family ? { title: '저녁 먹고 가족 산책', instruction: '저녁을 먹고 가족과 20분 걷고 사진을 올려요.', icon: 'walk.png', proof: 'photo', schedule: 'CUSTOM', activeDays: [2, 4], point: 10 }
          : { title: '계단으로 오르기', instruction: '엘리베이터 대신 계단을 이용했다면 눌러요.', icon: 'walk.png', proof: 'check', schedule: 'WEEKDAYS', point: 5 },
    c.together && c.work ? { title: '금요일 동료와 점심 산책', instruction: '금요일 점심엔 동료와 함께 걷고, 함께한 사진을 올려요.', icon: 'photo.png', proof: 'photo', schedule: 'CUSTOM', activeDays: [5], point: 15 }
      : c.together ? { title: '주말 함께 걷기', instruction: '주말에 함께 걸은 순간을 사진으로 남겨요.', icon: 'photo.png', proof: 'photo', schedule: 'WEEKENDS', point: 15 }
      : { title: '주말 30분 산책', instruction: '주말에 30분 걷고 산책길 사진을 올려요.', icon: 'walk.png', proof: 'photo', schedule: 'WEEKENDS', point: 15 },
  ],
  달리기: (c) => [
    c.gentle ? { title: '15분 걷뛰기', instruction: '걷다가 뛰기를 섞어 15분 움직이고, 움직인 시간(분)을 입력해요.', icon: 'running.png', proof: 'number', metrics: [MINUTES], schedule: 'CUSTOM', activeDays: [1, 3, 5], point: 15 }
      : c.compete ? { title: '3km 달리기', instruction: '3km를 달리고 러닝 앱 기록 화면을 찍어 거리와 함께 올려요.', icon: 'running.png', proof: 'photo_number', metrics: [DISTANCE], schedule: 'CUSTOM', activeDays: [1, 3, 5], point: 15 }
        : { title: '3km 달리기', instruction: '3km를 달리고 러닝 앱이나 시계에 기록된 거리를 입력해요.', icon: 'running.png', proof: 'number', metrics: [DISTANCE], schedule: 'CUSTOM', activeDays: [1, 3, 5], point: 15 },
    { title: '달리기 전후 스트레칭', instruction: '달리기 전후로 5분 몸을 풀었다면 눌러요.', icon: 'stretching.png', proof: 'check', schedule: 'CUSTOM', activeDays: [1, 3, 5], point: 5 },
    c.together && c.work ? { title: '금요일 동료와 함께 달리기', instruction: '금요일엔 동료와 함께 달린 순간을 사진으로 남겨요.', icon: 'photo.png', proof: 'photo', schedule: 'CUSTOM', activeDays: [5], point: 15 }
      : c.together ? { title: '주말 함께 달리기', instruction: '주말에 함께 달린 순간을 사진으로 남겨요.', icon: 'photo.png', proof: 'photo', schedule: 'WEEKENDS', point: 15 }
      : { title: '주말 가벼운 조깅 20분', instruction: '주말에 20분 가볍게 뛰고 사진을 올려요.', icon: 'running.png', proof: 'photo', schedule: 'WEEKENDS', point: 15 },
  ],
  웨이트: (c) => [
    { title: '근력 운동 30분', instruction: c.compete ? '근력 운동을 하고 운동한 곳이나 기록 화면을 사진으로 올려요.' : '근력 운동을 30분 하고 사진을 올려요.', icon: 'exercise.png', proof: 'photo', schedule: 'CUSTOM', activeDays: [1, 3, 5], point: 15 },
    { title: '오늘 한 운동 적기', instruction: '한 운동과 무게·횟수를 짧게 적어요(예: 스쿼트 20kg 10회 3세트).', icon: 'diary.png', proof: 'note', schedule: 'CUSTOM', activeDays: [1, 3, 5], point: 5 },
    { title: '쉬는 날 스트레칭 10분', instruction: '운동하지 않는 날엔 10분 몸을 풀고 눌러요.', icon: 'stretching.png', proof: 'check', schedule: 'CUSTOM', activeDays: [2, 4, 6], point: 5 },
  ],
  // 금연 — 금연 전용 홈(QUIT_SMOKING)이 «오늘 핀 담배(cigarettes)·참은 담배(saved)»를 더해 절약 금액과 「내 변화」를 그린다(라이브러리 금연 프리셋과 같은 칸 이름)
  금연: () => [
    { title: '오늘 담배 기록', instruction: '오늘 핀 담배와, 피우고 싶었지만 참은 담배 개수를 입력해요. 한 개비도 안 피웠다면 0을 입력해요.', icon: 'nosmoke.png', proof: 'number', metrics: [
      { key: 'cigarettes', label: '오늘 핀 담배', unit: '개비', max: 100, allowZero: true, icon: '🚬' },
      { key: 'saved', label: '참은 담배', unit: '개비', max: 100, allowZero: true, icon: '🚭' },
    ], schedule: 'ALL_DAYS', point: 10 },
    { title: '담배 생각 이겨 낸 방법', instruction: '담배 생각이 날 때 대신 한 일을 한 줄로 남겨요.', icon: 'diary.png', proof: 'note', schedule: 'CUSTOM', activeDays: [1, 3, 5], point: 5 },
    { title: '담배 대신 물 한 잔', instruction: '담배 생각이 날 때 물 한 잔으로 넘겼다면 눌러요.', icon: 'water.png', proof: 'check', schedule: 'ALL_DAYS', point: 5 },
  ],
  식단: () => [
    { title: '채소 한 접시 먹기', instruction: '채소가 들어간 식사 사진을 올려요.', icon: 'diet.png', proof: 'photo', schedule: 'ALL_DAYS', point: 10 },
    { title: '물 6잔 마시기', instruction: '오늘 마신 물이 몇 잔인지 입력해요.', icon: 'water.png', proof: 'number', metrics: [{ key: 'water', label: '마신 물', unit: '잔', max: 30, icon: '💧' }], schedule: 'ALL_DAYS', point: 5 },
    { title: '야식 없이 하루 마무리', instruction: '야식 없이 하루를 마쳤다면 눌러요.', icon: 'diet.png', proof: 'check', schedule: 'WEEKDAYS', point: 5 },
  ],
  스트레칭: (c) => [
    { title: '아침 스트레칭 5분', instruction: '일어나서 5분 몸을 풀고 눌러요.', icon: 'stretching.png', proof: 'check', schedule: 'ALL_DAYS', point: 5 },
    c.work ? { title: '오후 목·어깨 풀기', instruction: '오후에 자리에서 목과 어깨를 3분 풀고, 어땠는지 한 줄 남겨요.', icon: 'stretching.png', proof: 'note', schedule: 'WEEKDAYS', point: 5 }
      : c.family ? { title: '저녁 가족 스트레칭', instruction: '저녁에 가족과 함께 10분 스트레칭하고 사진을 올려요.', icon: 'stretching.png', proof: 'photo', schedule: 'CUSTOM', activeDays: [2, 4], point: 10 }
        : { title: '자기 전 스트레칭 5분', instruction: '자기 전에 5분 몸을 풀고 한 줄 남겨요.', icon: 'stretching.png', proof: 'note', schedule: 'ALL_DAYS', point: 5 },
    c.together && c.work ? { title: '금요일 함께 스트레칭', instruction: '금요일엔 동료와 함께 5분 스트레칭하고 사진을 올려요.', icon: 'photo.png', proof: 'photo', schedule: 'CUSTOM', activeDays: [5], point: 10 }
      : c.together ? { title: '주말 함께 스트레칭', instruction: '주말에 함께 스트레칭한 순간을 사진으로 남겨요.', icon: 'photo.png', proof: 'photo', schedule: 'WEEKENDS', point: 10 }
      : { title: '주말 전신 스트레칭 15분', instruction: '주말에 15분 전신 스트레칭을 하고 사진을 올려요.', icon: 'stretching.png', proof: 'photo', schedule: 'WEEKENDS', point: 10 },
  ],
  수면: () => [
    { title: '일어난 시각 적기', instruction: '아침에 일어난 시각을 적어요(예: 6시 40분).', icon: 'sleep.png', proof: 'note', schedule: 'ALL_DAYS', point: 5 },
    { title: '자기 전 휴대폰 내려놓기', instruction: '잠들기 30분 전에 휴대폰을 내려놨다면 눌러요.', icon: 'sleep.png', proof: 'check', schedule: 'ALL_DAYS', point: 10 },
    { title: '주말에도 같은 시각에 일어나기', instruction: '주말에도 평일과 비슷한 시각에 일어났다면 눌러요.', icon: 'sleep.png', proof: 'check', schedule: 'WEEKENDS', point: 10 },
  ],
  마음관리: (c) => [
    { title: '5분 호흡 명상', instruction: '명상 타이머를 켜고 5분 동안 호흡에 집중해요.', icon: '/icons/meditation/meditate.png', proof: 'meditation', meditationMinutes: 5, schedule: 'ALL_DAYS', point: 10 },
    { title: '오늘 감사한 일 한 줄', instruction: '오늘 고마웠던 일을 한 줄로 남겨요. 글은 기본으로 커뮤니티에 공개되지 않아요.', icon: 'diary.png', proof: 'note', schedule: 'ALL_DAYS', point: 5 },
    c.work ? { title: '점심 산책하며 숨 고르기', instruction: '점심시간에 10분 걸으며 숨을 고르고 눌러요.', icon: 'walk.png', proof: 'check', schedule: 'WEEKDAYS', point: 5 }
      : { title: '주말 마음 산책 20분', instruction: '주말에 20분 천천히 걸으며 쉬고 눌러요.', icon: 'walk.png', proof: 'check', schedule: 'WEEKENDS', point: 5 },
  ],
}
const DESC_OF: Record<string, string> = {
  걷기: '매일 조금씩 걸으며 활력을 채워요', 달리기: '무리 없는 속도로 달리기 습관을 만들어요', 웨이트: '쉬는 날을 지키며 근력 운동을 꾸준히 이어 가요',
  금연: '담배 없는 하루를 하나씩 쌓아 가요', 식단: '채소와 물을 챙기며 식습관을 다듬어요', 스트레칭: '하루 몇 분씩 몸을 풀며 가볍게 시작해요',
  수면: '잠드는 시각과 일어나는 시각을 맞춰 가요', 마음관리: '하루 몇 분, 마음을 돌보는 시간을 가져요',
}
const WHY_OF: Record<string, string> = {
  걷기: '처음 하는 분도 시작하기 쉬운 걸음 수로 정했어요', 달리기: '달리는 날 사이에 쉬는 날을 둬서 무리하지 않게 했어요', 웨이트: '근육이 쉬는 날을 지키도록 월·수·금에 운동하게 했어요',
  금연: '매일 기록은 숫자 두 칸뿐이라 금방 끝나요 — 핀 담배와 참은 담배가 절약 금액과 「내 변화」로 쌓여요', 식단: '무엇을 빼기보다 채소와 물을 «더하는» 쪽으로 짰어요', 스트레칭: '아침 5분처럼 짧게 시작해서 이어 가기 쉽게 했어요',
  수면: '잠의 길이보다 «시각»을 맞추는 쪽이 꾸준히 하기 쉬워요', 마음관리: '명상 타이머와 한 줄 글로 부담 없이 짰어요',
}
// 규칙으로 짤 수 있나 — 아는 목표이고 계획서 경로가 아닐 때(계획서는 그 문서에 맞춰야 해서 AI, 유료 플랜)
export function canUseRules(bp0: Blueprint): boolean {
  const bp = sanitizeBlueprint(bp0)
  return KNOWN_GOALS.includes(bp.goal) && bp.source !== 'plan'
}
export function ruleDraft(bp0: Blueprint): ModelDraft {
  const bp = sanitizeBlueprint(bp0)
  if (!BANK[bp.goal]) return fallbackModel(bp)
  const c = ctxOf(bp)
  const shown = shownGoal(bp)
  const days = Math.min(365, Math.max(3, Math.round(Number(bp.durationDays) || 28)))
  const weeks = Math.max(1, Math.round(days / 7))
  const name = c.compete ? `${shown} ${weeks}주 챌린지` : c.team ? `팀으로 함께하는 ${shown} ${weeks}주` : c.family ? `우리 가족 ${shown} ${weeks}주` : `${weeks}주 ${shown} 습관`
  return {
    thinking: 'rules',
    nameSuggestion: fitName([name, `${shown} ${weeks}주`, shown]),
    description: `${days}일 동안 ${DESC_OF[bp.goal]}.`,
    missions: BANK[bp.goal](c),
    reasons: [WHY_OF[bp.goal], '매일 할 일은 2개까지, 나머지는 평일·주말로 나눠 부담을 줄였어요'],
    rewrites: [],
  }
}
// AI 를 쓸 수 없을 때(처음 보는 목표 — 실패하거나 아직 열려 있지 않을 때) — 기본 틀로라도 짠다(실패 화면 대신). 운영 점검이 「다듬어 주세요」를 건다
//   대상·분위기는 규칙 엔진과 같은 기준: 직장은 금요일, 팀형이면 함께하기는 분위기 미션이 맡는다(리뷰 2026-10-10).
export function fallbackModel(bp0: Blueprint): ModelDraft {
  const bp = sanitizeBlueprint(bp0)
  const c = ctxOf(bp)
  const g = shownGoal(bp)
  const days = Math.min(365, Math.max(3, Math.round(Number(bp.durationDays) || 28)))
  const weeks = Math.max(1, Math.round(days / 7))
  const eul = josa(g, '을', '를')
  const third: ModelMission = c.together && c.work ? { title: `금요일 동료와 ${g}`, instruction: `금요일엔 동료와 함께한 ${g}${eul} 사진으로 남겨요.`, icon: 'photo.png', proof: 'photo', schedule: 'CUSTOM', activeDays: [5], point: 10 }
    : c.together ? { title: `주말 함께 ${g}`, instruction: `주말에 함께한 ${g}${eul} 사진으로 남겨요.`, icon: 'photo.png', proof: 'photo', schedule: 'WEEKENDS', point: 10 }
    : { title: `주말 ${g} 인증`, instruction: `주말에 한 ${g}${eul} 사진 한 장으로 남겨요.`, icon: 'photo.png', proof: 'photo', schedule: 'WEEKENDS', point: 10 }
  return {
    thinking: 'fallback',
    nameSuggestion: fitName([`${weeks}주 ${g} 습관`, `${g} ${weeks}주`, g]),
    description: `${days}일 동안 ${g} 습관을 함께 만들어요.`,
    missions: [
      { title: `오늘의 ${g}`, instruction: `오늘 ${g}${eul} 했다면 사진과 한 줄로 남겨요.`, icon: 'photo.png', proof: 'photo_note', schedule: 'ALL_DAYS', point: 10 },
      // 글 기록은 화·목 — 월·수·금이면 직장의 금요일 함께하기와 겹쳐 같은 날 3개가 된다
      { title: `${g} 기록 한 줄`, instruction: `오늘 한 ${g}${eul} 짧게 적어요.`, icon: 'diary.png', proof: 'note', schedule: 'CUSTOM', activeDays: [2, 4], point: 5 },
      third,
    ],
    reasons: [],
    rewrites: [],
  }
}
// 무료 AI 에는 «설계도»만 보낸다 — 무료 티어는 보낸 내용이 학습·사람 검토에 쓰일 수 있어서.
//   빼는 것: 처음 적은 문장(freeText — 쓸 만한 내용은 이미 목표·대상·인원·기간·분위기 칸으로 읽혔다), 기관 이름, 계획서 내용(지표·문장·미션 후보).
//   목표·대상 칸에 기관 이름이 섞여 있으면 그 이름도 지운다(리뷰 2026-10-10: 「○○보건소 어르신」처럼 적으면 그대로 갔다).
export function forFreeAI(bp0: Blueprint): Blueprint {
  const bp = sanitizeBlueprint(bp0)
  const names = [bp.orgName].filter((x): x is string => !!x && x.length >= 2)
  const strip = (v: string | null | undefined) => {
    if (!v) return v ?? null
    let out = v
    for (const n of names) out = out.split(n).join(' ')
    out = out.replace(/\s+/g, ' ').trim()
    return out || null
  }
  return { goal: strip(bp.goal) || '건강 습관', goalRaw: strip(bp.goalRaw), target: strip(bp.target), org: bp.org, headcount: bp.headcount, mood: bp.mood, durationDays: bp.durationDays, mode: bp.mode }
}

// 모델 출력(또는 규칙 엔진 출력) + 설계도 → 초안(프리셋 객체 + 화면용 표시) + 검사. 같은 입력이면 같은 규칙.
//   engine: 'rules'(자체 규칙) | 'ai'(모델) | 'fallback'(AI 를 쓸 수 없어 기본 틀)
export function finalizeDraft(raw: ModelDraft, bp0: Blueprint, engine: 'rules' | 'ai' | 'fallback' = 'ai') {
  const bp = sanitizeBlueprint(bp0)
  const d = { ...buildDraft(raw, bp, engine), engine, rewrites: Array.isArray(raw.rewrites) ? raw.rewrites.filter((r) => r && typeof r.original === 'string' && typeof r.rewrite === 'string') : [] }
  return { ...d, checks: computeChecks(d, bp, d) }
}
export type Draft = ReturnType<typeof finalizeDraft>
// 초안을 화면에서 바꾼 뒤(기능 끄고 켜기·지표 «한 가지 더») 검사만 다시 — 같은 규칙으로
export function recheck(d: Draft, bp0: Blueprint): Draft {
  return { ...d, checks: computeChecks(d, sanitizeBlueprint(bp0), { rewrites: d.rewrites }) }
}

function buildDraft(raw: ModelDraft, bp: Blueprint, engine: 'rules' | 'ai' | 'fallback') {
  const goal = (bp.goal || '').trim() || '건강 습관'
  const known = KNOWN_GOALS.includes(goal)
  const mind = goal === '마음관리'
  const quit = goal === '금연'
  const shown = shownGoal(bp)
  const mood = bp.mood && MOOD_FEATURES[bp.mood] ? bp.mood : 'growth'
  const auto = bp.mode === 'AUTO'
  const headcount = Math.max(1, Math.round(Number(bp.headcount) || 30))
  const durationDays = Math.min(365, Math.max(3, Math.round(Number(bp.durationDays) || 28)))
  const weeks = Math.max(1, Math.round(durationDays / 7))

  // 미션 — 모델이 짠 3개(넘치면 자름) + 분위기 미션 1개
  const modelMissions = (Array.isArray(raw.missions) ? raw.missions : []).filter((m) => m && typeof m === 'object' && clean(m.title, 30)).slice(0, 3)
  const mapped = modelMissions.map((m, i) => toPresetMission(m, i, { goal, mind, auto }))
  let missions = [...mapped, toPresetMission(moodMission(mood, bp, mind, mapped), 3, { goal, mind, auto, fromMood: true })]
  // 인원이 많으면(100명↑) 심사 미션은 하나만 — 나머지는 자동으로(뼈대: 「꼭 봐야 할 미션 하나만 심사로」, 질문 화면 추천과 같은 규칙).
  //   남기는 건 «사진이 있는 미션 중 가장 드물게 열리는» 것 — 사람이 볼 가치는 함께한 사진 같은 드문 미션에 있고,
  //   매일 하는 숫자 기록은 자동으로 충분하다(매일 미션을 남기면 200명에 하루 34분).
  if (!auto && headcount >= 100) {
    const manualIdx = missions.map((m, i) => (m.verification_type === 'MANUAL' ? i : -1)).filter((i) => i >= 0)
    const keep = manualIdx.sort((a, b) => (Number(missions[b].requires_image) - Number(missions[a].requires_image)) || (dayFactor(missions[a]) - dayFactor(missions[b])))[0]
    missions = missions.map((m, i) => (m.verification_type === 'MANUAL' && i !== keep ? { ...m, verification_type: 'AUTO' } : m))
  }

  // 퀴즈 — 아는 목표는 정해진 주제, 모르는 목표만 모델이 고른 것(허용 목록 안에서)
  const aud = audienceOf(bp)
  const allowed = AUDIENCE_TOPICS[aud]
  const quizTopicKey = (known && TOPIC_OF[goal]?.[aud]) || (raw.quizTopicKey && allowed.includes(raw.quizTopicKey) ? raw.quizTopicKey : (aud === 'worker' ? 'activity' : 'general'))

  const features = { ...MOOD_FEATURES[mood] }
  const brand = bp.org === 'org' && bp.orgName ? { orgName: clean(bp.orgName, 40) } : null
  const rm = auto ? 0 : reviewMinutes(headcount, missions)
  const manualCount = missions.filter((m) => m.verification_type === 'MANUAL').length
  const category = CATEGORY_OF[goal] || 'ETC'
  const homeTheme = HOME_THEME_OF[category] || null
  // 참여 방법 — 물었으면 그 답, 안 물었으면(건너뜀·서버 직접 호출) 추천
  const join = { mode: bp.join || recommendedJoin(bp).join, maxParticipants: PARTICIPANT_MAX, preview: false }

  return {
    nameSuggestion: fitName([raw.nameSuggestion, `${shown} ${weeks}주`, shown]),
    description: noBrand(clean(raw.description, 120)) || `${durationDays}일 동안 ${shown} 습관을 함께 만들어요.`,
    goal, goalShown: shown, custom: !known, category, categoryLabel: CATEGORY_LABEL[category], homeTheme,
    target: bp.target || '누구나', headcount, durationDays, mode: auto ? 'AUTO' : 'MANUAL', manualCount,
    org: bp.org || 'casual', brand, mood, features,
    teamScoreMode: features.team ? 'average' : null,
    // 금연 — 라이브러리 금연 프리셋·마법사와 같이 「내 변화」 탭을 켠다(순위·팀 대신)
    changeTabEnabled: quit,
    // 인증 피드 공개(인증 게시판 feedVisibility) — 마음 건강은 «기본 비공개 · 개인 선택»
    certFeedVisibility: mind ? 'optin_private' : 'public',
    crisisLine: mind ? CRISIS_LINE : null,
    join,
    missions,
    quiz: { audienceKey: aud, topicKey: quizTopicKey },
    kpi: (bp.kpi?.length ? bp.kpi : ['참여율', '끝까지 함께한 참여자(활동일 50% 이상)']).map((k) => ({ label: k, ...measureOf(k, bp) })),
    reviewMinutesPerDay: rm,
    why: [
      ...(engine === 'rules' ? ['검수된 미션 목록에서 대상·분위기에 맞춰 골랐어요(AI 없이 바로)'] : []),
      ...(engine === 'fallback' ? [`「${shown}」${josa(shown, '은', '는')} 정해진 틀이 없고 지금은 AI 초안을 쓸 수 없어서 기본 틀로 짰어요. 미션 이름과 설명을 꼭 한 번 다듬어 주세요`]
        : !known ? [`「${shown}」${josa(shown, '은', '는')} 도담에 정해진 틀이 없어서 처음부터 짰어요. 미션을 꼭 한 번 봐 주세요`] : []),
      ...(mind ? ['마음 건강은 사진 인증이 부담이라 체크·글·명상으로 짰고, 글은 기본 비공개로 뒀어요', '힘들 때 연락할 곳(자살예방 상담전화 109)을 소개에 늘 넣어 둬요'] : []),
      ...(quit && bp.moodAsked ? [`금연 프로그램은 순위·팀 대신 「내 변화」 화면과 불꽃으로 응원해요 — 고르신 ${MOOD_LABEL[bp.moodAsked]} 대신 성장형으로 맞췄어요`] : []),
      ...(homeTheme === 'QUIT_SMOKING' ? ['참여자에게는 금연 전용 홈(아낀 담배·절약 금액·「내 변화」)으로 보여요'] : []),
      ...(homeTheme === 'RUNNING' ? ['참여자에게는 달리기 전용 홈(누적 거리·시간)으로 보여요'] : []),
      ...(Array.isArray(raw.reasons) ? raw.reasons.map((r) => clean(r, 80).replace(/[.。]+$/, '')).filter(Boolean).slice(0, 3) : []),
      MOOD_WHY[mood],
      auto ? '자동 승인이라 심사 시간이 거의 안 들어요'
        : manualCount === 0 ? '운영자 확인을 고르셨지만 지금 미션은 모두 «누르기만»이라 볼 것이 없어서 바로 인정돼요'
          : `${headcount}명 기준 심사는 많은 날 하루 약 ${rm}분이에요(그날 열린 심사 미션마다 절반이 올리고 1건 20초로 보고)`,
      ...(!auto && headcount >= 100 && manualCount === 1 ? ['인원이 많아서 사진 미션 하나만 심사로 두고, 나머지는 바로 인정되게 했어요'] : []),
      ...(brand ? [`${brand.orgName} 이름을 표지에 넣었어요 — 참여자 화면 앞에는 기관이 서요`] : []),
      JOIN_WHY[join.mode],
      '퀴즈 문항은 AI 가 쓰지 않고, 검수된 퀴즈 라이브러리에서 주제 하나를 골랐어요 — 바로 채점되는 문항만 넣어요',
    ],
  }
}

// ─── 성과 지표 → 도담이 «어떻게 재는지» (자동 / 한 가지 더 / 도담 밖) ───
//   도담 밖 기록(검진 수치)을 먼저 본다 — 「건강검진 참여율 70%」를 앱 인증률로 잘못 재지 않게(리뷰 2026-10-10)
export function measureOf(k: string, bp: Blueprint): { status: 'auto' | 'setup' | 'outside', how: string, setup?: string, need?: string } {
  if (/검진|혈압|혈당|콜레스테롤|체성분|인바디/.test(k)) return { status: 'outside', how: '건강검진 기록은 도담 밖에 있어서 도담이 재지 못해요. 기관 보고서에는 직접 적어 주세요' }
  if (/만족도/.test(k)) return { status: 'setup', how: '종료 설문의 만족도 문항 평균', setup: '종료 설문에 만족도 문항 넣기', need: '종료 설문에 만족도 문항이 있어야 해요' }
  if (/주\s*3일/.test(k)) return { status: 'auto', how: '한 주에 3일 이상 활동한 사람의 비율 — 불꽃과 같은 기준' }
  if (/끝까지|완주/.test(k)) return { status: 'auto', how: '활동일이 기간의 절반 이상인 사람 — 종료 리포트의 완주와 같은 기준' }
  if (/참여율/.test(k)) return bp.headcount && bp.source === 'plan'
    ? { status: 'auto', how: `대상 인원(계획서의 ${bp.headcount}명) 중 가입해서 한 번이라도 인증한 비율` }
    : { status: 'auto', how: '가입한 사람 중 한 번이라도 인증한 비율' }
  return { status: 'setup', how: '재는 방법을 만들기 전에 같이 정해요', setup: '재는 방법 정하기', need: '재는 방법을 정해야 해요' }
}

// ─── 검사 2단 ───
//   ① 도담 안전 검사 — 플랫폼에 해가 되는지. 걸리면 «못 만든다». 고친 문구를 같이 준다(목표는 살린다).
//      결과(몸무게 등) 기준 순위는 보지 않는다 — 운영자 계획에 따른다(본인 2026-10-09).
//   ② 운영 점검 — 끝까지 굴러가는지. «의도하신 건가요?»(의도함 / 고치기). 화면에 3개까지 — 중요한 것부터.
type Check = { key: string, label?: string, status?: 'pass' | 'fix', text?: string, fix?: string, okLabel?: string }
const OPS_ORDER = ['mind-rank', 'cap', 'custom-fallback', 'daily-load', 'effort', 'rank-delay', 'short', 'team-min', 'kpi-setup', 'custom']
function computeChecks(d: ReturnType<typeof buildDraft> & { engine: string }, bp: Blueprint, raw: Pick<ModelDraft, 'rewrites'>): { safety: Check[], ops: Check[] } {
  const mind = d.goal === '마음관리'
  const rewrites = Array.isArray(raw.rewrites) ? raw.rewrites.filter((r) => r && typeof r.original === 'string' && typeof r.rewrite === 'string' && r.original && r.rewrite) : []
  // 고친 문구의 바탕 낱말 — 약속·치료 낱말을 뺀 목표 이름(「당뇨 치료 걷기」 → 「당뇨 걷기」)
  const plainGoal = d.goalShown.replace(/치료|완치|진단|보장|낫게|낫는/g, ' ').replace(/\s+/g, ' ').trim() || (KNOWN_GOALS.includes(d.goal) ? d.goal : '건강')
  // 기본 문구 — 마음 건강은 늘 «마음을 돌보는 습관»(「우울증 습관」 같은 말이 나오지 않게), 그 밖은 약속 낱말을 뺀 목표 이름으로
  const generic = () => (mind ? '마음을 돌보는 습관을 함께 만들어요' : `${plainGoal} 습관을 함께 만들어요`)
  // 고친 문구는 «목표를 살리고 약속이 빠진» 것만 쓴다 — 숫자 목표(3kg·70%·8주)가 빠지거나, 약속·치료 낱말이 남거나,
  //   운영자 말투(「…만들어줘」)였으면 버리고 기본 문구로(리뷰 2026-10-10: 「우울증 치료에 함께 도전해요」「…만들어줘에 함께 도전해요」가 나왔다)
  const REQUEST_END = /(줘|주세요|해줘|하자|할래|합시다|해 주세요)[.!?]?$/
  const safe = (r: string) => !!r && !CLAIM_RE.test(r) && !CURE_RE.test(r) && !REQUEST_END.test(r)
  // 엔진·AI 가 쓴 글 — 고쳐 쓰지 않고 «약속이 든 문장»만 뺀다(문장 가운데 낱말을 지우면 「이 운동은 이에요」처럼 깨진다)
  const dropSentences = (line: string, re: RegExp) => (line.match(/[^.!?。]+[.!?。]?/g) || []).map((x) => x.trim()).filter((x) => x && !re.test(x)).join(' ').trim()
  const rewriteFor = (text: string, re: RegExp, generatedLine: boolean) => {
    if (generatedLine) { const kept = dropSentences(text, re); return safe(kept) ? kept : generic() }
    if (REQUEST_END.test(text.trim())) return generic()
    const r = rewrites.find((x) => text.includes(x.original) || x.original.includes(text))?.rewrite
    const nums = text.match(/\d+(\.\d+)?\s*(kg|%|주|일|개월|분|보|km)/g) || []
    const fromModel = r && nums.every((n) => r.replace(/\s/g, '').includes(n.replace(/\s/g, ''))) ? r : null
    const cand = fromModel || keepGoalRewrite(text)
    return safe(cand) ? cand : generic()
  }
  const generatedLines = [d.nameSuggestion, d.description, ...d.missions.flatMap((m) => [m.title, m.instruction])]
  const generated = generatedLines.join('\n')
  // 걸린 곳 — 운영자 쪽 문장(계획서·처음 적은 말·목표 말)이 먼저, 없으면 엔진·AI 가 쓴 글에서 «그 줄 전체»(조각만 넘기면 고친 문구가 「「에 함께 도전해요」」가 됐다)
  const theirs = [...(bp.claims || []), bp.freeText || '', bp.goalRaw || ''].filter(Boolean)
  const hitOf = (re: RegExp): { text: string, generated: boolean } | null => {
    const mine = theirs.find((t) => re.test(t))
    if (mine) return { text: mine, generated: false }
    const line = generatedLines.find((l) => re.test(l))
    return line ? { text: line, generated: true } : null
  }

  const safety: Check[] = []
  const claimHit = hitOf(CLAIM_RE)
  safety.push(claimHit
    ? { key: 'claim', label: '효과를 약속·보장하는 표현', status: 'fix', text: `「${clean(claimHit.text, 60)}」 — 「보장」처럼 효과를 약속하는 표현만 바꿀게요. 목표로 두는 건 괜찮아요.`, fix: `「${clean(rewriteFor(claimHit.text, CLAIM_RE, claimHit.generated), 60)}」로 바꾸기` }
    : { key: 'claim', label: '효과를 약속·보장하는 표현', status: 'pass' })
  // 진단·치료 약속 — 마음 건강만이 아니라 모든 프로그램(「당뇨 치료 걷기」), 운영자 말과 만들어진 글 둘 다(리뷰 2026-10-10)
  const cureHit = hitOf(CURE_RE)
  safety.push(cureHit
    ? { key: 'cure', label: '진단·치료를 약속하는 표현', status: 'fix', text: `「${clean(cureHit.text, 60)}」 — 도담 프로그램은 치료가 아니라 ${mind ? '«마음을 돌보는 습관»' : '«건강 습관»'}이에요. 치료를 약속하는 말만 바꿀게요.`, fix: `「${clean(rewriteFor(cureHit.text, CURE_RE, cureHit.generated), 40)}」로 바꾸기` }
    : { key: 'cure', label: '진단·치료를 약속하는 표현', status: 'pass' })
  if (mind) {
    safety.push({ key: 'mind-privacy', label: '마음 상태를 남에게 공개하라고 요구하지 않는지 — 인증 글은 «기본 비공개 · 개인 선택»으로 둘게요', status: 'pass' })
    safety.push({ key: 'crisis', label: '힘들 때 연락할 곳(자살예방 상담전화 109)을 소개에 넣었어요 — 마음 건강 프로그램엔 늘 들어가요', status: 'pass' })
  }
  const intensityHit = [...theirs, generated].find((t) => INTENSITY_RE.test(t))
  safety.push(intensityHit
    ? { key: 'intensity', label: '무리한 목표·강도', status: 'fix', text: `「${clean((intensityHit.match(INTENSITY_RE) || [''])[0], 40)}」 — 처음 하는 사람에게 무리가 될 수 있어요.`, fix: '무리 없는 목표로 바꾸기' }
    : { key: 'intensity', label: '무리한 목표·강도(급격한 감량·단식·과도한 운동량)', status: 'pass' })
  safety.push(PRIVACY_RE.test(generated)
    ? { key: 'privacy', label: '인증에 민감한 정보 요구', status: 'fix', text: '인증에 신체 노출·진료 기록 같은 민감한 정보가 들어갈 수 있어요.', fix: '인증 방법을 바꾸기' }
    : { key: 'privacy', label: '인증에 민감한 정보 요구(신체 노출·의료 기록)', status: 'pass' })
  safety.push(AD_RE.test(generated)
    ? { key: 'ads', label: '광고·외부 링크·상품 판매', status: 'fix', text: '미션 글에 광고·외부 링크로 보이는 말이 있어요.', fix: '그 부분 빼기' }
    : { key: 'ads', label: '광고·외부 링크·상품 판매', status: 'pass' })

  const ops: Check[] = []
  if (mind && d.features.ranking) ops.push({ key: 'mind-rank', text: '마음 건강 프로그램에서 순위 경쟁은 부담이 될 수 있어요.', fix: '랭킹 끄기(성장형처럼)' })
  // 정원 — 지금(베타)은 프로그램 하나에 최대 100명(마법사 3단계 상한과 같다). 인원이 넘으면 미리 알린다
  if (d.headcount > PARTICIPANT_MAX) ops.push({ key: 'cap', text: `약 ${d.headcount}명이면 정원을 넘어요. 지금(베타)은 프로그램 하나에 ${PARTICIPANT_MAX}명까지 함께할 수 있어요.`, fix: '프로그램을 나눠 만들기', okLabel: `${PARTICIPANT_MAX}명까지 받기` })
  if (d.custom) ops.push(d.engine === 'fallback'
    ? { key: 'custom', text: `기본 틀로 짠 미션이에요. 「${d.goalShown}」에 맞게 미션 이름과 설명을 한 번 다듬어 주세요.`, fix: '미션 다시 보기', okLabel: '확인했어요' }
    : { key: 'custom', text: `「${d.goalShown}」${josa(d.goalShown, '은', '는')} 도담에 정해진 틀이 없어 처음부터 짠 미션이에요. 인증 방법이 참여자에게 분명한지 한 번 봐 주세요.`, fix: '미션 다시 보기', okLabel: '확인했어요' })
  if (d.mode === 'MANUAL' && d.reviewMinutesPerDay >= 30) ops.push({ key: 'effort', text: `${d.headcount}명이면 심사가 많은 날 하루 ${d.reviewMinutesPerDay}분쯤 걸려요. 바쁜 날엔 심사가 밀릴 수 있어요.`, fix: '자동 승인 미션 늘리기' })
  // 점수는 승인될 때 들어간다(grant_score_on_approval) — 순위가 있는데 심사가 밀리면 순위가 멈춘다
  if (d.features.ranking && d.mode === 'MANUAL' && d.missions.some((m) => m.verification_type === 'MANUAL')) ops.push({ key: 'rank-delay', text: '랭킹을 켰는데 심사 미션이 있어서, 그 점수는 운영자 승인 뒤에 올라가요. 하루 한 번은 심사해야 순위가 제때 바뀌어요.', fix: '자동 승인 미션 늘리기' })
  if (d.features.team && d.headcount < 8) ops.push({ key: 'team-min', text: `${d.headcount}명이면 팀이 한두 개뿐이라 팀 순위가 심심할 수 있어요.`, fix: '팀 없이 시작하기' })
  // 하루 부담 — 같은 날 «손이 가는» 인증이 3개 이상이면(모델이 규칙을 어겨도 여기서 잡는다).
  //   분위기 미션(주 1회 돌아보기)·「누르기만」은 가벼워서 세지 않는다 — 셌더니 실측 6번 중 5번 떠서(2026-10-09) 운영자가 점검을 무시하게 된다.
  const heavy = d.missions.filter((m) => !m.fromMood && !(m.requires_note && m.note_required === false && !m.requires_image && !m.requires_numeric))
  const load = Math.max(0, ...[1, 2, 3, 4, 5, 6, 7].map((dow) => heavy.filter((m) => activeOn(m, dow)).length))
  if (load >= 3) ops.push({ key: 'daily-load', text: `같은 날 사진·숫자·글로 인증할 미션이 ${load}개인 날이 있어요. 매일 하기엔 부담이 될 수 있어요.`, fix: '하루 2개로 줄이기' })
  const pendingKpi = d.kpi.find((k) => k.status === 'setup')
  if (pendingKpi) ops.push({ key: 'kpi-setup', text: `성과 지표 「${pendingKpi.label}」${josa(pendingKpi.label, '을', '를')} 재려면 ${pendingKpi.need}.`, fix: pendingKpi.setup })
  if (d.durationDays < 21) ops.push({ key: 'short', text: `${d.durationDays}일은 습관이 자리 잡기 전에 끝날 수 있어요.`, fix: '4주로' })
  if (ops.length === 0) ops.push({ key: 'start', text: '첫 미션이 시작일 당일에 열려요. 참여자가 아직 모이기 전이면 하루 늦춰도 돼요.', fix: '하루 늦추기' })
  // 3개로 자르기 전에 중요한 순서로 — «처음부터 짠 미션» 안내는 초안 위 한 줄과 겹치니 맨 뒤(기본 틀일 때만 앞), 하루 부담·짧은 기간이 밀려나지 않게
  const rank = (c: Check) => { const k = c.key === 'custom' && d.engine === 'fallback' ? 'custom-fallback' : c.key; const i = OPS_ORDER.indexOf(k); return i < 0 ? OPS_ORDER.length : i }
  return { safety, ops: [...ops].sort((a, b) => rank(a) - rank(b)).slice(0, 3) }
}

// 규칙으로 고치기 — 약속하는 말만 «도전»으로 바꾸고 목표(숫자)는 그대로. 「8주 후 체중 3kg 감량 보장」 → 「8주 동안 체중 3kg 감량에 함께 도전해요」
//   문장 가운데 남은 약속 낱말(「… 보장 프로그램」)도 지운다. 결과는 rewriteFor 가 한 번 더 검사한다(약속·치료 낱말이 남으면 기본 문구).
export function keepGoalRewrite(text: string): string {
  let out = String(text ?? '').trim()
    .replace(/(\d+\s*(주|일|개월))\s*후/, '$1 동안')
    // 숫자(「참여율 100%」의 100% 포함)는 목표일 수 있어 지우지 않는다 — 약속하는 낱말만 바꾼다
    .replace(/\s*(을|를)?\s*(보장|완치|확실히|반드시)(합니다|해요|함|됩니다|돼요)?\.?$/, '에 함께 도전해요')
  out = out.replace(/(100\s*%\s*)?(효과\s*)?(보장|완치)(된|되는|하는|형)?/g, ' ').replace(/\s+/g, ' ').trim()
  if (!/(요|다)[.!]?$/.test(out)) out = `${out.replace(/[\s.!]+$/, '')}에 함께 도전해요`
  return out
}

// 받침이 있으면 a(을·은·과), 없으면 b(를·는·와). 끝 괄호·따옴표는 떼고 본다(「요가(초급)」 → 요가),
//   숫자·영문은 읽는 소리로(0 영·1 일·3 삼·6 육·7 칠·8 팔 / L·M·N·R) — 리뷰 2026-10-10: 「스쿼트 100를」
export function josa(w: string, a: string, b: string): string {
  const s = String(w ?? '').replace(/\s*[([{「『][^()[\]{}「」『』]*[)\]}」』]\s*$/, '').replace(/[\s.,!?~·…'"」』)\]}]+$/, '')
  const ch = s.slice(-1)
  if (!ch) return b
  const c = ch.charCodeAt(0)
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0 ? a : b
  if (/[0-9]/.test(ch)) return '013678'.includes(ch) ? a : b
  if (/[a-z]/i.test(ch)) return 'lmnr'.includes(ch.toLowerCase()) ? a : b
  return b
}

// ─── Gemini 호출(모델 폴백) — 엣지 함수와 로컬 검사가 같이 쓴다 ───
// 모델 폴백 — 404(세대교체)·429(한도)·503(과부하)·시간 초과면 다음 모델로, 같은 모델을 다시 부르지 않는다.
//   실측(2026-10-09): 상위 모델이 503 을 자주 냈다. 같은 모델 재시도는 6번 중 1번만 살렸고 기다림은 최대 95초까지 늘었다 → 재시도 없이 넘긴다.
//   기다림: 다음 모델이 남아 있으면 12초, 마지막 모델은 25초(화면 약속 「보통 10초쯤」 — 실측: 상위 모델이 25초 동안 답이 없던 때가 있었다).
//   키는 주소(?key=)가 아니라 헤더(x-goog-api-key)로 — 주소는 기록·오류 메시지에 남기 쉽다.
//   attempts 는 진단용(모델:상태:걸린 시간).
export async function callGemini(apiKey: string, models: string[], payload: unknown): Promise<{ text: string | null, error: string | null, model: string | null, attempts: string[] }> {
  let lastErr = 'no_model'
  const attempts: string[] = []
  for (const [i, model] of models.entries()) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), i === models.length - 1 ? 25000 : 12000)
    const t0 = Date.now()
    let res: Response
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(payload), signal: ctl.signal })
    } catch {
      clearTimeout(timer)
      attempts.push(`${model}:timeout:${Date.now() - t0}ms`)
      lastErr = 'timeout'
      continue
    }
    clearTimeout(timer)
    attempts.push(`${model}:${res.status}:${Date.now() - t0}ms`)
    if (res.ok) {
      const data = await res.json().catch(() => null)
      const parts = data?.candidates?.[0]?.content?.parts || []
      const text = parts.map((p: { text?: string }) => p.text || '').join('')
      return { text, error: null, model, attempts }
    }
    lastErr = `gemini_${res.status}`
    if (![404, 429, 503].includes(res.status)) return { text: null, error: lastErr, model, attempts }
  }
  return { text: null, error: lastErr, model: null, attempts }
}

export function draftPayload(bp0: Blueprint) {
  const bp = sanitizeBlueprint(bp0)
  return {
    contents: [{ parts: [{ text: draftPrompt(bp) }] }],
    generationConfig: {
      temperature: 0.4,   // 미션 문장엔 약간의 다양성, 규칙은 후처리가 지킨다
      responseMimeType: 'application/json',
      responseSchema: draftSchema(bp),
      maxOutputTokens: 8192,
    },
  }
}
export function planPayload(mimeType: string, base64: string) {
  return {
    contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: PLAN_PROMPT }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: PLAN_SCHEMA, maxOutputTokens: 2048 },
  }
}
