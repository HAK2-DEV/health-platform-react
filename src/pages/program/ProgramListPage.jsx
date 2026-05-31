import { useState, useMemo } from 'react'
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

      {/* 내 프로그램 — 헤더 + "+ 생성하기" 버튼 + 카드 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-lg font-medium text-gray-800">
            <Activity className="w-5 h-5 text-emerald-500" />
            내 프로그램 <span className="text-sm text-gray-500">({filteredMy.length})</span>
          </h2>
          {!isSearching && myPrograms.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAllMy(!showAllMy)}
              className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
            >
              {showAllMy ? '간단히 보기' : `전체보기 (${myPrograms.length})`}
              {!showAllMy && <ChevronRight className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* 프로그램 생성하기 — 내 프로그램 섹션의 첫 줄. 검색 중에는 숨김 */}
        {!isSearching && (
          <Link
            to="/programs/new"
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium py-2.5 rounded-2xl shadow-md shadow-emerald-200/40 mb-3 transition"
          >
            <Plus className="w-5 h-5" />
            프로그램 생성하기
          </Link>
        )}

        {isMyLoading ? (
          <LoadingState size="sm" />
        ) : myPrograms.length === 0 ? (
          !isSearching && <EmptyState icon="📋" title="아직 만든 프로그램이 없어요" size="sm" />
        ) : displayedMy.length === 0 ? (
          isSearching && <p className="text-xs text-gray-400 text-center py-3">매칭된 내 프로그램이 없어요</p>
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-3">
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
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
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

      {/* 참여 중인 프로그램 — 파스텔 sky/emerald 박스로 감싸 시각 구분 */}
      <section className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-sky-50 via-cyan-50/60 to-emerald-50/40 border border-sky-100/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-lg font-medium text-gray-800">
            🎯 참여 중인 프로그램 <span className="text-sm text-gray-500">({filteredActive.length})</span>
          </h2>
          {!isSearching && activePrograms.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAllActive(!showAllActive)}
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
          !isSearching && <EmptyState icon="🎯" title="아직 참여한 프로그램이 없어요" />
        ) : displayedActive.length === 0 ? (
          isSearching && <p className="text-xs text-gray-400 text-center py-3">매칭된 참여 프로그램이 없어요</p>
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-3">
            <AnimatePresence initial={false}>
              {displayedActive.map(program => (
                <motion.div
                  key={program.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  onClick={() => navigate(`/programs/${program.id}`)}
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

      {/* 공개 둘러보기 — 파스텔 violet/pink 박스로 감싸 시각 구분 */}
      <section className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-violet-100/70 via-purple-50/80 to-pink-100/50 border border-violet-200/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-lg font-medium text-gray-800">
            🔍 둘러보기 <span className="text-sm text-gray-500">({filteredPublic.length})</span>
          </h2>
          {!isSearching && publicPrograms.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAllPublic(!showAllPublic)}
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
          <motion.div layout className="grid grid-cols-1 gap-3">
            <AnimatePresence initial={false}>
              {displayedPublic.map(program => (
                <motion.div
                  key={program.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
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
