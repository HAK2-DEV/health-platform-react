import { useState } from 'react'
import { CATEGORY_LIST } from '../lib/constants'

// 3D 아이콘 미리보기 — /category-icons-demo.
//   카테고리: public/icons/category/<key>.png · 기능: public/icons/feature/<key>.png
//   파일 없거나 로드 실패 시 이모지 폴백.
const FEATURES = [
  { key: 'mission', label: '미션', emoji: '📋' },
  { key: 'quiz', label: '퀴즈', emoji: '❓' },
  { key: 'community', label: '커뮤니티', emoji: '💬' },
  { key: 'stats', label: '통계', emoji: '📊' },
  { key: 'point', label: '점수', emoji: '🪙' },
  { key: 'streak', label: '연속', emoji: '🔥' },
  { key: 'attendance', label: '출석', emoji: '📅' },
  { key: 'bell', label: '알림', emoji: '🔔' },
]
const REWARDS = [
  { key: 'ranking', label: '랭킹', emoji: '🏆' },
  { key: 'medal-1', label: '1위', emoji: '🥇' },
  { key: 'medal-2', label: '2위', emoji: '🥈' },
  { key: 'medal-3', label: '3위', emoji: '🥉' },
  { key: 'leaves', label: '리브즈', emoji: '🌿' },
  { key: 'gift', label: '보상', emoji: '🎁' },
  { key: 'trend', label: '변동', emoji: '📈' },
]
const ACTIONS = [
  { key: 'record', label: '기록', emoji: '✏️' },
  { key: 'complete', label: '완료', emoji: '✅' },
  { key: 'comment', label: '댓글', emoji: '💬' },
  { key: 'habit', label: '습관', emoji: '🔁' },
  { key: 'photo', label: '사진', emoji: '📷' },
  { key: 'diary', label: '일기', emoji: '📔' },
  { key: 'reading', label: '독서', emoji: '📖' },
  { key: 'water', label: '물마시기', emoji: '💧' },
]
const GROWTH = [
  { key: 'seed', label: '씨앗', emoji: '🌰' },
  { key: 'sprout', label: '새싹', emoji: '🌱' },
  { key: 'sapling', label: '묘목', emoji: '🌿' },
  { key: 'tree', label: '나무', emoji: '🌳' },
  { key: 'bloom', label: '만개', emoji: '🌸' },
  { key: 'water', label: '물(인증)', emoji: '💧' },
  { key: 'sun', label: '햇빛(출석)', emoji: '☀️' },
]
const MISSIONS = [
  { key: 'stretching', label: '스트레칭', emoji: '🤸' },
  { key: 'meal', label: '식단', emoji: '🥗' },
  { key: 'sleep', label: '수면', emoji: '🌙' },
]
const CHEER = [
  { key: 'heart', label: '응원(초록)', emoji: '💚' },
  { key: 'heart-red', label: '좋아요', emoji: '❤️' },
  { key: 'people', label: '함께', emoji: '🙌' },
  { key: 'letter', label: '응원 편지', emoji: '💌' },
  { key: 'trophy', label: '트로피', emoji: '🏆' },
  { key: 'star', label: '별', emoji: '⭐' },
  { key: 'sprout', label: '응원 새싹', emoji: '🍀' },
  { key: 'leaf', label: '잎', emoji: '🌿' },
]

function Icon3D({ src, emoji, label, size }) {
  const [err, setErr] = useState(false)
  if (err) return <span style={{ fontSize: size * 0.62 }} className="leading-none">{emoji}</span>
  return <img src={src} alt={label} onError={() => setErr(true)} style={{ width: size, height: size }} className="object-contain" />
}

function IconSection({ title, items, srcOf }) {
  return (
    <section className="mt-6">
      <h2 className="text-[15px] font-bold text-gray-900 mb-2">{title}</h2>
      {/* 카드(72px) */}
      <div className="grid grid-cols-2 gap-3">
        {items.map((it) => (
          <div key={it.key} className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4 flex flex-col items-center gap-2">
            <Icon3D src={srcOf(it.key)} emoji={it.emoji} label={it.label} size={72} />
            <span className="text-[13px] font-bold text-gray-800">{it.label}</span>
            <span className="text-[10px] text-gray-400">{it.key}.png</span>
          </div>
        ))}
      </div>
      {/* 칩(28px) */}
      <div className="flex flex-wrap gap-2 mt-3">
        {items.map((it) => (
          <div key={it.key} className="inline-flex items-center gap-1.5 bg-white border border-gray-100 rounded-full shadow-soft pl-1.5 pr-3 py-1">
            <Icon3D src={srcOf(it.key)} emoji={it.emoji} label={it.label} size={28} />
            <span className="text-[12px] font-bold text-gray-700">{it.label}</span>
          </div>
        ))}
      </div>
      {/* 원형 배경(40px) */}
      <div className="flex flex-wrap gap-3 mt-3">
        {items.map((it) => (
          <div key={it.key} className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <Icon3D src={srcOf(it.key)} emoji={it.emoji} label={it.label} size={40} />
          </div>
        ))}
      </div>
    </section>
  )
}

function CategoryIconsDemoPage() {
  const catItems = CATEGORY_LIST.map((c) => ({ key: c.key.toLowerCase(), label: c.label, emoji: c.emoji }))
  return (
    <div className="min-h-screen bg-[#f8fbf9] max-w-md mx-auto px-4 py-6">
      <h1 className="text-lg font-bold text-gray-900">3D 아이콘 미리보기</h1>
      <p className="text-[12px] text-gray-500 mt-1">public/icons/&lt;category|feature&gt;/&lt;key&gt;.png · 없으면 이모지 폴백</p>

      <IconSection title="카테고리 (8)" items={catItems} srcOf={(k) => `/icons/category/${k}.png`} />
      <IconSection title="기능 (8)" items={FEATURES} srcOf={(k) => `/icons/feature/${k}.png`} />
      <IconSection title="보상·랭킹 (7)" items={REWARDS} srcOf={(k) => `/icons/reward/${k}.png`} />
      <IconSection title="활동·기록 (8)" items={ACTIONS} srcOf={(k) => `/icons/action/${k}.png`} />
      <IconSection title="성장 (7)" items={GROWTH} srcOf={(k) => `/icons/growth/${k}.png`} />
      <IconSection title="미션 (3)" items={MISSIONS} srcOf={(k) => `/icons/mission/${k}.png`} />
      <IconSection title="응원 (8)" items={CHEER} srcOf={(k) => `/icons/cheer/${k}.png`} />
    </div>
  )
}

export default CategoryIconsDemoPage
