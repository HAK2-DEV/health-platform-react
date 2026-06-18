import { useState } from 'react'
import { Link2, Check } from 'lucide-react'
import Modal from '../common/Modal'

// 초대 모달 — 비공개(초대코드) 프로그램의 가입 링크 공유.
//   "링크 복사하기" → 클립보드에 <origin>/join?code=<code> 복사.
//
// TODO(모바일): 네이티브 전환 후 문자(SMS)·카카오톡·기타 앱 공유시트 연동
//   (navigator.share / Capacitor Share 플러그인)로 "보내기" 기능 추가 예정.
function InviteModal({ code, isOpen, onClose }) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const inviteUrl = `${origin}/join?code=${encodeURIComponent(code || '')}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('복사 실패:', err)
      window.prompt('이 링크를 복사해서 공유해주세요:', inviteUrl)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 text-center">
        <div className="text-4xl mb-3 leading-none">🎟️</div>
        <h2 className="text-lg font-bold text-gray-800 mb-1.5 break-keep">
          링크를 공유하고 참여자를 초대하세요!
        </h2>
        <p className="text-sm text-gray-500 mb-5 break-keep leading-relaxed">
          비공개 프로그램은 이 링크로만 참여할 수 있어요.<br />받은 사람이 링크를 열면 바로 참여 화면으로 이동해요.
        </p>

        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-2.5 mb-3">
          <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <code className="flex-1 text-xs text-gray-600 truncate text-left select-all">{inviteUrl}</code>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-2xl transition shadow-md ${
            copied
              ? 'bg-emerald-500 text-white'
              : 'bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white'
          }`}
        >
          {copied ? <><Check className="w-4 h-4" />복사됐어요!</> : <><Link2 className="w-4 h-4" />링크 복사하기</>}
        </button>
      </div>
    </Modal>
  )
}

export default InviteModal
