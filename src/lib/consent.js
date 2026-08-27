// 약관 동의 상태·판정·저장형태 — UI(components/legal/ConsentBox)와 분리.
//   (컴포넌트 파일에서 함께 export 하면 Fast Refresh 가 깨진다 — react-refresh/only-export-components)
//
// 회원가입(이메일)과 닉네임 설정(소셜) 두 경로가 같은 규칙을 쓴다.

export const EMPTY_CONSENT = {
  age: false,        // [필수] 만 14세 이상
  terms: false,      // [필수] 이용약관
  privacy: false,    // [필수] 개인정보 수집·이용
  marketing: false,  // [선택] 마케팅 정보 수신
}

export function isAllRequiredAgreed(c) {
  return Boolean(c?.age && c?.terms && c?.privacy)
}

// 동의 시점·항목 추적 — auth user_metadata 에 저장할 형태.
//   agreed_terms_at 유무로 "이미 동의한 사용자" 를 판별하므로 키 이름을 바꾸지 말 것.
export function consentMetadata(c) {
  const now = new Date().toISOString()
  return {
    agreed_terms_at: now,
    agreed_privacy_at: now,
    agreed_age_14: Boolean(c?.age),
    agreed_marketing: Boolean(c?.marketing),
  }
}
