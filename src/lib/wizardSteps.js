// 프로그램 만들기 마법사 — 단계 이동 규칙(순수 함수, 검사 스크립트가 직접 부른다)
//   AI 초안(source_preset_key 'ai_builder')은 2단계(프로그램 옵션)·3단계(참여 조건)를 건너뛴다 — AI 질문에서 이미 정했다
//   (본인 2026-10-10: 「이미 정한 걸 또 물으면 AI로 만든 게 더 귀찮다」). 1단계(이름·기간 확인) → 4단계(요약·게시).
//   두 단계가 저장하던 칸은 만들 때 채운다(aiDraftProgramFields·withInviteCode). 바꾸고 싶으면 게시 뒤 프로그램 설정에서.
import { AI_PRESET_KEY } from './aiDraft'

export const WIZARD_SKIP_FOR_AI = [2, 3]
// 건너뛰는 건 «그 단계의 값이 이미 채워져 있을 때만»(2026-10-10 실측: 참여 방법을 채우기 전 버전으로 만든 AI 초안은 join_type 이 비어 있었다
//   — 3단계를 건너뛰면 참여 방식 없이 게시된다). 비어 있으면 그 단계를 거쳐서 마법사가 채운다.
//   2단계: 커뮤니티 피드 옛 칸(feed_enabled)이 커뮤니티 켜짐과 맞을 때(예전 초안은 feed_enabled 가 DB 기본값 꺼짐이라 피드가 빈다)
//   3단계: 참여 방식이 있고, 초대 코드 방식이면 코드까지 있을 때
export const wizardSkips = (program) => {
  if (program?.source_preset_key !== AI_PRESET_KEY) return []
  const skips = []
  if (program.feed_enabled === (program.community_enabled !== false)) skips.push(2)
  if (program.join_type && (program.join_type !== 'INVITE_CODE' || program.invite_code)) skips.push(3)
  return skips
}
// 다음 단계 — 건너뛸 단계는 넘는다(마지막은 4)
export const nextWizardStep = (step, skips = []) => {
  let n = step + 1
  while (skips.includes(n) && n < 4) n += 1
  return Math.min(4, n)
}
// 이전 단계 — 건너뛴 단계는 넘는다(처음은 1). 4단계에서 «이전»이면 AI 초안은 1단계로
export const prevWizardStep = (step, skips = []) => {
  let p = step - 1
  while (skips.includes(p) && p > 1) p -= 1
  return Math.max(1, p)
}
