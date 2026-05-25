import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Upload, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { CATEGORY } from '../../lib/constants'
import { checkMissionToday } from '../../lib/formatters'
import { queryKeys, fetchMission } from '../../lib/queries'

// 카테고리 → 히어로 그라데이션
const CATEGORY_HERO = {
  WALKING:    { from: 'from-emerald-100', via: 'via-emerald-50/80', to: 'to-teal-50/40',    chip: 'bg-emerald-500' },
  DIET:       { from: 'from-green-100',   via: 'via-green-50/80',   to: 'to-emerald-50/40', chip: 'bg-green-500' },
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
  const fileInputRef = useRef(null)

  // 인증 페이지 진입 시 location.state.returnPath 가 있으면 제출/뒤로 후 그 페이지로 복귀
  // (예: BundleDetailPage 에서 진입 → 같은 BundleDetailPage 로 복귀)
  const returnPath = location.state?.returnPath || null
  const backToProgram = () => {
    navigate(returnPath || `/programs/${programId}`)
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

  // 입력 상태
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [numericValue, setNumericValue] = useState('')
  const [noteText, setNoteText] = useState('')
  const [error, setError] = useState(null)

  // 입력 메타
  const needsImage = !!mission?.requires_image
  const needsNumeric = !!mission?.requires_numeric
  const needsNote = !!mission?.requires_note
  const requireCount = [needsImage, needsNumeric, needsNote].filter(Boolean).length
  const isMulti = requireCount >= 2

  // 카테고리 → 히어로 색
  const catKey = program?.categories?.[0] || 'ETC'
  const hero = CATEGORY_HERO[catKey] || CATEGORY_HERO.ETC
  const catMeta = CATEGORY[catKey] || CATEGORY.ETC

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있어요')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 해요')
      return
    }
    setError(null)
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
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
        const buffer = await selectedFile.arrayBuffer()
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const imageHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        insertData.image_hash = imageHash

        const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${Date.now()}.${ext}`
        const path = `${session.user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('verification-images')
          .upload(path, selectedFile)
        if (uploadError) throw new Error(`업로드 실패: ${uploadError.message}`)
        imagePath = path
        insertData.image_path = path
      }

      if (needsNumeric) insertData.numeric_value = parseFloat(numericValue)
      if (needsNote) insertData.note = noteText.trim()

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
    onSuccess: () => {
      // 인증 성공 → 점수/카운트/랭킹 모두 무효화 → 다른 화면 진입 시 fresh
      // prefix 무효화로 한 번에 처리 (새 키 추가 시 빠질 위험 줄임)
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['verifications'] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      queryClient.invalidateQueries({ queryKey: ['missions', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      // 운영자 본인이 자기 미션 인증한 경우 PENDING 도 갱신될 수 있음
      // 묶음 진입이었으면 묶음 모달로 자동 복귀 (다른 미션 연속 인증 가능)
      backToProgram()
    },
    onError: (err) => {
      console.error('인증 제출 오류:', err)
      setError(err.message)
    },
  })

  const handleSubmit = () => {
    if (!session || !mission) return

    if (needsImage && !selectedFile) {
      setError('사진을 선택해주세요')
      return
    }
    if (needsNumeric) {
      const num = parseFloat(numericValue)
      if (!numericValue || isNaN(num) || num <= 0) {
        setError('0보다 큰 숫자를 입력해주세요')
        return
      }
    }
    if (needsNote && !noteText.trim()) {
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
    if (needsImage && !selectedFile) return false
    if (needsNumeric && !numericValue) return false
    if (needsNote && !noteText.trim()) return false
    if (requireCount === 0) return false
    return true
  })()

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-500 text-sm">
        불러오는 중...
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
        <p className="p-4 bg-red-50 text-red-700 rounded-lg text-center">
          미션을 찾을 수 없어요
        </p>
      </div>
    )
  }

  return (
    <div className="-mx-4 -mt-2">
      {/* 히어로 영역 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`relative bg-gradient-to-b ${hero.from} ${hero.via} ${hero.to} pt-3 pb-20 px-5 overflow-hidden`}
      >
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center justify-center w-9 h-9 bg-white/80 hover:bg-white rounded-full shadow-sm transition mb-4"
          title="뒤로"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>

        <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
          <span className="text-base leading-none">{catMeta.emoji}</span>
          <span className="font-medium">{catMeta.label}</span>
          <span className="text-gray-400">·</span>
          <span className="truncate">{program?.name}</span>
        </p>

        <h1 className="text-2xl font-medium text-gray-800 leading-tight mb-2">
          {mission.title}
        </h1>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2.5 py-1 ${hero.chip} text-white text-xs rounded-full font-medium`}>
            +{mission.point}P
          </span>
          <span className="inline-flex items-center px-2.5 py-1 bg-white/80 text-gray-700 text-xs rounded-full font-medium">
            {mission.verification_type === 'AUTO' ? '⚡ 자동 승인' : '✅ 운영자 심사'}
          </span>
          {isMulti && (
            <span className="inline-flex items-center px-2.5 py-1 bg-white/80 text-emerald-700 text-xs rounded-full font-medium">
              {requireCount}가지 인증
            </span>
          )}
        </div>
      </motion.div>

      {/* 입력 카드 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="relative -mt-10 bg-white rounded-t-3xl shadow-sm px-5 pt-6 pb-32"
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

        {mission.instruction && (
          <div className="mb-5 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1 font-medium">📋 안내</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {mission.instruction}
            </p>
          </div>
        )}

        {needsImage && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📷 인증 사진
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
                <span className="text-xs text-gray-400">JPG / PNG / 최대 5MB</span>
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

        {error && (
          <p className="mb-3 p-3 bg-red-50 text-red-700 rounded-xl text-sm text-center">
            {error}
          </p>
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
            className="flex-[2] px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition disabled:bg-gray-300 shadow-sm"
          >
            {isSubmitting ? '제출 중...' : '인증 제출'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MissionVerifyPage
