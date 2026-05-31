import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Trash2, FileText, Clock, Users } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { queryKeys, fetchProgram, fetchProgramQuizzes } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import { formatKoreanDate } from '../../lib/formatters'

// 게시물 관리 — 운영자 전용. 라우트: /programs/:id/posts
//   현재는 퀴즈만. 추후 공지사항 등 다른 게시물 유형 확장 예정.
function PostsManagePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const { data: program, isLoading: isProgramLoading } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })

  const isOwner = program?.owner_id === userId

  const { data: quizzes = [], isLoading: isQuizzesLoading } = useQuery({
    queryKey: queryKeys.programQuizzes(id),
    queryFn: () => fetchProgramQuizzes(id),
    enabled: !!session && !!id && isOwner,
  })

  const deleteMutation = useMutation({
    mutationFn: async (quizId) => {
      const { error } = await supabase.from('quizzes').delete().eq('id', quizId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programQuizzes(id) })
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
    },
    onError: (err) => {
      console.error('퀴즈 삭제 실패:', err)
      alert(`삭제에 실패했어요: ${err.message}`)
    },
  })

  const handleDelete = (quiz) => {
    if (!window.confirm(
      `"${quiz.title}" 퀴즈를 삭제할까요?\n\n⚠️ 참가자 제출/점수도 함께 삭제돼요. 되돌릴 수 없어요.`
    )) return
    deleteMutation.mutate(quiz.id)
  }

  if (isProgramLoading) return <LoadingState variant="page" />

  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}`} title="프로그램으로" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-center">
          운영자만 게시물을 관리할 수 있어요
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}`} title="프로그램으로" />

      {/* 헤더 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
        <p className="text-xs text-gray-500 mb-1">{program.name}</p>
        <h1 className="text-2xl font-medium text-gray-800">📋 게시물 관리</h1>
      </div>

      {/* 퀴즈 생성 — 추후 공지사항 등 다른 유형도 여기에 추가 */}
      <button
        type="button"
        onClick={() => navigate(`/programs/${id}/posts/quiz/new`)}
        className="w-full mb-6 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-2xl shadow-md shadow-emerald-200/40 transition"
      >
        <Plus className="w-5 h-5" />
        퀴즈 만들기
      </button>

      {/* 퀴즈 목록 */}
      <h2 className="text-lg font-medium text-gray-800 mb-3 flex items-center gap-2">
        📝 퀴즈 <span className="text-sm text-gray-500">({quizzes.length})</span>
      </h2>

      {isQuizzesLoading ? (
        <LoadingState />
      ) : quizzes.length === 0 ? (
        <EmptyState icon="📝" title="아직 만든 퀴즈가 없어요" description="위의 '퀴즈 만들기'로 시작해보세요" />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid gap-3"
        >
          {quizzes.map(quiz => {
            const now = new Date()
            const isNotStarted = quiz.start_at && new Date(quiz.start_at) > now
            const isExpired = quiz.due_at && new Date(quiz.due_at) < now
            return (
              <div
                key={quiz.id}
                onClick={() => navigate(`/programs/${id}/posts/quiz/${quiz.id}`)}
                className="bg-white border border-gray-200 rounded-2xl p-4 hover:bg-gray-50 hover:border-emerald-300 transition cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-gray-800 flex-1 min-w-0">{quiz.title}</h3>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(quiz) }}
                    disabled={deleteMutation.isPending}
                    className="p-1 text-gray-400 hover:text-red-500 transition disabled:opacity-40 flex-shrink-0"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    문제 {quiz.questionCount}개
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    제출 {quiz.submissionCount}명
                  </span>
                  {(quiz.start_at || quiz.due_at) && (
                    <span className={`inline-flex items-center gap-1 ${isExpired ? 'text-red-500' : isNotStarted ? 'text-amber-600' : ''}`}>
                      <Clock className="w-3.5 h-3.5" />
                      {isExpired
                        ? '마감'
                        : isNotStarted
                          ? `${formatKoreanDate(quiz.start_at)} 시작`
                          : quiz.due_at ? `~ ${formatKoreanDate(quiz.due_at)}` : '기한 없음'}
                    </span>
                  )}
                  {quiz.reveal_answers && (
                    <span className="text-emerald-600">정답 공개</span>
                  )}
                </div>
              </div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

export default PostsManagePage
