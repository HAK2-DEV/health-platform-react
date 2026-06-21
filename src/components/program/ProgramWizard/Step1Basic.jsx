import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CATEGORY_LIST, PROGRAM } from '../../../lib/constants'
import { getTodayKST } from '../../../lib/formatters'
import { useAuth } from '../../../hooks/useAuth'
import CoverImageUploader from '../../common/CoverImageUploader'

// 1단계: 기본 정보 — 무스크롤 서브스텝(타입폼) 방식.
//   이름 → 카테고리 → 기간 → 소개·사진. 한 화면에 하나씩, 스크롤 없이 넘김.
const SUB = [
  { q: '프로그램 이름을 정해볼까요?', sub: '참여자에게 보이는 이름이에요.' },
  { q: '어떤 카테고리인가요?', sub: '여러 개 골라도 좋아요.' },
  { q: '언제부터 언제까지 진행하나요?', sub: '시작 후엔 시작일을 바꿀 수 없어요.\n(종료일만 나중에 수정 가능)' },
  { q: '소개와 대표 사진을 더해요', sub: '선택이에요 — 비워도 괜찮아요.' },
]
const TOTAL = SUB.length

const slideVariants = {
  enter: (d) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
}

function Step1Basic({ initialData, onNext, onSave, enterAtEnd = false }) {
  const { session } = useAuth()
  const ownerId = session?.user?.id

  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [startDate, setStartDate] = useState(initialData?.start_date || '')
  const [endDate, setEndDate] = useState(initialData?.end_date || '')
  const endDateRef = useRef(null)
  const [categories, setCategories] = useState(initialData?.categories || [])
  const [coverImagePath, setCoverImagePath] = useState(initialData?.cover_image_path || null)
  const [error, setError] = useState(null)

  // 2단계에서 「이전」으로 돌아오면 마지막 서브스텝(소개·사진)부터 보이게
  const [subStep, setSubStep] = useState(enterAtEnd ? TOTAL - 1 : 0)
  const [dir, setDir] = useState(enterAtEnd ? -1 : 1)

  const toggleCategory = (key) => {
    setCategories(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key])
  }

  const collectData = () => ({
    name: name.trim(),
    description: description.trim(),
    start_date: startDate || null,
    end_date: endDate || null,
    categories,
    cover_image_path: coverImagePath,
  })

  // 서브스텝별 검증
  const validateSub = (s) => {
    if (s === 0) {
      if (!name.trim()) return '프로그램 이름을 입력해주세요'
      if (name.length > PROGRAM.NAME_MAX_LENGTH) return `이름은 최대 ${PROGRAM.NAME_MAX_LENGTH}자예요`
    }
    if (s === 1 && categories.length === 0) return '카테고리를 최소 1개 선택해주세요'
    if (s === 2) {
      if (!startDate) return '시작일을 선택해주세요'
      if (!endDate) return '종료일을 선택해주세요'
      if (startDate > endDate) return '종료일은 시작일 이후여야 해요'
    }
    if (s === 3 && description.length > PROGRAM.DESCRIPTION_MAX_LENGTH) {
      return `목표 설명은 최대 ${PROGRAM.DESCRIPTION_MAX_LENGTH}자예요`
    }
    return null
  }

  const goNext = () => {
    const err = validateSub(subStep)
    if (err) { setError(err); return }
    setError(null)
    if (subStep < TOTAL - 1) { setDir(1); setSubStep(s => s + 1) }
    else onNext(collectData())
  }
  const goPrev = () => { setError(null); setDir(-1); setSubStep(s => Math.max(0, s - 1)) }

  const handleSave = () => {
    if (!name.trim()) { setError('임시저장하려면 이름을 입력해주세요'); return }
    setError(null)
    onSave(collectData())
  }

  return (
    <div>
      {/* 서브스텝 진행 바 */}
      <div className="flex gap-1.5" style={{ marginBottom: '9px' }}>
        {SUB.map((_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= subStep ? 'bg-emerald-500' : 'bg-gray-200'}`} />
        ))}
      </div>

      {/* 슬라이드되는 서브스텝 콘텐츠 — 한 화면에 한 항목, 무스크롤 */}
      <div className="min-h-[300px]">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={subStep}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <h2 className="text-xl font-bold text-gray-800 break-keep" style={{ marginBottom: '5px' }}>{SUB[subStep].q}</h2>
            <p className="text-sm text-gray-500 break-keep whitespace-pre-line" style={{ marginBottom: '18px' }}>{SUB[subStep].sub}</p>

            {/* 0: 이름 */}
            {subStep === 0 && (
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') goNext() }}
                  maxLength={PROGRAM.NAME_MAX_LENGTH}
                  placeholder="예: 봄철 걷기 챌린지"
                  className="w-full px-3.5 py-3 border-2 border-gray-200 rounded-[10px] focus:outline-none focus:border-emerald-500 text-[15px]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{name.length}/{PROGRAM.NAME_MAX_LENGTH}</span>
              </div>
            )}

            {/* 1: 카테고리 */}
            {subStep === 1 && (
              <div className="grid grid-cols-3" style={{ gap: '9px' }}>
                {CATEGORY_LIST.map(category => {
                  const on = categories.includes(category.key)
                  return (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => toggleCategory(category.key)}
                      className={`flex items-center justify-center gap-1 px-2 py-2.5 rounded-[10px] border-2 text-sm transition leading-tight min-w-0
                        ${on ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                    >
                      <span className="flex-shrink-0">{category.emoji}</span>
                      <span className="whitespace-pre-line text-center">{category.label === '마음관리' ? '마음\n관리' : category.label}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* 2: 기간 */}
            {subStep === 2 && (
              <div className="flex flex-col sm:flex-row sm:items-end" style={{ gap: '9px' }}>
                <div className="w-full sm:flex-1 min-w-0">
                  <p className="text-[11px] text-gray-500 mb-1">📅 시작</p>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      if (e.target.value) setTimeout(() => { endDateRef.current?.focus(); try { endDateRef.current?.showPicker?.() } catch { /* 미지원 */ } }, 100)
                    }}
                    min={getTodayKST()}
                    className="block w-full max-w-full min-w-0 box-border appearance-none px-3 py-3 border-2 border-gray-200 rounded-[10px] focus:outline-none focus:border-emerald-500 bg-white text-sm"
                  />
                </div>
                <span className="hidden sm:inline text-gray-500 flex-shrink-0 pb-3">~</span>
                <div className="w-full sm:flex-1 min-w-0">
                  <p className="text-[11px] text-gray-500 mb-1">📅 종료</p>
                  <input
                    ref={endDateRef}
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || getTodayKST()}
                    className="block w-full max-w-full min-w-0 box-border appearance-none px-3 py-3 border-2 border-gray-200 rounded-[10px] focus:outline-none focus:border-emerald-500 bg-white text-sm"
                  />
                </div>
              </div>
            )}

            {/* 3: 소개 + 대표 사진 */}
            {subStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                <CoverImageUploader
                  ownerId={ownerId}
                  imagePath={coverImagePath}
                  onChange={setCoverImagePath}
                  categories={categories}
                  name={name}
                />
                <div className="relative">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={PROGRAM.DESCRIPTION_MAX_LENGTH}
                    placeholder="목표 한 줄 — 예: 매일 7천보 걷고 건강 습관 만들기!"
                    rows={3}
                    className="w-full px-3.5 py-3 border-2 border-gray-200 rounded-[10px] focus:outline-none focus:border-emerald-500 resize-none text-sm"
                  />
                  <span className="absolute right-3 bottom-2.5 text-xs text-gray-400">{description.length}/{PROGRAM.DESCRIPTION_MAX_LENGTH}</span>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && (
        <p className="p-2 bg-red-100 text-red-700 rounded-[10px] text-sm text-center" style={{ marginTop: '9px' }}>{error}</p>
      )}

      {/* 네비게이션 — 2·3단계와 동일 (이전/임시저장/다음) */}
      <div className="flex" style={{ gap: '9px', marginTop: '18px' }}>
        {subStep > 0 && (
          <button type="button" onClick={goPrev}
            className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-[10px] transition text-sm">이전</button>
        )}
        <button type="button" onClick={handleSave}
          className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-[10px] transition text-sm whitespace-nowrap">임시저장</button>
        <button type="button" onClick={goNext}
          className="flex-1 px-3 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-[10px] transition text-sm">
          {subStep < TOTAL - 1 ? '다음' : '다음 단계로'}
        </button>
      </div>
    </div>
  )
}

export default Step1Basic
