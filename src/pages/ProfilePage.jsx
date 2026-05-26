import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, Camera, Pencil, X, Loader2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useNicknameCheck } from '../hooks/useNicknameCheck'
import { NICKNAME } from '../lib/constants'
import UserAvatar from '../components/common/UserAvatar'

// 프로필 페이지 — Bottom Tab Bar 👤 진입점
// 기능 (Day 56):
//   - 아바타 보기/변경/삭제 (profile-avatars 버킷, PUBLIC)
//   - 닉네임 보기/변경 (7일 쿨다운, NicknameInput 검증 재사용)
//   - 이메일 표시 / 로그아웃
function ProfilePage() {
  const { session, nickname, refreshNickname } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  // ─── 본인 프로필 정보 (avatar_path, nickname_changed_at) ───────
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('avatar_path, nickname_changed_at, nickname')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })

  // 캐시버스터 — 아바타 새로 올린 직후 브라우저 캐시 회피
  const [avatarCacheBust, setAvatarCacheBust] = useState(0)

  // ─── 닉네임 변경 폼 ─────────────────────────────────────
  const [isEditingNickname, setIsEditingNickname] = useState(false)
  const [draftNickname, setDraftNickname] = useState('')
  const [nickError, setNickError] = useState(null)

  useEffect(() => {
    if (isEditingNickname) setDraftNickname(nickname || '')
  }, [isEditingNickname, nickname])

  // 7일 쿨다운 — 마지막 변경 후 7일 지나야 다시 변경 가능
  const COOLDOWN_DAYS = 7
  const cooldownInfo = (() => {
    if (!profile?.nickname_changed_at) return { canChange: true, daysLeft: 0 }
    const elapsedMs = Date.now() - new Date(profile.nickname_changed_at).getTime()
    const daysElapsed = elapsedMs / (24 * 60 * 60 * 1000)
    if (daysElapsed >= COOLDOWN_DAYS) return { canChange: true, daysLeft: 0 }
    return { canChange: false, daysLeft: Math.ceil(COOLDOWN_DAYS - daysElapsed) }
  })()

  // 닉네임 중복/형식 검증 — 본인 닉네임은 중복 검증 스킵 (currentUserId)
  const nickStatus = useNicknameCheck(draftNickname, userId)
  const nickIsSame = (draftNickname || '').trim() === (nickname || '').trim()

  const nicknameMutation = useMutation({
    mutationFn: async (newNick) => {
      const { error } = await supabase
        .from('users')
        .update({ nickname: newNick, nickname_changed_at: new Date().toISOString() })
        .eq('id', userId)
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshNickname()
      await refetchProfile()
      // 닉네임 사용하는 모든 캐시 무효화 (랭킹/피드/통계 등)
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setIsEditingNickname(false)
      setNickError(null)
    },
    onError: (err) => {
      console.error('닉네임 변경 실패:', err)
      setNickError(err.message)
    },
  })

  const handleSaveNickname = () => {
    if (!cooldownInfo.canChange) {
      setNickError(`${cooldownInfo.daysLeft}일 후 변경 가능합니다`)
      return
    }
    if (nickIsSame) {
      setIsEditingNickname(false)
      return
    }
    if (!nickStatus.available) {
      setNickError(nickStatus.reason || '사용 가능한 닉네임을 입력해주세요')
      return
    }
    setNickError(null)
    nicknameMutation.mutate(draftNickname.trim())
  }

  // ─── 아바타 업로드 / 삭제 ─────────────────────────────────
  const fileInputRef = useRef(null)
  const [avatarError, setAvatarError] = useState(null)

  const avatarMutation = useMutation({
    mutationFn: async (file) => {
      // 1) 새 파일 업로드
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const newPath = `${userId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('profile-avatars')
        .upload(newPath, file, { upsert: false })
      if (upErr) throw new Error(`업로드 실패: ${upErr.message}`)

      // 2) users.avatar_path 갱신
      const { error: updErr } = await supabase
        .from('users')
        .update({ avatar_path: newPath })
        .eq('id', userId)
      if (updErr) {
        // 롤백 — 업로드 파일 제거
        await supabase.storage.from('profile-avatars').remove([newPath])
        throw new Error(`프로필 갱신 실패: ${updErr.message}`)
      }

      // 3) 기존 파일 삭제 (있으면) — 실패해도 본 흐름 영향 X
      if (profile?.avatar_path && profile.avatar_path !== newPath) {
        await supabase.storage.from('profile-avatars').remove([profile.avatar_path])
      }

      return newPath
    },
    onSuccess: async () => {
      await refetchProfile()
      setAvatarCacheBust(Date.now())
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setAvatarError(null)
    },
    onError: (err) => {
      console.error('아바타 업로드 실패:', err)
      setAvatarError(err.message)
    },
  })

  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.avatar_path) return
      // 1) DB NULL
      const { error: updErr } = await supabase
        .from('users')
        .update({ avatar_path: null })
        .eq('id', userId)
      if (updErr) throw updErr
      // 2) 파일 삭제 (실패해도 무시)
      await supabase.storage.from('profile-avatars').remove([profile.avatar_path])
    },
    onSuccess: async () => {
      await refetchProfile()
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (err) => {
      console.error('아바타 삭제 실패:', err)
      setAvatarError(err.message)
    },
  })

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일 재선택 가능하게 reset
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('이미지 파일만 업로드할 수 있어요')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('파일 크기는 2MB 이하여야 해요')
      return
    }
    setAvatarError(null)
    avatarMutation.mutate(file)
  }

  const handleRemoveAvatar = () => {
    if (!window.confirm('프로필 사진을 삭제할까요?')) return
    removeAvatarMutation.mutate()
  }

  const handleLogout = () => {
    supabase.auth.signOut()
  }

  const isAvatarBusy = avatarMutation.isPending || removeAvatarMutation.isPending

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl text-gray-800 mb-6">👤 프로필</h1>

      {/* 아바타 + 닉네임 카드 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-3">
        <div className="flex flex-col items-center">
          {/* 아바타 */}
          <div className="relative mb-3">
            <UserAvatar
              avatarPath={profile?.avatar_path}
              nickname={nickname}
              size="xl"
              cacheBust={avatarCacheBust || undefined}
              className="ring-4 ring-emerald-100"
            />
            {isAvatarBusy && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
            {/* 카메라 버튼 — 우하단 */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAvatarBusy}
              className="absolute -bottom-1 -right-1 w-9 h-9 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-md flex items-center justify-center transition disabled:opacity-50"
              title="프로필 사진 변경"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {profile?.avatar_path && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={isAvatarBusy}
              className="text-xs text-gray-400 hover:text-red-500 transition mb-3 disabled:opacity-50"
            >
              사진 삭제
            </button>
          )}

          {avatarError && (
            <p className="mb-3 text-xs text-red-600 text-center">{avatarError}</p>
          )}

          {/* 닉네임 — 보기/편집 모드 */}
          {!isEditingNickname ? (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xl font-medium text-gray-800">{nickname || '-'}</p>
              <button
                type="button"
                onClick={() => {
                  if (!cooldownInfo.canChange) {
                    setNickError(`${cooldownInfo.daysLeft}일 후 변경 가능합니다`)
                  }
                  setIsEditingNickname(true)
                }}
                className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition"
                title="닉네임 변경"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="w-full max-w-xs mt-2">
              <NicknameEditor
                value={draftNickname}
                onChange={setDraftNickname}
                status={nickStatus}
                isSame={nickIsSame}
                canChange={cooldownInfo.canChange}
                daysLeft={cooldownInfo.daysLeft}
              />
              {nickError && (
                <p className="mt-2 text-xs text-red-600 text-center">{nickError}</p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => { setIsEditingNickname(false); setNickError(null) }}
                  disabled={nicknameMutation.isPending}
                  className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md transition disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveNickname}
                  disabled={
                    nicknameMutation.isPending
                    || !cooldownInfo.canChange
                    || (!nickIsSame && !nickStatus.available)
                  }
                  className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-md transition disabled:bg-gray-300"
                >
                  {nicknameMutation.isPending ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          )}

          {/* 쿨다운 안내 */}
          {!isEditingNickname && !cooldownInfo.canChange && (
            <p className="text-[11px] text-gray-400 mt-1">
              닉네임은 {cooldownInfo.daysLeft}일 후 변경 가능
            </p>
          )}
        </div>
      </div>

      {/* 이메일 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6">
        <p className="text-xs text-gray-500 mb-1">이메일</p>
        <p className="text-gray-800 break-all">{session?.user?.email}</p>
      </div>

      {/* 로그아웃 */}
      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition"
      >
        <LogOut className="w-4 h-4" />
        로그아웃
      </button>
    </div>
  )
}

// 닉네임 편집 — NicknameInput 의 축소판 (작은 화면 인라인용)
function NicknameEditor({ value, onChange, status, isSame, canChange, daysLeft }) {
  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={NICKNAME.MAX_LENGTH}
          disabled={!canChange}
          placeholder="새 닉네임"
          className="w-full px-3 py-2 pr-9 text-sm border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {status.checking && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
          {!status.checking && !isSame && status.available === true && (
            <span className="text-emerald-500 text-base leading-none">✓</span>
          )}
          {!status.checking && !isSame && status.available === false && (
            <X className="w-4 h-4 text-red-500" />
          )}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-gray-500 text-center">
        {!canChange
          ? `${daysLeft}일 후 변경 가능 (한 번 변경 시 7일 잠금)`
          : isSame
          ? '현재 닉네임과 동일'
          : status.checking
          ? '확인 중...'
          : status.available === true
          ? '사용 가능'
          : status.available === false
          ? status.reason || '사용 불가'
          : `${NICKNAME.MIN_LENGTH}-${NICKNAME.MAX_LENGTH}자, 한글/영문/숫자/_-.`}
      </p>
    </div>
  )
}

export default ProfilePage
