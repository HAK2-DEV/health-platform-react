// 추천 미션 라이브러리 — 운영자가 ProgramDetailPage 의 "➕ 미션 추가" 클릭 시 첫 화면
//
// 사용 흐름:
//   1. 운영자가 묶음 카드 선택 (예: "수면 회복 루틴")
//   2. 묶음 안의 미션 2~3개가 디폴트로 체크된 상태로 표시
//   3. 운영자가 토글로 일부 선택/해제 + 점수/한도 미세 조정 가능
//   4. "선택된 N개 추가" → missions 일괄 INSERT
//
// 데이터 구조:
//   bundles: 묶음 카드 메타
//   missions: 각 묶음의 미션 디폴트값 (MissionCreateModal 의 INSERT 페이로드와 동일 스키마)
//
// 본인의 카테고리 균형:
//   사진 1 레퍼런스 5개 (식단/수면/수분/마음챙김/금연) + WALKING + EMPATHY 추가 = 7개

export const MISSION_LIBRARY = [
  {
    key: 'diet_balance',
    title: '식단 밸런스 챌린지',
    description: '균형 잡힌 식습관 만들기',
    category: 'DIET',
    emoji: '🥗',
    missions: [
      {
        title: '아침 식단 사진',
        instruction: '오늘 아침에 먹은 음식을 사진으로 인증해요',
        requires_image: true,
        requires_numeric: false,
        requires_note: false,
        verification_type: 'AUTO',
        point: 5,
        daily_limit: 1,
      },
      {
        title: '점심 식단 사진',
        instruction: '오늘 점심에 먹은 음식을 사진으로 인증해요',
        requires_image: true,
        requires_numeric: false,
        requires_note: false,
        verification_type: 'AUTO',
        point: 5,
        daily_limit: 1,
      },
      {
        title: '저녁 식단 사진',
        instruction: '오늘 저녁에 먹은 음식을 사진으로 인증해요',
        requires_image: true,
        requires_numeric: false,
        requires_note: false,
        verification_type: 'AUTO',
        point: 5,
        daily_limit: 1,
      },
    ],
  },

  {
    key: 'sleep_recovery',
    title: '수면 회복 루틴',
    description: '숙면으로 컨디션 회복하기',
    category: 'SLEEP',
    emoji: '🌙',
    missions: [
      {
        title: '취침 시간 기록',
        instruction: '오늘 잠든 시간을 시·분 단위 숫자로 기록해요 (예: 23.5 = 23시 30분)',
        requires_image: false,
        requires_numeric: true,
        requires_note: false,
        verification_type: 'AUTO',
        point: 5,
        daily_limit: 1,
      },
      {
        title: '아침 기상 기록',
        instruction: '오늘 일어난 시간을 시·분 단위 숫자로 기록해요',
        requires_image: false,
        requires_numeric: true,
        requires_note: false,
        verification_type: 'AUTO',
        point: 5,
        daily_limit: 1,
      },
      {
        title: '수면 한 줄 소감',
        instruction: '오늘 수면 어땠나요? 한 줄로 남겨주세요',
        requires_image: false,
        requires_numeric: false,
        requires_note: true,
        verification_type: 'AUTO',
        point: 5,
        daily_limit: 1,
      },
    ],
  },

  {
    key: 'hydration',
    title: '수분 섭취 루틴',
    description: '하루 8잔 건강한 습관',
    category: 'DIET',
    emoji: '💧',
    missions: [
      {
        title: '물 마신 횟수 기록',
        instruction: '오늘 마신 컵 수를 기록해요',
        requires_image: false,
        requires_numeric: true,
        requires_note: false,
        verification_type: 'AUTO',
        point: 3,
        daily_limit: 1,
      },
      {
        title: '수분 섭취 한 줄 소감',
        instruction: '컨디션이 어땠나요? 한 줄로 남겨주세요',
        requires_image: false,
        requires_numeric: false,
        requires_note: true,
        verification_type: 'AUTO',
        point: 2,
        daily_limit: 1,
      },
    ],
  },

  {
    key: 'mindcare',
    title: '마음챙김 명상',
    description: '마음의 평온을 찾아보세요',
    category: 'MINDCARE',
    emoji: '🧘',
    missions: [
      {
        title: '명상 인증 사진',
        instruction: '오늘 명상한 순간을 사진으로 인증해요',
        requires_image: true,
        requires_numeric: false,
        requires_note: false,
        verification_type: 'AUTO',
        point: 7,
        daily_limit: 1,
      },
      {
        title: '명상 시간 기록',
        instruction: '오늘 명상한 시간(분)을 기록해요',
        requires_image: false,
        requires_numeric: true,
        requires_note: false,
        verification_type: 'AUTO',
        point: 3,
        daily_limit: 1,
      },
      {
        title: '마음 한 줄 소감',
        instruction: '오늘 마음 상태를 한 줄로 남겨주세요',
        requires_image: false,
        requires_numeric: false,
        requires_note: true,
        verification_type: 'AUTO',
        point: 3,
        daily_limit: 1,
      },
    ],
  },

  {
    key: 'no_smoking',
    title: '금연 서포트',
    description: '건강한 변화를 응원합니다',
    category: 'NO_SMOKING',
    emoji: '🚭',
    missions: [
      {
        title: '오늘 안 피웠어요',
        instruction: '오늘 흡연하지 않았다면 인증해주세요',
        requires_image: false,
        requires_numeric: false,
        requires_note: true,
        verification_type: 'AUTO',
        point: 10,
        daily_limit: 1,
      },
      {
        title: '금연 의지 한 줄',
        instruction: '오늘 다짐을 한 줄로 남겨주세요',
        requires_image: false,
        requires_numeric: false,
        requires_note: true,
        verification_type: 'AUTO',
        point: 3,
        daily_limit: 1,
      },
    ],
  },

  {
    key: 'exercise_certification',
    title: '운동 인증 챌린지',
    description: '오늘의 운동을 사진과 소감으로 인증해요',
    category: 'WALKING',
    emoji: '💪',
    missions: [
      {
        title: '운동 사진',
        instruction: '오늘 운동한 순간을 사진으로 인증해요',
        requires_image: true,
        requires_numeric: false,
        requires_note: false,
        verification_type: 'AUTO',
        point: 7,
        daily_limit: 1,
      },
      {
        title: '운동 후 한 줄 소감',
        instruction: '오늘 운동 어땠나요? 한 줄로 남겨주세요',
        requires_image: false,
        requires_numeric: false,
        requires_note: true,
        verification_type: 'AUTO',
        point: 3,
        daily_limit: 1,
      },
    ],
  },

  {
    key: 'walking',
    title: '걷기 챌린지',
    description: '매일 꾸준한 걷기 습관',
    category: 'WALKING',
    emoji: '🚶',
    missions: [
      {
        title: '걸음 수 기록',
        instruction: '오늘 걸은 걸음 수를 기록해요',
        requires_image: false,
        requires_numeric: true,
        requires_note: false,
        verification_type: 'AUTO',
        point: 5,
        daily_limit: 1,
      },
      {
        title: '산책 사진',
        instruction: '오늘 산책한 풍경을 사진으로 인증해요',
        requires_image: true,
        requires_numeric: false,
        requires_note: false,
        verification_type: 'AUTO',
        point: 5,
        daily_limit: 1,
      },
      {
        title: '걷기 후 컨디션',
        instruction: '걷기 후 느낌을 한 줄로 남겨주세요',
        requires_image: false,
        requires_numeric: false,
        requires_note: true,
        verification_type: 'AUTO',
        point: 3,
        daily_limit: 1,
      },
    ],
  },

  {
    key: 'empathy_share',
    title: '공감·나눔 루틴',
    description: '주변과 따뜻함을 나눠요',
    category: 'EMPATHY',
    emoji: '🤝',
    missions: [
      {
        title: '오늘의 감사 한 줄',
        instruction: '오늘 감사했던 일을 한 줄로 남겨주세요',
        requires_image: false,
        requires_numeric: false,
        requires_note: true,
        verification_type: 'AUTO',
        point: 5,
        daily_limit: 1,
      },
      {
        title: '친절 인증 사진',
        instruction: '오늘 베푼 또는 받은 친절을 사진으로 남겨요',
        requires_image: true,
        requires_numeric: false,
        requires_note: false,
        verification_type: 'AUTO',
        point: 7,
        daily_limit: 1,
      },
    ],
  },
]
