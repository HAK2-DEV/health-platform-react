import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, Camera, Pencil, X, Loader2, BarChart3, ChevronRight, Bell, Shield, BookOpen, MessageCircle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useNicknameCheck } from '../hooks/useNicknameCheck'
import { NICKNAME } from '../lib/constants'
import { queryKeys, fetchActivePrograms, fetchMyParticipantStats } from '../lib/queries'
import UserAvatar from '../components/common/UserAvatar'
import BackButton from '../components/common/BackButton'
import NotificationBell from '../components/common/NotificationBell'
import IconBox from '../components/common/IconBox'
import CountUp from '../components/common/CountUp'
import ImageCropModal from '../components/common/ImageCropModal'

// 프로필 페이지 — Bottom Tab Bar 👤 진입점
// 기능 (Day 56):
//   - 아바타 보기/변경/삭제 (profile-avatars 버킷, PUBLIC)
//   - 닉네임 보기/변경 (7일 쿨다운, NicknameInput 검증 재사용)
//   - 이메일 표시 / 로그아웃
function ProfilePage() {
  const { session, nickname, refreshNickname } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const showBack = location.state?.showBack === true
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

  // 통계 박스 — 참여 프로그램 수 / 누적 포인트 / 연속 인증일
  const { data: activePrograms = [] } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })
  const { data: pStats } = useQuery({
    queryKey: queryKeys.myParticipantStats(userId),
    queryFn: () => fetchMyParticipantStats(userId),
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
  // 크롭 모달 — 파일 선택 시 바로 업로드하지 않고 크롭 모달을 먼저 띄움
  const [cropImageSrc, setCropImageSrc] = useState(null)
  const [isCropOpen, setIsCropOpen] = useState(false)

  const avatarMutation = useMutation({
    // 크롭 완료 후 512x512 JPEG Blob 을 받아 업로드
    mutationFn: async (blob) => {
      // 1) 새 파일 업로드 (crop 결과는 항상 jpeg)
      const newPath = `${userId}/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('profile-avatars')
        .upload(newPath, blob, { upsert: false, contentType: 'image/jpeg' })
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
      closeCropModal()
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

  // 파일 선택 → 바로 업로드하지 않고 크롭 모달을 띄움
  //   원본은 crop 후 512x512 로 축소되므로 제한을 10MB 로 완화 (모바일 사진 수용)
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일 재선택 가능하게 reset
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('이미지 파일만 업로드할 수 있어요')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('파일 크기는 10MB 이하여야 해요')
      return
    }
    setAvatarError(null)
    const url = URL.createObjectURL(file)
    setCropImageSrc(url)
    setIsCropOpen(true)
  }

  // 크롭 모달 닫기 — objectURL 메모리 해제
  const closeCropModal = () => {
    setIsCropOpen(false)
    setCropImageSrc(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  // 크롭 완료 → 512x512 Blob 업로드
  const handleCropComplete = (blob) => {
    avatarMutation.mutate(blob)
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
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 — 앱아이콘 + 마이페이지 + 알림 (다른 탭과 통일) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-md mx-auto h-[46px] px-4 flex items-center justify-center relative">
          {showBack && (
            <div className="absolute left-2"><BackButton /></div>
          )}
          <div className="flex items-center gap-1.5">
            <img src="/app-icon.png" onError={(e) => { e.currentTarget.style.display = 'none' }} alt="" className="w-5 h-5 rounded-md" />
            <span className="text-[17px] font-bold text-gray-800">마이페이지</span>
          </div>
          <div className="absolute right-3"><NotificationBell bare /></div>
        </div>
      </header>

      <div className="w-full max-w-md mx-auto px-4 pt-[9px] pb-6 space-y-[9px]">

      {/* 프로필 카드 — 366×200, r10 (우측 잎 일러스트) */}
      <div className="relative w-[366px] max-w-full mx-auto h-[200px] overflow-hidden rounded-[10px] bg-[#eef7f1] border border-emerald-100/60">
        <img
          src="/illustrations/mypage-banner.jpg"
          alt="" aria-hidden="true"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
          className="absolute right-0 top-0 bottom-0 h-full w-auto max-w-none"
        />
        <div className="relative px-5 pt-5">
        {!isEditingNickname ? (
          <div className="flex items-center gap-4">
            {/* 아바타 + 카메라 */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="relative">
                <UserAvatar
                  avatarPath={profile?.avatar_path}
                  nickname={nickname}
                  size="lg"
                  cacheBust={avatarCacheBust || undefined}
                  className="ring-2 ring-white shadow-sm"
                />
                {isAvatarBusy && (
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAvatarBusy}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white rounded-full shadow-md flex items-center justify-center transition disabled:opacity-50"
                  title="프로필 사진 변경"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              </div>
              {profile?.avatar_path && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={isAvatarBusy}
                  className="text-[11px] text-gray-400 hover:text-red-500 transition mt-2 disabled:opacity-50"
                >
                  사진 삭제
                </button>
              )}
            </div>

            {/* 이름 + 인사말 + 이메일 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-xl font-extrabold text-gray-900 truncate">{nickname || '반가워요'}님 👋</p>
                <button
                  type="button"
                  onClick={() => {
                    if (!cooldownInfo.canChange) setNickError(`${cooldownInfo.daysLeft}일 후 변경 가능합니다`)
                    setIsEditingNickname(true)
                  }}
                  className="p-1 text-gray-400 hover:text-emerald-600 rounded-full transition flex-shrink-0"
                  title="닉네임 변경"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">오늘도 건강한 하루 되세요! 🌿</p>
              <p className="text-[11px] text-gray-400 break-all mt-1">{session?.user?.email}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <UserAvatar
              avatarPath={profile?.avatar_path}
              nickname={nickname}
              size="lg"
              cacheBust={avatarCacheBust || undefined}
              className="ring-2 ring-white shadow-sm flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <NicknameEditor
                value={draftNickname}
                onChange={setDraftNickname}
                status={nickStatus}
                isSame={nickIsSame}
                canChange={cooldownInfo.canChange}
                daysLeft={cooldownInfo.daysLeft}
              />
              {nickError && <p className="mt-2 text-xs text-red-600 text-center">{nickError}</p>}
              <div className="flex gap-2 mt-2">
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
                  disabled={nicknameMutation.isPending || !cooldownInfo.canChange || (!nickIsSame && !nickStatus.available)}
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm rounded-md transition disabled:bg-gray-300"
                >
                  {nicknameMutation.isPending ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )}
        {avatarError && <p className="mt-3 text-xs text-red-600 text-center">{avatarError}</p>}
        </div>

        {/* 통계 박스 — 355×73, r11, 카드 하단에서 6px */}
        {!isEditingNickname && (
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-[6px] w-[342px] max-w-full h-[73px] grid items-center bg-white/95 rounded-[11px] border border-gray-100 shadow-soft"
            style={{ gridTemplateColumns: 'calc(33.333% + 3px) calc(33.333% - 3px) 33.333%' }}
          >
            <ProfileStat imgSrc="/icons/profile/programs.png" imgSize="w-[42px] h-[42px]" label="참여 중" value={<CountUp value={activePrograms.length} />} unit="개" />
            <ProfileStat imgSrc="/icons/profile/point.png" label="누적 포인트" value={<CountUp value={pStats?.totalPoints ?? 0} duration={1100} />} unit="P" valueClass="text-emerald-600" divider />
            <ProfileStat imgSrc="/icons/profile/streak.png" imgSize="w-[42px] h-[42px]" label="연속 인증" value={<CountUp value={pStats?.streak ?? 0} />} unit="일" valueClass="text-violet-600" divider />
          </div>
        )}
      </div>

      {/* 메뉴 카드 */}
      <ProfileMenuItem
        tone="emerald"
        icon={<BarChart3 className="w-5 h-5" />}
        imgSrc="/icons/profile/activity.png"
        title="내 기록"
        description="걷기, 운동, 수면 등 내 활동 기록을 확인하세요."
        onClick={() => navigate('/profile/activity')}
      />
      {/* 운영자 가이드 — UI 대폭 변경으로 내용 갱신 필요, 임시 숨김 (2026-06-22).
          개편 후 복구 예정. 라우트(/operator-guide)와 OperatorGuidePage 는 유지. */}
      {/* <ProfileMenuItem
        tone="amber"
        icon={<BookOpen className="w-5 h-5" />}
        title="운영자 가이드"
        description="프로그램·미션·퀴즈… 운영자가 할 수 있는 모든 것"
        onClick={() => navigate('/operator-guide')}
      /> */}
      <ProfileMenuItem
        tone="violet"
        icon={<Bell className="w-5 h-5" />}
        imgSrc="/icons/profile/notify.png"
        title="알림 설정"
        description="알림 설정을 관리하고 중요한 소식을 받아보세요."
        onClick={() => navigate('/profile/notifications-settings')}
      />
      <ProfileMenuItem
        tone="sky"
        icon={<Shield className="w-5 h-5" />}
        title="계정 설정"
        description="개인정보 및 계정 정보를 관리하세요."
        onClick={() => navigate('/profile/account-settings')}
      />
      <ProfileMenuItem
        tone="emerald"
        icon={<MessageCircle className="w-5 h-5" />}
        imgSrc="/icons/profile/inquiry.png"
        title="문의하기"
        description="궁금한 점이 있으신가요? 문의해보세요."
        onClick={() => { window.location.href = 'mailto:ds5acqsjh@naver.com?subject=' + encodeURIComponent('[도담] 문의하기') }}
      />

      {/* 로그아웃 — 소프트 레드 (참고 사진) */}
      <button
        type="button"
        onClick={handleLogout}
        className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 font-semibold rounded-[10px] transition shadow-soft"
      >
        <LogOut className="w-4 h-4" />
        로그아웃
      </button>

      {/* 공개 페이지 링크 — 푸터 */}
      <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-gray-400">
        <button type="button" onClick={() => navigate('/install')} className="hover:text-gray-600 transition">
          📲 앱으로 설치하기
        </button>
        <span>·</span>
        <button type="button" onClick={() => navigate('/terms')} className="hover:text-gray-600 transition">
          이용약관
        </button>
        <span>·</span>
        <button type="button" onClick={() => navigate('/privacy')} className="hover:text-gray-600 transition">
          개인정보처리방침
        </button>
      </div>

      {/* 프로필 사진 크롭 모달 — 1:1 원형, 512x512 */}
      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={cropImageSrc}
        onClose={closeCropModal}
        onComplete={handleCropComplete}
        isUploading={avatarMutation.isPending}
        aspect={1}
        cropShape="round"
        outputWidth={512}
        outputHeight={512}
        title="프로필 사진 편집"
        description="원 안에서 드래그하고 확대·축소해 위치를 맞춰주세요"
      />

      </div>
    </div>
  )
}

// 프로필 메뉴 카드 — IconBox + 제목 + 설명 + ChevronRight (참고 사진).
// 프로필 통계 셀 — 아이콘(또는 이미지) + 라벨 + 값 (구분선 옵션)
function ProfileStat({ tone, icon, imgSrc, imgStyle, imgSize, label, value, unit, valueClass, divider }) {
  return (
    <div className={`flex items-center gap-[5px] px-2 ${divider ? 'border-l border-gray-100' : ''}`}>
      {imgSrc ? (
        <img src={imgSrc} alt="" aria-hidden="true" onError={(e) => { e.currentTarget.style.display = 'none' }} className={`object-contain flex-shrink-0 ${imgSize || 'w-8 h-8'}`} style={imgStyle} />
      ) : (
        <IconBox tone={tone} size="sm" shape="circle">{icon}</IconBox>
      )}
      <div className="min-w-0">
        <p className="text-[12px] text-gray-400 leading-tight truncate">{label}</p>
        <p className={`text-[15px] font-extrabold leading-tight ${valueClass || 'text-gray-900'}`}>
          {value}{unit && <span className="text-[12px]">{unit}</span>}
        </p>
      </div>
    </div>
  )
}

function ProfileMenuItem({ tone, icon, imgSrc, title, description, onClick }) {
  const [imgErr, setImgErr] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-[10px] shadow-soft hover:shadow-elevated hover:border-emerald-200 transition text-left"
    >
      {/* 모든 메뉴 아이콘 통일 — 동일 IconBox(둥근 모서리 + 연한 톤 배경) 안에 심볼(투명 PNG 또는 lucide) */}
      <IconBox tone={tone} size="lg" shape="square" className="!rounded-[18px]">
        {imgSrc && !imgErr
          ? <img src={imgSrc} alt="" aria-hidden="true" onError={() => setImgErr(true)} className="w-8 h-8 object-contain" />
          : icon}
      </IconBox>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
    </button>
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
