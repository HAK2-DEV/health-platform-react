// 강퇴(운영자 내보내기) 전역 감지용 보조 상태.
//   - 본인 탈퇴(나가기)는 강퇴로 오인하면 안 되므로, 스스로 나간 program_id 를
//     잠시 기록해 둔다(localStorage). 전역 감시자가 ACTIVE→이탈 전환을 볼 때 이 목록에
//     있으면 "강퇴 아님"으로 건너뛴다(소비 후 제거).
//   - 페이지 이동/리로드에도 살아남아야 해서 ref 가 아니라 localStorage 를 쓴다.

const key = (userId) => `self-left-${userId}`

const read = (userId) => {
  if (!userId) return []
  try { return JSON.parse(localStorage.getItem(key(userId)) || '[]') } catch { return [] }
}
const write = (userId, arr) => {
  try { localStorage.setItem(key(userId), JSON.stringify([...new Set(arr)])) } catch { /* 미지원 */ }
}

// 본인이 나간 프로그램 표시 — leave/탈퇴 직전에 호출.
export function markSelfLeft(userId, programId) {
  if (!userId || !programId) return
  write(userId, [...read(userId), programId])
}

// 현재 자진 이탈 목록(Set).
export function getSelfLeft(userId) {
  return new Set(read(userId))
}

// 소비 — 강퇴 판별에서 "자진 이탈"로 처리한 뒤 목록에서 제거.
export function consumeSelfLeft(userId, programId) {
  if (!userId || !programId) return
  write(userId, read(userId).filter((id) => id !== programId))
}
