// 프로그램 → HP2030(제6차 국민건강증진종합계획 2026-2030) 대표지표 매핑.
//   각 프로그램의 시작→종료 자기보고 변화를 해당 건강영역 지표 "기여"로 프레이밍(인과 아님).
//   primary = 그 지표를 가장 잘 대표하는 척도 문항 id(기본 문항 기준).
import { PROGRAM_THEME } from './constants'

// 국가 통계 참고선(전국 지표) 표시 여부 플래그.
//   현재 off — 국가값(%)과 우리 자기보고(1~5) 단위 불일치 + 공개 지표 신선도 이슈(암센터 2021).
//   나중에 켤 때: 설문에 객관 문항(예: 현재 흡연 여부 예/아니오) 추가로 우리 % 산출 → 지역 흡연율과 like-for-like.
//   엣지 함수(health-indicators)·매핑(nationalIndicator)·리포트 렌더 코드는 모두 보존됨.
export const NATIONAL_BENCHMARK_ENABLED = false

// nationalIndicator: 국립암센터 API 로 전국 참고값을 붙일 수 있는 지표(현재 흡연만 개방·배선됨). null 이면 참고선 없음.
export function hp2030Mapping(program) {
  const theme = program?.theme
  const c = (program?.categories || [])[0]
  if (theme === PROGRAM_THEME.QUIT_SMOKING) return { area: '금연', indicator: '성인 현재흡연율 감소', primary: 'smoke_amount', primaryLabel: '하루 흡연량(적을수록 좋음)', nationalIndicator: 'smoking' }
  if (c === 'DRINKING') return { area: '절주', indicator: '고위험음주율 감소', primary: 'drink_freq', primaryLabel: '음주 빈도(적을수록 좋음)', nationalIndicator: null }
  if (c === 'RUNNING') return { area: '신체활동', indicator: '유산소 신체활동 실천율 증가', primary: 'run_freq', primaryLabel: '주간 운동 횟수', nationalIndicator: null }
  if (c === 'WALKING') return { area: '신체활동', indicator: '유산소 신체활동 실천율 증가', primary: 'walk_amount', primaryLabel: '하루 걷는 양', nationalIndicator: null }
  if (c === 'DIET') return { area: '영양', indicator: '건강식생활 실천율 증가', primary: 'diet_regular', primaryLabel: '식사 규칙성', nationalIndicator: null }
  if (c === 'MINDCARE') return { area: '정신건강', indicator: '스트레스 인지·우울감 개선', primary: 'mind_state', primaryLabel: '마음 상태', nationalIndicator: null }
  return { area: '건강생활', indicator: '건강생활 실천 개선', primary: null, primaryLabel: null, nationalIndicator: null }
}
