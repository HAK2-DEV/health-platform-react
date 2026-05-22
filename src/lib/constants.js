// 닉네임 정책 상수
export const NICKNAME = {
  MIN_LENGTH: 2,
  MAX_LENGTH: 15,
  
  // 한글 (완성형 + 자모), 영문, 숫자, 언더스코어, 하이픈, 마침표
  ALLOWED_PATTERN: /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9_\-.]+$/,
  
  // 특수문자로 시작/끝 금지
  INVALID_START_END_PATTERN: /^[_\-.]|[_\-.]$/,
  
  // 금지어 (대소문자 무관)
  FORBIDDEN_WORDS: ['admin', 'administrator', '운영자', '관리자'],
  
  // 변경 제한 (DB 트리거와 일치)
  CHANGE_INTERVAL_DAYS: 7,
}

// 사용자 역할
export const USER_ROLE = {
  USER: 'USER',
  ADMIN: 'ADMIN',
}

// 프로그램 카테고리
// 주의: key 는 DB의 programs.categories TEXT[] 와 일치해야 함.
// label / emoji 만 진화시켜도 기존 데이터 영향 없음.
export const CATEGORY = {
  WALKING: { key: 'WALKING', label: '운동', emoji: '💪' },
  DIET: { key: 'DIET', label: '식단', emoji: '🍱' },
  EMPATHY: { key: 'EMPATHY', label: '공감', emoji: '🤝' },
  MINDCARE: { key: 'MINDCARE', label: '마음관리', emoji: '🧘' },
  SLEEP: { key: 'SLEEP', label: '수면', emoji: '🌙' },
  NO_SMOKING: { key: 'NO_SMOKING', label: '금연', emoji: '🚭' },
  ETC: { key: 'ETC', label: '기타', emoji: '🌱' },
}

// 본인의 화면 표시용 배열 (순서 보장)
export const CATEGORY_LIST = [
  CATEGORY.WALKING,
  CATEGORY.DIET,
  CATEGORY.EMPATHY,
  CATEGORY.MINDCARE,
  CATEGORY.SLEEP,
  CATEGORY.NO_SMOKING,
   CATEGORY.ETC,    
]

// 프로그램 상태
export const PROGRAM_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ENDED: 'ENDED',
  ARCHIVED: 'ARCHIVED',
}

// 프로그램 기본 정보 길이 제한
export const PROGRAM = {
  NAME_MAX_LENGTH: 20,
  DESCRIPTION_MAX_LENGTH: 200,
}

// 프로그램 유형
export const PROGRAM_TYPE = {
  CERTIFICATION: { 
    key: 'CERTIFICATION', 
    label: '인증형',
    description: '사진/영상 인증으로 활동을 증명해요',
    emoji: '📸'
  },
  RECORD: { 
    key: 'RECORD', 
    label: '기록형',
    description: '걸음 수, 체중 등 숫자 데이터를 기록해요',
    emoji: '📊'
  },
  MISSION: { 
    key: 'MISSION', 
    label: '미션형',
    description: '정해진 미션을 수행해요',
    emoji: '🎯'
  },
  HABIT: { 
    key: 'HABIT', 
    label: '습관형성형',
    description: '매일 반복으로 좋은 습관을 만들어요',
    emoji: '🔄'
  },
}

export const PROGRAM_TYPE_LIST = [
  PROGRAM_TYPE.CERTIFICATION,
  PROGRAM_TYPE.RECORD,
  PROGRAM_TYPE.MISSION,
  PROGRAM_TYPE.HABIT,
]

// 참여 방식
export const JOIN_TYPE = {
  FREE: { 
    key: 'FREE', 
    label: '공개 참여',
    description: '누구나 바로 참여할 수 있어요',
    emoji: '🌐'
  },
  APPROVAL: { 
    key: 'APPROVAL', 
    label: '승인 후 참여',
    description: '운영자가 승인한 사람만 참여해요',
    emoji: '✋'
  },
  INVITE_CODE: { 
    key: 'INVITE_CODE', 
    label: '초대 코드 참여',
    description: '초대 코드를 가진 사람만 참여해요',
    emoji: '🔑'
  },
}

export const JOIN_TYPE_LIST = [
  JOIN_TYPE.FREE,
  JOIN_TYPE.APPROVAL,
  JOIN_TYPE.INVITE_CODE,
]

// 운영 요일 모드 — missions.schedule_mode 와 일치 (032 마이그레이션 + 033 점수 트리거)
export const SCHEDULE_MODES = [
  { key: 'ALL_DAYS', label: '매일' },
  { key: 'WEEKDAYS', label: '평일만 (월-금)' },
  { key: 'WEEKENDS', label: '주말만 (토-일)' },
  { key: 'CUSTOM',   label: '직접 선택' },
]

// ISO 8601 요일 (1=월 ... 7=일) — missions.active_days 와 점수 트리거 ISODOW 와 일치
export const WEEKDAY_OPTIONS = [
  { num: 1, label: '월' },
  { num: 2, label: '화' },
  { num: 3, label: '수' },
  { num: 4, label: '목' },
  { num: 5, label: '금' },
  { num: 6, label: '토' },
  { num: 7, label: '일' },
]