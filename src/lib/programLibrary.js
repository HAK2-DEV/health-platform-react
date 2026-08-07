// 관리자 프리셋 프로그램 라이브러리 — 코드 정의 (missionLibrary/quizLibrary 패턴).
//   운영자가 「라이브러리에서 시작」을 고르면 프리셋 → 미션 체크 선택 → DRAFT 프로그램 + 선택 미션 생성.
//   운영자 공유(인기 프로그램)는 다음 슬라이스에서 DB + cloneProgram 으로 별도 구현.
//
// 프리셋:
//   key, emoji, name, description, categories[](CATEGORY key), durationDays, bundleTitle,
//   missions[] — 각 미션은 missionLibrary 와 동일한 필드(미지정 시 expandPresetMission 기본값).
//     선택을 위해 미션마다 고유 key 부여.
import { CATEGORY, PROGRAM_THEME } from './constants'

export const PROGRAM_PRESETS = [
  {
    key: 'run_3km',
    quizTopicKey: 'activity',
    emoji: '🏃',
    name: '3km 달리기 챌린지',
    description: '하루 3km 달리기로 건강한 습관을 만드는 챌린지예요.',
    categories: [CATEGORY.RUNNING.key],
    durationDays: 28,
    theme: PROGRAM_THEME.RUNNING,   // 달리기 테마 — 상세 변형(마라톤 지도 등)
    bundleTitle: '🏃 3km 달리기',
    missions: [
      {
        key: 'daily_3km',
        title: '오늘 3km 달리기',
        instruction: '평일마다 3km 이상 달린 뒤, 러닝앱·시계 기록 화면을 사진으로 찍고 달린 거리(km)를 입력해 인증해요. 시간·칼로리는 선택이에요.',
        icon: 'exercise.png',
        point: 10,
        requires_image: true, requires_numeric: true, requires_note: false,
        image_point: 5, numeric_point: 5,
        image_required: true, numeric_required: true,
        // 달리기 기록 — 거리(주) + 시간 + 칼로리. 거리만 채워도 되고 나머지는 선택.
        metrics: [
          { key: 'distance', label: '거리', unit: 'km', max: 100, icon: '👟' },
          { key: 'time', label: '시간', icon: '⏱️', inputFormat: 'hms' },
          { key: 'calories', label: '칼로리', unit: 'kcal', max: 5000, icon: '🔥' },
        ],
        metric_aggregate: true,             // 누적 합산 → 개요 「주요 기록 요약」에 거리/시간/칼로리 표시
        schedule_mode: 'WEEKDAYS',          // 평일만
        verification_type: 'MANUAL',        // 거리 기록은 운영자 심사 후 요약 반영
        daily_limit: 1,
      },
      {
        key: 'weekend_social_run',
        title: '가족, 동료와 함께 달리기',
        instruction: '주말에 가족·동료·친구와 함께 달리고, 함께 찍은 사진과 달린 거리(km)를 올려 인증해요. 혼자보다 오래 꾸준히 가는 힘이 돼요.',
        icon: 'exercise.png',
        point: 10,
        requires_image: true, requires_numeric: true, requires_note: false,
        image_point: 5, numeric_point: 5,
        image_required: true, numeric_required: true,
        metrics: [
          { key: 'distance', label: '거리', unit: 'km', max: 100, icon: '👟' },
          { key: 'time', label: '시간', icon: '⏱️', inputFormat: 'hms' },
          { key: 'calories', label: '칼로리', unit: 'kcal', max: 5000, icon: '🔥' },
        ],
        metric_aggregate: true,             // 누적 합산 → 개요 「주요 기록 요약」에 반영
        schedule_mode: 'WEEKENDS',          // 주말만
        verification_type: 'MANUAL',
        daily_limit: 1,
        is_main: false,                     // 서브 미션 → 주간 스트릭 앰버(주말 구분)
      },
    ],
  },
  {
    key: 'quit_smoking',
    quizTopicKey: 'smoking',
    emoji: '🚭',
    name: '금연 습관 챌린지',
    description: '함께 응원하며 금연 습관을 만들어가는 프로그램이에요.',
    categories: [CATEGORY.NO_SMOKING.key],
    durationDays: 30,
    durationOptions: [30, 90, 180],      // 운영자 선택: 1/3/6개월
    theme: PROGRAM_THEME.QUIT_SMOKING,   // 상세 페이지 변형(히어로/탭)
    bundleTitle: '🚭 금연',
    // 금연 테마 기본 메뉴 구성 — 퀴즈·랭킹 끔, 「내 변화」 탭 켬 (createProgramFromPreset 가 반영)
    quizEnabled: false,
    rankingEnabled: false,
    changeTabEnabled: true,
    // TODO(다음 슬라이스): '오늘의 기분 체크'(5단계 이모지) 미션 + '아낀 담배(돈/개비)' + 기간 1/3/6개월 선택
    missions: [
      {
        key: 'smoking_log',
        title: '오늘 흡연 기록',
        instruction: '하루를 마무리하며 오늘 피운 담배 개비 수와 피운 시각을 기록해요. 여러 번 피웠다면 시각을 여러 개 추가하고, 한 개비도 안 피웠다면 0개비로 금연 성공을 남겨요.',
        icon: 'nosmoke.png',
        point: 10,
        requires_image: false, requires_numeric: true, requires_note: true,
        numeric_point: 5, note_point: 5,
        numeric_required: true, note_required: false,
        // 흡연 개비 + 핀 시각(시, 0~23) — 핀 시각은 「내 변화」 흡연 시간대 패턴 차트 데이터(슬라이스 3)
        metrics: [
          { key: 'cigarettes', label: '오늘 핀 담배 개수', unit: '개비', max: 100, icon: '🚬', allowZero: true },
          { key: 'smoke_hour', label: '핀 시각', icon: '⏰', inputFormat: 'clock_multi', allowZero: true },
        ],
        metric_aggregate: true,           // 누적 흡연량 추적
        schedule_mode: 'ALL_DAYS',
        verification_type: 'MANUAL',      // 흡연 기록은 운영자 심사
        daily_limit: 1,
      },
      {
        key: 'craving_moment',
        title: '흡연 욕구가 올라온 순간',
        instruction: '담배 생각이 강하게 든 순간을 기록해요. 언제·어떤 상황이었는지, 그 욕구를 어떻게 넘겼는지 적으면 나만의 대처법이 쌓여요. (기록은 운영자만 봐요)',
        icon: 'diary.png',
        point: 5,
        requires_image: false, requires_numeric: false, requires_note: true,
        note_point: 5, note_required: true,
        schedule_mode: 'ALL_DAYS',
        verification_type: 'AUTO',
        daily_limit: null,
        feedExcluded: true,   // 운영자 전용 — 응원/커뮤니티 피드에서 제외(「참가자 추세」에서만)
      },
      {
        // 본인 결정 B(2026-06-28): 매일 아낀 담배 수를 직접 입력. 누적 합산 → 개요/히어로 절약 표시 근거.
        key: 'saved_cigarettes',
        title: '오늘 아낀 담배',
        instruction: '평소 같으면 피웠을 텐데 오늘 참아서 아낀 담배 개비 수를 입력해요. 아낀 담배가 쌓여 절약한 돈·건강 회복으로 이어져요.',
        icon: 'nosmoke.png',
        point: 10,
        requires_image: false, requires_numeric: true, requires_note: false,
        numeric_point: 10, numeric_required: true,
        metrics: [{ key: 'saved', label: '오늘 피려다가 참은 담배', unit: '개비', max: 100, icon: '🚭', allowZero: true }],
        metric_aggregate: true,
        schedule_mode: 'ALL_DAYS',
        verification_type: 'AUTO',   // 자기 입력 — 자동 승인
        daily_limit: 1,
      },
    ],
  },
  {
    key: 'diet_21days',
    quizTopicKey: 'nutrition',
    emoji: '🥗',
    name: '건강 식습관 21일',
    description: '21일 동안 식습관을 하나씩 바꿔보는 프로그램이에요.',
    categories: [CATEGORY.DIET.key],
    durationDays: 21,
    bundleTitle: '🥗 식습관',
    missions: [
      { key: 'water', title: '물 8잔 마시기', instruction: '하루 8잔(약 2L)을 목표로 물을 자주 마셔요. 마신 물병·컵을 사진으로 찍어 인증하면 완료돼요.', point: 10, icon: 'water.png' },
      { key: 'veggie', title: '채소 한 끼 먹기', instruction: '채소가 들어간 식사를 하루 한 끼 이상 챙겨 먹고, 그 식사 사진을 올려 인증해요.', point: 10, icon: 'diet.png' },
      { key: 'no_latenight', title: '야식 참기', instruction: '야식 없이 하루를 마무리했다면 인증해요. 참기 힘들었던 순간이나 대신 한 일을 함께 적으면 더 좋아요.', point: 10, icon: 'diet.png' },
    ],
  },
  {
    key: 'mind_2weeks',
    quizTopicKey: 'mind',
    emoji: '🧘',
    iconSrc: '/icons/meditation/meditate.png',   // 3D 명상 아이콘
    name: '2주 마음챙김',
    description: '바쁜 일상 속 마음을 돌보는 2주 프로그램이에요.',
    categories: [CATEGORY.MINDCARE.key],
    durationDays: 14,
    bundleTitle: '🧘 마음챙김',
    missions: [
      { key: 'meditate', title: '3분 명상', instruction: '자리를 잡고 앉아 3분간 호흡에 집중해요. 음악과 호흡 가이드가 함께 나와요.', point: 10, verify_style: 'meditation', meditation_seconds: 180, meditation_pattern: { inhale: 4, hold1: 4, exhale: 4, hold2: 4 } },
      { key: 'reflect', title: '하루 돌아보기', instruction: '오늘 하루를 돌아보며 잘한 점·아쉬운 점을 짧게 메모로 남겨 인증해요.', point: 5, requires_image: false, requires_note: true, icon: 'diary.png' },
    ],
  },
]

export function getPreset(key) {
  return PROGRAM_PRESETS.find(p => p.key === key) || null
}

// 기간(일) → 라벨. 30 단위면 N개월, 7 단위면 N주, 아니면 N일.
export function durationLabel(days) {
  if (days % 30 === 0) return `${days / 30}개월`
  if (days % 7 === 0) return `${days / 7}주`
  return `${days}일`
}

// 프리셋 미션 → missions 테이블 행 (MissionLibraryModal insert 필드셋과 동일).
//   미션 def 에 명시 안 된 필드는 합리적 기본값. 사진+거리(지표)·평일·누적 모두 지원.
//   active_from/until 은 생성 시 프로그램 기간으로 채움(이후 027 트리거가 날짜 동기화).
export function expandPresetMission(m, { programId, activeFrom, activeUntil, bundleTitle }) {
  const point = m.point ?? 10
  const isMed = m.verify_style === 'meditation'   // 명상(타이머) — 입력 없이 완료로 인증
  const ri = isMed ? false : (m.requires_image ?? true)
  const rn = isMed ? false : (m.requires_numeric ?? false)
  const rno = isMed ? false : (m.requires_note ?? false)
  const onlyImage = ri && !rn && !rno
  const onlyNote = rno && !ri && !rn
  return {
    program_id: programId,
    feature: null,
    title: m.title,
    instruction: m.instruction || null,
    verification_type: isMed ? 'AUTO' : (m.verification_type || 'AUTO'),
    point,
    daily_limit: m.daily_limit ?? null,
    // 명상(타이머) 인증 필드
    verify_style: m.verify_style || 'standard',
    meditation_seconds: isMed ? (m.meditation_seconds ?? 180) : null,
    meditation_pattern: isMed ? (m.meditation_pattern ?? { inhale: 4, hold1: 4, exhale: 4, hold2: 4 }) : null,
    meditation_music: null,
    requires_image: ri,
    requires_numeric: rn,
    requires_note: rno,
    image_point: ri ? (m.image_point ?? (onlyImage ? point : 0)) : null,
    numeric_point: rn ? (m.numeric_point ?? 0) : null,
    note_point: rno ? (m.note_point ?? (onlyNote ? point : 0)) : null,
    image_required: m.image_required ?? true,
    numeric_required: m.numeric_required ?? true,
    note_required: m.note_required ?? true,
    metrics: rn && Array.isArray(m.metrics) ? m.metrics : [],
    metric_aggregate: !!m.metric_aggregate,
    active_from: activeFrom,
    active_until: activeUntil,
    schedule_mode: m.schedule_mode || 'ALL_DAYS',
    active_days: m.schedule_mode === 'CUSTOM' ? (m.active_days || []) : [],
    excluded_periods: [],
    bundle_title: bundleTitle || null,
    icon_path: m.icon || null,
    feed_excluded: !!m.feedExcluded,   // 운영자 전용 미션(피드 제외)
    is_main: m.is_main !== false,      // 메인/서브(달리기 주간 스트릭 색). 기본 메인
  }
}
