import { supabase } from '../../supabaseClient'

// 공통 아바타 컴포넌트 — 피드/랭킹/프로필/댓글 모든 곳에서 재사용
// props:
//   avatarPath: users.avatar_path (NULL 가능)
//   nickname:   fallback 이니셜 / alt 텍스트
//   size:       'sm' (24px) | 'md' (40px) | 'lg' (64px) | 'xl' (96px)
//   cacheBust:  변경된 직후 새로고침 위한 timestamp (선택)
//   className:  추가 클래스 (그림자/링 등)
//
// avatar_path 없으면 → emerald 그라데이션 + 닉네임 첫 글자 (이모지 X — OS 별 차이 회피)
const SIZE_MAP = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
}

function UserAvatar({ avatarPath, nickname, size = 'md', cacheBust, className = '' }) {
  const sizeCls = SIZE_MAP[size] || SIZE_MAP.md
  const initial = (nickname || '?').trim().charAt(0).toUpperCase() || '?'

  const publicUrl = avatarPath
    ? supabase.storage.from('profile-avatars').getPublicUrl(avatarPath).data?.publicUrl
    : null
  const finalUrl = publicUrl && cacheBust ? `${publicUrl}?t=${cacheBust}` : publicUrl

  return (
    <div
      className={`
        ${sizeCls} ${className}
        flex-shrink-0 rounded-full overflow-hidden
        bg-gradient-to-br from-emerald-400 to-teal-500
        flex items-center justify-center
        text-white font-semibold select-none
      `}
      title={nickname || ''}
    >
      {finalUrl ? (
        <img
          src={finalUrl}
          alt={nickname || ''}
          className="w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  )
}

export default UserAvatar
