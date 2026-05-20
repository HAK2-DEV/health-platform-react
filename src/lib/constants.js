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
export const CATEGORY = {
  WALKING: { key: 'WALKING', label: '걷기', emoji: '🚶' },
  DIET: { key: 'DIET', label: '식단', emoji: '🍱' },
  EMPATHY: { key: 'EMPATHY', label: '공감', emoji: '🤝' },
  MINDCARE: { key: 'MINDCARE', label: '마음관리', emoji: '🧘' },
  SLEEP: { key: 'SLEEP', label: '수면', emoji: '🌙' },
  NO_SMOKING: { key: 'NO_SMOKING', label: '금연', emoji: '🚭' },
  ETC: { key: 'ETC', label: '기타', emoji: '🌱' },     // ⭐ 추가
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