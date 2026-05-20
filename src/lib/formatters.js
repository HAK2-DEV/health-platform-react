// 한국 시간 (Asia/Seoul, UTC+9) 기준 날짜 함수들

// 오늘 날짜 (YYYY-MM-DD)
export function getTodayKST() {
  const now = new Date()
  // 본인의 컴퓨터의 시간대 무관하게 KST 기준
  const kstOffset = 9 * 60 // KST = UTC+9 (분)
  const localOffset = now.getTimezoneOffset() // 본인의 컴퓨터 (분, UTC 기준 - 본인 시간)
  const kstTime = new Date(now.getTime() + (kstOffset + localOffset) * 60 * 1000)
  return kstTime.toISOString().split('T')[0]
}

// Date 객체 → KST YYYY-MM-DD
export function toKSTDateString(date) {
  const d = new Date(date)
  const kstOffset = 9 * 60
  const localOffset = d.getTimezoneOffset()
  const kstTime = new Date(d.getTime() + (kstOffset + localOffset) * 60 * 1000)
  return kstTime.toISOString().split('T')[0]
}

// YYYY-MM-DD → 한국 표시용 (2026.05.20)
export function formatKoreanDate(dateString) {
  if (!dateString) return ''
  return dateString.replaceAll('-', '.')
}