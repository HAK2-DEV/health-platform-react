-- 075a patch: 075 마이그레이션 이전에 라이브러리에서 추가된 미션의 icon_path 일회성 채우기.
-- 매칭 기준: title 정확 일치 + bundle_title IS NOT NULL (운영자 직접 생성 미션 보호)
--           + icon_path IS NULL (이미 채워진 row 건드리지 않음 — 멱등).
-- 적용 후 검증:
--   SELECT COUNT(*) FROM public.missions WHERE icon_path IS NOT NULL;

UPDATE public.missions m
SET icon_path = lib.icon
FROM (VALUES
  ('아침 식단 사진', 'diet/diet_breakfast_photo.png'),
  ('점심 식단 사진', 'diet/diet_lunch_photo.png'),
  ('저녁 식단 사진', 'diet/diet_dinner_photo.png'),
  ('취침 시간 기록', 'sleep/sleep_bedtime_log.png'),
  ('아침 기상 기록', 'sleep/sleep_morning_log.png'),
  ('수면 한 줄 소감', 'sleep/sleep_note.png'),
  ('물 마신 횟수 기록', 'diet/diet_water_count.png'),
  ('수분 섭취 한 줄 소감', 'diet/diet_water_note.png'),
  ('명상 인증 사진', 'mind/mind_meditation_photo.png'),
  ('명상 시간 기록', 'mind/mind_meditation_time.png'),
  ('마음 한 줄 소감', 'mind/mind_meditation_note.png'),
  ('오늘 안 피웠어요', 'nosmoke/nosmoke_clean_day.png'),
  ('금연 의지 한 줄', 'nosmoke/nosmoke_resolve_note.png'),
  ('운동 사진', 'walk/walk_workout_photo.png'),
  ('운동 후 한 줄 소감', 'walk/walk_workout_note.png'),
  ('걸음 수 기록', 'walk/walk_steps_log.png'),
  ('산책 사진', 'walk/walk_walking_photo.png'),
  ('걷기 후 컨디션', 'walk/walk_walking_mood.png'),
  ('오늘의 감사 한 줄', 'empathy/empathy_gratitude_note.png'),
  ('친절 인증 사진', 'empathy/empathy_kindness_photo.png'),
  ('러닝 거리 기록', 'walk/walk_running_distance.png'),
  ('러닝 인증 사진', 'walk/walk_running_photo.png'),
  ('러닝 한 줄 소감', 'walk/walk_running_note.png'),
  ('스트레칭 시간 기록', 'walk/walk_stretching_time.png'),
  ('스트레칭 인증', 'walk/walk_stretching_photo.png'),
  ('단백질 식사 사진', 'diet/diet_protein_photo.png'),
  ('단백질 섭취량 기록', 'diet/diet_protein_log.png'),
  ('채소 식단 사진', 'diet/diet_veggie_photo.png'),
  ('채소 한 줄 소감', 'diet/diet_veggie_note.png'),
  ('취침 전 스트레칭/명상', 'sleep/sleep_bedtime_routine.png'),
  ('취침 시각 기록', 'sleep/sleep_bedtime_clock.png'),
  ('오늘 감사한 일 3가지', 'mind/mind_gratitude_diary.png'),
  ('스트레스 해소 활동', 'mind/mind_stress_relief.png'),
  ('심호흡 시간', 'mind/mind_breathing_time.png'),
  ('가족 안부 한 줄', 'empathy/empathy_family_note.png'),
  ('오늘의 친절 한 줄', 'empathy/empathy_kindness_note.png'),
  ('아침 기상 시각', 'etc/etc_morning_wake_time.png'),
  ('아침 활동 한 줄', 'etc/etc_morning_note.png'),
  ('독서 시간 기록', 'etc/etc_reading_time.png'),
  ('독서 한 줄 소감', 'etc/etc_reading_note.png'),
  ('독서 인증 사진', 'etc/etc_reading_photo.png'),
  ('취미 활동 사진', 'etc/etc_hobby_photo.png'),
  ('취미 시간', 'etc/etc_hobby_time.png')
) AS lib(title, icon)
WHERE m.title = lib.title
  AND m.icon_path IS NULL
  AND m.bundle_title IS NOT NULL;
