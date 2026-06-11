import { useState, useMemo, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { Plus, Activity, Trash2, ChevronRight, Search, X, Users, Calendar, Pencil } from 'lucide-react'
import { formatKoreanDate, isUpcomingByStartDate } from '../../lib/formatters'
import ProgramDetailModal from '../../components/program/ProgramDetailModal'
import ProgramBrowseModal from '../../components/program/ProgramBrowseModal'
import DeleteProgramConfirmModal from '../../components/program/DeleteProgramConfirmModal'
import {
  queryKeys,
  fetchMyPrograms,
  fetchActivePrograms,
  fetchActiveParticipantCounts,
  fetchPublicPrograms,
} from '../../lib/queries'
import EmptyState from '../../components/common/EmptyState'
import LoadingState from '../../components/common/LoadingState'
import ProgramCover from '../../components/common/ProgramCover'
import Badge from '../../components/common/Badge'
import { CATEGORY_COLORS, calcProgress, progressUrgency } from '../../lib/programVisuals'

// 📋 프로그램 탭 — 3섹션 전체 표시
// 본인 [feedback_state_consistency] — 대시보드 "내 프로그램" 과 동일 동작 + 동일 캐시
function ProgramListPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  // selectedSource: { listKey: 'public'|'my', programId } | null.
  // 좌우 스와이프로 prev/next 시 listKey 의 list 안에서 index 이동 (Day 65 본인 요청).
  // selectedProgram 은 list + id 로 derived.
  const [selectedSource, setSelectedSource] = useState(null)
  const [programToDelete, setProgramToDelete] = useState(null)
  const [browseOpen, setBrowseOpen] = useState(false)  // 둘러보기 모달 (카테고리 필터)
  // 섹션별 전체보기 토글 — URL searchParam 으로 동기화 (Day 65 본인 요청).
  // 모달 안에서 navigation 후 뒤로가도 expand 상태 보존.
  // 형식: ?expand=public,my (콤마 구분). 빈 값이면 모두 false.
  const [searchParams, setSearchParams] = useSearchParams()
  const expandSet = (() => {
    const raw = searchParams.get('expand') || ''
    return new Set(raw.split(',').filter(Boolean))
  })()
  const showAllMy = expandSet.has('my')
  const showAllActive = expandSet.has('active')
  const toggleExpand = (key) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      const cur = new Set((next.get('expand') || '').split(',').filter(Boolean))
      if (cur.has(key)) cur.delete(key); else cur.add(key)
      if (cur.size === 0) next.delete('expand')
      else next.set('expand', Array.from(cur).join(','))
      return next
    }, { replace: true })
  }
  const setShowAllMy = () => toggleExpand('my')
  const setShowAllActive = () => toggleExpand('active')
  // 검색 — 3섹션 모두 클라이언트 측 필터링 (name + description 매칭)
  const [searchQuery, setSearchQuery] = useState('')
  const isSearching = searchQuery.trim().length > 0

  // 전체보기 토글 시 해당 섹션을 viewport 상단으로 스크롤 — 새 카드 자연 노출
  const myRef = useRef(null)
  const activeRef = useRef(null)
  const publicRef = useRef(null)
  const scrollToSection = (ref) => {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // ─── React Query — 대시보드와 같은 캐시 키 공유 ──────────
  const { data: myPrograms = [], isLoading: isMyLoading } = useQuery({
    queryKey: queryKeys.myPrograms(userId),
    queryFn: () => fetchMyPrograms(userId),
    enabled: !!userId,
  })

  const { data: activePrograms = [], isLoading: isActiveLoading } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  const { data: publicPrograms = [], isLoading: isPublicLoading } = useQuery({
    queryKey: queryKeys.publicPrograms(userId),
    queryFn: () => fetchPublicPrograms(userId),
    enabled: !!userId,
  })

  // 참여 중 카드의 "N명이 함께 참여 중" 표시용
  const activeProgramIds = activePrograms.map(p => p.id)
  const { data: activeCounts = {} } = useQuery({
    queryKey: queryKeys.activeParticipantCounts(activeProgramIds),
    queryFn: () => fetchActiveParticipantCounts(activeProgramIds),
    enabled: activeProgramIds.length > 0,
  })

  // 검색 필터 — name 또는 description 에 query 포함 (대소문자 무시)
  const filterByQuery = (programs) => {
    if (!isSearching) return programs
    const q = searchQuery.trim().toLowerCase()
    return programs.filter(p =>
      (p.name || '').toLowerCase().includes(q)
      || (p.description || '').toLowerCase().includes(q)
    )
  }

  const filteredMy = useMemo(() => filterByQuery(myPrograms), [myPrograms, searchQuery])
  const filteredActive = useMemo(() => filterByQuery(activePrograms), [activePrograms, searchQuery])
  const filteredPublic = useMemo(() => filterByQuery(publicPrograms), [publicPrograms, searchQuery])

  // 검색 중에는 전체보기 토글 무관 — 매칭된 결과 모두 노출
  const displayedMy = isSearching ? filteredMy : (showAllMy ? filteredMy : filteredMy.slice(0, 2))
  const displayedActive = isSearching ? filteredActive : (showAllActive ? filteredActive : filteredActive.slice(0, 2))
  // 둘러보기 — 미리보기 3개만, 전체는 「전체 둘러보기」 모달(카테고리 필터)에서
  const displayedPublic = isSearching ? filteredPublic : filteredPublic.slice(0, 3)

  // ─── 삭제 — DashboardPage 와 동일 패턴 ────────────────
  const deleteMutation = useMutation({
    mutationFn: async (programId) => {
      const { error } = await supabase
        .from('programs')
        .delete()
        .eq('id', programId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myPrograms(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.activePrograms(userId) })
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
    onError: (err) => {
      console.error('삭제 실패:', err)
      alert('삭제에 실패했습니다')
    },
  })

  const handleDelete = (program) => {
    if (program.status === 'DRAFT') {
      if (!window.confirm(`"${program.name}" 임시저장을 삭제할까요?`)) return
      deleteMutation.mutate(program.id)
    } else {
      setProgramToDelete(program)
    }
  }
  const handleConfirmDeletePublished = async () => {
    if (!programToDelete) return
    await deleteMutation.mutateAsync(programToDelete.id)
    setProgramToDelete(null)
  }

  return (
    <div className="min-h-screen bg-surface-app">
      {/* Day 65 Phase 2 — 헤더 그라데이션 + 마스코트 (참고 사진).
          연한 mint 그라데이션 + 우상단 잎사귀/태양 일러스트. */}
      <div className="relative bg-gradient-to-b from-emerald-100 via-emerald-50/80 to-teal-50/40 pt-6 pb-6 overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 relative">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            프로그램 <span className="text-xl">🌿</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
            나에게 맞는 프로그램을 찾고,<br />꾸준히 건강을 관리해요.
          </p>
        </div>
        {/* 마스코트 일러스트 — 우상단 */}
        <div className="absolute top-4 right-0 pointer-events-none select-none">
          <div className="max-w-4xl mx-auto px-4 relative">
            <div className="absolute right-2 top-0 w-24 h-24 sm:w-28 sm:h-28 opacity-90">
              <span className="absolute inset-0 flex items-center justify-center text-5xl opacity-40">
                🌱
              </span>
              <img
                src="/illustrations/mascot.png"
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 -mt-4 relative space-y-4 pb-6">
        {/* 검색바 — Day 65 Phase 2: 흰색 카드 + 그림자 강화 (참고 사진 톤) */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="프로그램 이름이나 설명 검색..."
            className="w-full pl-10 pr-10 py-3.5 bg-white border border-gray-100 rounded-card text-sm shadow-soft focus:outline-none focus:border-emerald-400 focus:shadow-elevated transition"
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition"
              title="검색 지우기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

      {/* 검색 중일 때 결과 요약 — 모든 섹션 매칭 0개면 안내 */}
      {isSearching && filteredMy.length + filteredActive.length + filteredPublic.length === 0 && (
        <EmptyState
          icon="🔍"
          title="검색 결과가 없어요"
          description={`"${searchQuery.trim()}" 와 일치하는 프로그램이 없어요`}
        />
      )}

      {/* 참여 중인 프로그램 — Day 65 Phase 2: 흰 카드 + Dashboard 와 동일 카드 양식 통일. */}
      <section ref={activeRef} className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-4 scroll-mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            🎯 참여 중인 프로그램 <span className="text-sm font-medium text-gray-400">({filteredActive.length})</span>
          </h2>
          {!isSearching && activePrograms.length > 2 && (
            <button
              type="button"
              onClick={() => { setShowAllActive(!showAllActive); scrollToSection(activeRef) }}
              className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
            >
              {showAllActive ? '간단히 보기' : `전체보기 (${activePrograms.length})`}
              {!showAllActive && <ChevronRight className="w-3 h-3" />}
            </button>
          )}
        </div>

        {isActiveLoading ? (
          <LoadingState />
        ) : activePrograms.length === 0 ? (
          !isSearching && (
            // 컴팩트 빈 상태 — Day 65 본인 결정: 가로 배치로 박스 높이 절감
            <div className="bg-gray-50/60 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="text-2xl opacity-70 leading-none flex-shrink-0">🎯</div>
              <p className="text-sm font-medium text-gray-700 leading-tight flex-1 min-w-0">
                아직 참여한 프로그램이 없어요
              </p>
            </div>
          )
        ) : displayedActive.length === 0 ? (
          isSearching && <p className="text-xs text-gray-400 text-center py-3">매칭된 참여 프로그램이 없어요</p>
        ) : (
          <motion.div className="grid grid-cols-1 gap-3">
            <AnimatePresence initial={false}>
              {displayedActive.map(program => {
                const catKey = program.categories?.[0] || 'ETC'
                const catColors = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.ETC
                const progress = calcProgress(program.start_date, program.end_date)
                const urgency = progressUrgency(progress)
                const isEnded = urgency.urgency === 'ended'
                const colors = isEnded
                  ? { bg: 'bg-gray-100', border: 'border-gray-200', accent: 'bg-gray-400' }
                  : catColors
                const barAccentCls = urgency.barCls || colors.accent
                const catPercentCls = catKey === 'MINDCARE' ? 'text-orange-600'
                  : catKey === 'EMPATHY' ? 'text-pink-600'
                  : catKey === 'SLEEP' ? 'text-purple-600'
                  : catKey === 'NO_SMOKING' ? 'text-yellow-600'
                  : catKey === 'ETC' ? 'text-gray-600'
                  : 'text-emerald-600'
                const percentTextCls = urgency.textCls || catPercentCls
                const countPillCls = catKey === 'MINDCARE' ? 'bg-orange-100/80 text-orange-700'
                  : catKey === 'EMPATHY' ? 'bg-pink-100/80 text-pink-700'
                  : catKey === 'SLEEP' ? 'bg-purple-100/80 text-purple-700'
                  : catKey === 'NO_SMOKING' ? 'bg-yellow-100/80 text-yellow-700'
                  : catKey === 'ETC' ? 'bg-gray-100/80 text-gray-700'
                  : 'bg-emerald-100/80 text-emerald-700'
                return (
                  <motion.div
                    key={program.id}
                    onClick={() => navigate(`/programs/${program.id}`)}
                    className={`${colors.bg} ${colors.border} border rounded-card p-3 shadow-soft hover:shadow-elevated transition cursor-pointer flex items-center gap-3`}
                  >
                    <div className="relative flex-shrink-0">
                      <ProgramCover
                        imagePath={program.cover_image_path}
                        categories={program.categories}
                        name={program.name}
                        variant="thumb"
                        className="w-20 h-20 rounded-card"
                      />
                      <Badge variant={isEnded ? 'ended' : 'progress'} size="sm" className="absolute top-1.5 left-1.5 shadow-sm">
                        {isEnded ? '종료' : '진행중'}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base text-gray-800 truncate">{program.name}</h3>
                      {program.description && program.description.trim() !== program.name?.trim() && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{program.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-2 bg-white/90 rounded-full overflow-hidden">
                          <div
                            className={`${barAccentCls} h-full rounded-full transition-all`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className={`text-base font-bold flex-shrink-0 ${percentTextCls}`}>{progress}%</span>
                      </div>
                      {urgency.label && (
                        <p className={`text-[11px] font-medium mt-1 ${percentTextCls}`}>
                          {urgency.urgency === 'ended' ? '🏁' : urgency.urgency === 'imminent' ? '🔥' : '⏳'} {urgency.label}
                        </p>
                      )}
                      {activeCounts[program.id] != null && (
                        <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-pill text-[11px] font-medium w-fit ${countPillCls}`}>
                          <Users className="w-3 h-3 flex-shrink-0" />
                          <span>{activeCounts[program.id].toLocaleString()}명이 함께 참여 중</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* 공개 둘러보기 — Day 65 Phase 2: 흰 카드 + 큰 이미지 + 추천 뱃지 + 원형 화살표. */}
      <section ref={publicRef} className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-4 scroll-mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            🔍 둘러보기 <span className="text-sm font-medium text-gray-400">({filteredPublic.length})</span>
          </h2>
          {!isSearching && publicPrograms.length > 0 && (
            <button
              type="button"
              onClick={() => setBrowseOpen(true)}
              className="flex items-center gap-0.5 text-xs font-medium text-emerald-600 hover:text-emerald-700"
            >
              전체 둘러보기 ({publicPrograms.length})
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {isPublicLoading ? (
          <LoadingState />
        ) : publicPrograms.length === 0 ? (
          !isSearching && <EmptyState icon="🔍" title="아직 둘러볼 공개 프로그램이 없어요" />
        ) : displayedPublic.length === 0 ? (
          isSearching && <p className="text-xs text-gray-400 text-center py-3">매칭된 둘러보기 프로그램이 없어요</p>
        ) : (
          <motion.div className="grid grid-cols-1 gap-3">
            <AnimatePresence initial={false}>
              {displayedPublic.map(program => (
                <motion.div
                  key={program.id}
                  onClick={() => setSelectedSource({ listKey: 'public', programId: program.id })}
                  className="bg-white border border-gray-100 rounded-card p-3 shadow-soft hover:shadow-elevated transition cursor-pointer flex items-center gap-2.5"
                >
                  {/* 표지 + 추천 뱃지 오버레이 — 날짜 한 줄 확보 위해 w-24 → w-20 축소 */}
                  <div className="relative flex-shrink-0">
                    <ProgramCover
                      imagePath={program.cover_image_path}
                      categories={program.categories}
                      name={program.name}
                      variant="thumb"
                      className="w-20 h-20 rounded-card"
                    />
                    <Badge variant="recommend" size="sm" className="absolute top-1.5 left-1.5">
                      추천
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base text-gray-800 mb-1 truncate">{program.name}</h3>
                    {program.description && program.description.trim() !== program.name?.trim() && (
                      <p className="text-xs text-gray-500 mb-1.5 line-clamp-2 leading-snug">{program.description}</p>
                    )}
                    {/* 날짜 — text-[11px] 로 한 줄에 풀 날짜 노출 */}
                    <p className="text-[11px] text-emerald-600 flex items-center gap-1 whitespace-nowrap">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span>{formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}</span>
                    </p>
                  </div>
                  {/* 원형 화살표 버튼 (장식, 전체 카드 클릭으로 동작) — w-8 로 축소 */}
                  <div className="w-8 h-8 flex-shrink-0 bg-emerald-50 rounded-full flex items-center justify-center">
                    <ChevronRight className="w-4 h-4 text-emerald-600" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* 내 프로그램 — Day 65 Phase 2: 흰 카드 + Dashboard 와 동일 카드 양식 통일. */}
      <section ref={myRef} className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-4 scroll-mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <Activity className="w-5 h-5 text-emerald-500" />
            내 프로그램 <span className="text-sm font-medium text-gray-400">({filteredMy.length})</span>
          </h2>
          {!isSearching && myPrograms.length > 2 && (
            <button
              type="button"
              onClick={() => { setShowAllMy(!showAllMy); scrollToSection(myRef) }}
              className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
            >
              {showAllMy ? '간단히 보기' : `전체보기 (${myPrograms.length})`}
              {!showAllMy && <ChevronRight className="w-3 h-3" />}
            </button>
          )}
        </div>

        {isMyLoading ? (
          <LoadingState size="sm" />
        ) : myPrograms.length === 0 ? (
          !isSearching && <EmptyState icon="📋" title="아직 만든 프로그램이 없어요" size="sm" />
        ) : displayedMy.length === 0 ? (
          isSearching && <p className="text-xs text-gray-400 text-center py-3">매칭된 내 프로그램이 없어요</p>
        ) : (
          <motion.div className="grid grid-cols-1 gap-3">
            <AnimatePresence initial={false}>
              {displayedMy.map(program => {
                const isDraft = program.status === 'DRAFT'
                const isUpcoming = !isDraft && isUpcomingByStartDate(program.start_date)
                const badgeVariant = isDraft ? 'draft' : isUpcoming ? 'upcoming' : 'progress'
                const statusLabel = isDraft ? '임시저장' : isUpcoming ? '예정' : '진행중'
                return (
                  <motion.div
                    key={program.id}
                    onClick={() => {
                      if (isDraft) {
                        navigate(`/programs/new?id=${program.id}`)
                      } else {
                        setSelectedSource({ listKey: 'my', programId: program.id })
                      }
                    }}
                    className="bg-white border border-gray-100 rounded-card p-3 shadow-soft hover:shadow-elevated transition cursor-pointer"
                  >
                    <div className="flex gap-3 items-start">
                      <ProgramCover
                        imagePath={program.cover_image_path}
                        categories={program.categories}
                        name={program.name}
                        variant="thumb"
                        className="w-16 h-16 rounded-xl"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-gray-800 truncate">{program.name}</h3>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Badge variant={badgeVariant} size="sm">{statusLabel}</Badge>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(program)
                              }}
                              disabled={deleteMutation.isPending}
                              className="p-1 text-gray-300 hover:text-red-500 transition disabled:opacity-40"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {program.description && program.description.trim() !== program.name?.trim() && (
                          <p className="text-xs text-gray-500 mb-1 line-clamp-1">{program.description}</p>
                        )}
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 flex-shrink-0 text-gray-400" />
                          <span>{formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}</span>
                        </p>
                        {isDraft && (
                          <p className="text-[11px] text-emerald-600 mt-1.5 flex items-center gap-1">
                            <Pencil className="w-3 h-3 flex-shrink-0" />
                            <span>클릭하면 이어서 작성할 수 있어요</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* FAB — 프로그램 생성하기. 검색 중에는 숨김 (생성 컨텍스트 X).
          BottomTabBar 위에 떠 있도록 bottom-24 + z-40. 본인 피드백 (2026-06-05):
          bottom-20 은 모바일에서 BottomTabBar 와 살짝 겹쳤음 → bottom-24 로 여유. */}
      {!isSearching && (
        <Link
          to="/programs/new"
          className="fixed bottom-24 right-4 z-40 inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white rounded-full shadow-lg shadow-emerald-500/40 transition hover:scale-105 active:scale-95"
          title="프로그램 생성하기"
          aria-label="프로그램 생성하기"
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </Link>
      )}

      {/* 프로그램 상세 모달 — 대시보드와 동일 컴포넌트.
          좌우 스와이프: 선택한 섹션(public/my)의 list 안에서 prev/next 이동.
          findIndex 로 매번 위치 재계산 — list 가 변해도(필터/refetch) 안전. */}
      {(() => {
        const sourceList = selectedSource?.listKey === 'public'
          ? publicPrograms
          : selectedSource?.listKey === 'my'
            ? myPrograms
            : []
        const currentIndex = selectedSource
          ? sourceList.findIndex(p => p.id === selectedSource.programId)
          : -1
        const currentProgram = currentIndex >= 0 ? sourceList[currentIndex] : null
        const goTo = (idx) => setSelectedSource({ listKey: selectedSource.listKey, programId: sourceList[idx].id })
        return (
          <ProgramDetailModal
            program={currentProgram}
            isOpen={currentProgram !== null}
            onClose={() => setSelectedSource(null)}
            onPrev={currentIndex > 0 ? () => goTo(currentIndex - 1) : undefined}
            onNext={currentIndex >= 0 && currentIndex < sourceList.length - 1 ? () => goTo(currentIndex + 1) : undefined}
          />
        )
      })()}

      {/* 둘러보기 모달 — 카테고리 필터 + 정렬. 카드 선택 시 상세 모달로 연결 */}
      <ProgramBrowseModal
        isOpen={browseOpen}
        onClose={() => setBrowseOpen(false)}
        programs={publicPrograms}
        onSelect={(id) => { setBrowseOpen(false); setSelectedSource({ listKey: 'public', programId: id }) }}
      />

      {/* PUBLISHED 삭제 — 이름 재입력 확인 (대시보드와 동일) */}
      <DeleteProgramConfirmModal
        program={programToDelete}
        isOpen={programToDelete !== null}
        onClose={() => setProgramToDelete(null)}
        onConfirm={handleConfirmDeletePublished}
      />
      </div>
    </div>
  )
}

export default ProgramListPage
