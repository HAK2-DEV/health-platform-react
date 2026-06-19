import { useEffect, useState, useRef, Fragment } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Upload, X, Check, Flag, Clock, Star, Camera, MessageSquare } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { CATEGORY } from '../../lib/constants'
import { checkMissionToday } from '../../lib/formatters'
import { resolveMissionIcon } from '../../lib/missionIcons'
import { queryKeys, fetchMission, fetchProgramOverview, fetchProgram } from '../../lib/queries'
import { detectMilestonesReached, resolveStreakMilestones, computeStage } from '../../lib/gamification'
import { useToast } from '../../contexts/ToastContext'
import { compressImage } from '../../lib/imageCompression'
import LoadingState from '../../components/common/LoadingState'
import ImageCropModal from '../../components/common/ImageCropModal'
import NotificationBell from '../../components/common/NotificationBell'

// 카테고리 → 히어로 그라데이션
const CATEGORY_HERO = {
  WALKING:    { from: 'from-emerald-100', via: 'via-emerald-50/80', to: 'to-teal-50/40',    chip: 'bg-emerald-500' },
  DIET:       { from: 'from-emerald-100',   via: 'via-emerald-50/80',   to: 'to-emerald-50/40', chip: 'bg-emerald-500' },
  EMPATHY:    { from: 'from-pink-100',    via: 'via-pink-50/80',    to: 'to-rose-50/40',    chip: 'bg-pink-500' },
  MINDCARE:   { from: 'from-orange-100',  via: 'via-orange-50/80',  to: 'to-amber-50/40',   chip: 'bg-orange-500' },
  SLEEP:      { from: 'from-purple-100',  via: 'via-purple-50/80',  to: 'to-indigo-50/40',  chip: 'bg-purple-500' },
  NO_SMOKING: { from: 'from-yellow-100',  via: 'via-yellow-50/80',  to: 'to-amber-50/40',   chip: 'bg-yellow-500' },
  ETC:        { from: 'from-gray-100',    via: 'via-gray-50/80',    to: 'to-slate-50/40',   chip: 'bg-gray-500' },
}

// 참여자 미션 인증 페이지 (React Query 패턴)
// — 미션 로드는 useQuery (캐시 자동) — 같은 미션 재진입 시 즉시 표시
// — 제출은 useMutation — onSuccess 에서 관련 키 invalidate → 모든 화면 자동 갱신
function MissionVerifyPage() {
  const { programId, missionId } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const fileInputRef = useRef(null)
  const errorRef = useRef(null) // 에러 메시지 — 화면 중앙 스크롤 + 진동
  const beforeOverviewRef = useRef(null) // 인증 직전 overview snapshot — 마일스톤 비교용

  // 인증 페이지 진입 시 location.state.returnPath 가 있으면 제출/뒤로 후 그 페이지로 복귀
  // (예: BundleDetailPage 에서 진입 → 같은 BundleDetailPage 로 복귀)
  const returnPath = location.state?.returnPath || null

  // 뒤로가기 — 스마트 백
  //   history 가 있으면 navigate(-1) 로 자연스럽게 pop (Verify 가 history 에서 사라짐)
  //   알림/딥링크로 첫 진입한 경우 (location.key === 'default') 만 returnPath 로 replace 이동
  //   기존: navigate(target) push → [Detail, Verify, Detail] 쌓여 뒤로 누르면 Verify 로 복귀 = 루프
  const backToProgram = () => {
    if (location.key === 'default') {
      navigate(returnPath || `/programs/${programId}`, { replace: true })
    } else {
      navigate(-1)
    }
  }

  // 미션 로드 — RQ
  const {
    data: mission,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: queryKeys.mission(missionId),
    queryFn: () => fetchMission(missionId),
    enabled: !!session && !!missionId,
  })

  const program = mission?.programs

  // 인증 권한 — ACTIVE 참여자 또는 운영자만. 공개 프로그램 '둘러보기'(비참여자)는 차단.
  const isOwner = program?.owner_id === session?.user?.id
  const { data: myPart, isLoading: isPartLoading } = useQuery({
    queryKey: ['my-part-status', programId, session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('program_participants')
        .select('status')
        .eq('program_id', programId)
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!session && !!programId,
  })
  const canVerify = isOwner || myPart?.status === 'ACTIVE'

  // 입력 상태
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [cropImageSrc, setCropImageSrc] = useState(null)  // 크롭 모달용 원본 objectURL
  const [isCropOpen, setIsCropOpen] = useState(false)
  const [numericValue, setNumericValue] = useState('')
  const [noteText, setNoteText] = useState('')
  const [feedVisible, setFeedVisible] = useState(true)  // 디폴트 노출 — feed_enabled 인 프로그램만 의미 있음
  const [error, setErrorRaw] = useState(null)
  const [errorTick, setErrorTick] = useState(0)
  // 제출 완료 화면 데이터 (있으면 완료 화면 렌더)
  const [submitted, setSubmitted] = useState(null)
  // setError wrapper — 같은 메시지 재발생 시에도 스크롤/진동 트리거되도록 tick 증가
  const setError = (msg) => {
    setErrorRaw(msg)
    if (msg) setErrorTick(t => t + 1)
  }

  // 에러 등장/재등장 시 화면 중앙 스크롤
  useEffect(() => {
    if (!error || !errorRef.current) return
    errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [errorTick, error])

  // 입력 메타
  const needsImage = !!mission?.requires_image
  const needsNumeric = !!mission?.requires_numeric
  const needsNote = !!mission?.requires_note
  const requireCount = [needsImage, needsNumeric, needsNote].filter(Boolean).length
  const isMulti = requireCount >= 2

  // 084 — 입력별 필수/선택 + 점수. *_required 기본 true(legacy 호환).
  const reqImage = needsImage && mission?.image_required !== false
  const reqNumeric = needsNumeric && mission?.numeric_required !== false
  const reqNote = needsNote && mission?.note_required !== false
  const optImage = needsImage && !reqImage
  const optNumeric = needsNumeric && !reqNumeric
  const optNote = needsNote && !reqNote
  // per-input 점수 (없으면 legacy 단일 point)
  const perInput = !!mission && (mission.image_point != null || mission.numeric_point != null || mission.note_point != null)
  const imgPts = mission?.image_point ?? 0
  const numPts = mission?.numeric_point ?? 0
  const notePts = mission?.note_point ?? 0
  // 현재 입력 기준 획득 예정 점수 (선택 입력 작성 시 증가)
  const earnedPoint = perInput
    ? ((selectedFile ? imgPts : 0) + (numericValue ? numPts : 0) + (noteText.trim() ? notePts : 0))
    : (mission?.point ?? 0)

  // 카테고리 → 히어로 색
  const catKey = program?.categories?.[0] || 'ETC'
  const hero = CATEGORY_HERO[catKey] || CATEGORY_HERO.ETC
  const catMeta = CATEGORY[catKey] || CATEGORY.ETC

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''  // 같은 파일 재선택 허용
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있어요')
      return
    }
    // 업로드 직전 자동 압축(1280px·0.6MB)하므로 큰 사진도 OK.
    // 단, 과도하게 큰 원본(메모리 보호)만 차단 — 30MB 상한.
    if (file.size > 30 * 1024 * 1024) {
      setError('사진이 너무 커요 (30MB 이하). 다른 사진을 선택해주세요')
      return
    }
    setError(null)
    // 크롭/편집 모달 — 위치·확대 조정 후 저장 (프로필 사진과 동일 UX)
    setCropImageSrc(URL.createObjectURL(file))
    setIsCropOpen(true)
  }

  // 크롭 완료 → 결과(JPEG Blob)를 File 로 감싸 selectedFile 로 사용 (해시·압축 흐름 그대로)
  const handleCropComplete = (blob) => {
    const file = new File([blob], `mission-${Date.now()}.jpg`, { type: 'image/jpeg' })
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    closeCrop()
  }
  const closeCrop = () => {
    setIsCropOpen(false)
    setCropImageSrc(prev => { if (prev) URL.revokeObjectURL(prev); return null })
  }

  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelectedFile(null)
    setPreviewUrl(null)
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleClose = () => {
    backToProgram()
  }

  // 제출 — useMutation. 성공 시 invalidate 로 모든 화면 자동 갱신
  const submitMutation = useMutation({
    mutationFn: async () => {
      const insertData = {
        mission_id: mission.id,
        user_id: session.user.id,
      }
      let imagePath = null

      if (needsImage && selectedFile) {
        // 1) 원본 해시 — 중복 차단 (압축은 deterministic X 라 반드시 원본으로)
        const buffer = await selectedFile.arrayBuffer()
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const imageHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        insertData.image_hash = imageHash

        // 2) 압축 — 인증 사진은 피드(max-h-500)에서만 쓰여 1280px·0.6MB 면 충분.
        //    모바일 로딩·Egress 절감 (1920·1MB → 1280·0.6MB, Day 66).
        const compressed = await compressImage(selectedFile, {
          maxWidthOrHeight: 1280,
          maxSizeMB: 0.6,
        })

        // 3) 업로드 — 압축 결과는 항상 image/jpeg
        const fileName = `${Date.now()}.jpg`
        const path = `${session.user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('verification-images')
          .upload(path, compressed, { contentType: 'image/jpeg' })
        if (uploadError) throw new Error(`업로드 실패: ${uploadError.message}`)
        imagePath = path
        insertData.image_path = path
      }

      // 선택 입력 미작성 시 저장하지 않음 → 채점 합산에서 제외
      if (needsNumeric && numericValue !== '' && !isNaN(parseFloat(numericValue))) insertData.numeric_value = parseFloat(numericValue)
      if (needsNote && noteText.trim()) insertData.note = noteText.trim()
      // 피드 노출 여부 — 프로그램이 피드 활성일 때만 의미. 디폴트 true.
      if (program?.feed_enabled) insertData.feed_visible = feedVisible

      const { error: insertError } = await supabase
        .from('verifications')
        .insert(insertData)

      if (insertError) {
        if (imagePath) {
          await supabase.storage.from('verification-images').remove([imagePath])
        }
        if (insertError.code === '23505') {
          throw new Error('이미 인증에 사용한 사진이에요. 다른 사진을 올려주세요.')
        }
        throw new Error(`인증 제출 실패: ${insertError.message}`)
      }
    },
    onSuccess: async () => {
      // 인증 성공 → 점수/카운트/랭킹 모두 무효화 → 다른 화면 진입 시 fresh
      // prefix 무효화로 한 번에 처리 (새 키 추가 시 빠질 위험 줄임)
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['verifications'] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      queryClient.invalidateQueries({ queryKey: ['missions', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })

      // Day 65 — 마일스톤 토스트 + 연속 인증일 캡처 (완료 화면 표시용).
      let streak = 0
      try {
        const before = beforeOverviewRef.current
        const newOverview = await fetchProgramOverview(programId, session.user.id)
        queryClient.setQueryData(queryKeys.programOverview(programId, session.user.id), newOverview)
        streak = newOverview.streak || 0

        // streak_preset/streak_milestones 조회 위해 program 가져옴 (cache hit 우선)
        let program = queryClient.getQueryData(queryKeys.program(programId))
        if (!program) program = await fetchProgram(programId)

        const milestones = resolveStreakMilestones(program?.streak_preset, program?.streak_milestones)

        // stage 계산 — 성장형 트랙에서만 의미
        const programDays = (program?.start_date && program?.end_date)
          ? Math.max(1, Math.round((new Date(`${program.end_date}T23:59:59+09:00`) - new Date(`${program.start_date}T00:00:00+09:00`)) / 86400000) + 1)
          : 1
        const beforeStage = computeStage({ activeDays: before?.activeDays || 0, totalCount: before?.totalCount || 0, programDays })
        const afterStage = computeStage({ activeDays: newOverview.activeDays, totalCount: newOverview.totalCount, programDays })

        const reached = detectMilestonesReached(
          { streak: before?.streak || 0, totalCount: before?.totalCount || 0, stage: beforeStage },
          { streak: newOverview.streak, totalCount: newOverview.totalCount, stage: afterStage },
          milestones,
        )
        // 토스트 순서대로 표시 (살짝 지연으로 겹침 방지)
        reached.forEach((m, idx) => {
          setTimeout(() => toast.show(m.message, { variant: m.variant, icon: m.icon }), idx * 400)
        })
      } catch (e) {
        // 마일스톤 체크 실패는 silent — 핵심 인증 흐름 방해 X
        console.warn('마일스톤 체크 실패:', e)
      }

      // 완료 화면 표시 (자동 이동 X — 사용자가 「내 기록 보기 / 프로그램으로 이동」 선택)
      const t = new Date()
      const timeStr = `${t.getHours() < 12 ? '오전' : '오후'} ${t.getHours() % 12 || 12}:${String(t.getMinutes()).padStart(2, '0')}`
      setSubmitted({
        points: earnedPoint,
        streak,
        timeStr,
        note: (needsNote && noteText.trim()) ? noteText.trim() : null,
        numeric: (needsNumeric && numericValue !== '') ? numericValue : null,
        photoUrl: (needsImage && selectedFile) ? previewUrl : null,
      })
      window.scrollTo({ top: 0 })
    },
    onError: (err) => {
      console.error('인증 제출 오류:', err)
      setError(err.message)
    },
  })

  const handleSubmit = () => {
    if (!session || !mission) return

    // Day 65 — 마일스톤 비교용 직전 snapshot 캡처 (현재 cache 데이터).
    beforeOverviewRef.current = queryClient.getQueryData(
      queryKeys.programOverview(programId, session.user.id)
    )

    if (reqImage && !selectedFile) {
      setError('사진을 선택해주세요')
      return
    }
    if (reqNumeric) {
      const num = parseFloat(numericValue)
      if (!numericValue || isNaN(num) || num <= 0) {
        setError('0보다 큰 숫자를 입력해주세요')
        return
      }
    } else if (optNumeric && numericValue) {
      const num = parseFloat(numericValue)
      if (isNaN(num) || num <= 0) {
        setError('기록은 0보다 큰 숫자여야 해요')
        return
      }
    }
    if (reqNote && !noteText.trim()) {
      setError('소감을 입력해주세요')
      return
    }
    setError(null)
    submitMutation.mutate()
  }

  const isSubmitting = submitMutation.isPending

  // schedule_mode + 제외 기간 검사 (URL 직접 입력 우회 차단 — 점수 트리거 033 의 안전망)
  const todayCheck = checkMissionToday(mission)

  const canSubmit = (() => {
    if (isSubmitting) return false
    if (!mission) return false
    if (!todayCheck.active) return false
    if (reqImage && !selectedFile) return false
    if (reqNumeric && !numericValue) return false
    if (reqNote && !noteText.trim()) return false
    if (requireCount === 0) return false
    return true
  })()

  if (isLoading || isPartLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingState variant="inline" />
      </div>
    )
  }

  if (loadError || !mission) {
    return (
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition mb-4"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <p className="p-4 bg-red-50 text-red-700 rounded-xl text-center">
          미션을 찾을 수 없어요
        </p>
      </div>
    )
  }

  // 비참여자(둘러보기) 차단 — 인증은 참여한 회원만
  if (!canVerify) {
    return (
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition mb-4"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="text-center py-12">
          <div className="text-5xl mb-3 leading-none">🔒</div>
          <p className="text-lg font-bold text-gray-800 mb-1">참여한 회원만 인증할 수 있어요</p>
          <p className="text-sm text-gray-500 mb-5">먼저 프로그램에 참여해 주세요.</p>
          <button
            type="button"
            onClick={() => navigate(`/programs/${programId}`)}
            className="inline-flex items-center gap-1 px-6 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-semibold rounded-full transition shadow-sm"
          >
            프로그램으로 가기
          </button>
        </div>
      </div>
    )
  }

  // ─── 제출 완료 화면 ──────────────────────────────────────
  if (submitted) {
    const STEPS_DONE = ['프로그램 선택', '미션 확인', '미션 인증']
    return (
      <div className="min-h-screen bg-gray-50 -mx-4 -mt-2">
        {/* 헤더 — 뒤로 + 미션 인증 + 알림 */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
          <div className="max-w-md mx-auto h-[46px] px-4 flex items-center justify-center relative">
            <button type="button" onClick={handleClose} className="absolute left-3 p-1.5 -ml-1.5 text-gray-500 hover:text-gray-800" aria-label="뒤로">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-[17px] font-bold text-gray-800">미션 인증</span>
            <div className="absolute right-3"><NotificationBell /></div>
          </div>
        </header>

        <div className="max-w-md mx-auto px-4 pt-3 pb-10 space-y-3">
          {/* 단계 인디케이터 (400×82, r10) — 전 단계 완료 */}
          <div className="w-[400px] max-w-full h-[82px] mx-auto bg-white border border-gray-100 rounded-[10px] shadow-soft px-4 flex items-center">
            <div className="flex items-start w-full">
              {STEPS_DONE.map((label, i) => (
                <Fragment key={label}>
                  {i > 0 && <div className="flex-1 h-0.5 mt-[14px] mx-1 rounded-full bg-emerald-500" />}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </div>
                    <span className={`mt-1 text-[11px] font-medium whitespace-nowrap ${i === 2 ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {label}
                    </span>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>

          {/* 완료 카드 — 🎉 + 텍스트 + 통계(2/3) 포함 */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="text-5xl flex-shrink-0 select-none leading-none">🎉</div>
              <div className="min-w-0">
                <h2 className="text-[21px] font-extrabold text-gray-900 leading-tight">기록이 완료되었어요!</h2>
                <p className="text-[12px] text-gray-500 mt-1">오늘의 미션 인증이 정상적으로 제출되었어요.</p>
              </div>
            </div>

            {/* 인증한 미션 (미션탭 박스 — 포인트 제외) + 요약 통계 4박스 */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
                {mission.icon_path && (
                  <img
                    src={resolveMissionIcon(mission.icon_path)}
                    alt=""
                    className="w-11 h-11 flex-shrink-0 rounded-xl object-contain bg-white"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-gray-800 truncate">{mission.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {mission.verification_type === 'AUTO' ? '자동 승인' : '운영자 심사'}
                    {mission.daily_limit ? ` · 하루 ${mission.daily_limit}회` : ' · 무제한'}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[13px] font-bold text-emerald-600 flex-shrink-0">
                  <Check className="w-3.5 h-3.5" /> 오늘 인증 완료
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <StatTile icon={<Clock className="w-4 h-4" />} iconBg="bg-purple-100 text-purple-600" label="완료 시각" value={`오늘 ${submitted.timeStr}`} />
                <StatTile icon={<Check className="w-4 h-4" />} iconBg="bg-sky-100 text-sky-600" label="인증 상태" value="제출 완료" valueClass="text-emerald-600" />
                <StatTile icon={<Star className="w-4 h-4 fill-current" />} iconBg="bg-amber-100 text-yellow-400" label="획득 포인트" value={`+${submitted.points}P`} valueClass="text-emerald-600" />
                <StatTile imgSrc="/icons/activity/points.png" imgStyle={{ filter: 'hue-rotate(100deg) saturate(1.3)' }} label="연속 참여" value={`${submitted.streak}일 연속`} />
              </div>
            </div>
          </div>

          {/* 제출한 기록 요약 */}
          {(submitted.photoUrl || submitted.note || submitted.numeric) && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4 space-y-3">
              <h3 className="text-[14px] font-bold text-gray-800">제출한 기록 요약</h3>
              {submitted.photoUrl && (
                <div className="flex items-center gap-3">
                  <img src={submitted.photoUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Camera className="w-4 h-4 text-emerald-500" /> 인증 사진 1장 제출
                  </div>
                </div>
              )}
              {submitted.numeric && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Flag className="w-4 h-4 text-emerald-500" /> 기록 {submitted.numeric}{mission.numeric_unit ? ` ${mission.numeric_unit}` : ''}
                </div>
              )}
              {submitted.note && (
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MessageSquare className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="leading-snug">{submitted.note}</span>
                </div>
              )}
            </div>
          )}

          {/* 버튼 — 내 기록 보기 / 프로그램으로 이동 (184×36, r10, 13px) */}
          <div className="flex gap-2 justify-center pt-1">
            <button
              type="button"
              onClick={() => navigate(`/profile/activity/${programId}/verifications`)}
              className="w-[184px] max-w-[48%] h-[36px] rounded-[10px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[13px] transition"
            >
              내 기록 보기
            </button>
            <button
              type="button"
              onClick={() => navigate(`/programs/${programId}`)}
              className="w-[184px] max-w-[48%] h-[36px] rounded-[10px] bg-white border border-emerald-300 text-emerald-600 font-bold text-[13px] hover:bg-emerald-50 transition"
            >
              프로그램으로 이동
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="-mx-4 -mt-2">
      {/* 뒤로가기 — fixed 좌상단 floating (스크롤해도 그 자리 고정).
          헤더 안에서 공간 차지 X → 일러스트가 위로 올라와 전체 높이 절약. */}
      <button
        type="button"
        onClick={handleClose}
        className="fixed top-3 left-3 z-40 flex items-center justify-center w-9 h-9 bg-white/85 hover:bg-white rounded-full shadow-md backdrop-blur-sm transition"
        title="뒤로"
      >
        <ChevronLeft className="w-5 h-5 text-gray-700" />
      </button>

      {/* 히어로 영역 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`relative bg-gradient-to-b ${hero.from} ${hero.via} ${hero.to} pt-2 pb-8 px-5 overflow-hidden`}
      >

        {/* 라이브러리 미션 일러스트 — 히어로 풀블리드 (Day 65, 본인 모의도 흐름).
            본인 피드백: 일러스트가 헤더 배경과 「사각형 영역」 으로 명확히 구분되어 보임.
            해결:
              (1) 크기 키우기 — 모바일 폭의 80% (max 360px) 까지
              (2) 사방 페이드 — radial gradient mask 로 좌·우·하단 모두 transparent
                  → 일러스트 가장자리가 배경 그라데이션에 자연스럽게 녹아듦 (vignette). */}
        {mission.icon_path && (
          /^https?:\/\//.test(mission.icon_path) ? (
            // 커스텀 업로드(불투명 사진) — 마스크 없이 깔끔한 라운드 카드 (흰색/초록 갈림 방지)
            <motion.img
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              src={resolveMissionIcon(mission.icon_path)}
              alt=""
              className="block mx-auto w-24 h-24 rounded-2xl object-cover shadow-sm ring-1 ring-black/5 pointer-events-none select-none mb-1"
              aria-hidden="true"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            // 프리셋 일러스트(투명) — 그라데이션 마스크로 배경에 자연스럽게 녹아듦
            <motion.img
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              src={resolveMissionIcon(mission.icon_path)}
              alt=""
              className="block mx-auto w-[60%] max-w-[240px] aspect-square object-contain pointer-events-none select-none -mt-1 -mb-4"
              style={{
                WebkitMaskImage:
                  'radial-gradient(ellipse 70% 70% at 50% 45%, black 50%, rgba(0,0,0,0.6) 75%, transparent 100%)',
                maskImage:
                  'radial-gradient(ellipse 70% 70% at 50% 45%, black 50%, rgba(0,0,0,0.6) 75%, transparent 100%)',
              }}
              aria-hidden="true"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )
        )}

        <div>
        <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
          <span className="text-base leading-none">{catMeta.emoji}</span>
          <span className="font-medium">{catMeta.label}</span>
          <span className="text-gray-400">·</span>
          <span className="truncate">{program?.name}</span>
        </p>

        <h1 className="text-2xl font-medium text-gray-800 leading-tight">
          {mission.title}
        </h1>
        </div>
      </motion.div>

      {/* 입력 카드 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="relative -mt-6 bg-white rounded-t-[2rem] shadow-sm px-5 pt-5 pb-32"
      >
        {!todayCheck.active && (
          <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
            <p className="text-sm font-medium text-amber-800 mb-0.5">
              🚫 오늘은 인증할 수 없어요
            </p>
            <p className="text-xs text-amber-700">
              {todayCheck.reason}
            </p>
          </div>
        )}

        {(mission.instruction || true) && (
          <div className="mb-5 p-3 bg-gray-50 rounded-xl">
            {/* 안내 라벨 + 칩(보상/방식) 한 줄 — 본인 결정으로 통합 */}
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
              <p className="text-xs text-gray-500 font-medium">📋 안내</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 ${hero.chip} text-white text-[11px] rounded-full font-medium`}>
                  +{earnedPoint}P{perInput && earnedPoint < mission.point ? ` / 최대 ${mission.point}P` : ''}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 bg-white text-gray-700 text-[11px] rounded-full font-medium border border-gray-200">
                  {mission.verification_type === 'AUTO' ? '⚡ 자동 승인' : '✅ 운영자 심사'}
                </span>
                {isMulti && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] rounded-full font-medium">
                    {requireCount}가지 인증
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed break-keep">
              {mission.instruction || '인증 시 점수가 자동 적립돼요.'}
            </p>
          </div>
        )}

        {needsImage && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📷 인증 사진
              {perInput && <span className="ml-1 text-xs font-normal text-emerald-600">· {imgPts}P</span>}
              {optImage && <span className="ml-1 text-xs font-normal text-amber-600">(선택)</span>}
            </label>
            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="미리보기"
                  className="w-full max-h-96 object-contain rounded-xl border border-gray-200 bg-gray-50"
                />
                <button
                  type="button"
                  onClick={clearPreview}
                  disabled={isSubmitting}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-full text-gray-700 shadow disabled:opacity-50"
                  title="다시 선택"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-full p-10 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-400 hover:bg-emerald-50/30 transition flex flex-col items-center gap-2 text-gray-500 hover:text-emerald-600 disabled:opacity-50"
              >
                <Upload className="w-9 h-9" />
                <span className="text-sm font-medium">사진 선택하기</span>
                <span className="text-xs text-gray-400">JPG / PNG · 업로드 시 자동 최적화</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={isSubmitting}
              className="hidden"
            />
          </div>
        )}

        {needsNumeric && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📊 기록 값
              {perInput && <span className="ml-1 text-xs font-normal text-emerald-600">· {numPts}P</span>}
              {optNumeric && <span className="ml-1 text-xs font-normal text-amber-600">(선택)</span>}
            </label>
            <input
              type="number"
              value={numericValue}
              onChange={(e) => setNumericValue(e.target.value)}
              placeholder="예: 8000 (걸음) 또는 5.2 (km)"
              step="0.01"
              min="0"
              disabled={isSubmitting}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 disabled:bg-gray-50 text-base"
            />
            <p className="text-xs text-gray-500 mt-1">
              숫자로 본인의 활동 결과를 입력해요
            </p>
          </div>
        )}

        {needsNote && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              💬 한 줄 소감
              {perInput && <span className="ml-1 text-xs font-normal text-emerald-600">· {notePts}P</span>}
              {optNote && <span className="ml-1 text-xs font-normal text-amber-600">(선택)</span>}
            </label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="오늘 활동 어땠나요? 한 줄로 남겨주세요"
              rows={3}
              maxLength={300}
              disabled={isSubmitting}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 disabled:bg-gray-50 resize-none text-base"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">
              {noteText.length}/300
            </p>
          </div>
        )}

        {requireCount === 0 && (
          <div className="p-6 bg-amber-50 rounded-xl text-center">
            <p className="text-sm text-amber-700">
              이 미션은 아직 인증 방식이 설정되지 않았어요
            </p>
          </div>
        )}

        {/* 피드 노출 여부 — feed_enabled 인 프로그램만 표시 */}
        {program?.feed_enabled && requireCount > 0 && (
          <button
            type="button"
            onClick={() => setFeedVisible(!feedVisible)}
            disabled={isSubmitting}
            className={`
              w-full mb-3 p-3 rounded-xl border-2 text-left transition disabled:opacity-50
              ${feedVisible
                ? 'border-emerald-300 bg-emerald-50/50'
                : 'border-gray-200 bg-white'}
            `}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg">{feedVisible ? '📷' : '🔒'}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${feedVisible ? 'text-emerald-700' : 'text-gray-700'}`}>
                  {feedVisible ? '피드에 공개' : '나만 보기'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {feedVisible
                    ? '다른 참여자들이 피드에서 보고 응원할 수 있어요'
                    : '점수는 그대로 받지만 피드에는 표시되지 않아요'}
                </p>
              </div>
              <div className={`
                relative w-9 h-5 rounded-full flex-shrink-0 transition mt-0.5
                ${feedVisible ? 'bg-emerald-500' : 'bg-gray-300'}
              `}>
                <div className={`
                  absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                  ${feedVisible ? 'translate-x-4' : 'translate-x-0.5'}
                `} />
              </div>
            </div>
          </button>
        )}

        {error && (
          <motion.p
            ref={errorRef}
            key={errorTick}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: [-8, 8, -6, 6, -3, 3, 0],
            }}
            transition={{
              opacity: { duration: 0.15 },
              scale: { duration: 0.15 },
              x: { duration: 0.5, ease: 'easeOut' },
            }}
            className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-center font-medium shadow-sm"
          >
            {error}
          </motion.p>
        )}
      </motion.div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-5 py-3 z-40">
        <div className="max-w-4xl mx-auto flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-[2] px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-xl transition disabled:bg-gray-300 shadow-sm"
          >
            {isSubmitting ? '제출 중...' : '인증 제출'}
          </button>
        </div>
      </div>

      {/* 사진 크롭/편집 모달 (프로필 사진과 동일 UX) */}
      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={cropImageSrc}
        onClose={closeCrop}
        onComplete={handleCropComplete}
        aspect={4 / 3}
        aspectOptions={[
          { label: '정사각 1:1', value: 1 },
          { label: '가로 4:3', value: 4 / 3 },
          { label: '세로 3:4', value: 3 / 4 },
        ]}
        cropShape="rect"
        title="사진 편집"
        description="비율을 고르고, 드래그·확대축소로 맞춰주세요"
      />
    </div>
  )
}

// 완료 화면 요약 통계 타일 (아이콘/이미지 왼쪽 + 라벨/값 오른쪽)
function StatTile({ icon, iconBg, imgSrc, imgStyle, label, value, valueClass }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl p-2.5">
      {imgSrc ? (
        <img src={imgSrc} alt="" aria-hidden="true" className="w-8 h-8 object-contain flex-shrink-0" style={imgStyle} onError={(e) => { e.currentTarget.style.display = 'none' }} />
      ) : (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>{icon}</div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
        <p className={`text-[13px] font-bold leading-tight truncate ${valueClass || 'text-gray-800'}`}>{value}</p>
      </div>
    </div>
  )
}

export default MissionVerifyPage
