// 프로그램 → HP2030(제6차 국민건강증진종합계획 2026-2030) 대표지표 매핑.
//   각 프로그램의 시작→종료 자기보고 변화를 해당 건강영역 지표 "기여"로 프레이밍(인과 아님).
//   primary = 그 지표를 가장 잘 대표하는 척도 문항 id(기본 문항 기준).
import { PROGRAM_THEME } from './constants'

export function hp2030Mapping(program) {
  const theme = program?.theme
  const c = (program?.categories || [])[0]
  if (theme === PROGRAM_THEME.QUIT_SMOKING) return { area: '금연', indicator: '성인 현재흡연율 감소', primary: 'smoke_amount', primaryLabel: '하루 흡연량(적을수록 좋음)' }
  if (c === 'DRINKING') return { area: '절주', indicator: '고위험음주율 감소', primary: 'drink_freq', primaryLabel: '음주 빈도(적을수록 좋음)' }
  if (c === 'RUNNING') return { area: '신체활동', indicator: '유산소 신체활동 실천율 증가', primary: 'run_freq', primaryLabel: '주간 운동 횟수' }
  if (c === 'WALKING') return { area: '신체활동', indicator: '유산소 신체활동 실천율 증가', primary: 'walk_amount', primaryLabel: '하루 걷는 양' }
  if (c === 'DIET') return { area: '영양', indicator: '건강식생활 실천율 증가', primary: 'diet_regular', primaryLabel: '식사 규칙성' }
  if (c === 'MINDCARE') return { area: '정신건강', indicator: '스트레스 인지·우울감 개선', primary: 'mind_state', primaryLabel: '마음 상태' }
  return { area: '건강생활', indicator: '건강생활 실천 개선', primary: null, primaryLabel: null }
}
