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

// KST 오늘 ISO 요일 (1=월 ... 7=일) — 점수 트리거 033 의 EXTRACT(ISODOW) 와 동일 규약
export function getTodayKstDow() {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(new Date())
  const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  return map[day]
}

// 미션이 KST 오늘 운영일인지 검사 (점수 트리거 033 의 클라이언트 미러)
//   schedule_mode + active_days + excluded_periods 모두 통과해야 active
//   반환: { active: boolean, reason: string | null }
export function checkMissionToday(mission) {
  if (!mission) return { active: false, reason: '미션 없음' }
  const todayDow = getTodayKstDow()
  const todayDate = getTodayKST()
  const mode = mission.schedule_mode || 'ALL_DAYS'

  if (mode === 'WEEKDAYS' && (todayDow < 1 || todayDow > 5)) {
    return { active: false, reason: '평일만 운영' }
  }
  if (mode === 'WEEKENDS' && !(todayDow === 6 || todayDow === 7)) {
    return { active: false, reason: '주말만 운영' }
  }
  if (mode === 'CUSTOM' && !(mission.active_days || []).includes(todayDow)) {
    return { active: false, reason: '오늘은 운영일 아님' }
  }

  for (const p of mission.excluded_periods || []) {
    if (p.start_date && p.end_date && todayDate >= p.start_date && todayDate <= p.end_date) {
      return { active: false, reason: p.reason ? `제외: ${p.reason}` : '제외 기간' }
    }
  }

  return { active: true, reason: null }
}