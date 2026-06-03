import { useState, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { Plus, Activity, Trash2, ChevronRight, Search, X } from 'lucide-react'
import { formatKoreanDate, isUpcomingByStartDate } from '../../lib/formatters'
import ProgramDetailModal from '../../components/program/ProgramDetailModal'
import DeleteProgramConfirmModal from '../../components/program/DeleteProgramConfirmModal'
import {
  queryKeys,
  fetchMyPrograms,
  fetchActivePrograms,
  fetchPublicPrograms,
} from '../../lib/queries'
import EmptyState from '../../components/common/EmptyState'
import LoadingState from '../../components/common/LoadingState'
import ProgramCover from '../../components/common/ProgramCover'
import PageHeader from '../../components/common/PageHeader'
import { CATEGORY_COLORS, calcProgress } from '../../lib/programVisuals'

// 📋 프로그램 탭 — 3섹션 전체 표시
// 본인 [feedback_state_consistency] — 대시보드 "내 프로그램" 과 동일 동작 + 동일 캐시
function ProgramListPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const [selectedProgram, setSelectedProgram] = useState(null)
  const [programToDelete, setProgramToDelete] = useState(null)
  // 섹션별 전체보기 토글 (3개 이상 시 활성)
  const [showAllMy, setShowAllMy] = useState(false)
  const [showAllActive, setShowAllActive] = useState(false)
  const [showAllPublic, setShowAllPublic] = useState(false)
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
  const displayedPublic = isSearching ? filteredPublic : (showAllPublic ? filteredPublic : filteredPublic.slice(0, 2))

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
    <div className="p-4 max-w-4xl mx-auto">
      {/* 페이지 타이틀 — 공통 PageHeader */}
      <PageHeader>📋 프로그램</PageHeader>

      {/* 검색바 — 3섹션 모두 클라이언트 측 필터 */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="프로그램 이름이나 설명 검색..."
          className="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-emerald-400 transition"
        />
        {isSearching && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition"
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

      {/* 참여 중인 프로그램 — 파스텔 sky/emerald 박스로 감싸 시각 구분.
          본인 결정 (Day 58): 메인 사용 흐름이 "참여 중"이므로 최상단으로 이동. */}
      <section ref={activeRef} className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-sky-50 via-cyan-50/60 to-emerald-50/40 border border-sky-100/50 scroll-mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            🎯 참여 중인 프로그램 <span className="text-sm text-gray-500">({filteredActive.length})</span>
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
            /* 컴팩트 빈 상태 — Day 65 본인 결정: 가로 배치로 박스 높이 절감 */
            <div className="bg-white/60 rounded-xl px-4 py-3 flex items-center gap-3">
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
                // Dashboard 참여중 카드와 동일 룩 — 카테고리 파스텔 배경 + 진행률 바
                const catKey = program.categories?.[0] || 'ETC'
                const colors = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.ETC
                const progress = calcProgress(program.start_date, program.end_date)
                return (
                  <motion.div
                    key={program.id}
                    onClick={() => navigate(`/programs/${program.id}`)}
                    className={`${colors.bg} ${colors.border} border rounded-2xl p-3 hover:shadow-md transition cursor-pointer flex items-center gap-3`}
                  >
                    <ProgramCover
                      imagePath={program.cover_image_path}
                      categories={program.categories}
                      name={program.name}
                      variant="thumb"
                      className="w-16 h-16 rounded-2xl"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 truncate">{program.name}</h3>
                      {program.description && program.description.trim() !== program.name?.trim() && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{program.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 bg-white/80 rounded-full overflow-hidden">
                          <div
                            className={`${colors.accent} h-full rounded-full transition-all`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 font-medium flex-shrink-0">{progress}%</span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* 공개 둘러보기 — 파스텔 violet/pink 박스로 감싸 시각 구분 */}
      <section ref={publicRef} className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-violet-100/70 via-purple-50/80 to-pink-100/50 border border-violet-200/50 scroll-mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            🔍 둘러보기 <span className="text-sm text-gray-500">({filteredPublic.length})</span>
          </h2>
          {!isSearching && publicPrograms.length > 2 && (
            <button
              type="button"
              onClick={() => { setShowAllPublic(!showAllPublic); scrollToSection(publicRef) }}
              className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
            >
              {showAllPublic ? '간단히 보기' : `전체보기 (${publicPrograms.length})`}
              {!showAllPublic && <ChevronRight className="w-3 h-3" />}
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
                  onClick={() => setSelectedProgram(program)}
                  className="bg-white border border-gray-200 rounded-2xl p-3 hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex gap-3">
                    <ProgramCover
                      imagePath={program.cover_image_path}
                      categories={program.categories}
                      name={program.name}
                      variant="thumb"
                      className="w-16 h-16"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 mb-1 truncate">{program.name}</h3>
                      {program.description && program.description.trim() !== program.name?.trim() && (
                        <p className="text-xs text-gray-600 mb-1 line-clamp-1">{program.description}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* 내 프로그램 — Day 65 본인 결정: 제일 아래로 이동 (운영자 관점 보조 정보). */}
      <section ref={myRef} className="mb-6 scroll-mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            <Activity className="w-5 h-5 text-emerald-500" />
            내 프로그램 <span className="text-sm text-gray-500">({filteredMy.length})</span>
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
                const statusLabel = isDraft ? '임시저장' : isUpcoming ? '예정' : '진행중'
                const statusClass = (isDraft || isUpcoming)
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-emerald-100 text-emerald-700'
                return (
                  <motion.div
                    key={program.id}
                    onClick={() => {
                      if (isDraft) {
                        navigate(`/programs/new?id=${program.id}`)
                      } else {
                        setSelectedProgram(program)
                      }
                    }}
                    className="bg-white border border-gray-200 rounded-2xl p-3 hover:shadow-md transition cursor-pointer"
                  >
                    <div className="flex gap-3">
                      <ProgramCover
                        imagePath={program.cover_image_path}
                        categories={program.categories}
                        name={program.name}
                        variant="thumb"
                        className="w-16 h-16"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-medium text-gray-800 truncate">{program.name}</h3>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`px-2 py-0.5 rounded text-xs ${statusClass}`}>
                              {statusLabel}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(program)
                              }}
                              disabled={deleteMutation.isPending}
                              className="p-1 text-gray-400 hover:text-red-500 transition disabled:opacity-40"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {program.description && program.description.trim() !== program.name?.trim() && (
                          <p className="text-xs text-gray-600 mb-1 line-clamp-1">{program.description}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
                        </p>
                        {isDraft && (
                          <p className="text-[11px] text-emerald-600 mt-1">
                            ✏️ 클릭하면 이어서 작성할 수 있어요
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
          BottomTabBar 위에 떠 있도록 bottom-20 + z-40 (RankingsPage FAB 와 동일 패턴) */}
      {!isSearching && (
        <Link
          to="/programs/new"
          className="fixed bottom-20 right-4 z-40 inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white rounded-full shadow-lg shadow-emerald-500/40 transition hover:scale-105 active:scale-95"
          title="프로그램 생성하기"
          aria-label="프로그램 생성하기"
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </Link>
      )}

      {/* 프로그램 상세 모달 — 대시보드와 동일 컴포넌트 */}
      <ProgramDetailModal
        program={selectedProgram}
        isOpen={selectedProgram !== null}
        onClose={() => setSelectedProgram(null)}
      />

      {/* PUBLISHED 삭제 — 이름 재입력 확인 (대시보드와 동일) */}
      <DeleteProgramConfirmModal
        program={programToDelete}
        isOpen={programToDelete !== null}
        onClose={() => setProgramToDelete(null)}
        onConfirm={handleConfirmDeletePublished}
      />
    </div>
  )
}

export default ProgramListPage
