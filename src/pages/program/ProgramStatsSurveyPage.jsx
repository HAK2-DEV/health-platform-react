import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Pencil } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { queryKeys, fetchProgram, fetchProgramSurveyResults } from '../../lib/queries'
import { getProgramSurvey } from '../../lib/surveyDefaults'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import StickyBackBar from '../../components/common/StickyBackBar'
import SurveyResults from '../../components/program/SurveyResults'

// 운영자 — 사전(시작) 설문 결과. 라우트: /programs/:id/stats/survey
function ProgramStatsSurveyPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id

  const { data: program, isLoading: isProgramLoading } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })
  const isOwner = program?.owner_id === userId

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['survey-results', id, 'start'],
    queryFn: () => fetchProgramSurveyResults({ programId: id, phase: 'start' }),
    enabled: !!session && !!id && isOwner,
  })
  const { data: partCount = 0 } = useQuery({
    queryKey: ['active-part-count', id],
    queryFn: async () => {
      const { count } = await supabase.from('program_participants').select('id', { count: 'exact', head: true }).eq('program_id', id).eq('status', 'ACTIVE')
      return count || 0
    },
    enabled: !!session && !!id && isOwner,
  })

  if (isProgramLoading) return <LoadingState variant="page" />
  if (!program) return <div className="p-6 max-w-4xl mx-auto"><p className="p-4 bg-red-100 text-red-700 rounded">프로그램을 찾을 수 없습니다</p></div>
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <button type="button" onClick={() => navigate(`/programs/${id}`)} className="flex items-center justify-center w-9 h-9 -ml-1 mb-2 rounded-full hover:bg-gray-100 transition"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">운영자만 볼 수 있어요</p>
      </div>
    )
  }

  const questions = getProgramSurvey(program)
  const rate = partCount > 0 ? Math.round((responses.length / partCount) * 100) : null

  return (
    <div className="px-4 pt-2 pb-8 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats`} title="통계로" breadcrumb={[program.name, '통계', '사전 설문 결과']} />

      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-extrabold text-gray-900">사전 설문 결과</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">
            {responses.length}명 응답{rate != null ? ` · 참여 ${partCount}명 중 ${rate}%` : ''}
          </p>
        </div>
        <button type="button" onClick={() => navigate(`/programs/${id}/survey/edit`)}
          className="flex-shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-full bg-gray-100 text-gray-600 text-[13px] font-semibold hover:bg-gray-200 transition">
          <Pencil className="w-3.5 h-3.5" /> 문항 편집
        </button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : responses.length === 0 ? (
        <EmptyState icon="📋" title="아직 응답이 없어요" description="참가자가 시작 설문에 답하면 여기에 모여요." />
      ) : (
        <SurveyResults questions={questions} responses={responses} />
      )}
    </div>
  )
}

export default ProgramStatsSurveyPage
