import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Lock, Trash2, AlertTriangle, Loader2, Mail } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import { deleteMyAccount } from '../lib/queries'
import { unsubscribeFromPush } from '../lib/push'
import StickyBackBar from '../components/common/StickyBackBar'
import Modal from '../components/common/Modal'

// Day 65 — 계정 설정 페이지.
// /profile/account-settings
//
// 기능:
//   1) 이메일 표시 (read-only)
//   2) 비밀번호 변경 (이메일 가입자만 — 소셜 가입자는 disabled)
//   3) 회원 탈퇴 (닉네임 재입력 이중 확인)

function AccountSettingsPage() {
  const { session, nickname } = useAuth()
  const navigate = useNavigate()
  const email = session?.user?.email ?? ''

  // 소셜 가입자 여부 — provider 가 'email' 외 다른 게 있으면 소셜
  // app_metadata.providers 가 보통 ['email'] 또는 ['google', 'kakao'] 등
  const providers = session?.user?.app_metadata?.providers || [session?.user?.app_metadata?.provider]
  const isSocialOnly = providers.length > 0 && !providers.includes('email')

  // 가상 이메일 (Kakao 일반 앱 fallback) — placeholder_email 플래그 확인
  const isPlaceholderEmail = !!session?.user?.user_metadata?.placeholder_email

  return (
    <div className="min-h-screen bg-surface-app">
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-6">
        <StickyBackBar fallbackPath="/profile" title="뒤로" />

        <div className="mt-2 mb-5">
          <h1 className="text-2xl font-bold text-gray-800">🛡️ 계정 설정</h1>
          <p className="text-sm text-gray-500 mt-1.5">이메일 · 비밀번호 · 계정 삭제</p>
        </div>

        {/* 1) 이메일 표시 (read-only) */}
        <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex-shrink-0 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Mail className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">이메일</p>
              <p className="text-sm font-semibold text-gray-800 truncate">
                {email || '-'}
              </p>
              {isPlaceholderEmail && (
                <p className="text-[11px] text-amber-600 mt-1">
                  ⚠️ Kakao 소셜 가입 — 가상 이메일이에요 (실제 이메일 X)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 2) 비밀번호 변경 */}
        <PasswordChangeCard isSocialOnly={isSocialOnly} />

        {/* 3) 회원 탈퇴 */}
        <DeleteAccountCard nickname={nickname} onComplete={() => navigate('/login', { replace: true })} />
      </div>
    </div>
  )
}

// ─── 비밀번호 변경 카드 ──────────────────────────────────────
function PasswordChangeCard({ isSocialOnly }) {
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error
    },
    onSuccess: () => {
      setSuccess(true)
      setNewPw('')
      setConfirmPw('')
      setError(null)
      setTimeout(() => setSuccess(false), 3000)
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)
    if (newPw.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요')
      return
    }
    if (newPw !== confirmPw) {
      setError('비밀번호가 일치하지 않아요')
      return
    }
    updateMutation.mutate()
  }

  if (isSocialOnly) {
    return (
      <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-4 mb-4 opacity-60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex-shrink-0 bg-gray-100 rounded-xl flex items-center justify-center">
            <Lock className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-700">비밀번호 변경</p>
            <p className="text-xs text-gray-500 mt-0.5">소셜 로그인 계정은 비밀번호 변경이 필요 없어요</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-4 mb-4"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 flex-shrink-0 bg-emerald-100 rounded-xl flex items-center justify-center">
          <Lock className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800">비밀번호 변경</p>
          <p className="text-xs text-gray-500 mt-0.5">6자 이상</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <input
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          placeholder="새 비밀번호"
          autoComplete="new-password"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 text-sm"
        />
        <input
          type="password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          placeholder="새 비밀번호 확인"
          autoComplete="new-password"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 text-sm"
        />
      </div>

      {error && (
        <p className="mt-3 p-2 bg-red-50 text-red-700 text-sm rounded-md text-center">{error}</p>
      )}
      {success && (
        <p className="mt-3 p-2 bg-emerald-50 text-emerald-700 text-sm rounded-md text-center">
          ✓ 비밀번호가 변경됐어요
        </p>
      )}

      <button
        type="submit"
        disabled={updateMutation.isPending || !newPw || !confirmPw}
        className="w-full mt-3 px-4 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-semibold rounded-md transition disabled:bg-gray-300 disabled:from-gray-300 disabled:to-gray-300"
      >
        {updateMutation.isPending ? '변경 중...' : '비밀번호 변경'}
      </button>
    </form>
  )
}

// ─── 회원 탈퇴 카드 ──────────────────────────────────────────
function DeleteAccountCard({ nickname, onComplete }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState(null)

  const deleteMutation = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: async () => {
      // 이 기기 푸시 구독 해제(브라우저) + 세션 종료 후 /login 으로 (DB 구독행은 계정 CASCADE 로 삭제됨)
      try { await unsubscribeFromPush() } catch { /* 무시 */ }
      await supabase.auth.signOut()
      onComplete()
    },
    onError: (err) => {
      console.error('회원 탈퇴 실패:', err)
      setError(`삭제 실패: ${err.message}`)
    },
  })

  const handleConfirm = () => {
    if (confirmText.trim() !== nickname) {
      setError('닉네임이 일치하지 않아요')
      return
    }
    setError(null)
    deleteMutation.mutate()
  }

  return (
    <>
      <div className="bg-white border border-red-100 rounded-card-lg shadow-soft p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800">회원 탈퇴</p>
            <p className="text-xs text-gray-500 mt-0.5">계정과 모든 데이터를 영구 삭제해요</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setConfirmText('')
            setError(null)
            setIsModalOpen(true)
          }}
          className="w-full px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-sm font-semibold rounded-md transition"
        >
          탈퇴하기
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h2 className="text-lg font-bold text-gray-800">회원 탈퇴 확인</h2>
          </div>
          <p className="text-sm text-gray-700 mb-3 leading-relaxed">
            계정과 함께 <span className="font-semibold">모든 인증 기록·점수·랭킹·게시물</span>이
            영구 삭제됩니다. <span className="text-red-600 font-semibold">복구할 수 없어요.</span>
          </p>
          <p className="text-xs text-gray-500 mb-4">
            확인을 위해 본인 닉네임 <span className="font-semibold text-gray-800">"{nickname || '-'}"</span>를 정확히 입력해주세요.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="닉네임 입력"
            disabled={deleteMutation.isPending}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-red-500 text-sm mb-3"
            autoFocus
          />
          {error && (
            <p className="mb-3 p-2 bg-red-50 text-red-700 text-sm rounded-md text-center">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={deleteMutation.isPending}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-md transition disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={deleteMutation.isPending || confirmText.trim() !== nickname}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-md transition disabled:bg-gray-300"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {deleteMutation.isPending ? '삭제 중...' : '영구 삭제'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default AccountSettingsPage
