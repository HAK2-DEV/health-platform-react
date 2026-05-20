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

// 프로그램 기능 모듈
export const FEATURE = {
  IMAGE_UPLOAD: { 
    key: 'image_upload', 
    label: '이미지 업로드',
    description: '사진/영상으로 활동을 인증해요',
    emoji: '📸'
  },
  COMMENT: { 
    key: 'comment', 
    label: '댓글 작성',
    description: '소감/후기를 댓글로 남겨요',
    emoji: '💬'
  },
  LIKE: { 
    key: 'like', 
    label: '좋아요',
    description: '서로의 활동에 좋아요로 응원해요',
    emoji: '❤️'
  },
  NUMERIC_RECORD: { 
    key: 'numeric_record', 
    label: '숫자 기록',
    description: '걸음 수, 거리 등 숫자를 기록해요',
    emoji: '🔢'
  },
  BODY_METRICS: { 
    key: 'body_metrics', 
    label: '신체 지표',
    description: '체중, 체지방, 골격근량을 기록해요',
    emoji: '⚖️'
  },
  QUIZ: { 
    key: 'quiz', 
    label: '퀴즈 풀이',
    description: '건강 지식 퀴즈로 학습해요',
    emoji: '🧩'
  },
}

export const FEATURE_LIST = [
  FEATURE.IMAGE_UPLOAD,
  FEATURE.COMMENT,
  FEATURE.LIKE,
  FEATURE.NUMERIC_RECORD,
  FEATURE.BODY_METRICS,
  FEATURE.QUIZ,
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