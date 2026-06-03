import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import { CATEGORY } from '../../lib/constants'

// 프로그램 대표 사진 — 상세 헤더 / 카드 / 모달 어디서나 재사용.
// props:
//   imagePath:  programs.cover_image_path (NULL 가능)
//   categories: programs.categories TEXT[] (fallback 결정)
//   name:       프로그램 이름 (alt)
//   variant:    'hero' (큰 헤더) | 'card' (카드 상단) | 'thumb' (작은 썸네일)
//   className:  추가 클래스
//
// Fallback 우선순위 (Day 65 본인 결정):
//   1) 운영자가 업로드한 사진 (cover_image_path)
//   2) 카테고리별 자체 일러스트 (/illustrations/program-covers/{KEY}.jpg)
//   3) 카테고리 이모지 + 그라데이션 (최종 안전망)
//
// thumb 정책 (본인 결정 — 잘림 vs 좌측 핵심 보존):
//   본인 7개 카테고리 표지가 모두 "좌측 핵심 요소 + 우측 여백" 디자인이라
//   1:1 thumb 에서 object-cover + object-position: left 로 좌측 핵심만 보여줘도 자연스럽게 식별됨.
//   운영자 업로드 사진도 같은 정책 적용 (운영자에게 좌측 정렬 가이드 제공 권장).

const VARIANT_CLS = {
  hero: 'w-full aspect-[16/9] rounded-2xl',
  card: 'w-full aspect-[16/9] rounded-t-2xl',
  banner: 'w-full aspect-[16/7] rounded-t-2xl',     // 모달 헤더용 (짧은 비율, Day 65 본인 결정)
  thumb: 'aspect-square rounded-xl flex-shrink-0',
}

const VARIANT_EMOJI = {
  hero: 'text-7xl',
  card: 'text-5xl',
  banner: 'text-5xl',
  thumb: 'text-3xl',
}

// 카테고리 KEY → 자체 표지 경로 매핑 (public/illustrations/program-covers/)
const COVER_BY_CATEGORY = {
  WALKING: '/illustrations/program-covers/walking.jpg',
  DIET: '/illustrations/program-covers/diet.jpg',
  EMPATHY: '/illustrations/program-covers/empathy.jpg',
  MINDCARE: '/illustrations/program-covers/mindcare.jpg',
  SLEEP: '/illustrations/program-covers/sleep.jpg',
  NO_SMOKING: '/illustrations/program-covers/no_smoking.jpg',
  ETC: '/illustrations/program-covers/etc.jpg',
}

function ProgramCover({ imagePath, categories, name, variant = 'hero', className = '' }) {
  const variantCls = VARIANT_CLS[variant] || VARIANT_CLS.hero
  const emojiCls = VARIANT_EMOJI[variant] || VARIANT_EMOJI.hero

  // 1) 운영자 업로드 사진 (Supabase Storage)
  const publicUrl = imagePath
    ? supabase.storage.from('program-covers').getPublicUrl(imagePath).data?.publicUrl
    : null

  // 2) 카테고리 기본 표지 경로
  const firstCategory = (categories && categories[0]) || 'ETC'
  const cat = CATEGORY[firstCategory] || CATEGORY.ETC
  const categoryCoverUrl = COVER_BY_CATEGORY[firstCategory] || null

  // 두 단계 fallback 상태
  const [uploadedFailed, setUploadedFailed] = useState(false)
  const [categoryFailed, setCategoryFailed] = useState(false)

  const showUploaded = publicUrl && !uploadedFailed
  const showCategoryDefault = !showUploaded && categoryCoverUrl && !categoryFailed
  const showEmoji = !showUploaded && !showCategoryDefault

  // 우리 기본 카테고리 표지만 좌측 15% 정렬 (좌측 핵심 + 우측 여백 디자인 전용)
  // 운영자 업로드 사진은 중앙 정렬 (사용자가 의도한 구도 존중)
  const categoryCoverPosition = variant === 'thumb'
    ? { objectPosition: '15% center' }
    : {}

  return (
    <div
      className={`
        relative overflow-hidden flex items-center justify-center
        bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-100
        ${variantCls} ${className}
      `}
    >
      {showUploaded && (
        <img
          src={publicUrl}
          alt={name || '프로그램 표지'}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setUploadedFailed(true)}
        />
      )}
      {showCategoryDefault && (
        <img
          src={categoryCoverUrl}
          alt={name || `${cat.label} 프로그램`}
          className="absolute inset-0 w-full h-full object-cover"
          style={categoryCoverPosition}
          onError={() => setCategoryFailed(true)}
        />
      )}
      {showEmoji && (
        <span className={`${emojiCls} select-none drop-shadow-sm`}>
          {cat.emoji}
        </span>
      )}
    </div>
  )
}

export default ProgramCover
