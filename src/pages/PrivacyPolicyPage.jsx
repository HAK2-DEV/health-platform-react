import StickyBackBar from '../components/common/StickyBackBar'
import { PrivacyContent } from '../components/legal/LegalContent'

// 개인정보처리방침 라우트 페이지 — 본문은 LegalContent 의 PrivacyContent 로 분리 (회원가입 모달과 공유).
// ⚠️ 본인 후속 액션:
//   1) [본인 정보] / ds5acqsjh@naver.com 등 marker 본인 정보로 교체
//   2) 변호사·전문가 검토 권장 (사업자등록 시점에 정식 검토)
//   3) 약관 변경 시 시행일자 변경 + 공지

function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-surface-app">
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-8">
        <StickyBackBar fallbackPath="/" title="뒤로" />
        <PrivacyContent />
      </div>
    </div>
  )
}

export default PrivacyPolicyPage
