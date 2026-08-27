import { useState } from 'react'
import { Check } from 'lucide-react'
import Modal from '../common/Modal'
import { TermsContent, PrivacyContent } from './LegalContent'
import { isAllRequiredAgreed } from '../../lib/consent'

// 약관 동의 박스 — 회원가입(이메일) / 닉네임 설정(소셜) 공용.
//
// 2026-08-27: 원래 SignupPage 안에만 있어서 **소셜 가입자는 동의를 한 번도 거치지 않았다**.
//   (만 14세 확인·이용약관·개인정보 필수 동의 누락) → 공용으로 빼고 소셜 경로에도 장착.
//
// 상태 형태·판정·metadata 생성은 lib/consent.js 참고.
// 사용법:
//   const [consent, setConsent] = useState(EMPTY_CONSENT)
//   <ConsentBox value={consent} onChange={setConsent} />
//   ... isAllRequiredAgreed(consent) 로 제출 가능 여부 판단
//   ... consentMetadata(consent) 로 user_metadata 에 저장할 객체 생성
//
// 「보기」는 페이지 이동 대신 모달 — 폼 입력값·체크 상태가 보존된다.

function ConsentBox({ value, onChange }) {
  // 'terms' | 'privacy' | null
  const [legalDoc, setLegalDoc] = useState(null)

  const set = (key) => (checked) => onChange({ ...value, [key]: checked })
  const allChecked = isAllRequiredAgreed(value) && value.marketing
  const handleAgreeAll = (checked) =>
    onChange({ age: checked, terms: checked, privacy: checked, marketing: checked })

  return (
    <>
      <div className="mt-2 border-2 border-gray-200 rounded-md p-3 space-y-2 bg-gray-50/40">
        {/* 전체 동의 */}
        <label className="flex items-center gap-2 cursor-pointer pb-2 border-b border-gray-200">
          <CheckBox checked={allChecked} onChange={(e) => handleAgreeAll(e.target.checked)} />
          <span className="text-sm font-semibold text-gray-800">전체 동의</span>
        </label>

        <ConsentItem
          required
          checked={value.age}
          onChange={set('age')}
          label="만 14세 이상입니다"
        />
        <ConsentItem
          required
          checked={value.terms}
          onChange={set('terms')}
          label="이용약관에 동의합니다"
          onView={() => setLegalDoc('terms')}
        />
        <ConsentItem
          required
          checked={value.privacy}
          onChange={set('privacy')}
          label="개인정보 수집·이용에 동의합니다"
          onView={() => setLegalDoc('privacy')}
        />
        <ConsentItem
          checked={value.marketing}
          onChange={set('marketing')}
          label="마케팅 정보 수신에 동의합니다"
        />
      </div>

      {/* 약관 보기 모달 — 닫으면 폼 그대로 복귀 (입력값·체크 유지) */}
      <Modal isOpen={legalDoc !== null} onClose={() => setLegalDoc(null)}>
        <div className="px-4 pb-6 pt-1">
          {legalDoc === 'terms' && <TermsContent />}
          {legalDoc === 'privacy' && <PrivacyContent />}
        </div>
      </Modal>
    </>
  )
}

function ConsentItem({ required, checked, onChange, label, onView }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <CheckBox checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-xs text-gray-700 flex-1">
        <span className={required ? 'text-emerald-600 font-semibold' : 'text-gray-500'}>
          [{required ? '필수' : '선택'}]
        </span>{' '}
        {label}
      </span>
      {onView && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onView() }}
          className="text-xs text-emerald-600 underline flex-shrink-0"
        >
          보기
        </button>
      )}
    </label>
  )
}

function CheckBox({ checked, onChange }) {
  return (
    <span className="relative w-5 h-5 flex-shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={`
          absolute inset-0 rounded-md border-2 flex items-center justify-center transition
          ${checked
            ? 'bg-brand-primary border-brand-primary'
            : 'bg-white border-gray-300 hover:border-emerald-400'}
        `}
      >
        {checked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </span>
    </span>
  )
}

export default ConsentBox
