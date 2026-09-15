// 프로그램 마법사 1단계 입력·진행 위치 보관 (세션 저장소, 30분)
//
// 배경 (2026-09-16 노트9 제보, code 41):
//   대표 사진을 고르고 오면 1단계가 새로 그려져 «이름» 서브스텝으로 돌아가고 입력이 사라졌다.
//   원인 경로를 실기기에서 확정하지 못해, 1단계가 다시 그려져도 그대로 이어지게 막는다.
//
// 지우는 시점: 다음 단계 저장 성공·임시저장 성공(ProgramNewPage) / 「직접 만들기」로 새로 시작.
// 임시저장 재진입(?id=)은 DB 값이 기준이라 이 보관본을 쓰지 않는다(Step1Basic).

const STEP1_DRAFT_KEY = 'wizard-step1-draft'
const STEP1_DRAFT_TTL_MS = 30 * 60_000

export function readStep1Draft() {
  try {
    const raw = sessionStorage.getItem(STEP1_DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d?.savedAt || Date.now() - d.savedAt > STEP1_DRAFT_TTL_MS) return null
    return d
  } catch {
    return null
  }
}

export function writeStep1Draft(data) {
  try {
    sessionStorage.setItem(STEP1_DRAFT_KEY, JSON.stringify({ ...data, savedAt: Date.now() }))
  } catch {
    /* 저장 실패 무시 — 보관은 보조 수단 */
  }
}

export function clearStep1Draft() {
  try {
    sessionStorage.removeItem(STEP1_DRAFT_KEY)
  } catch {
    /* 무시 */
  }
}
