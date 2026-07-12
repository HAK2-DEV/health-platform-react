// 강사 클래스 종목 — 색/이모지 공용(운영자 관리·참가자 화면 공유)
export const CLASS_CATEGORIES = {
  yoga:     { label: '요가',     emoji: '🧘', icon: '/icons/class/yoga.png',     pill: 'bg-emerald-100 text-emerald-700', grad: 'from-emerald-400 to-teal-500' },
  crossfit: { label: '크로스핏', emoji: '🏋️', icon: '/icons/class/crossfit.png', pill: 'bg-orange-100 text-orange-700',  grad: 'from-orange-400 to-rose-500' },
  pilates:  { label: '필라테스', emoji: '🤸', icon: '/icons/class/pilates.png',  pill: 'bg-violet-100 text-violet-700',  grad: 'from-violet-400 to-fuchsia-500' },
  gym:      { label: '헬스',     emoji: '💪', icon: '/icons/class/gym.png', pill: 'bg-sky-100 text-sky-700',        grad: 'from-sky-400 to-indigo-500' },
  etc:      { label: '기타',     emoji: '📌', pill: 'bg-gray-100 text-gray-600',      grad: 'from-gray-400 to-gray-500' },
}
export const CLASS_CAT_LIST = Object.entries(CLASS_CATEGORIES).map(([key, v]) => ({ key, ...v }))
export const catOf = (key) => CLASS_CATEGORIES[key] || CLASS_CATEGORIES.etc
