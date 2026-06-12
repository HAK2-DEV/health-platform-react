// 미션 기본 아이콘 목록 — public/mission-icons/ 하위 사전 제작 일러스트.
// icon_path 값은 'diet/diet_breakfast_photo.png' 같은 상대 경로.
// (라이브러리 미션은 missionLibrary.js 의 icon 으로 자동 지정, 직접 만들기는 선택기로 지정)
export const MISSION_ICONS = [
  // 식단
  'diet/diet_breakfast_photo.png',
  'diet/diet_lunch_photo.png',
  'diet/diet_dinner_photo.png',
  'diet/diet_protein_photo.png',
  'diet/diet_protein_log.png',
  'diet/diet_veggie_photo.png',
  'diet/diet_veggie_note.png',
  'diet/diet_water_count.png',
  'diet/diet_water_note.png',
  // 운동
  'walk/walk_running_photo.png',
  'walk/walk_running_distance.png',
  'walk/walk_running_note.png',
  'walk/walk_steps_log.png',
  'walk/walk_stretching_photo.png',
  // 마음관리
  'mind/mind_meditation_photo.png',
  'mind/mind_meditation_time.png',
  'mind/mind_meditation_note.png',
  'mind/mind_breathing_time.png',
  'mind/mind_gratitude_diary.png',
  'mind/mind_stress_relief.png',
  // 수면
  'sleep/sleep_bedtime_clock.png',
  'sleep/sleep_bedtime_log.png',
  'sleep/sleep_bedtime_routine.png',
  'sleep/sleep_morning_log.png',
  'sleep/sleep_note.png',
  // 공감
  'empathy/empathy_kindness_photo.png',
  'empathy/empathy_kindness_note.png',
  'empathy/empathy_gratitude_note.png',
  'empathy/empathy_family_note.png',
  // 금연
  'nosmoke/nosmoke_clean_day.png',
  'nosmoke/nosmoke_resolve_note.png',
  // 기타
  'etc/etc_reading_photo.png',
  'etc/etc_reading_note.png',
  'etc/etc_reading_time.png',
  'etc/etc_hobby_photo.png',
  'etc/etc_hobby_time.png',
  'etc/etc_morning_note.png',
  'etc/etc_morning_wake_time.png',
]

// icon_path → 실제 <img src>.
//   - 프리셋 상대경로('diet/..png') → /mission-icons/ 하위 정적 자산
//   - 커스텀 업로드(full URL, http..) → 그대로 사용
//   - NULL → null (카테고리 이모지 fallback)
export const resolveMissionIcon = (iconPath) =>
  iconPath ? (/^https?:\/\//.test(iconPath) ? iconPath : `/mission-icons/${iconPath}`) : null
