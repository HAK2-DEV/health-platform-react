import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

// 약관·개인정보처리방침 «개정 고지» — 13조(7일 전 안내) 이행용. 로그인 사용자에게 대시보드에서 1회.
//   기존 회원에게 «무엇이 바뀌었는지» 알리는 것이 목적이라 강제 재동의 게이트는 두지 않는다
//   (민감정보 동의는 기능 진입 시 별도 모달 — HealthConsentProvider).
//   닫으면 이 브라우저에서 다시 안 뜬다(localStorage). 다음 개정 땐 NOTICE_KEY 의 날짜만 바꾸면 된다.
const NOTICE_KEY = 'dodam-policy-notice-2026-09-22'

const ls = {
  get(k) { try { return localStorage.getItem(k) } catch { return null } },
  set(k, v) { try { localStorage.setItem(k, v) } catch { /* 무시 */ } },
}

export default function PolicyUpdateNotice() {
  const { session } = useAuth()
  const { pathname } = useLocation()
  const [dismissed, setDismissed] = useState(() => ls.get(NOTICE_KEY) === '1')

  if (!session || dismissed || pathname !== '/dashboard') return null
  const close = () => { ls.set(NOTICE_KEY, '1'); setDismissed(true) }

  return (
    <div
      role="status"
      className="fixed left-3 right-3 z-[900] flex items-start gap-2 rounded-2xl bg-gray-900/95 text-white shadow-elevated pl-4 pr-2 py-3"
      style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold leading-snug break-keep">📜 이용약관·개인정보처리방침이 9월 22일 개정돼요</p>
        <p className="text-[12px] text-gray-200 mt-0.5 leading-snug break-keep">
          건강 정보(기분·금연·설문) 항목, 푸시 알림 토큰, 국외 이전 안내, 신고·차단 절차, 운영자의 성과 보고용 기록 반출 안내가 추가됐어요.{' '}
          <Link to="/privacy" onClick={close} className="underline font-semibold text-emerald-300">내용 보기</Link>
        </p>
      </div>
      <button type="button" onClick={close} aria-label="닫기" className="flex-shrink-0 p-1.5 -mt-0.5 text-gray-300 hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
