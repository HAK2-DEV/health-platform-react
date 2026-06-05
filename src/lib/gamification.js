// 게이미피케이션 핵심 — 트랙별 계산, 꽃·별자리 풀, 마일스톤.
// 본인 결정 (Day 65 / 2026-06-05): 베타 포함. 운영자 선택 (랭킹/정원/별자리).
// 모델: 물(인증) + 햇빛(출석) → 5단계 비례 분할.
//
// 관련 메모:
//   project_gamification_design_2026-06-05.md
//   project_gamification_garden_mvp_2026-06-05.md

// ─── 5단계 진행 계산 ───────────────────────────
// activeDays  — 인증한 unique 일자 수 (출석 일수)
// totalCount  — 누적 미션 인증 횟수
// programDays — 프로그램 전체 일수
// 반환: 0 (시작 전) ~ 5 (만개)
export function computeStage({ activeDays, totalCount, programDays }) {
  if (!programDays || programDays <= 0) return 0
  if (activeDays === 0 && totalCount === 0) return 0
  // 물: 매일 1인증 = 100%. 슈퍼 액티브는 cap.
  const water = Math.min(totalCount / programDays, 1)
  // 햇빛: 출석률.
  const sun = Math.min(activeDays / programDays, 1)
  // 성장: 둘의 평균 (식물 성장 원리 — 균형).
  const growth = (water + sun) / 2
  if (growth >= 1) return 5
  return Math.max(1, Math.ceil(growth * 5))
}

// 진행 비율 (0-1) — 진행 바 시각화용. computeStage 와 동일 모델.
export function computeGrowthRatio({ activeDays, totalCount, programDays }) {
  if (!programDays || programDays <= 0) return 0
  const water = Math.min(totalCount / programDays, 1)
  const sun = Math.min(activeDays / programDays, 1)
  return Math.min(1, (water + sun) / 2)
}

// ─── 연속 보너스 ─────────────────────────────
export const STREAK_PRESETS = {
  short: [3, 7],
  medium: [7, 14],
  long: [7, 14, 30],
}

export function resolveStreakMilestones(preset, customMilestones) {
  if (preset === 'custom') return customMilestones || []
  return STREAK_PRESETS[preset] || STREAK_PRESETS.medium
}

export function computeStreakBonuses(currentStreak, milestones) {
  return (milestones || []).filter(m => currentStreak >= m)
}

// ─── 누적 보너스 (고정) ───────────────────────
export const CUMULATIVE_MILESTONES = [50, 100]

export function computeCumulativeBonuses(totalCount) {
  return CUMULATIVE_MILESTONES.filter(m => totalCount >= m)
}

// ─── 정원 — 꽃 풀 (16종) ────────────────────
// 본인 명언: 「꽃은 꽃만의 매력. 반드시 이뻐야 하는 것은 아님」
export const FLOWERS = [
  { key: 'daisy',              name: '데이지',     emoji: '🌼', tone: 'yellow' },
  { key: 'lavender',           name: '라벤더',     emoji: '🪻', tone: 'purple' },
  { key: 'ranunculus',         name: '라넌큘러스', emoji: '🌷', tone: 'pink' },
  { key: 'sunflower',          name: '해바라기',   emoji: '🌻', tone: 'yellow' },
  { key: 'lily_of_the_valley', name: '은방울꽃',   emoji: '🌸', tone: 'white' },
  { key: 'hibiscus',           name: '히비스커스', emoji: '🌺', tone: 'red' },
  { key: 'tulip',              name: '튤립',       emoji: '🌷', tone: 'red' },
  { key: 'rose',               name: '장미',       emoji: '🌹', tone: 'red' },
  { key: 'cosmos',             name: '코스모스',   emoji: '🌸', tone: 'pink' },
  { key: 'hydrangea',          name: '수국',       emoji: '💠', tone: 'blue' },
  { key: 'lily',               name: '백합',       emoji: '⚜️', tone: 'white' },
  { key: 'dandelion',          name: '민들레',     emoji: '🌼', tone: 'yellow' },
  { key: 'gypsophila',         name: '안개꽃',     emoji: '💮', tone: 'white' },
  { key: 'peony',              name: '작약',       emoji: '🌸', tone: 'pink' },
  { key: 'freesia',            name: '프리지아',   emoji: '💐', tone: 'yellow' },
  { key: 'mugunghwa',          name: '무궁화',     emoji: '🏵️', tone: 'pink' },
]

export function getFlowerByKey(key) {
  return FLOWERS.find(f => f.key === key) || null
}

// 씨앗 심을 때 무작위 추첨 (균등 분포). 한 번 결정되면 DB 저장 (변하지 X).
export function pickRandomFlower() {
  return FLOWERS[Math.floor(Math.random() * FLOWERS.length)]
}

// ─── 별자리 — 풀 (12개) ────────────────────
// 베타 MVP: 미리 그려진 5별 별자리. 5단계 성장에 따라 자동 점등.
// stars: 별 5개의 [x, y] 좌표 (0-100 정규화, SVG viewBox 0 0 100 100 기준)
// edges: 연결선 [from_index, to_index] (별 0-4 인덱스)
export const CONSTELLATIONS = [
  {
    key: 'great_bear',  name: '큰곰자리',
    stars: [[15, 30], [35, 25], [55, 30], [75, 40], [80, 65]],
    edges: [[0,1],[1,2],[2,3],[3,4]],
  },
  {
    key: 'little_bear', name: '작은곰자리',
    stars: [[20, 50], [40, 45], [55, 50], [70, 55], [85, 65]],
    edges: [[0,1],[1,2],[2,3],[3,4]],
  },
  {
    key: 'orion',       name: '오리온자리',
    stars: [[30, 20], [70, 25], [45, 50], [55, 55], [50, 80]],
    edges: [[0,2],[1,3],[2,3],[2,4]],
  },
  {
    key: 'cassiopeia',  name: '카시오페이아',
    stars: [[15, 60], [30, 35], [50, 55], [70, 30], [85, 60]],
    edges: [[0,1],[1,2],[2,3],[3,4]],
  },
  {
    key: 'cygnus',      name: '백조자리',
    stars: [[50, 15], [50, 45], [50, 75], [25, 50], [75, 50]],
    edges: [[0,1],[1,2],[3,1],[1,4]],
  },
  {
    key: 'lyra',        name: '거문고자리',
    stars: [[50, 20], [30, 50], [70, 50], [40, 80], [60, 80]],
    edges: [[0,1],[0,2],[1,3],[2,4]],
  },
  {
    key: 'virgo',       name: '처녀자리',
    stars: [[20, 20], [50, 35], [80, 25], [40, 65], [70, 75]],
    edges: [[0,1],[1,2],[1,3],[3,4]],
  },
  {
    key: 'leo',         name: '사자자리',
    stars: [[20, 40], [40, 20], [60, 35], [75, 60], [55, 75]],
    edges: [[0,1],[1,2],[2,3],[3,4]],
  },
  {
    key: 'scorpius',    name: '전갈자리',
    stars: [[20, 30], [35, 40], [50, 50], [65, 55], [80, 75]],
    edges: [[0,1],[1,2],[2,3],[3,4]],
  },
  {
    key: 'pegasus',     name: '페가수스',
    stars: [[25, 25], [75, 25], [75, 75], [25, 75], [50, 50]],
    edges: [[0,1],[1,2],[2,3],[3,0]],
  },
  {
    key: 'andromeda',   name: '안드로메다',
    stars: [[20, 50], [40, 45], [55, 50], [70, 55], [85, 60]],
    edges: [[0,1],[1,2],[2,3],[3,4]],
  },
  {
    key: 'perseus',     name: '페르세우스',
    stars: [[30, 25], [50, 35], [45, 55], [65, 60], [55, 80]],
    edges: [[0,1],[1,2],[2,3],[3,4]],
  },
]

export function getConstellationByKey(key) {
  return CONSTELLATIONS.find(c => c.key === key) || null
}

export function pickRandomConstellation() {
  return CONSTELLATIONS[Math.floor(Math.random() * CONSTELLATIONS.length)]
}

// ─── 5단계 메타포 — 정원 / 별자리 공통 라벨 ────
export const STAGE_LABELS = {
  garden: ['빈 흙', '씨앗', '새싹', '줄기', '꽃봉오리', '만개'],
  constellation: ['어두운 밤', '첫 별', '두 별', '세 별', '네 별', '별자리 완성'],
}

export const STAGE_EMOJI = {
  garden: ['🟫', '🌰', '🌱', '🌿', '🪴', '🌸'],
  constellation: ['🌑', '⭐', '✨', '🌟', '💫', '🌌'],
}

export function getStageLabel(track, stage) {
  const labels = STAGE_LABELS[track] || STAGE_LABELS.garden
  return labels[Math.min(stage, labels.length - 1)] || ''
}

export function getStageEmoji(track, stage) {
  const emojis = STAGE_EMOJI[track] || STAGE_EMOJI.garden
  return emojis[Math.min(stage, emojis.length - 1)] || ''
}

// ─── 도감 ────────────────────────────────────
// 만개한 꽃들의 key 목록 → 꽃 메타 배열 (도감 화면용)
export function getCollection(flowerKeys) {
  return (flowerKeys || []).map(getFlowerByKey).filter(Boolean)
}

// ─── 마일스톤 도달 감지 ──────────────────────
// 인증 성공 직후 호출. 직전 상태 vs 현재 상태 비교해서 새로 도달한 마일스톤 반환.
//
// before / after: { streak, totalCount, stage }
// streakMilestones: number[] (예: [7, 14, 30])
//
// 반환: 토스트 메시지 배열 (도달 순서대로)
//   [{ kind, message, icon, variant }]
export function detectMilestonesReached(before, after, streakMilestones = []) {
  const reached = []

  // 1) 연속 보너스 — streakMilestones 중 before 미도달 + after 도달
  for (const m of streakMilestones) {
    if ((before?.streak || 0) < m && (after?.streak || 0) >= m) {
      reached.push({ kind: 'streak', message: `${m}일 연속 달성!`, icon: '🔥', variant: 'achievement' })
    }
  }

  // 2) 누적 보너스 — CUMULATIVE_MILESTONES (50, 100)
  for (const m of CUMULATIVE_MILESTONES) {
    if ((before?.totalCount || 0) < m && (after?.totalCount || 0) >= m) {
      reached.push({ kind: 'cumulative', message: `누적 ${m}건 인증 달성!`, icon: '🎯', variant: 'achievement' })
    }
  }

  // 3) 5단계 도달 (만개) — 성장형 트랙
  if ((before?.stage || 0) < 5 && (after?.stage || 0) >= 5) {
    reached.push({ kind: 'stage', message: '만개! 식물의 정체가 공개됐어요', icon: '🌸', variant: 'achievement' })
  }

  return reached
}
