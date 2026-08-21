// 바이옴 세트 — 프로그램 카테고리별 「섬」의 하늘·땅 팔레트 + 앰비언트 + 이름.
//   v1(베타): 색·앰비언트·기본 클레이 스프라이트로 카테고리를 구분한다.
//   추후: 카테고리별 실제 섬 배경 아트(이미지)를 bg 로 얹어 교체 — 팔레트는 폴백으로 남김.
//   관련: project_growth_concept_2026-08-17 (바이옴별 다른 식물), project_growth_dev_strategy_2026-08-07.

export const BIOMES = {
  WALKING:      { key: 'meadow', name: '초원 섬', sky: ['#C7E9F4', '#E9F6DD'], ground: ['#93D9A2', '#5CAC6C', '#7C5A38'], accent: '#3E9E5B', ambient: 'butterfly' },
  RUNNING:      { key: 'hills',  name: '언덕 섬', sky: ['#CFEBF7', '#EAF6DE'], ground: ['#9BDDA8', '#54A566', '#7A5836'], accent: '#3B9A57', ambient: 'wind' },
  DIET:         { key: 'garden', name: '텃밭 섬', sky: ['#FBEEDA', '#ECF6D8'], ground: ['#BADB8E', '#7CB55A', '#8A5E38'], accent: '#7FA834', ambient: 'butterfly' },
  QUIT_SMOKING: { key: 'clear',  name: '맑은 섬', sky: ['#D0EAFB', '#E9F6F2'], ground: ['#A0D9C1', '#5CB39A', '#6E5A44'], accent: '#3AA0B0', ambient: 'bird' },
}

export const DEFAULT_BIOME = {
  key: 'meadow', name: '나의 섬', sky: ['#C7E9F4', '#E9F6DD'], ground: ['#93D9A2', '#5CAC6C', '#7C5A38'], accent: '#3E9E5B', ambient: 'butterfly',
}

// 프로그램 categories 배열 → 바이옴 세트 (첫 카테고리 기준, 없으면 기본).
export function biomeForCategories(categories) {
  const c = Array.isArray(categories) ? categories[0] : null
  return BIOMES[c] || DEFAULT_BIOME
}

// 프로그램 전체 일수 — 시작~종료. 없으면 30일 폴백. (성장 비율 분모)
export function programLengthDays(program) {
  if (program?.start_date && program?.end_date) {
    const d = Math.round((new Date(program.end_date) - new Date(program.start_date)) / 86400000) + 1
    if (d > 0) return d
  }
  return 30
}
