// 탭 페이지 공통 헤더 — 파스텔 그라데이션 박스 + 타이틀 (+ 우측 액션)
// 프로그램 / 랭킹 / 알림 / 프로필 4개 탭에서 동일 톤 사용.
// 톤 변경 시 이 한 곳만 수정하면 전체 탭에 반영.
//
// props:
//   children: 타이틀 내용 (이모지 텍스트 또는 <Icon /> + 텍스트)
//   action:   우측 버튼 등 (선택) — 없으면 타이틀만
//   className: 추가 클래스 (mb 조정 등)
function PageHeader({ children, action, className = '' }) {
  return (
    <div
      className={`
        flex items-center justify-between gap-3 mb-6 px-5 py-4 rounded-2xl
        bg-gradient-to-r from-emerald-50 via-teal-50/70 to-cyan-50/60
        border border-emerald-100/60
        ${className}
      `}
    >
      <h1 className="flex items-center gap-2 text-2xl font-medium text-gray-800 min-w-0">
        {children}
      </h1>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

export default PageHeader
