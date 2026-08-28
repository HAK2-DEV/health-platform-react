// 클래스 사전 신청 «개방 시점» 계산 — 참여자 게이팅(ClassDetail)과 운영자 목록(ClassManageView) 공용.
//
// 설정은 2단으로 겹친다 (마이그 245/246/248):
//   1) 클래스별 값  session.signup_lead_days / signup_open_time
//   2) 없으면 프로그램 기본  programs.class_signup_lead_days / class_signup_open_time
//   3) 시각이 둘 다 없으면 «클래스 시작 시각»과 같은 시각 (기존 동작)
//
// 두 화면이 같은 규칙을 봐야 하므로 계산을 여기 한곳에 둔다.
// (운영자 목록이 "3/3 19:00 개방" 이라고 보여주는데 참여자 화면은 09:00에 열리면 안 된다)

// 신청 개방 시각 = 클래스 시작일에서 leadDays 일 전.
//   openTime('HH:MM' 또는 'HH:MM:SS')이 있으면 그날의 그 시각으로 맞추고,
//   없으면 클래스 시작 시각을 그대로 유지한다.
//   로컬(KST) 기준 setHours — 저장된 TIME 에는 타임존이 없고 사용자층이 KST 단일이다.
export function signupOpenAt(startMs, leadDays, openTime) {
  const d = new Date(startMs - leadDays * 86400000)
  if (openTime) {
    const [h, m] = String(openTime).split(':')
    d.setHours(Number(h) || 0, Number(m) || 0, 0, 0)
  }
  return d.getTime()
}

/**
 * 이 클래스의 신청 개방 시점을 푼다.
 * @returns null 이면 «표시할 개방 시점이 없음» — 자유 참여이거나, 항상 열려 있거나, 시작일이 없는 경우.
 *          아니면 { opensMs, notYet }.
 */
export function resolveSignupOpen(session, programLeadDays = null, programOpenTime = null, nowMs = Date.now()) {
  if (!session?.starts_at) return null
  if (session.signup_mode !== 'rsvp') return null          // 자유 참여 = 신청 개념 자체가 없음
  const leadDays = session.signup_lead_days ?? programLeadDays
  if (!(leadDays > 0)) return null                          // 0/미설정 = 항상 열림
  const openTime = session.signup_open_time ?? programOpenTime
  const opensMs = signupOpenAt(new Date(session.starts_at).getTime(), leadDays, openTime)
  return { opensMs, notYet: nowMs < opensMs }
}
