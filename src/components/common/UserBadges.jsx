import { useProgramFlames } from '../../hooks/useProgramFlames'

// 닉네임 옆 배지 묶음 — 댓글 칭호(규칙 기반, 다음 단계) 자리.
//   불꽃(280)은 본인 결정(2026-10-05)으로 닉네임 옆이 아니라 «프로필 사진 뒤»에서 타오른다 → UserAvatar flameProgramId/flameUserId.
//   FlameBadge 는 프로그램 설정의 미리보기 아이콘으로만 쓴다.
//   배지가 없는 사람은 아무것도 그리지 않는다 — 빈 자리·회색·0 없음(퍼소나 4-6: 끊긴 것을 들추지 않는다).
//
//   size: 'xs' (11~12px 닉네임) | 'sm' (13~15px 닉네임, 기본)
//   level: 1 = 작은 불꽃(1주~) · 2 = 큰 불꽃(3주~) · 3 = 파란 불꽃(6주~)

// 그림은 앱의 3D 아이콘 에셋 — SVG 로 그린 불꽃은 «싼티·납작» (본인 2026-10-05).
//   1·2단계 = 주황 3D 불꽃(running/flame.png, 운영자 마일스톤 카드와 같은 것), 크기로 «더 오래»를 말한다.
//   3단계(6주~) = 브랜드 초록 3D 불꽃(feature/streak.png, 「지난 주 활동」·완주 축하와 같은 것).
const ASSET = { warm: '/icons/running/flame.png', brand: '/icons/feature/streak.png' }
const SIZE = { xs: [13, 16, 18], sm: [15, 18, 21] }   // [1단계, 2단계, 3단계] px

export function FlameBadge({ level = 1, weeks = 1, size = 'sm', className = '' }) {
  const px = (SIZE[size] || SIZE.sm)[Math.min(Math.max(level, 1), 3) - 1]
  const src = level >= 3 ? ASSET.brand : ASSET.warm
  const label = weeks >= 2 ? `${weeks}주째 꾸준히` : '이번 주 꾸준히'
  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 align-middle ${className}`}
      style={{ width: px, height: px }}
      role="img"
      aria-label={label}
      title={label}
    >
      <img src={src} alt="" aria-hidden="true" draggable="false" className="w-full h-full object-contain select-none" />
    </span>
  )
}

function UserBadges({ programId, userId, size = 'sm', className = '' }) {
  const flames = useProgramFlames(programId)
  const f = userId ? flames[userId] : null
  if (!f) return null
  return <FlameBadge level={f.level} weeks={f.weeks} size={size} className={className} />
}

export default UserBadges
