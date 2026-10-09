// 커뮤니티 게시판 이름 해석 — 운영자가 게시판을 커스터마이즈하지 않으면
//   programs.community_settings.boards 가 비어 있어 board_id(예: 'free')가 그대로 노출된다.
//   그때는 기본 게시판(DEFAULT_BOARDS)의 이름으로 대체한다. (CommunityManagePanel 의 기본 정의와 동일)

export const DEFAULT_BOARDS = [
  { id: 'all', name: '전체' },
  { id: 'cert', name: '인증' },
  { id: 'free', name: '자유' },
]

// 프로그램의 게시판 목록 — 커스텀 boards 있으면 그것, 없으면 기본.
export function programBoards(program) {
  const b = program?.community_settings?.boards
  return Array.isArray(b) && b.length ? b : DEFAULT_BOARDS
}

// board_id → 표시 이름. 운영자 설정 이름 우선, 없으면 기본 이름, 그래도 없으면 id 그대로.
export function boardLabel(program, boardId) {
  const found = programBoards(program).find((x) => x.id === boardId)
  if (found?.name) return found.name
  const def = DEFAULT_BOARDS.find((x) => x.id === boardId)
  return def?.name || boardId
}

// 커뮤니티 기본 게시판 «설정 전체»(2026-10-10, CommunityManagePanel 에서 옮김) — 위 DEFAULT_BOARDS(이름만, 이름 해석용)와 별개.
//   community_settings.boards 가 비어 있으면 관리 화면이 이 목록으로 시작한다.
//   ⚠️ boards 를 저장할 땐 «전체 목록»을 저장한다 — 일부만 저장하면 관리 화면이 그 일부만 게시판으로 본다.
//   인증 게시판 feedVisibility: public(항상 공개) / optin_public / optin_private(기본 비공개 · 개인 선택) / private.
//   AI 초안의 마음 건강 프로그램은 인증 게시판만 optin_private 로 바꿔 전체를 저장한다(aiDraft.js).
export const DEFAULT_BOARD_SETTINGS = [
  { id: 'all', name: '전체', system: true, desc: '모든 게시글을 한눈에 확인할 수 있어요.', writePerm: 'free', commentPerm: 'free', manageMode: 'default' },
  { id: 'cert', name: '인증', system: true, desc: '운동 인증이나 기록을 공유하는 공간이에요.', writePerm: 'approval', commentPerm: 'free', manageMode: 'review', feedVisibility: 'public' },
  { id: 'free', name: '자유', system: true, desc: '주제에 구애받지 않고 자유롭게 이야기해요.', writePerm: 'free', commentPerm: 'free', manageMode: 'instant' },
  { id: 'notice', name: '공지', system: true, desc: '운영진이 작성하는 공지사항 게시판이에요.', writePerm: 'readonly', commentPerm: 'readonly', manageMode: 'owner' },
]
