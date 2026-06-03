// 공용 안내 글 렌더러 — OverviewEditModal 미리보기 / ProgramDetailPage 개요 탭 공유.
//
// Day 65 본인 결정: 마크다운 파싱 제거. 단순 텍스트 + whitespace-pre-wrap 으로 변경.
//   이유: 본인 베타 운영자가 마크다운 문법(빈 줄 단락, 순서 목록 escape 등) 학습 부담 큼.
//   textarea 에 친 그대로(줄바꿈/공백/빈 줄) 자연스럽게 표시되는 게 직관적.
//   고급 마크다운 기능(굵게/링크/체크박스 등)이 필요해지면 그때 다시 도입.
function MarkdownView({ content, className = '' }) {
  if (!content || !content.trim()) return null
  return (
    <article
      className={`text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words ${className}`}
    >
      {content}
    </article>
  )
}

export default MarkdownView
