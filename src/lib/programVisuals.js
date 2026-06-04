// 참여 중 프로그램 카드의 카테고리별 파스텔 색상 + 시간 진행률 헬퍼.
// Dashboard / ProgramList 등 여러 페이지가 같은 룩을 공유하도록 한 곳에서 관리.

// 카테고리별 파스텔 색상 (Tailwind JIT 안전 — 명시적 클래스명)
export const CATEGORY_COLORS = {
  WALKING:    { bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'bg-emerald-400' },
  DIET:       { bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'bg-emerald-400' },
  EMPATHY:    { bg: 'bg-pink-50',    border: 'border-pink-100',    accent: 'bg-pink-400' },
  MINDCARE:   { bg: 'bg-orange-50',  border: 'border-orange-100',  accent: 'bg-orange-400' },
  SLEEP:      { bg: 'bg-purple-50',  border: 'border-purple-100',  accent: 'bg-purple-400' },
  NO_SMOKING: { bg: 'bg-yellow-50',  border: 'border-yellow-100',  accent: 'bg-yellow-400' },
  ETC:        { bg: 'bg-gray-50',    border: 'border-gray-100',    accent: 'bg-gray-400' },
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
