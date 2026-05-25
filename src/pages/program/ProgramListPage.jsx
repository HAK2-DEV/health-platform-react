import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { Plus, Activity, Trash2, ChevronRight } from 'lucide-react'
import { formatKoreanDate, isUpcomingByStartDate } from '../../lib/formatters'
import ProgramDetailModal from '../../components/program/ProgramDetailModal'
import DeleteProgramConfirmModal from '../../components/program/DeleteProgramConfirmModal'
import {
  queryKeys,
  fetchMyPrograms,
  fetchActivePrograms,
  fetchPublicPrograms,
} from '../../lib/queries'

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
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl text-gray-800 mb-6">📋 프로그램</h1>

      {/* CTA — 프로그램 생성하기 (Dashboard 와 동일 패턴, 높이 살짝 줄임) */}
      <Link
        to="/programs/new"
        className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2.5 rounded-2xl shadow-md shadow-emerald-200/40 mb-8 transition"
      >
        <Plus className="w-5 h-5" />
        프로그램 생성하기
      </Link>

      {/* 내 프로그램 — 3개 + 전체보기 + framer */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg text-gray-800">
            <Activity className="w-5 h-5 text-green-500" />
            내 프로그램 <span className="text-sm text-gray-500">({myPrograms.length})</span>
          </h2>
          {myPrograms.length > 2 && (
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

        {isMyLoading ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">불러오는 중...</div>
        ) : myPrograms.length === 0 ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">
            아직 만든 프로그램이 없어요
          </div>
        ) : (
          <motion.div layout className="grid gap-3">
            <AnimatePresence initial={false}>
              {(showAllMy ? myPrograms : myPrograms.slice(0, 2)).map(program => {
                const isDraft = program.status === 'DRAFT'
                const isUpcoming = !isDraft && isUpcomingByStartDate(program.start_date)
                const statusLabel = isDraft ? '임시저장' : isUpcoming ? '예정' : '진행중'
                const statusClass = (isDraft || isUpcoming)
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-green-100 text-green-700'
                return (
                  <motion.div
                    key={program.id}
                    layout
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
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-800">{program.name}</h3>
                      <div className="flex items-center gap-2">
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
                    {program.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{program.description}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
                    </p>
                    {isDraft && (
                      <p className="text-[11px] text-emerald-600 mt-1.5">
                        ✏️ 클릭하면 이어서 작성할 수 있어요
                      </p>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* 참여 중인 프로그램 — 3개 + 전체보기 토글 + framer 애니메이션 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg text-gray-800">
            🎯 참여 중인 프로그램 <span className="text-sm text-gray-500">({activePrograms.length})</span>
          </h2>
          {activePrograms.length > 2 && (
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
          <div className="bg-gray-50/60 p-8 rounded-2xl text-center text-gray-500 text-sm">불러오는 중...</div>
        ) : activePrograms.length === 0 ? (
          <div className="bg-gray-50/60 p-8 rounded-2xl text-center text-gray-500 text-sm">
            아직 참여한 프로그램이 없어요
          </div>
        ) : (
          <motion.div layout className="grid gap-3">
            <AnimatePresence initial={false}>
              {(showAllActive ? activePrograms : activePrograms.slice(0, 2)).map(program => (
                <motion.div
                  key={program.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  onClick={() => navigate(`/programs/${program.id}`)}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                >
                  <h3 className="font-medium text-gray-800 mb-2">{program.name}</h3>
                  {program.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{program.description}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* 공개 둘러보기 — 3개 + 전체보기 토글 + framer 애니메이션 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg text-gray-800">
            🔍 공개 프로그램 둘러보기 <span className="text-sm text-gray-500">({publicPrograms.length})</span>
          </h2>
          {publicPrograms.length > 2 && (
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
          <div className="bg-gray-50/60 p-8 rounded-2xl text-center text-gray-500 text-sm">불러오는 중...</div>
        ) : publicPrograms.length === 0 ? (
          <div className="bg-gray-50/60 p-8 rounded-2xl text-center text-gray-500 text-sm">
            아직 둘러볼 공개 프로그램이 없어요
          </div>
        ) : (
          <motion.div layout className="grid gap-3">
            <AnimatePresence initial={false}>
              {(showAllPublic ? publicPrograms : publicPrograms.slice(0, 2)).map(program => (
                <motion.div
                  key={program.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  onClick={() => setSelectedProgram(program)}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                >
                  <h3 className="font-medium text-gray-800 mb-2">{program.name}</h3>
                  {program.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{program.description}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
                  </p>
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
