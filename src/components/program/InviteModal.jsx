import { useState } from 'react'
import { Link2, Check, Share2 } from 'lucide-react'
import Modal from '../common/Modal'
import { supabase } from '../../supabaseClient'
import { shareInviteToKakao } from '../../lib/kakaoShare'

// 카테고리 기본 표지(카카오 카드 이미지 폴백) — ProgramCover 와 동일 매핑
const COVER_BY_CATEGORY = {
  WALKING: 'walking', RUNNING: 'running', DIET: 'diet', EMPATHY: 'empathy',
  MINDCARE: 'mindcare', SLEEP: 'sleep', NO_SMOKING: 'no_smoking', ETC: 'etc',
}

// 초대 모달 — 비공개(초대코드) 프로그램의 가입 링크 공유.
//   카카오톡으로 보내기(Kakao SDK) + 공유하기(navigator.share) + 링크 복사하기.
function InviteModal({ code, isOpen, onClose, program = null }) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const inviteUrl = `${origin}/join?code=${encodeURIComponent(code || '')}`
  // 모바일 웹 공유 시트 지원 여부 (iOS 사파리·안드 크롬 등). 데스크톱은 대개 미지원 → 복사만.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  // 카카오 카드 이미지 — 업로드 표지 > 카테고리 기본 표지(절대 URL)
  const coverUrl = program?.cover_image_path
    ? supabase.storage.from('program-covers').getPublicUrl(program.cover_image_path).data?.publicUrl
    : `${origin}/illustrations/program-covers/${COVER_BY_CATEGORY[(program?.categories?.[0]) || 'ETC'] || 'etc'}.jpg`

  const handleKakao = async () => {
    try {
      await shareInviteToKakao({
        url: inviteUrl,
        title: program?.name || '프로그램 초대',
        description: '초대 링크로 프로그램에 참여해보세요!',
        imageUrl: coverUrl,
      })
    } catch (err) {
      // SDK 로드 실패 등 → 공유 시트 or 복사로 폴백
      console.error('카카오 공유 실패:', err)
      if (canShare) { try { await navigator.share({ title: program?.name || '프로그램 초대', url: inviteUrl }) } catch { /* 취소 무시 */ } }
      else handleCopy()
    }
  }

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

  const handleShare = async () => {
    try {
      await navigator.share({ title: '프로그램 초대', text: '초대 링크로 프로그램에 참여하세요!', url: inviteUrl })
    } catch (err) {
      // 사용자가 시트를 닫은 경우(AbortError)는 무시, 그 외 오류는 복사로 폴백
      if (err?.name !== 'AbortError') handleCopy()
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

        {/* 카카오톡으로 보내기 — 리치 카드(표지·이름·「참여하기」 버튼) */}
        <button
          type="button"
          onClick={handleKakao}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 font-bold rounded-2xl transition shadow-md bg-[#FEE500] hover:brightness-95 text-[#191919] mb-2"
        >
          <span className="text-base leading-none">💬</span>카카오톡으로 보내기
        </button>
        {canShare && (
          <button
            type="button"
            onClick={handleShare}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-2xl transition bg-white border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 mb-2"
          >
            <Share2 className="w-4 h-4" />다른 앱으로 공유 (문자 등)
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-2xl transition ${
            copied
              ? 'bg-emerald-500 text-white shadow-md'
              : 'bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {copied ? <><Check className="w-4 h-4" />복사됐어요!</> : <><Link2 className="w-4 h-4" />링크 복사하기</>}
        </button>
      </div>
    </Modal>
  )
}

export default InviteModal
