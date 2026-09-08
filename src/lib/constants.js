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

// 🔴 식단「칼로리 기록」(음식 검색 로거) 피처 플래그 — 2026-09-07 부터 OFF.
//   끈 이유: 프로덕션 완전 미사용(식단 미션 0 · 식단 인증 0 · 담긴 음식 0/321,469)인데
//   foods 테이블이 무료 DB 한도 500MB 중 253MB(92%)를 먹고 있었다.
//   마이그 258 로 검색 인덱스 6종(약 137MB)을 «파킹»해 DB 61% → 33% 로 내렸다.
//   ⚠️ 데이터(321,469행)는 지우지 않았다 — 지운 건 인덱스뿐이다.
//
//   OFF 일 때 감추는 것: 미션 만들기의 「칼로리 기록」 스타일 · 라이브러리의 식단 프리셋.
//   식단 카테고리와 「인증샷 제출」(사진) 방식은 그대로 쓸 수 있다 — 음식 검색이 필요 없어서다.
//
//   ⚠️ 다시 켜기 전 반드시 이 순서로:
//     1) supabase/rollbacks/258_revert_foods_park_search_indexes.sql 로 인덱스 재생성
//        (인덱스 없이 켜면 32만 행 순차 스캔 → 검색이 15초 타임아웃에 걸린다)
//     2) DB 여유 200MB 이상인지 확인 (GIN 빌드에 작업 공간이 더 필요)
//     3) 이 플래그를 true 로
export const MEAL_LOGGER_ENABLED = false

// 걸음 자동 인증(Health Connect) — v1.0 출시에서 제외(건강 권한 심사 회피).
//   OFF 면 미션 만들기에서 「👣 걸음 자동 인증」 스타일이 숨겨진다.
//   ⚠️ 다시 켜기 전: AndroidManifest 의 health 권한 tools:node="remove" 를 되돌리고,
//      Google Play 건강 데이터/Health Connect 선언을 완료할 것.
export const STEPS_ENABLED = false

// 프로그램 카테고리
// 주의: key 는 DB의 programs.categories TEXT[] 와 일치해야 함.
// label / emoji 만 진화시켜도 기존 데이터 영향 없음.
export const CATEGORY = {
  WALKING: { key: 'WALKING', label: '운동', emoji: '💪' },
  RUNNING: { key: 'RUNNING', label: '달리기', emoji: '🏃' },
  DIET: { key: 'DIET', label: '식단', emoji: '🍱' },
  EMPATHY: { key: 'EMPATHY', label: '공감', emoji: '🤝' },
  MINDCARE: { key: 'MINDCARE', label: '마음관리', emoji: '🧘' },
  SLEEP: { key: 'SLEEP', label: '수면', emoji: '🌙' },
  NO_SMOKING: { key: 'NO_SMOKING', label: '금연', emoji: '🚭' },
  ETC: { key: 'ETC', label: '기타', emoji: '🌱' },
}

// 본인의 화면 표시용 배열 (순서 보장)
// ⚠️ v1.0: 식단(DIET) 은 선택 목록에서 제외(첫 출시 범위 집중). CATEGORY.DIET 정의는
//   남겨둔다 — 혹시 있을 기존 데이터의 key 조회가 깨지지 않도록. 재도입 시 아래에 다시 추가.
export const CATEGORY_LIST = [
  CATEGORY.WALKING,
  CATEGORY.RUNNING,
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

// 프로그램 테마 (programs.theme, 마이그 136) — 상세 페이지 변형. NULL = 일반.
export const PROGRAM_THEME = {
  QUIT_SMOKING: 'QUIT_SMOKING',
  RUNNING: 'RUNNING',
}

// 프로그램 기본 정보 길이 제한
export const PROGRAM = {
  NAME_MAX_LENGTH: 20,
  DESCRIPTION_MAX_LENGTH: 150,
}

// 베타 한도 — 운영자 1인당 동시에 운영(PUBLISHED)할 수 있는 프로그램 수.
//   카운트 대상: PUBLISHED 만 (DRAFT·ENDED·ARCHIVED 제외 → 종료/삭제 시 슬롯 회수)
//   정식 출시 때 이 값만 올리면 됨. DB 트리거(079)에도 동일 값이 하드코딩돼 있으니 함께 변경.
export const MAX_PROGRAMS_BETA = 2

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