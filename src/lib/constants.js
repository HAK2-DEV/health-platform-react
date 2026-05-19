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