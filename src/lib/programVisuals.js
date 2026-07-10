// 참여 중 프로그램 카드의 카테고리별 파스텔 색상 + 시간 진행률 헬퍼.
// Dashboard / ProgramList 등 여러 페이지가 같은 룩을 공유하도록 한 곳에서 관리.

// 카테고리별 파스텔 색상 (Tailwind JIT 안전 — 명시적 클래스명)
export const CATEGORY_COLORS = {
  WALKING:    { bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'bg-emerald-400' },
  RUNNING:    { bg: 'bg-sky-50',     border: 'border-sky-100',     accent: 'bg-sky-400' },
  DIET:       { bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'bg-emerald-400' },
  EMPATHY:    { bg: 'bg-pink-50',    border: 'border-pink-100',    accent: 'bg-pink-400' },
  MINDCARE:   { bg: 'bg-orange-50',  border: 'border-orange-100',  accent: 'bg-orange-400' },
  SLEEP:      { bg: 'bg-purple-50',  border: 'border-purple-100',  accent: 'bg-purple-400' },
  NO_SMOKING: { bg: 'bg-yellow-50',  border: 'border-yellow-100',  accent: 'bg-yellow-400' },
  ETC:        { bg: 'bg-gray-50',    border: 'border-gray-100',    accent: 'bg-gray-400' },
}

// 카테고리별 대표 색 (hex) — 칩/진행바/버튼/표지 폴백 틴트 등 동적 색상용.
//   본인 지정값 (임의, 추후 수정 가능). key 는 CATEGORY 키와 동일.
export const CATEGORY_HEX = {
  WALKING: '#22C58B',     // 운동
  RUNNING: '#0EA5E9',     // 달리기 (스카이 — 운동 초록과 구별)
  DIET: '#F5B66E',        // 식단
  EMPATHY: '#F4B8A8',     // 공감
  MINDCARE: '#F59E0B',    // 마음관리
  SLEEP: '#9B7CF3',       // 수면
  NO_SMOKING: '#14B8C4',  // 금연 (시안 청록 — 운동 초록과 구별)
  ETC: '#A7B4C8',         // 기타
}

// 시간 기반 진행률 (KST). 시작 전=0, 종료 후=100, 중간=경과/전체 %
export const calcProgress = (startDate, endDate) => {
  if (!startDate || !endDate) return 0
  const now = new Date()
  const start = new Date(`${startDate}T00:00:00+09:00`)
  const end = new Date(`${endDate}T23:59:59+09:00`)
  if (now < start) return 0
  if (now > end) return 100
  const total = end - start
  const passed = now - start
  return Math.round((passed / total) * 100)
}

// 프로그램 일수/경과일/남은일 + 참여율(=인증일÷경과일) 공용 계산 (KST).
//   대시보드·상세 개요·카드홈이 반드시 같은 값을 쓰도록 단일 소스로 통일.
//   경과일은 프로그램 기간(programDays)으로 상한 → 종료 후에도 분모가 늘지 않아
//   참여율이 계속 줄어드는 문제 방지. (예전 대시보드 uncapped 버그 교정)
export const calcProgramTiming = (startDate, endDate, activeDays = 0) => {
  const start = startDate ? new Date(`${startDate}T00:00:00+09:00`) : null
  const end = endDate ? new Date(`${endDate}T00:00:00+09:00`) : null
  const programDays = (start && end) ? Math.max(1, Math.round((end - start) / 86400000) + 1) : null
  const elapsedDays = start
    ? Math.min(programDays || 9999, Math.max(0, Math.round((new Date() - start) / 86400000) + 1))
    : 0
  const remainingDays = (programDays != null) ? Math.max(0, programDays - elapsedDays) : null
  const participationRate = elapsedDays > 0
    ? Math.min(100, Math.round(((activeDays || 0) / elapsedDays) * 100))
    : 0
  return { programDays, elapsedDays, remainingDays, participationRate }
}

// Day 65 — 진행도 막대의 종료 임박 시각화.
//   normal   (<70%): 카테고리 색 그대로 (override null)
//   soon   (70-89%): amber — 마무리 단계
//   imminent (90-99%): rose — 임박 (마지막 며칠)
//   ended    (=100%): gray — 종료
// 호출처는 override 가 null 이면 카테고리 색을 쓰고, 아니면 덮어씀.
export const progressUrgency = (progress) => {
  if (progress >= 100) return { urgency: 'ended',    barCls: 'bg-gray-400',    textCls: 'text-gray-500',  label: '종료' }
  if (progress >= 90)  return { urgency: 'imminent', barCls: 'bg-rose-500',    textCls: 'text-rose-600',  label: '마무리 임박' }
  if (progress >= 70)  return { urgency: 'soon',     barCls: 'bg-amber-400',   textCls: 'text-amber-600', label: '마무리 단계' }
  return { urgency: 'normal', barCls: null, textCls: null, label: null }
}
