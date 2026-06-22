import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { ChevronRight, ClipboardList, Calendar, Trash2 } from 'lucide-react'
import { CATEGORY, CATEGORY_LIST } from '../../lib/constants'
import { calcProgress, CATEGORY_HEX } from '../../lib/programVisuals'
import ProgramCover from '../../components/common/ProgramCover'
import NotificationBell from '../../components/common/NotificationBell'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import ProgramDetailModal from '../../components/program/ProgramDetailModal'
import ProgramBrowseModal from '../../components/program/ProgramBrowseModal'
import ParticipationTipsSheet from '../../components/program/ParticipationTipsSheet'
import ConfirmModal from '../../components/common/ConfirmModal'
import {
  queryKeys,
  fetchActivePrograms,
  fetchMyPrograms,
  fetchPublicPrograms,
  fetchActiveParticipantCounts,
  fetchProgramLastActivity,
} from '../../lib/queries'

// description 첫 줄(이름 중복이면 다음 줄) — 한 줄 설명
function oneLineDesc(program) {
  const raw = (program.description || '').trim()
  if (!raw) return ''
  const lines = raw.split('\n')
  if (lines[0].trim() === (program.name || '').trim()) return (lines[1] || '').trim()
  return lines[0].trim()
}

function daysLeftOf(program) {
  if (!program.end_date) return null
  const end = new Date(`${program.end_date}T23:59:59+09:00`)
  return Math.max(0, Math.ceil((end - new Date()) / 86400000))
}

// 참여중/운영중 카드
function ProgramCard({ program, ctaLabel, onClick, onDelete }) {
  const catKey = program.categories?.[0] || 'ETC'
  const color = CATEGORY_HEX[catKey] || CATEGORY_HEX.ETC
  const catLabel = CATEGORY[catKey]?.label || '기타'
  const isDraft = program.status === 'DRAFT'
  const progress = calcProgress(program.start_date, program.end_date)
  const days = daysLeftOf(program)
  const desc = oneLineDesc(program)

  return (
    <div
      onClick={onClick}
      className="relative bg-white border border-gray-100 rounded-[10px] shadow-soft p-4 flex flex-col cursor-pointer hover:shadow-elevated transition"
    >
      {/* 상단 — 텍스트(상단 정렬: 제목 위치 고정) + 썸네일 */}
      <div className="flex gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-[7px]">
          <span
            className="inline-flex items-center justify-center w-[44px] h-[18px] rounded-[3px] text-[10px] font-bold"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {catLabel}
          </span>
          <h3 className="text-[17px] font-bold text-gray-800 truncate leading-tight">{program.name}</h3>
          {isDraft ? (
            // 위치는 translateY 로 조절 (레이아웃 영향 X → 박스 안 커지고 숫자만큼만 내려감)
            <p
              className="text-[13px] font-medium text-gray-400 leading-tight"
              style={{ transform: 'translateY(15px)' }}
            >
              아직 만드는 중이에요!
            </p>
          ) : (
            <>
              {desc && <p className="text-[11px] text-gray-500 truncate leading-tight">{desc}</p>}
              {days != null && (
                <p className="text-[11px] leading-tight">
                  <span className="text-gray-800">종료까지 </span>
                  <span className="font-bold" style={{ color }}>{days}일</span>
                  <span className="text-gray-800"> 남았어요</span>
                </p>
              )}
            </>
          )}
        </div>
        <ProgramCover
          imagePath={program.cover_image_path}
          categories={program.categories}
          name={program.name}
          variant="thumb"
          className="w-[132px] h-[88px] aspect-auto rounded-lg flex-shrink-0"
        />
      </div>

      {/* 희미한 구분선 */}
      <div className="my-3 h-px bg-gray-100" />

      {/* 하단 — 진행률(완성본만) / 임시저장 안내(DRAFT) + CTA */}
      <div className="flex items-center gap-3">
        {isDraft ? (
          <span className="flex-1 text-[11px] text-gray-400 truncate">임시저장됨 · 작성을 완료해 주세요</span>
        ) : (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-[11px] text-gray-500 flex-shrink-0">진행률</span>
            <span className="text-[11px] font-bold flex-shrink-0" style={{ color }}>{progress}%</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ backgroundColor: color, width: `${progress}%` }} />
            </div>
          </div>
        )}
        {isDraft && onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            title="임시저장 삭제"
            className="w-[29px] h-[29px] rounded-[5px] flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick?.() }}
          className="w-[87px] h-[29px] rounded-[5px] text-[12px] font-bold flex-shrink-0"
          style={{ backgroundColor: `${color}26`, color }}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  )
}

// 둘러보기 — 2열 그리드 카드 (표지 + 카테고리칩 오버레이 + D-day·참여수 + 참여버튼)
function BrowseCard({ program, count, onClick }) {
  const catKey = program.categories?.[0] || 'ETC'
  const color = CATEGORY_HEX[catKey] || CATEGORY_HEX.ETC
  const catLabel = CATEGORY[catKey]?.label || '기타'
  const days = daysLeftOf(program)
  const desc = oneLineDesc(program)
  const isOpen = (program.join_type || 'FREE') === 'FREE'

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-100 rounded-2xl shadow-soft overflow-hidden flex flex-col cursor-pointer hover:shadow-elevated transition"
    >
      <div className="relative">
        <ProgramCover
          imagePath={program.cover_image_path}
          categories={program.categories}
          name={program.name}
          variant="tile"
        />
        <span
          className="absolute top-2 left-2 inline-flex items-center justify-center px-2 h-[20px] rounded-[5px] text-[10px] font-bold backdrop-blur-sm"
          style={{ backgroundColor: `${color}E6`, color: '#fff' }}
        >
          {catLabel}
        </span>
      </div>
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <h3 className="text-[15px] font-bold text-gray-800 truncate">{program.name}</h3>
        {desc && <p className="text-[11px] text-gray-500 truncate">{desc}</p>}
        <p className="text-[11px] text-gray-500 flex items-center gap-1 min-w-0">
          <Calendar className="w-3 h-3 flex-shrink-0" style={{ color }} />
          <span className="font-bold flex-shrink-0" style={{ color }}>{days != null ? `D-${days}` : '상시'}</span>
          <span className="truncate">· {count ?? '-'}명 참여 중</span>
        </p>
        <div
          className="mt-1 h-[34px] rounded-[8px] text-[13px] font-bold flex items-center justify-center"
          style={{ backgroundColor: `${color}1F`, color }}
        >
          {isOpen ? '참여하기' : '자세히 보기'}
        </div>
      </div>
    </div>
  )
}

// 하단 CTA 박스 (참여중 / 운영중 / 둘러보기 공용) — onClick 있으면 버튼, 없으면 정보성 박스
//   icon: 34×34 일러스트 PNG 경로 (없으면 기본 클립보드 아이콘)
function CreateProgramCTA({ icon, title, subtitle, onClick }) {
  const base = 'w-full flex items-center gap-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl px-4 py-3 text-left'
  const iconEl = icon ? (
    <img
      src={icon}
      alt=""
      aria-hidden="true"
      onError={(e) => { e.currentTarget.style.display = 'none' }}
      className="w-[58px] h-[58px] object-contain flex-shrink-0 mix-blend-multiply saturate-[1.45] contrast-[1.05]"
    />
  ) : (
    <div className="w-10 h-10 flex-shrink-0 bg-emerald-100 rounded-full flex items-center justify-center">
      <ClipboardList className="w-5 h-5 text-emerald-600" />
    </div>
  )
  const inner = (
    <>
      {iconEl}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-800 text-[14px]">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{subtitle}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
    </>
  )
  if (!onClick) return <div className={base}>{inner}</div>
  return (
    <button type="button" onClick={onClick} className={`${base} hover:bg-emerald-50 transition`}>
      {inner}
    </button>
  )
}

// 둘러보기 하단 CTA — 두 슬라이드 3초마다 옆으로 슬라이딩 교대
function BottomCtaCarousel({ onCreate }) {
  const [tipsOpen, setTipsOpen] = useState(false)
  const slides = [
    {
      icon: '/icons/cta/tip.png',
      title: '프로그램 참여 팁',
      subtitle: '꾸준한 실천이 중요해요! 나에게 맞는 프로그램을 선택하고, 작은 목표부터 시작해보세요.',
      onClick: () => setTipsOpen(true),
    },
    {
      icon: '/icons/cta/create.png',
      title: '마음에 드는 프로그램이 없으신가요?',
      subtitle: '4분만에 본인이 원하는 프로그램을 직접 만들어 보세요!',
      onClick: onCreate,
    },
  ]
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI(v => (v + 1) % slides.length), 5000)
    return () => clearInterval(id)
  }, [])
  const s = slides[i]
  return (
    <div className="relative overflow-hidden min-h-[86px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -60, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <CreateProgramCTA icon={s.icon} title={s.title} subtitle={s.subtitle} onClick={s.onClick} />
        </motion.div>
      </AnimatePresence>
      <ParticipationTipsSheet isOpen={tipsOpen} onClose={() => setTipsOpen(false)} />
    </div>
  )
}

// 둘러보기 상단 배너 슬라이드 (점=캐러셀)
const BROWSE_SLIDES = [
  { title: '나에게 맞는 건강 습관을\n찾아보세요! 🌿', sub: '작은 실천이 큰 변화를 만듭니다.' },
  { title: '함께라서 더 즐거운\n건강 여정 💚', sub: '마음 맞는 사람들과 시작해보세요.' },
]

const TABS = [
  { key: 'active', label: '참여중' },
  { key: 'mine', label: '운영중' },
  { key: 'browse', label: '둘러보기' },
]

function ProgramListPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user?.id

  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.some(t => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'active'
  const setTab = (key) => setSearchParams(key === 'active' ? {} : { tab: key }, { replace: true })

  const [catFilter, setCatFilter] = useState('ALL')
  const [slide, setSlide] = useState(0)
  const [selectedPublicId, setSelectedPublicId] = useState(null)
  const [browseOpen, setBrowseOpen] = useState(false)

  // 배너 자동 회전 (둘러보기 탭일 때만)
  useEffect(() => {
    if (tab !== 'browse') return
    const id = setInterval(() => setSlide(s => (s + 1) % BROWSE_SLIDES.length), 4500)
    return () => clearInterval(id)
  }, [tab])

  const { data: activePrograms = [], isLoading: isActiveLoading } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })
  const { data: myPrograms = [], isLoading: isMyLoading } = useQuery({
    queryKey: queryKeys.myPrograms(userId),
    queryFn: () => fetchMyPrograms(userId),
    enabled: !!userId,
  })
  const { data: publicPrograms = [], isLoading: isPublicLoading } = useQuery({
    queryKey: queryKeys.publicPrograms(userId),
    queryFn: () => fetchPublicPrograms(userId),
    enabled: !!userId,
  })
  const activeIds = publicPrograms.map(p => p.id)
  const { data: publicCounts = {} } = useQuery({
    queryKey: queryKeys.activeParticipantCounts(activeIds),
    queryFn: () => fetchActiveParticipantCounts(activeIds),
    enabled: tab === 'browse' && activeIds.length > 0,
  })

  // 임시저장(DRAFT) 프로그램 삭제 — 운영중 목록에서
  const queryClient = useQueryClient()
  const deleteDraftMutation = useMutation({
    mutationFn: async (programId) => {
      const { error } = await supabase.from('programs').delete().eq('id', programId)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.myPrograms(userId) }); setDraftToDelete(null) },
    onError: (e) => { console.error('임시저장 삭제 실패:', e); alert(`삭제에 실패했습니다: ${e.message}`) },
  })
  const [draftToDelete, setDraftToDelete] = useState(null)  // 임시저장 삭제 확인 모달
  const handleDeleteDraft = (program) => setDraftToDelete(program)

  // 둘러보기 — 내가 운영(소유)하거나 이미 참여 중인 프로그램은 제외
  //   publicPrograms 는 소유 프로그램(owner_id)은 이미 서버에서 제외됨. 여기선 참여 중 + 안전망으로 소유도 함께 제외.
  const excludeIds = useMemo(
    () => new Set([...activePrograms, ...myPrograms].map(p => p.id)),
    [activePrograms, myPrograms]
  )

  const filteredPublic = useMemo(() => {
    const base = publicPrograms.filter(p => !excludeIds.has(p.id))
    if (catFilter === 'ALL') return base
    return base.filter(p => (p.categories || []).includes(catFilter))
  }, [publicPrograms, excludeIds, catFilter])

  // 참여중 — 최근 인증한 프로그램이 위로. (마지막 인증 시각 내림차순, 없으면 뒤로)
  const { data: lastActivity = {} } = useQuery({
    queryKey: ['my-program-last-activity', userId],
    queryFn: () => fetchProgramLastActivity(userId),
    enabled: !!userId,
  })
  const sortedActive = useMemo(() => {
    return [...activePrograms].sort((a, b) => {
      const ta = lastActivity[a.id] ? new Date(lastActivity[a.id]).getTime() : 0
      const tb = lastActivity[b.id] ? new Date(lastActivity[b.id]).getTime() : 0
      return tb - ta
    })
  }, [activePrograms, lastActivity])

  return (
    <div className="min-h-screen bg-white">
      {/* 상단 헤더 — 도담 아이콘 + 프로그램 + 알림 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto h-[46px] px-4 flex items-center justify-center relative">
          <div className="flex items-center gap-1.5">
            <img src="/app-icon.png" onError={(e) => { e.currentTarget.style.display = 'none' }} alt="" className="w-5 h-5 rounded-md" />
            <span className="text-[17px] font-bold text-gray-800">프로그램</span>
          </div>
          <div className="absolute right-3">
            <NotificationBell bare />
          </div>
        </div>
      </header>

      <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 pt-0 pb-6 space-y-[11px]">
        {/* 서브탭 — 헤더(46px) 아래 고정 (sticky), 풀폭 흰 배경 */}
        <div className="sticky top-[46px] z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-[11px] pb-0 bg-white">
          <div className="mx-auto w-[362px] max-w-full h-[44px] rounded-[15px] bg-gray-100/90 p-1 flex gap-1">
            {TABS.map(t => {
              const on = tab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex-1 rounded-[12px] text-sm font-bold transition flex items-center justify-center ${
                    on ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── 참여중 ─── */}
        {tab === 'active' && (
          <>
            <div>
              <h2 className="text-[16px] font-bold text-gray-800">참여 중인 프로그램</h2>
              <p className="text-sm text-gray-400 mt-0.5">건강한 습관을 만들고 더 나은 나를 만나보세요! 💚</p>
            </div>
            {isActiveLoading ? (
              <LoadingState size="sm" />
            ) : activePrograms.length === 0 ? (
              <EmptyState icon="🎯" title="참여 중인 프로그램이 없어요" description="둘러보기에서 새 프로그램을 찾아보세요"
                action={{ label: '둘러보기', onClick: () => setTab('browse') }} variant="mint" size="lg" />
            ) : (
              <div className="space-y-[11px]">
                {sortedActive.map(p => (
                  <ProgramCard key={p.id} program={p} ctaLabel="계속하기" onClick={() => navigate(`/programs/${p.id}`)} />
                ))}
              </div>
            )}

            {/* 둘러보기 안내 CTA */}
            <CreateProgramCTA
              icon="/icons/cta/browse.png"
              title="나에게 맞는 프로그램을 찾아보세요!"
              subtitle="다양한 건강 프로그램을 둘러보고 참여해보세요."
              onClick={() => setTab('browse')}
            />
          </>
        )}

        {/* ─── 운영중 ─── */}
        {tab === 'mine' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-gray-800">운영 중인 프로그램</h2>
                <p className="text-sm text-gray-400 mt-0.5">내가 만든 프로그램을 관리해요.</p>
              </div>
              {myPrograms.length > 0 && (
                <button type="button" onClick={() => navigate('/programs/new')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full hover:bg-emerald-100 transition flex-shrink-0">
                  + 만들기
                </button>
              )}
            </div>
            {isMyLoading ? (
              <LoadingState size="sm" />
            ) : myPrograms.length === 0 ? (
              <EmptyState icon="📋" title="아직 만든 프로그램이 없어요" description="건강 프로그램을 만들어 운영해보세요"
                action={{ label: '프로그램 생성하기', onClick: () => navigate('/programs/new') }} variant="mint" size="lg" />
            ) : (
              <div className="space-y-[11px]">
                {myPrograms.map(p => (
                  <ProgramCard
                    key={p.id}
                    program={p}
                    ctaLabel={p.status === 'DRAFT' ? '완성하기' : '관리'}
                    onClick={() => p.status === 'DRAFT' ? navigate(`/programs/new?id=${p.id}`) : navigate(`/programs/${p.id}`)}
                    onDelete={p.status === 'DRAFT' ? () => handleDeleteDraft(p) : undefined}
                  />
                ))}
              </div>
            )}

            {/* 하단 — 새 프로그램 만들기 CTA (운영 중 프로그램이 있을 때만) */}
            {myPrograms.length > 0 && (
              <CreateProgramCTA
                icon="/icons/cta/create.png"
                title="새로운 프로그램을 만들어보세요!"
                subtitle="건강한 습관을 만드는 여정을 시작해보세요."
                onClick={() => navigate('/programs/new')}
              />
            )}
          </>
        )}

        {/* ─── 둘러보기 ─── */}
        {tab === 'browse' && (
          <>
            {/* 배너 — 일러스트 전체 배경(이미지와 동일 비율이라 잘림 없음) + 좌측 텍스트 오버레이 */}
            <div className="relative overflow-hidden rounded-2xl bg-[#eaf6ee] w-[359px] max-w-full h-[124px] mx-auto">
              {/* 배경 일러스트 */}
              <img
                src="/illustrations/browse-banner.jpg"
                alt=""
                aria-hidden="true"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: 'center top' }}
              />
              {/* 좌측 텍스트 가독성용 살짝의 흰 페이드 */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#eef8f1]/85 via-[#eef8f1]/30 to-transparent" />
              {/* 텍스트 (좌측 정렬·세로 중앙) */}
              <div className="absolute inset-0 px-5 flex flex-col justify-center">
                <div className="max-w-[60%]">
                  <h2 className="text-[19px] font-bold text-gray-800 leading-snug whitespace-pre-line drop-shadow-sm">
                    {BROWSE_SLIDES[slide].title}
                  </h2>
                  <p className="mt-1.5 text-[13px] text-gray-600">{BROWSE_SLIDES[slide].sub}</p>
                </div>
              </div>
              {/* 캐러셀 점 (좌하단) */}
              <div className="absolute left-5 bottom-3 flex gap-1.5">
                {BROWSE_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSlide(i)}
                    aria-label={`배너 ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-4 bg-emerald-500' : 'w-1.5 bg-emerald-300'}`}
                  />
                ))}
              </div>
            </div>

            {/* 추천 프로그램 헤더 + 전체 보기 */}
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-gray-800">추천 프로그램</h2>
              <button type="button" onClick={() => setBrowseOpen(true)}
                className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700">
                전체 보기<ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 카테고리 필터 칩 */}
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-hide">
              <button
                type="button"
                onClick={() => setCatFilter('ALL')}
                className={`flex-shrink-0 h-[34px] px-3.5 rounded-full text-[13px] font-bold transition ${
                  catFilter === 'ALL' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600'
                }`}
              >
                전체
              </button>
              {CATEGORY_LIST.map(c => {
                const on = catFilter === c.key
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCatFilter(c.key)}
                    className={`flex-shrink-0 h-[34px] px-3.5 rounded-full text-[13px] font-bold transition flex items-center gap-1 ${
                      on ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600'
                    }`}
                  >
                    <span>{c.emoji}</span>{c.label}
                  </button>
                )
              })}
            </div>

            {/* 2열 카드 그리드 */}
            {isPublicLoading ? (
              <LoadingState size="sm" />
            ) : filteredPublic.length === 0 ? (
              <EmptyState icon="🔍" title={catFilter === 'ALL' ? '아직 둘러볼 공개 프로그램이 없어요' : <span className="text-[18px] whitespace-nowrap">이 카테고리엔 아직 프로그램이 없어요</span>} variant="mint" size="lg" />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredPublic.map(p => (
                  <BrowseCard
                    key={p.id}
                    program={p}
                    count={publicCounts[p.id]}
                    onClick={() => setSelectedPublicId(p.id)}
                  />
                ))}
              </div>
            )}

            {/* 하단 — 참여 팁 ↔ 직접 만들기 CTA 교대 슬라이딩 (3초) */}
            <BottomCtaCarousel onCreate={() => navigate('/programs/new')} />
          </>
        )}
      </div>

      {/* 모달 */}
      <ProgramBrowseModal
        isOpen={browseOpen}
        onClose={() => setBrowseOpen(false)}
        programs={publicPrograms}
        onSelect={(id) => { setBrowseOpen(false); setSelectedPublicId(id) }}
      />
      {(() => {
        const idx = selectedPublicId ? publicPrograms.findIndex(p => p.id === selectedPublicId) : -1
        const current = idx >= 0 ? publicPrograms[idx] : null
        const goTo = (i) => setSelectedPublicId(publicPrograms[i].id)
        return (
          <ProgramDetailModal
            program={current}
            isOpen={current !== null}
            onClose={() => setSelectedPublicId(null)}
            onPrev={idx > 0 ? () => goTo(idx - 1) : undefined}
            onNext={idx >= 0 && idx < publicPrograms.length - 1 ? () => goTo(idx + 1) : undefined}
          />
        )
      })()}

      {/* 임시저장 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={draftToDelete != null}
        onClose={() => setDraftToDelete(null)}
        onConfirm={() => deleteDraftMutation.mutate(draftToDelete.id)}
        title="임시저장 프로그램을 삭제할까요?"
        message={draftToDelete ? `"${draftToDelete.name}" 임시저장을 삭제해요. 되돌릴 수 없어요.` : ''}
        confirmLabel="삭제"
        danger
        busy={deleteDraftMutation.isPending}
      />
    </div>
  )
}

export default ProgramListPage
