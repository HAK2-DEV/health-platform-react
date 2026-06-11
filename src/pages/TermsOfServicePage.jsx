import StickyBackBar from '../components/common/StickyBackBar'
import { TermsContent } from '../components/legal/LegalContent'

// 이용약관 라우트 페이지 — 본문은 LegalContent 의 TermsContent 로 분리 (회원가입 모달과 공유).
// ⚠️ 본인 후속: (개인) / ds5acqsjh@naver.com 등 자리 표시자 교체 + 법률 전문가 검토.

function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-surface-app">
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-8">
        <StickyBackBar fallbackPath="/" title="뒤로" />
        <TermsContent />
      </div>
    </div>
  )
}

export default TermsOfServicePage
