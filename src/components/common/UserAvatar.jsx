import { supabase } from '../../supabaseClient'
import { useAvatarViewer } from '../../contexts/AvatarViewerContext'
import { useProgramFlames } from '../../hooks/useProgramFlames'
import { FlameWrap } from './FlameAura'

// 공통 아바타 컴포넌트 — 피드/랭킹/프로필/댓글 모든 곳에서 재사용
// props:
//   avatarPath: users.avatar_path (NULL 가능)
//   nickname:   fallback 이니셜 / alt 텍스트
//   size:       'sm' (24px) | 'md' (40px) | 'lg' (64px) | 'xl' (96px)
//   cacheBust:  변경된 직후 새로고침 위한 timestamp (선택)
//   className:  추가 클래스 (그림자/링 등)
//   viewable:   true 면 눌러서 프로필 사진 크게 보기 (전역 AvatarViewer). 다른 유저 아바타용.
//   flameProgramId + flameUserId: 둘 다 주면 그 프로그램에서 불꽃이 켜진 사람일 때 사진 뒤에서
//     3D 불꽃이 이글이글(280, 본인 결정 2026-10-05 — 닉네임 옆 배지 대신 사진 뒤 배경).
//     꺼진 사람은 평소 아바타 그대로(빈 자리·회색 없음).
//
// avatar_path 없으면 → emerald 그라데이션 + 닉네임 첫 글자 (이모지 X — OS 별 차이 회피)
const SIZE_MAP = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
}
const SIZE_PX = { sm: 24, md: 40, lg: 64, xl: 96 }

// 불꽃의 색·혀 개수·키는 전부 FlameAura 가 단계로 정한다(1·2단계 주황, 3단계 브랜드 초록).
//   예전엔 사진 테두리에 box-shadow glow 를 하나 더 깔았는데, 새 불꽃은 사진에 «금색 테두리»가
//   직접 붙으므로 중복이고 서로 흐려 보였다. 뺐다(애니메이션 하나 줄어드는 건 덤).

//   flame: { level, weeks } 를 직접 주면 조회 없이 그대로 그린다(데모·미리보기용).
function UserAvatar({ avatarPath, nickname, size = 'md', cacheBust, className = '', viewable = false, flameProgramId = null, flameUserId = null, flame: flameProp = null }) {
  const { open } = useAvatarViewer()
  const flames = useProgramFlames(flameProgramId, { enabled: !!flameProgramId && !!flameUserId })
  const flame = flameProp || (flameProgramId && flameUserId ? flames[flameUserId] : null)
  const sizeCls = SIZE_MAP[size] || SIZE_MAP.md
  const initial = (nickname || '?').trim().charAt(0).toUpperCase() || '?'

  const publicUrl = avatarPath
    ? supabase.storage.from('profile-avatars').getPublicUrl(avatarPath).data?.publicUrl
    : null
  const finalUrl = publicUrl && cacheBust ? `${publicUrl}?t=${cacheBust}` : publicUrl

  const lit = !!flame && flame.level > 0
  // ⚠️ 불이 켜지면 className(전부 여백 클래스다)은 사진이 아니라 «바깥 상자»에 붙인다.
  //   사진에 붙이면 그 여백이 FlameWrap 안쪽에 들어가 불꽃 상자를 키우고, 불꽃 중심이
  //   여백의 절반만큼 내려간다 → 사진이 불꽃 가운데보다 «위로» 뜬 것처럼 보인다.
  //   (PodiumTop3 의 mb-1.5 로 3px 어긋나던 것 — 2026-10-06)
  const baseCls = `${sizeCls} ${lit ? '' : className} flex-shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold select-none`
  const inner = finalUrl
    ? <img src={finalUrl} alt={nickname || ''} loading="lazy" decoding="async" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
    : <span>{initial}</span>

  const avatar = viewable ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); open({ avatarPath, nickname }) }}
      className={`${baseCls} cursor-pointer relative z-[1]`}
      title={nickname ? `${nickname} 프로필 사진 보기` : '프로필 사진 보기'}
      aria-label={nickname ? `${nickname} 프로필 사진 보기` : '프로필 사진 보기'}
    >
      {inner}
    </button>
  ) : (
    <div className={`${baseCls} relative z-[1]`} title={nickname || ''}>
      {inner}
    </div>
  )

  if (!lit) return avatar

  // 불은 사진 «뒤» — 사진이 불의 속불 자리에 들어가고 혀만 어깨 위로 솟는다(FlameWrap).
  //   scale 은 «혀의 키»만 줄인다(테두리는 사진에 붙어 있어야 한다).
  //   sm/md(댓글·랭킹 행 64px) = 0.8 — 제일 큰 혀 끝이 사진 위 ~17px 에서 멈춰 이웃 행의 여백 안이다.
  //   lg = 0.7 — 64px 아바타라 0.7 이어도 절대 길이는 ~28px 로 제일 길다. 시상대 1등 자리는
  //     왕관·메달이 이미 위를 차지하고 있어서 더 솟으면 요란해진다(의도적으로 짧게).
  //   xl 은 프로필처럼 위가 트인 자리 — 그대로 1.
  const label = flame.weeks >= 2 ? `${flame.weeks}주째 꾸준히` : '이번 주 꾸준히'
  const scale = size === 'xl' ? 1 : size === 'lg' ? 0.7 : 0.8
  return <FlameWrap level={flame.level} px={SIZE_PX[size] || SIZE_PX.md} scale={scale} title={label} className={className}>{avatar}</FlameWrap>
}

export default UserAvatar
