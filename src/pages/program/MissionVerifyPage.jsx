import { useEffect, useState, useRef, Fragment } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Upload, X, Check, Flag, Clock, Star, Camera, MessageSquare, Pencil, Move } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { CATEGORY } from '../../lib/constants'
import { checkMissionToday } from '../../lib/formatters'
import { resolveMissionIcon } from '../../lib/missionIcons'
import { queryKeys, fetchMission, fetchProgramOverview, fetchProgram, fetchActivePrograms, fetchTodayMissions, fetchTodayCounts } from '../../lib/queries'
import { detectMilestonesReached, resolveStreakMilestones, computeStage } from '../../lib/gamification'
import { useToast } from '../../contexts/ToastContext'
import { compressImage, compressThumbnail } from '../../lib/imageCompression'
import { thumbPathOf } from '../../lib/signedUrls'
import { primeAudio, playSuccessChime } from '../../lib/sound'
import LoadingState from '../../components/common/LoadingState'
import ImageCropModal from '../../components/common/ImageCropModal'
import NotificationBell from '../../components/common/NotificationBell'
import Confetti from '../../components/common/Confetti'

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

// 인증 화면 히어로(썸네일) 비율 — 여기 한 줄만 바꾸면 됨.
//   예) 'aspect-[16/9]'(가로 넓게) · 'aspect-[4/3]'(더 높게) · 'aspect-square'(정사각)
const HERO_ASPECT = 'aspect-[16/9]'

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
  const photoPreviewRef = useRef(null)  // 사진 첨부 후 화면 중앙으로 스크롤
  const errorRef = useRef(null) // 에러 메시지 — 화면 중앙 스크롤 + 진동
  const beforeOverviewRef = useRef(null) // 인증 직전 overview snapshot — 마일스톤 비교용

  // 인증 페이지 진입 시 location.state.returnPath 가 있으면 제출/뒤로 후 그 페이지로 복귀
  // (예: BundleDetailPage 에서 진입 → 같은 BundleDetailPage 로 복귀)
  //   state 는 새로고침 시 사라짐 → 기록하기 출처는 URL ?from=record 로도 복원
  //   (programId 가 URL 에 있으므로 기록하기 2단계 경로를 재구성 가능).
  const fromRecordParam = new URLSearchParams(location.search).get('from') === 'record'
  const returnPath =
    location.state?.returnPath ||
    (fromRecordParam ? `/record?program=${programId}` : null)
  // 기록하기 흐름으로 진입했는지 — 완료 화면 헤더 제목 분기 (기록하기 vs 미션 인증)
  const fromRecord = !!returnPath && returnPath.startsWith('/record')

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
  // 완료 화면 「프로그램으로 이동」 — 완료(verify) 엔트리를 히스토리서 pop 해 원래 프로그램으로.
  //   그러면 프로그램에서 뒤로가기 = 대시보드/프로그램 탭 등 그 이전 화면으로 나감(완료화면 재진입 X).
  //   딥링크 첫 진입(아래 히스토리 없음)은 프로그램으로 replace.
  // 완료 화면 「프로그램으로 이동」 — 묶음/완료 화면을 거치지 않고 항상 프로그램 개요로.
  //   완료 화면 엔트리를 replace 로 덮고, fromCompletion 플래그를 넘겨 프로그램 뒤로가기 시
  //   대시보드로 나가게 함(묶음/완료 화면 재진입 방지).
  const goToProgram = () => {
    navigate(`/programs/${programId}`, { replace: true, state: { fromCompletion: true } })
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

  // 운영자 — 히어로 전용 이미지(아이콘과 별개) 편집: 16:9 로 위치·줌 조절해 크롭 (106)
  const [heroEditOpen, setHeroEditOpen] = useState(false)
  const [heroCropSrc, setHeroCropSrc] = useState(null)
  const [heroCropOpen, setHeroCropOpen] = useState(false)
  const [heroUploading, setHeroUploading] = useState(false)
  const heroFileRef = useRef(null)
  const updateHeroMutation = useMutation({
    mutationFn: async (url) => {   // url: 전체 public URL | null(아이콘으로 폴백)
      const { error } = await supabase.from('missions').update({ hero_image_path: url }).eq('id', missionId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mission(missionId) })
      setHeroEditOpen(false)
    },
    onError: (e) => alert(`미션 썸네일 저장 실패: ${e.message}`),
  })
  const heroBusy = heroUploading || updateHeroMutation.isPending
  const onHeroFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('이미지 파일만 올릴 수 있어요'); return }
    setHeroCropSrc(URL.createObjectURL(file))
    setHeroCropOpen(true)
  }
  const closeHeroCrop = () => {
    setHeroCropOpen(false)
    setHeroCropSrc(prev => { if (prev) URL.revokeObjectURL(prev); return null })
  }
  // 위치·크기 조절 — 새 업로드 없이 기존(히어로 or 아이콘) 이미지를 다시 크롭.
  //   public URL 을 fetch→blob→objectURL 로 (캔버스 cross-origin 타이닝 방지).
  const editExistingHero = async () => {
    const url = resolveMissionIcon(mission?.hero_image_path || mission?.icon_path)
    if (!url) return
    setHeroUploading(true)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('이미지를 불러오지 못했어요')
      const blob = await res.blob()
      setHeroCropSrc(URL.createObjectURL(blob))
      setHeroCropOpen(true)
    } catch (e) {
      alert(`이미지를 불러오지 못했어요: ${e.message}`)
    } finally {
      setHeroUploading(false)
    }
  }
  const onHeroCropComplete = async (blob) => {
    if (!program?.owner_id) return
    setHeroUploading(true)
    try {
      const path = `${program.owner_id}/mission-hero-${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('program-covers').upload(path, blob, { upsert: false, contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('program-covers').getPublicUrl(path)
      closeHeroCrop()
      updateHeroMutation.mutate(data.publicUrl)
    } catch (e) {
      alert(`업로드에 실패했어요: ${e.message}`)
    } finally {
      setHeroUploading(false)
    }
  }
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
  const [metricValues, setMetricValues] = useState({})  // 다중 지표 입력값 {key: value}
  const [noteText, setNoteText] = useState('')
  const [feedVisible, setFeedVisible] = useState(true)  // 디폴트 노출 — feed_enabled 인 프로그램만 의미 있음
  // 인증 피드 공개 정책 (커뮤니티 관리자 ②) ↔ 제출 토글 연결
  const feedPolicy = (() => {
    const boards = program?.community_settings?.boards
    const cert = Array.isArray(boards) ? boards.find(b => b.id === 'cert') : null
    return cert?.feedVisibility || 'public'   // 기본: 항상 공개
  })()
  const feedForced = feedPolicy === 'public' ? true : feedPolicy === 'private' ? false : null  // 강제값(개인선택이면 null)
  const effectiveFeedVisible = feedForced !== null ? feedForced : feedVisible
  // 프로그램 로드 시 정책 기본값으로 초기화 (개인 선택이면 기본 공개/비공개)
  useEffect(() => {
    if (program) setFeedVisible(feedPolicy === 'public' || feedPolicy === 'optin_public')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program?.id])
  const [error, setErrorRaw] = useState(null)
  const [errorTick, setErrorTick] = useState(0)
  // 제출 완료 화면 데이터 (있으면 완료 화면 렌더)
  //   제출 후 「프로그램으로 이동」(push) → 뒤로가기 시 이 페이지가 remount 되며 state 가
  //   사라져 폼이 다시 떴음. 제출 성공 시 현재 history 엔트리 state 에 완료정보를 박제 →
  //   뒤로가기 복귀 시 location.state.completed 로 완료 화면을 복원한다 (해당 엔트리에만 묶임).
  const [submitted, setSubmitted] = useState(() => location.state?.completed || null)

  // 오늘 더 인증 가능한 미션이 남았는지 — 「나머지 미션」 버튼 + 제출 후 전체완료 분기용.
  //   제출 직후(onSuccess)에 즉시 판단해야 하므로 submitted 와 무관하게 항상 조회.
  const userId = session?.user?.id
  const { data: recActivePrograms = [] } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })
  const recProgramIds = recActivePrograms.map(p => p.id)
  const { data: recTodayMissions = [] } = useQuery({
    queryKey: queryKeys.todayMissions(userId),
    queryFn: () => fetchTodayMissions(recProgramIds),
    enabled: !!userId && recProgramIds.length > 0,
  })
  // 폼 단계에서도 사용 (일일 한도 가드) → submitted 와 무관하게 항상 조회
  const { data: recTodayCounts = {} } = useQuery({
    queryKey: queryKeys.todayCounts(userId),
    queryFn: () => fetchTodayCounts(userId),
    enabled: !!userId,
  })
  const isRecordableMission = (m, counts = recTodayCounts) => {
    if (!(m.requires_image || m.requires_numeric || m.requires_note)) return false
    const now = new Date()
    if (m.active_from && now < new Date(m.active_from)) return false
    if (m.active_until && now > new Date(m.active_until)) return false
    if (!checkMissionToday(m).active) return false
    const cnt = counts[m.id]?.total || 0
    if (m.daily_limit != null && cnt >= m.daily_limit) return false
    return true
  }
  // 이 프로그램의 남은(인증 가능) 미션 — 「나머지 미션」 버튼 = 기록하기 2단계(이 프로그램 미션 선택)
  const remainingMissionCount = recTodayMissions.filter(m => m.program_id === programId && isRecordableMission(m)).length

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
  // 다중 지표 (122) — 정의돼 있으면 지표별 입력, 없으면 레거시 단일 numeric
  const metricList = Array.isArray(mission?.metrics) ? mission.metrics : []
  const hasMetrics = metricList.length > 0
  // HHMMSS(시분초) → {h,m,s}. 입력 raw 의 끝 6자리 사용(앞 0 패딩)
  const parseHMS = (raw) => {
    const d = String(raw ?? '').replace(/\D/g, '').slice(-6).padStart(6, '0')
    return { h: +d.slice(0, 2), m: +d.slice(2, 4), s: +d.slice(4, 6) }
  }
  const hmsToMinutes = (raw) => { const { h, m, s } = parseHMS(raw); return h * 60 + m + s / 60 }
  const hmsLabel = (raw) => { const { h, m, s } = parseHMS(raw); return `${h}시간 ${m}분 ${s}초` }
  // 지표 입력의 숫자값(저장용). hms 면 분으로 환산, 아니면 그대로 숫자.
  const metricNumValue = (m) => {
    const r = metricValues[m.key]
    if (r == null || String(r).trim() === '') return null
    return m.inputFormat === 'hms' ? hmsToMinutes(r) : parseFloat(r)
  }
  const filledMetric = (m) => { const r = metricValues[m.key]; return r != null && String(r).trim() !== '' }
  const anyMetricFilled = hasMetrics && metricList.some(filledMetric)
  // "기록" 입력 여부 — 다중이면 지표 1개+, 아니면 단일 numeric
  const numericFilled = hasMetrics ? anyMetricFilled : !!numericValue
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
    ? ((selectedFile ? imgPts : 0) + (numericFilled ? numPts : 0) + (noteText.trim() ? notePts : 0))
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
    // 사진 첨부 후 미리보기를 화면 정중앙으로 스크롤 (렌더 후 2-rAF)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      photoPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }))
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

        // 3-1) 목록용 썸네일(400px) 동반 업로드 — 실패해도 인증 제출은 진행(목록은 원본 폴백)
        try {
          const thumb = await compressThumbnail(selectedFile)
          if (thumb) await supabase.storage.from('verification-images')
            .upload(thumbPathOf(path), thumb, { contentType: 'image/jpeg' })
        } catch (e) { console.warn('[썸네일 업로드 생략]', e?.message) }
      }

      // 선택 입력 미작성 시 저장하지 않음 → 채점 합산에서 제외
      if (needsNumeric && hasMetrics) {
        const mv = {}
        for (const m of metricList) {
          if (!filledMetric(m)) continue
          const num = metricNumValue(m)
          if (num != null && !isNaN(num)) mv[m.key] = num
        }
        if (Object.keys(mv).length > 0) insertData.metric_values = mv
      } else if (needsNumeric && numericValue !== '' && !isNaN(parseFloat(numericValue))) {
        insertData.numeric_value = parseFloat(numericValue)
      }
      if (needsNote && noteText.trim()) insertData.note = noteText.trim()
      // 피드 노출 여부 — 정책(강제 공개/비공개)이면 강제값, 개인 선택이면 토글값
      if (program?.feed_enabled) insertData.feed_visible = effectiveFeedVisible

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
        // 서버 daily_limit 트리거(103) — 오늘 한도 도달
        if (insertError.message?.includes('DAILY_LIMIT_REACHED')) {
          queryClient.invalidateQueries({ queryKey: queryKeys.todayCounts(session.user.id) })
          throw new Error('오늘은 이미 인증을 완료했어요. 내일 다시 인증할 수 있어요.')
        }
        throw new Error(`인증 제출 실패: ${insertError.message}`)
      }
    },
    onSuccess: async () => {
      playSuccessChime()   // 인증 완료 효과음 (띠링↗)
      // 인증 성공 → 점수/카운트/랭킹 모두 무효화 → 다른 화면 진입 시 fresh
      // prefix 무효화로 한 번에 처리 (새 키 추가 시 빠질 위험 줄임)
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['verifications'] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      queryClient.invalidateQueries({ queryKey: ['missions', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['metricSummary'] })

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
      // 기록하기 흐름 + 오늘 더 인증할 미션이 없으면 → 미션별 완료 대신 전체 완료 화면으로.
      //   (낙관적 카운트: 방금 제출한 미션 +1 반영. recTodayMissions 미로딩 시엔 기존 완료화면 유지)
      const optimisticCounts = {
        ...recTodayCounts,
        [mission.id]: { total: (recTodayCounts[mission.id]?.total || 0) + 1 },
      }
      const anyRemaining = recTodayMissions.some(m => isRecordableMission(m, optimisticCounts))
      if (fromRecord && recTodayMissions.length > 0 && !anyRemaining) {
        navigate('/record', { replace: true })
        return
      }

      const t = new Date()
      const timeStr = `${t.getHours() < 12 ? '오전' : '오후'} ${t.getHours() % 12 || 12}:${String(t.getMinutes()).padStart(2, '0')}`
      const donePayload = {
        points: earnedPoint,
        streak,
        timeStr,
        note: (needsNote && noteText.trim()) ? noteText.trim() : null,
        numeric: (needsNumeric && !hasMetrics && numericValue !== '') ? numericValue : null,
        metrics: (needsNumeric && hasMetrics)
          ? metricList.filter(filledMetric).map(m => m.inputFormat === 'hms'
              ? { label: m.label || '기록', text: hmsLabel(metricValues[m.key]), icon: m.icon || '' }
              : { label: m.label || '기록', value: metricNumValue(m), unit: m.unit || '', icon: m.icon || '' })
          : null,
        photoUrl: (needsImage && selectedFile) ? previewUrl : null,
      }
      setSubmitted(donePayload)
      // 뒤로가기(프로그램→복귀) 시 완료 화면 복원용 — 현재 엔트리 state 에 박제.
      //   blob photoUrl 은 remount 시 무효라 제외 (썸네일만 빠지고 완료 화면은 유지).
      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: { ...(location.state || {}), completed: { ...donePayload, photoUrl: null } },
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
    primeAudio()   // 사용자 제스처에서 오디오 잠금 해제 (모바일) → onSuccess 효과음 재생 보장
    if (dailyLimitReached) {
      setError('오늘은 이미 인증을 완료했어요. 내일 다시 인증할 수 있어요.')
      return
    }

    // Day 65 — 마일스톤 비교용 직전 snapshot 캡처 (현재 cache 데이터).
    beforeOverviewRef.current = queryClient.getQueryData(
      queryKeys.programOverview(programId, session.user.id)
    )

    if (reqImage && !selectedFile) {
      setError('사진을 선택해주세요')
      return
    }
    if (needsNumeric && hasMetrics) {
      // 다중 지표 — 입력한 항목은 0 초과 + 1회 한도 이내, 필수면 1개 이상
      if (reqNumeric && !anyMetricFilled) {
        setError('기록 항목을 1개 이상 입력해주세요')
        return
      }
      for (const m of metricList) {
        if (!filledMetric(m)) continue
        const num = metricNumValue(m)
        if (num == null || isNaN(num) || num <= 0) {
          setError(`${m.label || '기록'}을(를) 올바르게 입력해주세요`)
          return
        }
        if (m.max != null && num > Number(m.max)) {
          const lim = m.inputFormat === 'hms' ? `${Math.floor(m.max / 60)}시간` : `${m.max}${m.unit || ''}`
          setError(`${m.label || '기록'}은(는) 1회 최대 ${lim} 까지예요`)
          return
        }
      }
    } else if (reqNumeric) {
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

  // 일일 한도 가드 — 오늘 이미 한도만큼 인증했으면 재제출 차단
  //   (뒤로가기/재진입/다른 경로 중복 제출 방지. 서버 트리거 103 의 클라 미러)
  const todayDoneCount = (mission && recTodayCounts[mission.id]?.total) || 0
  const dailyLimitReached =
    !!mission && mission.daily_limit != null && todayDoneCount >= mission.daily_limit

  const canSubmit = (() => {
    if (isSubmitting) return false
    if (!mission) return false
    if (!todayCheck.active) return false
    if (dailyLimitReached) return false
    if (reqImage && !selectedFile) return false
    if (reqNumeric && !numericFilled) return false
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
    // 기록하기 흐름이면 단계 라벨도 기록하기 기준(미션 선택·기록/인증)으로
    const STEPS_DONE = fromRecord ? ['프로그램 선택', '미션 선택', '기록·인증'] : ['프로그램 선택', '미션 확인', '미션 인증']
    // 운영자 심사(MANUAL) 미션 — 승인 전이라 점수 미반영 + '승인 대기' 표기
    const isReview = mission?.verification_type !== 'AUTO'
    return (
      <div className="min-h-screen bg-gray-50 -mx-4 -mt-2">
        {/* 헤더 — 뒤로 + 제목(진입 경로별) + 알림 */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
          <div className="max-w-md mx-auto h-[46px] px-4 flex items-center justify-center relative">
            <button type="button" onClick={handleClose} className="absolute left-3 p-1.5 -ml-1.5 text-gray-500 hover:text-gray-800" aria-label="뒤로">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-[17px] font-bold text-gray-800">{fromRecord ? '기록하기' : '미션 인증'}</span>
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

          {/* 완료 카드 — 🎉(빵빠레) + 텍스트 + 통계(2/3) 포함 */}
          <div className="relative overflow-hidden bg-white border border-gray-100 rounded-2xl shadow-soft p-5 space-y-4">
            <Confetti count={16} fall={300} />
            <div className="relative flex items-center gap-4">
              <motion.div
                className="text-5xl flex-shrink-0 select-none leading-none"
                initial={{ scale: 0, rotate: -25 }}
                animate={{ scale: [0, 1.35, 0.92, 1.08, 1], rotate: [-25, 12, -6, 0] }}
                transition={{ duration: 0.9, times: [0, 0.4, 0.65, 0.85, 1], ease: 'easeOut' }}
              >
                🎉
              </motion.div>
              <div className="min-w-0">
                <h2 className="text-[21px] font-extrabold text-gray-900 leading-tight">{isReview ? '인증을 제출했어요!' : '기록이 완료되었어요!'}</h2>
                <p className="text-[12px] text-gray-500 mt-1">{isReview ? '운영자 승인 후 점수가 반영돼요.' : '오늘의 미션 인증이 정상적으로 제출되었어요.'}</p>
              </div>
            </div>

            {/* 인증한 미션 (미션탭 박스 — 포인트 제외) + 요약 통계 4박스 */}
            <div className="relative space-y-2">
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
                {isReview ? (
                  <span className="flex items-center gap-1 text-[13px] font-bold text-amber-600 flex-shrink-0">
                    <Clock className="w-3.5 h-3.5" /> 승인 대기
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[13px] font-bold text-emerald-600 flex-shrink-0">
                    <Check className="w-3.5 h-3.5" /> 오늘 인증 완료
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <StatTile icon={<Clock className="w-4 h-4" />} iconBg="bg-purple-100 text-purple-600" label="완료 시각" value={`오늘 ${submitted.timeStr}`} />
                {isReview ? (
                  <StatTile icon={<Clock className="w-4 h-4" />} iconBg="bg-amber-100 text-amber-600" label="인증 상태" value="승인 대기" valueClass="text-amber-600" />
                ) : (
                  <StatTile icon={<Check className="w-4 h-4" />} iconBg="bg-sky-100 text-sky-600" label="인증 상태" value="제출 완료" valueClass="text-emerald-600" />
                )}
                {isReview ? (
                  <StatTile icon={<Star className="w-4 h-4 fill-current" />} iconBg="bg-amber-100 text-amber-500" label="획득 예정" value={`+${submitted.points}P`} valueClass="text-amber-600" />
                ) : (
                  <StatTile icon={<Star className="w-4 h-4 fill-current" />} iconBg="bg-amber-100 text-yellow-400" label="획득 포인트" value={`+${submitted.points}P`} valueClass="text-emerald-600" />
                )}
                <StatTile imgSrc="/icons/activity/points.png" imgStyle={{ filter: 'hue-rotate(100deg) saturate(1.3)' }} label="연속 참여" value={`${submitted.streak}일 연속`} />
              </div>
            </div>
          </div>

          {/* 제출한 기록 요약 */}
          {(submitted.photoUrl || submitted.note || submitted.numeric || (submitted.metrics && submitted.metrics.length)) && (
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
                  <Flag className="w-4 h-4 text-emerald-500" /> 기록 {submitted.numeric}
                </div>
              )}
              {submitted.metrics && submitted.metrics.map((m, i) => (
                <div key={i} className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Flag className="w-4 h-4 text-emerald-500" /> {m.icon && <span>{m.icon}</span>}{m.label} {m.text != null ? m.text : `${m.value}${m.unit}`}
                </div>
              ))}
              {submitted.note && (
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MessageSquare className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="leading-snug">{submitted.note}</span>
                </div>
              )}
            </div>
          )}

          {/* 버튼 — (남은 미션 있으면)나머지 미션 제출하기 + 프로그램으로 이동 */}
          <div className="flex gap-2 justify-center pt-1">
            {remainingMissionCount > 0 && (
              <button
                type="button"
                onClick={() => navigate(`/record?program=${programId}`, { replace: true })}
                className="w-[184px] max-w-[48%] h-[36px] rounded-[10px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[13px] transition flex items-center justify-center gap-1 whitespace-nowrap"
              >
                📋 나머지 미션 ({remainingMissionCount}개)
              </button>
            )}
            <button
              type="button"
              onClick={goToProgram}
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

      {/* 운영자 — 우상단 연필: 히어로 이미지 위치·크기 조절 */}
      {isOwner && (
        <button
          type="button"
          onClick={() => setHeroEditOpen(true)}
          className="fixed top-3 right-3 z-40 flex items-center justify-center w-9 h-9 bg-white/85 hover:bg-white rounded-full shadow-md backdrop-blur-sm transition"
          title="미션 썸네일 편집"
        >
          <Pencil className="w-4 h-4 text-gray-700" />
        </button>
      )}

      {/* 미션 썸네일 편집 모달 — 운영자 전용 (중앙 카드). 크롭 중엔 숨김 */}
      {heroEditOpen && isOwner && !heroCropOpen && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-5" onClick={() => !heroBusy && setHeroEditOpen(false)}>
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-[15px] font-bold text-gray-800 mb-1">미션 썸네일 편집</h4>
            <p className="text-[12px] text-gray-400 mb-3 break-keep">가로(16:9) 화면에 맞게 사진의 <b className="text-gray-600">위치·크기</b>를 조절해 원하는 부분이 보이게 해요. 미션 아이콘과는 별개로 저장돼요.</p>

            {(mission.hero_image_path || mission.icon_path) && (
              <div className="aspect-[16/9] rounded-xl overflow-hidden bg-gray-100 mb-3 ring-1 ring-black/5">
                <img src={resolveMissionIcon(mission.hero_image_path || mission.icon_path)} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            {/* 사진 바꾸기 — 새 사진 업로드 */}
            <button type="button" onClick={() => heroFileRef.current?.click()} disabled={heroBusy}
              className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-1.5">
              <Camera className="w-4 h-4" /> 사진 바꾸기
            </button>
            {/* 위치·크기 조절 — 새 업로드 없이 기존 이미지 재편집 */}
            {(mission.hero_image_path || mission.icon_path) && (
              <button type="button" onClick={editExistingHero} disabled={heroBusy}
                className="w-full h-11 mt-2 rounded-xl border-2 border-emerald-400 text-emerald-700 text-sm font-bold transition hover:bg-emerald-50 disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Move className="w-4 h-4" /> 위치·크기 조절
              </button>
            )}
            {mission.hero_image_path && (
              <button type="button" onClick={() => updateHeroMutation.mutate(null)} disabled={heroBusy}
                className="w-full h-10 mt-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50 transition disabled:opacity-50">
                기본(아이콘)으로 되돌리기
              </button>
            )}
            <button type="button" onClick={() => setHeroEditOpen(false)} disabled={heroBusy}
              className="w-full h-10 mt-2 rounded-xl text-gray-500 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
              닫기
            </button>
            <input ref={heroFileRef} type="file" accept="image/*" onChange={onHeroFile} className="hidden" />
          </div>
        </div>
      )}

      {/* 16:9 크롭(위치·줌 조절) */}
      <ImageCropModal
        isOpen={heroCropOpen}
        imageSrc={heroCropSrc}
        onClose={closeHeroCrop}
        onComplete={onHeroCropComplete}
        isUploading={heroUploading}
        aspect={16 / 9}
        cropShape="rect"
        outputWidth={1280}
        outputHeight={720}
        title="미션 썸네일 편집"
        description="원하는 부분이 보이도록 위치·크기를 맞춰주세요 (16:9)"
      />

      {/* 히어로 — 썸네일을 영역 전체에 풀블리드(object-cover) + 하단 그라데이션 위에
          프로그램·미션 제목 오버레이. 뒤로가기 버튼은 위(fixed z-40)에 떠 있음. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`relative ${HERO_ASPECT} overflow-hidden`}
      >
        {/* 배경 썸네일 — 히어로 전용 이미지(hero_image_path) 우선, 없으면 아이콘 */}
        {(mission.hero_image_path || mission.icon_path) ? (
          <motion.img
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            src={resolveMissionIcon(mission.hero_image_path || mission.icon_path)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            aria-hidden="true"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-teal-200" />
        )}

        {/* 가독성 오버레이 — 하단으로 갈수록 어둡게 (약하게) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

        {/* 텍스트 — 좌하단 흰색 (카드와 겹치지 않게 여유) */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-9 pt-12 text-white">
          <p className="text-xs mb-1 flex items-center gap-1 drop-shadow-sm">
            <span className="text-base leading-none">{catMeta.emoji}</span>
            <span className="font-medium">{catMeta.label}</span>
            <span className="opacity-70">·</span>
            <span className="truncate">{program?.name}</span>
          </p>
          <h1 className="text-2xl font-bold leading-tight drop-shadow">
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

        {todayCheck.active && dailyLimitReached && (
          <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
            <p className="text-sm font-medium text-emerald-800 mb-0.5">
              ✅ 오늘 인증을 완료했어요
            </p>
            <p className="text-xs text-emerald-700">
              {mission.daily_limit === 1
                ? '이 미션은 하루 1회만 인증할 수 있어요. 내일 다시 만나요!'
                : `이 미션은 하루 ${mission.daily_limit}회까지 인증할 수 있어요. (오늘 ${todayDoneCount}회 완료)`}
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
              <div className="relative scroll-mt-20" ref={photoPreviewRef}>
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
            {hasMetrics ? (
              <>
                <div className="space-y-2.5">
                  {metricList.map(m => {
                    const isHms = m.inputFormat === 'hms'
                    const raw = metricValues[m.key] ?? ''
                    return (
                    <div key={m.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">{m.icon && <span className="mr-1">{m.icon}</span>}{m.label || '기록'}</span>
                        {m.max != null && <span className="text-[11px] text-gray-400">최대 {isHms ? `${Math.floor(Number(m.max) / 60)}시간` : `${m.max}${m.unit || ''}`}</span>}
                      </div>
                      {isHms ? (
                        <>
                          <div className="flex items-center gap-2">
                            <input
                              type="text" inputMode="numeric" maxLength={6}
                              value={raw}
                              onChange={(e) => setMetricValues(v => ({ ...v, [m.key]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                              placeholder="예: 012345"
                              disabled={isSubmitting}
                              className="w-[42%] px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 disabled:bg-gray-50 text-base tracking-[0.2em] text-center"
                            />
                            <span className="text-gray-300 flex-shrink-0">→</span>
                            <div className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-100 text-base truncate">
                              {String(raw).trim() !== '' ? <span className="text-gray-800 font-medium">{hmsLabel(raw)}</span> : <span className="text-gray-300">0시간 0분 0초</span>}
                            </div>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1">시·분·초 6자리로 입력해요 (예: 1시간 23분 45초 → 012345)</p>
                        </>
                      ) : (
                        <div className="relative">
                          <input
                            type="number" step="0.01" min="0"
                            value={raw}
                            onChange={(e) => setMetricValues(v => ({ ...v, [m.key]: e.target.value }))}
                            placeholder="예: 5.2"
                            disabled={isSubmitting}
                            className={`w-full px-4 py-3 ${m.unit ? 'pr-12' : ''} border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 disabled:bg-gray-50 text-base`}
                          />
                          {m.unit && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">{m.unit}</span>}
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1.5">가진 항목만 입력해도 돼요</p>
              </>
            ) : (
              <>
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
                <p className="text-xs text-gray-500 mt-1">숫자로 본인의 활동 결과를 입력해요</p>
              </>
            )}
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

        {/* 피드 노출 여부 — feed_enabled + 개인 선택(정책 미고정)일 때만 표시. 고정이면 숨김(값은 정책대로 저장) */}
        {program?.feed_enabled && requireCount > 0 && feedForced === null && (
          <button
            type="button"
            onClick={() => { if (feedForced === null) setFeedVisible(!feedVisible) }}
            disabled={isSubmitting || feedForced !== null}
            className={`
              w-full mb-3 p-3 rounded-xl border-2 text-left transition
              ${effectiveFeedVisible
                ? 'border-emerald-300 bg-emerald-50/50'
                : 'border-gray-200 bg-white'}
              ${isSubmitting ? 'opacity-50' : ''}
            `}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg">{effectiveFeedVisible ? '📷' : '🔒'}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${effectiveFeedVisible ? 'text-emerald-700' : 'text-gray-700'}`}>
                  {effectiveFeedVisible ? '피드에 공개' : '나만 보기'}
                  {feedForced !== null && <span className="ml-1 text-[11px] font-normal text-gray-400">· 운영자 고정</span>}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {feedForced !== null
                    ? (feedForced ? '운영자 설정으로 인증이 항상 피드에 공개돼요' : '운영자 설정으로 인증이 피드에 공개되지 않아요')
                    : (effectiveFeedVisible
                        ? '다른 참여자들이 피드에서 보고 응원할 수 있어요'
                        : '점수는 그대로 받지만 피드에는 표시되지 않아요')}
                </p>
              </div>
              <div className={`
                relative w-9 h-5 rounded-full flex-shrink-0 transition mt-0.5
                ${effectiveFeedVisible ? 'bg-emerald-500' : 'bg-gray-300'} ${feedForced !== null ? 'opacity-60' : ''}
              `}>
                <div className={`
                  absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                  ${effectiveFeedVisible ? 'translate-x-4' : 'translate-x-0.5'}
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
            className={`flex-[2] px-4 py-3 font-medium rounded-xl transition shadow-sm ${
              dailyLimitReached
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white disabled:bg-gray-300 disabled:bg-none disabled:text-gray-500'
            }`}
          >
            {dailyLimitReached ? '🔒 오늘 인증 완료' : isSubmitting ? '제출 중...' : '인증 제출'}
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
