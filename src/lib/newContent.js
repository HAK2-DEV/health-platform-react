// 「새 미션/퀴즈」 강조 — localStorage 기반. (B안: 마지막으로 본 시각 이후 생성된 콘텐츠 = new)
//   kind: 'missions' | 'quizzes'. 프로그램·종류별로 「마지막으로 본 시각(ISO)」을 저장.
//   판정: item.created_at > lastSeen. 탭을 열면 markSeen 으로 갱신 → 배지 사라짐.
//   최초 진입(값 없음)엔 baseline=now 로 초기화 → 기존 콘텐츠는 new 로 잡지 않고, 이후 추가분만 강조.

const key = (programId, kind) => `dodam:seen:${programId}:${kind}`

export function getLastSeen(programId, kind) {
  if (!programId) return null
  try { return localStorage.getItem(key(programId, kind)) } catch { return null }
}

export function markSeen(programId, kind) {
  if (!programId) return
  try { localStorage.setItem(key(programId, kind), new Date().toISOString()) } catch { /* 사파리 프라이빗 등 무시 */ }
}

// items: [{ created_at }] → 기준 시각 이후 생성된 개수.
//   기준 = localStorage lastSeen(탭 열면 갱신) 우선, 없으면 fallbackSince(보통 참여 시각 joined_at).
//   → 상세를 한 번도 안 열어도 「참여 후 추가된 콘텐츠」를 new 로 표시.
//   비교는 타임스탬프(ms)로 — DB('+00:00')·markSeen('Z') 포맷 차이/초미만 경계에서도 정확.
export function countNew(items, programId, kind, fallbackSince = null) {
  const since = getLastSeen(programId, kind) || fallbackSince
  if (!since) return 0
  const sinceMs = new Date(since).getTime()
  if (Number.isNaN(sinceMs)) return 0
  let n = 0
  for (const it of items || []) {
    if (!it?.created_at) continue
    const t = new Date(it.created_at).getTime()
    if (!Number.isNaN(t) && t > sinceMs) n++
  }
  return n
}
