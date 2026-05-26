import { supabase } from '../../supabaseClient'
import { CATEGORY } from '../../lib/constants'

// 프로그램 대표 사진 — 상세 헤더 / 카드 / 모달 어디서나 재사용.
// props:
//   imagePath:  programs.cover_image_path (NULL 가능)
//   categories: programs.categories TEXT[] (fallback 이모지 결정)
//   name:       프로그램 이름 (alt + 제목 오버레이 옵션)
//   variant:    'hero' (큰 헤더) | 'card' (카드 상단) | 'thumb' (작은 썸네일)
//   className:  추가 클래스
//
// 이미지 없을 때 fallback — 카테고리 첫 번째 이모지 + emerald-teal 그라데이션.
// (UserAvatar 와 같은 톤으로 통일감 유지)

// hero/card 는 부모 폭 100% (헤더용), thumb 는 외부 className 으로 사이즈 결정 (카드 썸네일).
// 모바일 우선 — 좁은 폭에서 카드 좌측 64px 썸네일을 의도대로 표시하려면 thumb 에 w-full 두면 안 됨.
const VARIANT_CLS = {
  hero: 'w-full aspect-[16/9] rounded-2xl',
  card: 'w-full aspect-[16/9] rounded-t-2xl',
  thumb: 'aspect-square rounded-xl flex-shrink-0',
}

const VARIANT_EMOJI = {
  hero: 'text-7xl',
  card: 'text-5xl',
  thumb: 'text-2xl',
}

function ProgramCover({ imagePath, categories, name, variant = 'hero', className = '' }) {
  const variantCls = VARIANT_CLS[variant] || VARIANT_CLS.hero
  const emojiCls = VARIANT_EMOJI[variant] || VARIANT_EMOJI.hero

  const publicUrl = imagePath
    ? supabase.storage.from('program-covers').getPublicUrl(imagePath).data?.publicUrl
    : null

  // fallback — 카테고리 첫 번째 이모지 (없으면 ETC)
  const firstCategory = (categories && categories[0]) || 'ETC'
  const cat = CATEGORY[firstCategory] || CATEGORY.ETC
  const fallbackEmoji = cat.emoji

  return (
    <div
      className={`
        relative overflow-hidden flex items-center justify-center
        bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-100
        ${variantCls} ${className}
      `}
    >
      {publicUrl ? (
        <img
          src={publicUrl}
          alt={name || '프로그램 표지'}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      ) : (
        <span className={`${emojiCls} select-none drop-shadow-sm`}>
          {fallbackEmoji}
        </span>
      )}
    </div>
  )
}

export default ProgramCover
