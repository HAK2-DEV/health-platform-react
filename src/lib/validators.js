import { NICKNAME } from './constants'

// 닉네임 검증
export function validateNickname(nickname) {
  // 빈 값
  if (!nickname || nickname.trim() === '') {
    return { valid: false, reason: '닉네임을 입력해주세요' }
  }
  
  // 길이 검증
  if (nickname.length < NICKNAME.MIN_LENGTH) {
    return { 
      valid: false, 
      reason: `닉네임은 최소 ${NICKNAME.MIN_LENGTH}자 이상이어야 합니다` 
    }
  }
  if (nickname.length > NICKNAME.MAX_LENGTH) {
    return { 
      valid: false, 
      reason: `닉네임은 최대 ${NICKNAME.MAX_LENGTH}자까지 가능합니다` 
    }
  }
  
  // 허용 문자 검증
  if (!NICKNAME.ALLOWED_PATTERN.test(nickname)) {
    return { 
      valid: false, 
      reason: '한글, 영문, 숫자, _ - . 만 사용 가능합니다' 
    }
  }
  
  // 시작/끝 문자 검증
  if (NICKNAME.INVALID_START_END_PATTERN.test(nickname)) {
    return { 
      valid: false, 
      reason: '닉네임의 시작과 끝은 특수문자가 될 수 없습니다' 
    }
  }
  
  // 금지어 검증
  const lowerNickname = nickname.toLowerCase()
  for (const word of NICKNAME.FORBIDDEN_WORDS) {
    if (lowerNickname.includes(word.toLowerCase())) {
      return { 
        valid: false, 
        reason: '사용할 수 없는 단어가 포함되어 있습니다' 
      }
    }
  }
  
  return { valid: true }
}

// 닉네임 변경 가능 여부 (7일 제한)
export function canChangeNickname(nicknameChangedAt) {
  if (!nicknameChangedAt) return { canChange: true }
  
  const lastChange = new Date(nicknameChangedAt)
  const now = new Date()
  const daysDiff = (now - lastChange) / (1000 * 60 * 60 * 24)
  
  if (daysDiff < NICKNAME.CHANGE_INTERVAL_DAYS) {
    const nextChangeDate = new Date(lastChange)
    nextChangeDate.setDate(nextChangeDate.getDate() + NICKNAME.CHANGE_INTERVAL_DAYS)
    return { 
      canChange: false, 
      nextChangeDate,
      reason: `다음 변경 가능일: ${nextChangeDate.toLocaleDateString('ko-KR')}`
    }
  }
  
  return { canChange: true }
}