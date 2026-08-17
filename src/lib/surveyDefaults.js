// 프로그램 참여 설문 — 카테고리별 기본 표준 문항(운영자 커스텀 편집 전까지 사용).
//   문항: { id, type: 'text' | 'scale', q, min?, max?, minLabel?, maxLabel? }
//   구성: [목표(공통)] + [카테고리 특화 문항 1~2개] + [자신감(공통)]
//   척도는 "높을수록 건강한 방향" 으로 통일 → 시작·종료 비교(변화)에 그대로 사용.
import { PROGRAM_THEME } from './constants'

// 공통 문항 — 목표(단답)·자신감(척도)은 카테고리와 무관하게 고정
const GOAL = { id: 'goal', type: 'text', q: '이 프로그램에서 이루고 싶은 목표를 한 줄로 적어주세요' }
const CONFIDENCE = { id: 'confidence', type: 'scale', q: '목표를 이룰 수 있다는 자신감은 어느 정도인가요?', min: 1, max: 5, minLabel: '낮음', maxLabel: '높음' }

// 카테고리/테마별 중간 문항(그 활동에 맞춘 기준선 측정)
function middleQuestions(categories = [], theme = null) {
  if (theme === PROGRAM_THEME.QUIT_SMOKING) return [
    { id: 'smoke_amount', type: 'scale', q: '요즘 하루 흡연량은 어느 정도인가요?', min: 1, max: 5, minLabel: '많음(한 갑 이상)', maxLabel: '거의 안 피움' },
    { id: 'smoke_try', type: 'scale', q: '담배를 줄이거나 끊으려는 시도를 하고 있나요?', min: 1, max: 5, minLabel: '전혀 안 함', maxLabel: '적극적으로' },
  ]
  const c = (categories || [])[0]
  if (c === 'DIET') return [
    { id: 'diet_regular', type: 'scale', q: '요즘 하루 세 끼를 얼마나 규칙적으로 드시나요?', min: 1, max: 5, minLabel: '매우 불규칙', maxLabel: '매우 규칙적' },
    { id: 'diet_veggie', type: 'scale', q: '채소·과일을 챙겨 먹는 편인가요?', min: 1, max: 5, minLabel: '거의 안 먹음', maxLabel: '매일 챙겨 먹음' },
  ]
  if (c === 'WALKING') return [
    { id: 'walk_amount', type: 'scale', q: '요즘 하루에 걷는 양은 어느 정도인가요?', min: 1, max: 5, minLabel: '거의 안 걸음', maxLabel: '많이 걸음' },
    { id: 'walk_habit', type: 'scale', q: '계단 이용·가까운 거리 걷기 같은 활동을 실천하나요?', min: 1, max: 5, minLabel: '거의 안 함', maxLabel: '자주 함' },
  ]
  if (c === 'RUNNING') return [
    { id: 'run_freq', type: 'scale', q: '요즘 일주일에 운동(달리기 포함)을 얼마나 하나요?', min: 1, max: 5, minLabel: '거의 안 함', maxLabel: '주 5회 이상' },
    { id: 'run_endurance', type: 'scale', q: '쉬지 않고 30분 정도 달릴 수 있나요?', min: 1, max: 5, minLabel: '전혀 못 함', maxLabel: '여유롭게 가능' },
  ]
  if (c === 'DRINKING') return [
    { id: 'drink_freq', type: 'scale', q: '요즘 일주일에 술을 마시는 횟수는 어느 정도인가요?', min: 1, max: 5, minLabel: '거의 매일', maxLabel: '거의 안 마심' },
    { id: 'drink_control', type: 'scale', q: '술자리에서 음주량을 조절할 수 있나요?', min: 1, max: 5, minLabel: '조절 어려움', maxLabel: '잘 조절함' },
  ]
  if (c === 'MINDCARE') return [
    { id: 'mind_state', type: 'scale', q: '요즘 마음 상태(스트레스·기분)는 어떤가요?', min: 1, max: 5, minLabel: '많이 지침', maxLabel: '편안함' },
    { id: 'mind_care', type: 'scale', q: '마음을 돌보는 활동(명상·산책·기록 등)을 실천하나요?', min: 1, max: 5, minLabel: '거의 안 함', maxLabel: '자주 함' },
  ]
  return [
    { id: 'practice', type: 'scale', q: '요즘 건강 관리를 얼마나 실천하고 있나요?', min: 1, max: 5, minLabel: '거의 못 함', maxLabel: '매우 잘 함' },
  ]
}

// 기본 설문 = 목표 + 카테고리 특화 문항 + 자신감
export function defaultSurvey({ categories, theme } = {}) {
  return [GOAL, ...middleQuestions(categories, theme), CONFIDENCE]
}

// 프로그램에 커스텀 문항이 있으면 그걸, 없으면 카테고리 기본 문항
export function getProgramSurvey(program) {
  const custom = program?.survey_questions
  if (Array.isArray(custom) && custom.length) return custom
  return defaultSurvey({ categories: program?.categories, theme: program?.theme })
}
