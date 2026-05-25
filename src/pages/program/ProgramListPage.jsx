import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { Plus, Activity, Trash2 } from 'lucide-react'
import { formatKoreanDate } from '../../lib/formatters'
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

      {/* 내 프로그램 — 대시보드와 동일 동작 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg text-gray-800">
            <Activity className="w-5 h-5 text-green-500" />
            내 프로그램 <span className="text-sm text-gray-500">({myPrograms.length})</span>
          </h2>
          <Link
            to="/programs/new"
            className="flex items-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-md transition"
          >
            <Plus className="w-4 h-4" />
            새 프로그램
          </Link>
        </div>

        {isMyLoading ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">불러오는 중...</div>
        ) : myPrograms.length === 0 ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">
            아직 만든 프로그램이 없어요
          </div>
        ) : (
          <div className="grid gap-3">
            {myPrograms.map(program => {
              const isDraft = program.status === 'DRAFT'
              return (
                <div
                  key={program.id}
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
                      <span className={`
                        px-2 py-0.5 rounded text-xs
                        ${isDraft
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-green-100 text-green-700'}
                      `}>
                        {isDraft ? '임시저장' : '진행중'}
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
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 참여 중인 프로그램 */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 text-lg text-gray-800 mb-4">
          🎯 참여 중인 프로그램 <span className="text-sm text-gray-500">({activePrograms.length})</span>
        </h2>

        {isActiveLoading ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">불러오는 중...</div>
        ) : activePrograms.length === 0 ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">
            아직 참여한 프로그램이 없어요
          </div>
        ) : (
          <div className="grid gap-3">
            {activePrograms.map(program => (
              <div
                key={program.id}
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
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 공개 둘러보기 */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 text-lg text-gray-800 mb-4">
          🔍 공개 프로그램 둘러보기 <span className="text-sm text-gray-500">({publicPrograms.length})</span>
        </h2>

        {isPublicLoading ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">불러오는 중...</div>
        ) : publicPrograms.length === 0 ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">
            아직 둘러볼 공개 프로그램이 없어요
          </div>
        ) : (
          <div className="grid gap-3">
            {publicPrograms.map(program => (
              <div
                key={program.id}
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
              </div>
            ))}
          </div>
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
