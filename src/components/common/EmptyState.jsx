// 공통 빈 상태 컴포넌트 — 페이지/섹션의 데이터 0 일 때 부드러운 안내
//
// props:
//   icon:        이모지 1자 (예: '📭', '🏆', '📷') 또는 이미지 경로(예: '/icons/empty/mission.png') — 경로면 <img> 로 렌더
//   title:       굵은 한 줄 (예: '아직 알림이 없어요')
//   description: 보조 한 줄 (옵션)
//   action:      { label: string, onClick?: fn, to?: string } — 옵션, 표시 시 CTA 칩
//   variant:     'soft' (기본, 옅은 회색) | 'mint' (emerald tint) — 페이지 톤 맞춤
//   size:        'sm' (간단 줄임용) | 'md' (기본) | 'lg' (페이지 전체 빈 상태)
//
// 사용:
//   <EmptyState icon="📭" title="아직 알림이 없어요" />
//   <EmptyState icon="🏆" title="참여 중인 프로그램이 없어요" description="둘러보기에서 시작해보세요"
//     action={{ label: '프로그램 둘러보기', onClick: ... }} size="lg" variant="mint" />

import { Link } from 'react-router-dom'

const VARIANT_BG = {
  soft: 'bg-gray-50/60',
  mint: 'bg-emerald-50/50',
}
const SIZE_PAD = {
  sm: 'p-6',
  md: 'p-8',
  lg: 'p-10',
}
const SIZE_ICON = {
  sm: 'text-3xl mb-1',
  md: 'text-4xl mb-2',
  lg: 'text-5xl mb-3',
}
// 이미지 아이콘(3D) 크기 — 이모지 대비 살짝 크게
const SIZE_IMG = {
  sm: 'w-12 h-12 mb-1.5',
  md: 'w-16 h-16 mb-2',
  lg: 'w-20 h-20 mb-3',
}
const isImagePath = (v) => typeof v === 'string' && (/^(https?:)?\//.test(v) || /\.(png|webp|jpg|jpeg|svg|gif)$/i.test(v))

// 이모지 아이콘 → 3D 에셋 매핑. 호출부 수정 없이 전역 교체(빈 상태 3D 통일).
//   매핑에 없는 이모지(🔍·🔒·🗂️ 등)는 그대로 이모지로 렌더.
const EMOJI_ICON = {
  '📊': '/icons/feature/stats.png',       // 통계·인증 기록
  '💬': '/icons/mypage/comments.png',     // 댓글·문의
  '📝': '/icons/mypage/posts.png',        // 글·기록 작성
  '📭': '/icons/feature/mission-empty.png',// 인증·심사 없음
  '👥': '/icons/cheer/people.png',        // 참여자·팀
  '🙌': '/icons/cheer/people.png',
  '✅': '/icons/action/complete.png',      // 처리 완료·없음
  '🎯': '/icons/profile/programs.png',     // 프로그램 없음
  '📋': '/icons/profile/programs.png',
  '🏆': '/icons/profile/programs.png',
  '💎': '/icons/feature/point.png',        // 점수
  '🗓️': '/icons/mypage/calendar.png',     // 일정·클래스
  '🧘': '/icons/feature/attendance.png',   // 클래스 출석
  '📦': '/icons/feature/mission-empty.png',// 묶음에 미션 없음
}
const SIZE_TITLE = {
  sm: 'text-base',  // Day 65 본인 피드백: 모바일 가독성 위해 sm 도 base 로
  md: 'text-base',
  lg: 'text-lg',
}
const SIZE_DESC = {
  sm: 'text-xs',
  md: 'text-sm',  // Day 65 — 12px → 14px (모바일 가독성)
  lg: 'text-sm',
}

function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'soft',
  size = 'md',
  className = '',
}) {
  const resolvedIcon = EMOJI_ICON[icon] || icon   // 이모지면 3D 경로로 치환(없으면 원본)
  return (
    <div
      className={`
        ${VARIANT_BG[variant] || VARIANT_BG.soft}
        ${SIZE_PAD[size] || SIZE_PAD.md}
        rounded-2xl text-center
        ${className}
      `}
    >
      {resolvedIcon && (
        isImagePath(resolvedIcon) ? (
          <img src={resolvedIcon} alt="" className={`${SIZE_IMG[size] || SIZE_IMG.md} mx-auto object-contain`} />
        ) : (
          <div className={`${SIZE_ICON[size] || SIZE_ICON.md} opacity-70 leading-none`}>
            {resolvedIcon}
          </div>
        )
      )}
      {title && (
        <p className={`${SIZE_TITLE[size] || SIZE_TITLE.md} font-medium text-gray-800 mb-1 break-keep`}>
          {title}
        </p>
      )}
      {description && (
        <p className={`${SIZE_DESC[size] || SIZE_DESC.md} text-gray-500 break-keep leading-relaxed`}>
          {description}
        </p>
      )}
      {action && (
        action.to ? (
          <Link
            to={action.to}
            className="inline-flex items-center gap-1 mt-4 px-5 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-medium rounded-full transition shadow-sm"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-1 mt-4 px-5 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-medium rounded-full transition shadow-sm"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  )
}

export default EmptyState
