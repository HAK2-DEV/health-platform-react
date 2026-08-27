import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useNicknameCheck } from '../hooks/useNicknameCheck'
import { UserPlus, Camera, Loader2 } from 'lucide-react'
import NicknameInput from '../components/auth/NicknameInput'
import ImageCropModal from '../components/common/ImageCropModal'
import { takePendingInvite } from '../lib/pendingInvite'
import ConsentBox from '../components/legal/ConsentBox'
import { EMPTY_CONSENT, isAllRequiredAgreed, consentMetadata } from '../lib/consent'

// 2026-08-27 — 소셜 가입자 약관 동의를 여기서 받는다.
//   회원가입 폼(SignupPage)의 동의 박스는 이메일 가입자만 거치므로, Kakao/Google/Naver 로
//   들어온 사용자는 만 14세 확인·이용약관·개인정보 동의를 **한 번도 거치지 않았다**.
//   이 페이지는 신규 가입자만 지나가는 길목이라(닉네임이 있으면 '/' 로 튕김) 기존 사용자의
//   로그인을 방해하지 않으면서 동의를 받을 수 있다.
//   판별은 user_metadata.agreed_terms_at 유무 — 이메일 가입자는 signUp 시 이미 박혀 온다.

function NicknameSetupPage() {
  const { session, refreshNickname } = useAuth()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState(null)      // 'M' | 'F' | null(비공개) — 선택
  const [ageRange, setAgeRange] = useState(null)  // '10s'~'70s' | null — 선택
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  // 프로필 사진(아바타) — 선택. **크롭 직후 바로 업로드**한다 (2026-08-28 수정).
  //   이전엔 blob 을 state 에 들고 있다가 「시작하기」 때 한꺼번에 올렸는데,
  //   미리보기(blob: objectURL)도 안 뜨고 사진도 저장되지 않는 문제가 있었다.
  //   같은 크롭·업로드를 쓰는 ProfilePage 는 "크롭 즉시 업로드" 방식이고 정상 동작하므로,
  //   검증된 그 경로로 통일했다. 곁들여 업로드 실패를 제출까지 기다리지 않고 그 자리에서 알린다.
  const [avatarPath, setAvatarPath] = useState(null)   // 업로드된 스토리지 경로 (저장 시 users.avatar_path 로)
  const [avatarUrl, setAvatarUrl] = useState(null)     // 미리보기용 public URL
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState(null)
  const [isCropOpen, setIsCropOpen] = useState(false)
  const fileInputRef = useRef(null)

  // 약관 동의 — 아직 동의 기록이 없는 사용자(=소셜 가입자)에게만 노출.
  const [consent, setConsent] = useState(EMPTY_CONSENT)
  const needsConsent = Boolean(session) && !session.user?.user_metadata?.agreed_terms_at
  const consentOk = !needsConsent || isAllRequiredAgreed(consent)

  // 동의하지 않고 나가기 — 계정은 이미 만들어졌지만 프로필 미완성 상태로 남는다.
  const handleDecline = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드할 수 있어요'); return }
    if (file.size > 10 * 1024 * 1024) { setError('파일 크기는 10MB 이하여야 해요'); return }
    setError(null)
    const url = URL.createObjectURL(file)
    setCropImageSrc(prev => { if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev); return url })
    setIsCropOpen(true)
  }
  const closeCropModal = () => { setIsCropOpen(false); setCropImageSrc(prev => { if (prev) URL.revokeObjectURL(prev); return null }) }

  // 크롭 완료 → 곧바로 스토리지 업로드. 미리보기는 업로드된 public URL 을 쓴다.
  const handleCropComplete = async (blob) => {
    closeCropModal()
    setIsUploadingAvatar(true)
    setError(null)
    try {
      const newPath = `${session.user.id}/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('profile-avatars')
        .upload(newPath, blob, { upsert: false, contentType: 'image/jpeg' })
      if (upErr) throw new Error(`프로필 사진 업로드 실패: ${upErr.message}`)

      // 저장 전에 사진을 여러 번 바꾼 경우 직전 파일 정리 (고아 파일 방지)
      if (avatarPath) {
        await supabase.storage.from('profile-avatars').remove([avatarPath]).catch(() => {})
      }
      setAvatarPath(newPath)
      setAvatarUrl(supabase.storage.from('profile-avatars').getPublicUrl(newPath).data?.publicUrl ?? null)
    } catch (err) {
      console.error('프로필 사진 업로드 실패:', err)
      setError(err.message)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const status = useNicknameCheck(nickname)
  
  // 로그인 안 됨 → /login
  useEffect(() => {
    if (session === null) {
      navigate('/login')
    }
  }, [session, navigate])
  
  // 이미 닉네임 설정됨 → /
  useEffect(() => {
    const checkNickname = async () => {
      if (!session) return
      
      const { data } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', session.user.id)
        .maybeSingle()                     // ⭐ .single() → .maybeSingle()
      
      if (data?.nickname) {
        navigate('/')
      }
    }
    
    checkNickname()
  }, [session, navigate])
  
const handleSubmit = async (e) => {
  e.preventDefault()
  
  if (!status.available) {
    setError('사용 가능한 닉네임을 입력해주세요')
    return
  }

  if (needsConsent && !isAllRequiredAgreed(consent)) {
    setError('필수 약관에 동의해주세요')
    return
  }

  setIsSaving(true)
  setError(null)

  try {
    // 동의 기록을 가장 먼저 남긴다 — 이후 단계가 실패해도 동의 사실은 보존되고,
    //   반대로 동의 저장이 실패하면 가입을 진행시키지 않는다.
    if (needsConsent) {
      const { error: consentErr } = await supabase.auth.updateUser({ data: consentMetadata(consent) })
      if (consentErr) throw new Error(`약관 동의 저장 실패: ${consentErr.message}`)
    }

    // 프로필 사진은 크롭 시점에 이미 업로드됐다 — 여기선 경로만 users 에 반영.
    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({ nickname, gender, age_range: ageRange, ...(avatarPath ? { avatar_path: avatarPath } : {}) })
      .eq('id', session.user.id)
      .select('id')

    if (updateError) throw updateError
    // ⚠️ 대상 행이 없으면 0행이 갱신되고 **error 는 null** 이다. 그냥 넘어가면 닉네임도 사진도
    //   저장되지 않은 채 다음 화면으로 가버린다 — 실제로 public.users 행이 없는 계정에서
    //   "프로필이 저장 안 되고 마이페이지에 ? 로 뜨는" 증상으로 나타났다. 조용히 지나치지 않는다.
    if (!updated?.length) {
      throw new Error('계정 정보를 찾지 못했어요. 로그아웃 후 다시 로그인해주세요.')
    }
    
    await refreshNickname()
    // 초대링크로 들어온 신규 유저면 온보딩보다 초대 참여를 우선(없으면 온보딩 튜토리얼).
    //   NicknameSetupPage 는 '/' 를 안 거치고 직행하므로 여기서 초대 복귀를 직접 처리.
    const invite = takePendingInvite()
    navigate(invite || '/onboarding')
  } catch (err) {
    console.error('닉네임 저장 실패:', err)
    setError(err.message)
  } finally {
    setIsSaving(false)
  }
}
  
  if (!session) return null
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-md w-full max-w-md mx-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <UserPlus className="w-6 h-6 text-emerald-500" />
          <h2 className="text-xl font-semibold text-emerald-500">닉네임 설정</h2>
        </div>
        
        <p className="text-sm text-gray-600 text-center mb-6">
          서비스에서 사용할 닉네임을 설정해주세요.
          <br />
          한 번 설정하면 7일 후 변경 가능합니다.
        </p>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* 프로필 사진 — 선택. 탭하면 파일 선택 → 크롭 */}
          <div className="flex flex-col items-center gap-1.5">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSaving || isUploadingAvatar}
              className="relative w-24 h-24 rounded-full border-2 border-emerald-100 bg-emerald-50/60 overflow-hidden flex items-center justify-center group">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                : <Camera className="w-8 h-8 text-emerald-400" />}
              {isUploadingAvatar && (
                <span className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                </span>
              )}
              <span className="absolute bottom-0 inset-x-0 h-7 bg-black/45 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition">변경</span>
            </button>
            <span className="text-[11.5px] text-gray-400">프로필 사진 <b className="font-semibold">(선택)</b></span>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          </div>

          <NicknameInput value={nickname} onChange={setNickname} required />

          {/* 선택 — 건강 통계·형평성 분석에만 사용. 위 필수 항목과 구분선으로 분리 */}
          <div className="border-t border-gray-200 pt-4 mt-1">
            <p className="text-xs text-gray-500 mb-2">아래는 <b className="text-gray-600">선택 사항</b>이에요 · 건강 통계·형평성 분석에만 쓰여요</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[12px] font-medium text-gray-500">성별</span>
                <div className="flex gap-1.5 mt-1">
                  {[['M', '남'], ['F', '여']].map(([v, l]) => (
                    <button type="button" key={v} onClick={() => setGender(gender === v ? null : v)}
                      className={`flex-1 h-9 rounded-lg text-[13px] font-medium border transition ${gender === v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600'}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[12px] font-medium text-gray-500">연령대</span>
                <select value={ageRange || ''} onChange={(e) => setAgeRange(e.target.value || null)}
                  className="mt-1 w-full h-9 rounded-lg border border-gray-200 px-2 text-[13px] text-gray-700 bg-white focus:border-emerald-400 outline-none">
                  <option value="">선택 안 함</option>
                  {[['10s', '10대'], ['20s', '20대'], ['30s', '30대'], ['40s', '40대'], ['50s', '50대'], ['60s', '60대'], ['70s', '70대+']].map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 약관 동의 — 소셜 가입자만. 이메일 가입자는 회원가입 폼에서 이미 동의했다. */}
          {needsConsent && (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-500">
                서비스 이용을 위해 <b className="text-gray-600">약관 동의</b>가 필요해요
              </p>
              <ConsentBox value={consent} onChange={setConsent} />
              <button
                type="button"
                onClick={handleDecline}
                disabled={isSaving}
                className="mt-2 w-full text-[12px] text-gray-400 underline py-1"
              >
                동의하지 않고 나가기
              </button>
            </div>
          )}

          {error && (
            <p className="p-2 text-center bg-red-100 text-red-700 rounded-xl text-sm">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!status.available || isSaving || isUploadingAvatar || !consentOk}
            className="px-4 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {isSaving ? '저장 중...' : '시작하기'}
          </button>
        </form>
      </div>

      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={cropImageSrc}
        onClose={closeCropModal}
        onComplete={handleCropComplete}
        onPickNew={() => fileInputRef.current?.click()}
      />
    </div>
  )
}

export default NicknameSetupPage