// 프로그램 참여 설문 — 카테고리별 기본 표준 문항(운영자 커스텀 편집 전까지 사용).
//   문항: { id, type: 'text' | 'scale', q, min?, max?, minLabel?, maxLabel? }
import { PROGRAM_THEME } from './constants'

// 카테고리/테마 → 설문에서 물을 "행동" 표현
function behaviorOf(categories = [], theme = null) {
  if (theme === PROGRAM_THEME.QUIT_SMOKING) return '금연'
  const c = (categories || [])[0]
  if (c === 'DIET') return '건강한 식사'
  if (c === 'WALKING') return '걷기·활동'
  if (c === 'RUNNING') return '운동·러닝'
  if (c === 'DRINKING') return '절주'
  return '건강 관리'
}

// 기본 설문 (목표 단답 + 실천 정도·자신감 척도)
export function defaultSurvey({ categories, theme } = {}) {
  const b = behaviorOf(categories, theme)
  return [
    { id: 'goal', type: 'text', q: '이 프로그램에서 이루고 싶은 목표를 한 줄로 적어주세요' },
    { id: 'practice', type: 'scale', q: `요즘 ${b} 실천 정도는 어떤가요?`, min: 1, max: 5, minLabel: '거의 못 함', maxLabel: '매우 잘 함' },
    { id: 'confidence', type: 'scale', q: '목표를 이룰 수 있다는 자신감은 어느 정도인가요?', min: 1, max: 5, minLabel: '낮음', maxLabel: '높음' },
  ]
}

// 프로그램에 커스텀 문항이 있으면 그걸, 없으면 카테고리 기본 문항
export function getProgramSurvey(program) {
  const custom = program?.survey_questions
  if (Array.isArray(custom) && custom.length) return custom
  return defaultSurvey({ categories: program?.categories, theme: program?.theme })
}
