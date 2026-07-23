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
