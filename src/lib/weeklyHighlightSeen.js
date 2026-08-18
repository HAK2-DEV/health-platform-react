// 주간 리포트 배너 노출 판별 — WeeklyHighlight 컴포넌트와 덱 멤버십(부모)이 공유하는 단일 소스.
//   프로드는 이번 주 미열람일 때만 노출(주 1회), dev 는 항상 노출(테스트 편의).
const DEV = import.meta.env.DEV

export function weekKey() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}

export const seenKey = (pid) => `whl-seen:${pid}`

export function weeklyHighlightVisible(programId) {
  if (DEV) return true
  try { return localStorage.getItem(seenKey(programId)) !== weekKey() } catch { return true }
}
