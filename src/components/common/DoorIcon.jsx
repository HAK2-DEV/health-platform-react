// 문 아이콘 — 나가기/내보내기 공용. stroke=currentColor 라 text-* 로 색, w-/h- 로 크기 조절.
//   열린 문 패널 + 오른쪽 문틀 + 손잡이 (붙여넣은 도어 아이콘 재현).
function DoorIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 21h18" />
      <path d="M19 21V3h-5" />
      <path d="M14 2.5 5 4.2v15.6L14 21z" />
      <circle cx="7.4" cy="12.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default DoorIcon
