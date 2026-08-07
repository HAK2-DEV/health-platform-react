// 미션 기본 아이콘 — public/mission-icons/ 바로 아래 flat 10장.
// 테마별 대표 아이콘 1개씩 (미션마다 1개 → 테마마다 1개로 축소, 2026-06-22).
// icon_path 값은 'diet.png' 같은 파일명. (라이브러리 미션은 missionLibrary.js 의 icon,
// 직접 만들기는 MissionIconPicker 선택기로 지정)
export const MISSION_ICONS = [
  'diet.png',        // 식단 (샐러드)
  'water.png',       // 수분 (물병)
  'exercise.png',    // 운동 (운동화)
  'walk.png',        // 걷기 (걷기 전용)
  'running.png',     // 러닝 (달리기 전용)
  'stretching.png',  // 스트레칭 (요가)
  'sleep.png',       // 수면 (달·베개)
  'meditation.png',  // 명상·마음 (연꽃)
  '/icons/meditation/meditate.png',  // 명상 (3D 명상 캐릭터)
  'nosmoke.png',     // 금연 (담배·새싹)
  'reading.png',     // 독서 (책)
  'diary.png',       // 일기·소감·감사·공감 (일기장·연필)
  'photo.png',       // 범용 사진 인증 (카메라·체크)
]

// 레거시 경로 호환 — 이미 생성된 미션·라이브러리가 저장한 옛 카테고리 경로
// ('diet/diet_breakfast_photo.png' 등)를 새 10장으로 매핑. 옛 png 파일 삭제 후에도
// 기존 미션 아이콘이 깨지지 않도록 resolveMissionIcon 에서 정규화.
// 전용 테마가 없는 카테고리(공감/취미/아침)는 미션 성격에 따라 diary(소감)·photo(사진)로 흡수.
const LEGACY_ICON_MAP = {
  // 식단
  'diet/diet_breakfast_photo.png': 'diet.png',
  'diet/diet_lunch_photo.png': 'diet.png',
  'diet/diet_dinner_photo.png': 'diet.png',
  'diet/diet_protein_photo.png': 'diet.png',
  'diet/diet_protein_log.png': 'diet.png',
  'diet/diet_veggie_photo.png': 'diet.png',
  'diet/diet_veggie_note.png': 'diet.png',
  'diet/diet_water_count.png': 'water.png',
  'diet/diet_water_note.png': 'water.png',
  // 운동
  'walk/walk_running_photo.png': 'exercise.png',
  'walk/walk_running_distance.png': 'exercise.png',
  'walk/walk_running_note.png': 'exercise.png',
  'walk/walk_steps_log.png': 'exercise.png',
  'walk/walk_walking_photo.png': 'exercise.png',
  'walk/walk_walking_mood.png': 'exercise.png',
  'walk/walk_workout_photo.png': 'exercise.png',
  'walk/walk_workout_note.png': 'exercise.png',
  'walk/walk_stretching_photo.png': 'stretching.png',
  'walk/walk_stretching_time.png': 'stretching.png',
  // 마음관리
  'mind/mind_meditation_photo.png': 'meditation.png',
  'mind/mind_meditation_time.png': 'meditation.png',
  'mind/mind_meditation_note.png': 'meditation.png',
  'mind/mind_breathing_time.png': 'meditation.png',
  'mind/mind_stress_relief.png': 'meditation.png',
  'mind/mind_gratitude_diary.png': 'diary.png',
  // 수면
  'sleep/sleep_bedtime_clock.png': 'sleep.png',
  'sleep/sleep_bedtime_log.png': 'sleep.png',
  'sleep/sleep_bedtime_routine.png': 'sleep.png',
  'sleep/sleep_morning_log.png': 'sleep.png',
  'sleep/sleep_note.png': 'sleep.png',
  // 공감 (전용 아이콘 없음 → 사진은 photo, 소감은 diary)
  'empathy/empathy_kindness_photo.png': 'photo.png',
  'empathy/empathy_kindness_note.png': 'diary.png',
  'empathy/empathy_gratitude_note.png': 'diary.png',
  'empathy/empathy_family_note.png': 'diary.png',
  // 금연
  'nosmoke/nosmoke_clean_day.png': 'nosmoke.png',
  'nosmoke/nosmoke_resolve_note.png': 'nosmoke.png',
  // 기타
  'etc/etc_reading_photo.png': 'reading.png',
  'etc/etc_reading_note.png': 'reading.png',
  'etc/etc_reading_time.png': 'reading.png',
  'etc/etc_hobby_photo.png': 'photo.png',
  'etc/etc_hobby_time.png': 'diary.png',
  'etc/etc_morning_note.png': 'diary.png',
  'etc/etc_morning_wake_time.png': 'diary.png',
}

// 옛 경로면 새 파일명으로 정규화 (이미 새 파일명이면 그대로).
export const normalizeMissionIcon = (iconPath) =>
  iconPath ? (LEGACY_ICON_MAP[iconPath] || iconPath) : iconPath

// icon_path → 실제 <img src>.
//   - 프리셋 파일명('diet.png') / 옛 경로('diet/..png') → /mission-icons/ 하위 정적 자산 (레거시 정규화)
//   - 커스텀 업로드(full URL, http..) → 그대로 사용
//   - NULL → null (카테고리 이모지 fallback)
export const resolveMissionIcon = (iconPath) => {
  if (!iconPath) return null
  if (/^https?:\/\//.test(iconPath)) return iconPath
  if (iconPath.startsWith('/')) return iconPath   // 절대 public 경로(예: /icons/meditation/meditate.png)는 그대로
  return `/mission-icons/${normalizeMissionIcon(iconPath)}`
}
