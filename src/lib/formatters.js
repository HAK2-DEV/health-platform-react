// 한국 시간 (Asia/Seoul, UTC+9) 기준 날짜 함수들

// Intl.DateTimeFormat 으로 KST 날짜 추출 — DST/오프셋 계산 함정 없음
//   기존 toISOString 기반 로직은 KST 09시 이전에 어제 날짜를 반환하는 버그가 있었음 (Day 55 수정)
const _KST_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// 오늘 날짜 (YYYY-MM-DD, KST)
export function getTodayKST() {
  return _KST_FORMATTER.format(new Date())
}

// Date 객체 → KST YYYY-MM-DD
export function toKSTDateString(date) {
  return _KST_FORMATTER.format(new Date(date))
}

// YYYY-MM-DD → 한국 표시용 (2026.05.20)
export function formatKoreanDate(dateString) {
  if (!dateString) return ''
  return dateString.replaceAll('-', '.')
}

// ISO timestamp → KST 'YYYY.MM.DD HH:mm' (퀴즈 기한처럼 시간 포함 표시용)
const _KST_DATETIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit',
  hour12: false,
})
export function formatKoreanDateTime(timestamp) {
  if (!timestamp) return ''
  const parts = _KST_DATETIME_FORMATTER.formatToParts(new Date(timestamp))
  const get = (t) => parts.find(p => p.type === t)?.value || ''
  return `${get('year')}.${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`
}

// 프로그램 시작일이 오늘(KST) 이후면 true — "예정" 상태 판정용
export function isUpcomingByStartDate(startDate) {
  if (!startDate) return false
  return new Date(`${startDate}T00:00:00+09:00`) > new Date()
}

// ISO timestamp → "오늘" / "어제" / "N일 전" / "YYYY.MM.DD" 짧은 한국식
export function formatRelativeKstDay(timestamp) {
  if (!timestamp) return ''
  const todayKst = getTodayKST()
  const targetKst = toKSTDateString(timestamp)
  if (targetKst === todayKst) return '오늘'
  const today = new Date(`${todayKst}T00:00:00+09:00`)
  const target = new Date(`${targetKst}T00:00:00+09:00`)
  const diffDays = Math.round((today - target) / (1000 * 60 * 60 * 24))
  if (diffDays === 1) return '어제'
  if (diffDays > 1 && diffDays < 30) return `${diffDays}일 전`
  return targetKst.replaceAll('-', '.')
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