import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, AlertCircle, Loader2 } from 'lucide-react'
import { CATEGORY_LIST, PROGRAM } from '../../../lib/constants'
import { getTodayKST } from '../../../lib/formatters'
import { checkProgramNameTaken } from '../../../lib/queries'
import { useAuth } from '../../../hooks/useAuth'

// 카테고리 3D 아이콘 (public/icons/category/<key>.png) — 로드 실패 시 이모지 폴백
function CatIcon({ cat }) {
  const [err, setErr] = useState(false)
  if (err) return <span className="text-base leading-none">{cat.emoji}</span>
  // 마음관리는 명상 3D 아이콘 사용 (여백이 많아 조금 더 크게 렌더)
  const isMed = cat.key === 'MINDCARE'
  const src = isMed ? '/icons/meditation/meditate.png' : `/icons/category/${cat.key.toLowerCase()}.png`
  return <img src={src} alt="" aria-hidden="true" onError={() => setErr(true)} className={`${isMed ? 'w-8 h-8 -my-1' : 'w-6 h-6'} object-contain`} />
}
import CoverImageUploader from '../../common/CoverImageUploader'
import InfoTip from '../../common/InfoTip'

// 1단계: 기본 정보 — 무스크롤 서브스텝(타입폼) 방식.
//   이름 → 카테고리 → 기간 → 소개·사진. 한 화면에 하나씩, 스크롤 없이 넘김.
const SUB = [
  { q: '프로그램 이름을 정해볼까요?', sub: '참여자에게 보이는 이름이에요.' },
  { q: '한 줄 설명을 적어볼까요?', sub: '프로그램을 한 문장으로 소개해요.\n(선택 — 비워도 돼요)' },
  { q: '어떤 카테고리인가요?', sub: '하나만 골라주세요. 메뉴 구성이 여기에 맞춰져요.\n⚠️ 생성 후에는 바꿀 수 없어요.', danger: true },
  { q: '언제부터 언제까지 진행하나요?', sub: '⚠️ 시작 후엔 시작일을 바꿀 수 없어요.\n(종료일은 수정 가능)', danger: true },
  { q: '대표 사진을 더해요', sub: '선택이에요 — 비워도 괜찮아요.' },
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

  // 이름 중복 검사(전역, 마이그 163 RPC) — 종료된 건 무관. 입력 디바운스 후 검사.
  const [debouncedName, setDebouncedName] = useState(name.trim())
  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(name.trim()), 350)
    return () => clearTimeout(t)
  }, [name])
  const { data: nameTaken = false, isFetching: nameFetching } = useQuery({
    queryKey: ['program-name-taken', debouncedName.toLowerCase(), initialData?.id || null],
    queryFn: () => checkProgramNameTaken({ name: debouncedName, excludeId: initialData?.id }),
    enabled: !!ownerId && debouncedName.length > 0,
    staleTime: 0,
  })
  const nameSettled = debouncedName === name.trim()
  const isDupName = name.trim().length > 0 && nameSettled && nameTaken
  const nameChecking = name.trim().length > 0 && (!nameSettled || nameFetching)  // 확인 중(진행 차단)

  // 2단계에서 「이전」으로 돌아오면 마지막 서브스텝(소개·사진)부터 보이게
  const [subStep, setSubStep] = useState(enterAtEnd ? TOTAL - 1 : 0)
  const [dir, setDir] = useState(enterAtEnd ? -1 : 1)

  // 단일 선택 — 카테고리 1개만 (카테고리가 메뉴/테마를 결정하므로)
  const toggleCategory = (key) => {
    setCategories([key])
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
      if (isDupName) return '이미 있는 프로그램 이름이에요. 다른 이름을 써주세요'
      if (nameChecking) return '이름 확인 중이에요. 잠시 후 다시 눌러주세요'
    }
    if (s === 1 && description.length > PROGRAM.DESCRIPTION_MAX_LENGTH) {
      return `한 줄 설명은 최대 ${PROGRAM.DESCRIPTION_MAX_LENGTH}자예요`
    }
    if (s === 2 && categories.length === 0) return '카테고리를 최소 1개 선택해주세요'
    if (s === 3) {
      if (!startDate) return '시작일을 선택해주세요'
      if (startDate < getTodayKST()) return '시작일은 오늘 이후로 선택해주세요'
      if (!endDate) return '종료일을 선택해주세요'
      if (startDate > endDate) return '종료일은 시작일 이후여야 해요'
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
    if (isDupName) { setError('이미 있는 프로그램 이름이에요. 다른 이름을 써주세요'); return }
    if (nameChecking) { setError('이름 확인 중이에요. 잠시 후 다시 눌러주세요'); return }
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
            <h2 className="text-xl font-bold text-gray-800 break-keep flex items-center gap-1.5" style={{ marginBottom: '18px' }}>
              <span>{SUB[subStep].q}</span>
              <InfoTip danger={SUB[subStep].danger}>{SUB[subStep].sub}</InfoTip>
            </h2>

            {/* 0: 이름 */}
            {subStep === 0 && (
              <div>
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') goNext() }}
                    maxLength={PROGRAM.NAME_MAX_LENGTH}
                    placeholder="예: 봄철 걷기 챌린지"
                    className={`w-full px-3.5 py-3 border-2 rounded-[10px] focus:outline-none text-[15px] ${isDupName ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-emerald-500'}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{name.length}/{PROGRAM.NAME_MAX_LENGTH}</span>
                </div>
                {isDupName ? (
                  <p className="flex items-start gap-1 mt-2 text-[13px] text-red-600 break-keep">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>이미 있는 프로그램 이름이에요. 다른 이름을 써주세요.</span>
                  </p>
                ) : nameChecking ? (
                  <p className="flex items-center gap-1 mt-2 text-[12px] text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" /> 이름 확인 중…
                  </p>
                ) : name.trim().length > 0 ? (
                  <p className="mt-2 text-[12px] text-emerald-600">사용 가능한 이름이에요 ✓</p>
                ) : null}
              </div>
            )}

            {/* 1: 한 줄 설명 */}
            {subStep === 1 && (
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={PROGRAM.DESCRIPTION_MAX_LENGTH}
                  autoFocus
                  placeholder="예: 매일 7천보 걷고 건강 습관 만들기!"
                  rows={3}
                  className="w-full px-3.5 py-3 border-2 border-gray-200 rounded-[10px] focus:outline-none focus:border-emerald-500 resize-none text-sm"
                />
                <span className="absolute right-3 bottom-2.5 text-xs text-gray-400">{description.length}/{PROGRAM.DESCRIPTION_MAX_LENGTH}</span>
              </div>
            )}

            {/* 2: 카테고리 */}
            {subStep === 2 && (
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
                      <span className="flex-shrink-0"><CatIcon cat={category} /></span>
                      <span className="whitespace-pre-line text-center">{category.label === '마음관리' ? '마음\n관리' : category.label}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* 3: 기간 */}
            {subStep === 3 && (
              <div className="flex flex-col sm:flex-row sm:items-end" style={{ gap: '9px' }}>
                <div className="w-full sm:flex-1 min-w-0">
                  <p className="flex items-center gap-1 text-[11px] text-gray-500 mb-1"><Calendar className="w-3 h-3" /> 시작</p>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      // 일부 모바일 브라우저는 min 을 피커에서 강제 안 함 → 과거 선택 시 오늘로 클램프
                      const today = getTodayKST()
                      const val = e.target.value && e.target.value < today ? today : e.target.value
                      setStartDate(val)
                      if (val) setTimeout(() => { endDateRef.current?.focus(); try { endDateRef.current?.showPicker?.() } catch { /* 미지원 */ } }, 100)
                    }}
                    min={getTodayKST()}
                    className="block w-full max-w-full min-w-0 box-border appearance-none px-3 py-3 border-2 border-gray-200 rounded-[10px] focus:outline-none focus:border-emerald-500 bg-white text-sm"
                  />
                </div>
                <span className="hidden sm:inline text-gray-500 flex-shrink-0 pb-3">~</span>
                <div className="w-full sm:flex-1 min-w-0">
                  <p className="flex items-center gap-1 text-[11px] text-gray-500 mb-1"><Calendar className="w-3 h-3" /> 종료</p>
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

            {/* 4: 대표 사진 */}
            {subStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                <CoverImageUploader
                  ownerId={ownerId}
                  imagePath={coverImagePath}
                  onChange={setCoverImagePath}
                  categories={categories}
                  name={name}
                />
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
        <button type="button" onClick={goNext} disabled={subStep === 0 && (isDupName || nameChecking)}
          className="flex-1 px-3 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-[10px] transition text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          {subStep < TOTAL - 1 ? '다음' : '다음 단계로'}
        </button>
      </div>
    </div>
  )
}

export default Step1Basic
