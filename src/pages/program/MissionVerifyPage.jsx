import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Upload, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { CATEGORY } from '../../lib/constants'

// 카테고리 → 히어로 그라데이션 (DashboardPage CATEGORY_COLORS 와 톤 일치)
const CATEGORY_HERO = {
  WALKING:    { from: 'from-emerald-100', via: 'via-emerald-50/80', to: 'to-teal-50/40',    chip: 'bg-emerald-500' },
  DIET:       { from: 'from-green-100',   via: 'via-green-50/80',   to: 'to-emerald-50/40', chip: 'bg-green-500' },
  EMPATHY:    { from: 'from-pink-100',    via: 'via-pink-50/80',    to: 'to-rose-50/40',    chip: 'bg-pink-500' },
  MINDCARE:   { from: 'from-orange-100',  via: 'via-orange-50/80',  to: 'to-amber-50/40',   chip: 'bg-orange-500' },
  SLEEP:      { from: 'from-purple-100',  via: 'via-purple-50/80',  to: 'to-indigo-50/40',  chip: 'bg-purple-500' },
  NO_SMOKING: { from: 'from-yellow-100',  via: 'via-yellow-50/80',  to: 'to-amber-50/40',   chip: 'bg-yellow-500' },
  ETC:        { from: 'from-gray-100',    via: 'via-gray-50/80',    to: 'to-slate-50/40',   chip: 'bg-gray-500' },
}

// 참여자 미션 인증 전용 페이지 (히어로 스타일)
// /programs/:programId/missions/:missionId
// — 모달 대신 풀스크린: 헤더/바텀바 숨김 (App.jsx 분기)
// — 사진 영역을 크게 (히어로 흰 카드 첫 영역) → 사진 위주 인증 UX 강화
// — daily_limit / 활성 기간 / 미지원 케이스는 진입 전 ProgramDetailPage 에서 차단되지만,
//   라우트 직접 진입을 대비해 mission 로드 후 isInactive/reachedLimit/!isSupported 만 guard
function MissionVerifyPage() {
  const { programId, missionId } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [mission, setMission] = useState(null)
  const [program, setProgram] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [numericValue, setNumericValue] = useState('')
  const [noteText, setNoteText] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // mission/program fetch (RLS: mission 은 본인이 참여 중인 program 만 보임 — 015)
  useEffect(() => {
    if (!session || !missionId) return
    setIsLoading(true)
    setLoadError(null)
    ;(async () => {
      const { data: m, error: mErr } = await supabase
        .from('missions')
        .select('*, programs!inner(id, name, categories)')
        .eq('id', missionId)
        .maybeSingle()

      if (mErr || !m) {
        setLoadError('미션을 찾을 수 없어요')
        setIsLoading(false)
        return
      }
      setMission(m)
      setProgram(m.programs)
      setIsLoading(false)
    })()
  }, [session, missionId])

  // 입력 메타 — 미션이 요구하는 것만 노출
  const needsImage = !!mission?.requires_image
  const needsNumeric = !!mission?.requires_numeric
  const needsNote = !!mission?.requires_note
  const requireCount = [needsImage, needsNumeric, needsNote].filter(Boolean).length
  const isMulti = requireCount >= 2

  // 카테고리 → 히어로 색 (첫 번째 카테고리 사용)
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

  // 페이지 이탈 시 미리보기 URL 정리
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleClose = () => {
    navigate(-1)
  }

  // 제출 — VerificationSubmitModal 의 handleSubmit 과 동일한 흐름
  // 1) 입력 검증, 2) 사진 업로드 + SHA-256 해시, 3) verifications INSERT
  const handleSubmit = async () => {
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

    setIsSubmitting(true)
    setError(null)

    try {
      const insertData = {
        mission_id: mission.id,
        user_id: session.user.id,
      }
      let imagePath = null

      if (needsImage && selectedFile) {
        // SHA-256 — 본인의 같은 사진 중복 인증 차단 (029 partial UNIQUE)
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

        if (uploadError) {
          throw new Error(`업로드 실패: ${uploadError.message}`)
        }
        imagePath = path
        insertData.image_path = path
      }

      if (needsNumeric) {
        insertData.numeric_value = parseFloat(numericValue)
      }
      if (needsNote) {
        insertData.note = noteText.trim()
      }

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

      // 제출 후 ProgramDetailPage 로 복귀 — refetch 는 detail 페이지의 useEffect 가 처리
      navigate(`/programs/${programId}`)
    } catch (err) {
      console.error('인증 제출 오류:', err)
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  // 제출 가능 조건
  const canSubmit = (() => {
    if (isSubmitting) return false
    if (!mission) return false
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

  if (loadError) {
    return (
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition mb-4"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <p className="p-4 bg-red-50 text-red-700 rounded-lg text-center">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="-mx-4 -mt-2">
      {/* 히어로 영역 — 카테고리별 그라데이션 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`relative bg-gradient-to-b ${hero.from} ${hero.via} ${hero.to} pt-3 pb-20 px-5 overflow-hidden`}
      >
        {/* 닫기 (← 백) — 좌상단 작은 흰 원 */}
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center justify-center w-9 h-9 bg-white/80 hover:bg-white rounded-full shadow-sm transition mb-4"
          title="뒤로"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>

        {/* 카테고리 + 프로그램명 */}
        <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
          <span className="text-base leading-none">{catMeta.emoji}</span>
          <span className="font-medium">{catMeta.label}</span>
          <span className="text-gray-400">·</span>
          <span className="truncate">{program?.name}</span>
        </p>

        {/* 미션 타이틀 */}
        <h1 className="text-2xl font-medium text-gray-800 leading-tight mb-2">
          {mission.title}
        </h1>

        {/* 포인트 + 자동/심사 칩 */}
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

      {/* 흰 카드 오버랩 — 입력 영역 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="relative -mt-10 bg-white rounded-t-3xl shadow-sm px-5 pt-6 pb-32"
      >
        {/* 안내 (운영자가 입력) */}
        {mission.instruction && (
          <div className="mb-5 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1 font-medium">📋 안내</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {mission.instruction}
            </p>
          </div>
        )}

        {/* 사진 영역 */}
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

        {/* 숫자 영역 */}
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

        {/* 소감 영역 */}
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

        {/* 인증 UI 없는 미션 (feature 자동생성 + requires_* 미설정 등 예외) */}
        {requireCount === 0 && (
          <div className="p-6 bg-amber-50 rounded-xl text-center">
            <p className="text-sm text-amber-700">
              이 미션은 아직 인증 방식이 설정되지 않았어요
            </p>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <p className="mb-3 p-3 bg-red-50 text-red-700 rounded-xl text-sm text-center">
            {error}
          </p>
        )}
      </motion.div>

      {/* 하단 sticky 제출 영역 — BottomTabBar 숨겨진 상태이므로 화면 하단에 직접 고정 */}
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
