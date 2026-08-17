import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram, fetchProgramSurveyResults } from '../../lib/queries'
import LoadingState from '../../components/common/LoadingState'
import StickyBackBar from '../../components/common/StickyBackBar'
import SurveyEditor from '../../components/program/SurveyEditor'

// 운영자 — 설문 문항 편집 페이지. 라우트: /programs/:id/survey/edit
function ProgramSurveyEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id

  const { data: program, isLoading } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })
  const isOwner = program?.owner_id === userId

  const { data: responses = [] } = useQuery({
    queryKey: ['survey-results', id, 'start'],
    queryFn: () => fetchProgramSurveyResults({ programId: id, phase: 'start' }),
    enabled: !!session && !!id && isOwner,
  })

  if (isLoading) return <LoadingState variant="page" />
  if (!program) return <div className="p-6"><p className="p-4 bg-red-100 text-red-700 rounded">프로그램을 찾을 수 없습니다</p></div>
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <button type="button" onClick={() => navigate(`/programs/${id}`)} className="flex items-center justify-center w-9 h-9 -ml-1 mb-2 rounded-full hover:bg-gray-100 transition"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">운영자만 편집할 수 있어요</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-8 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats/survey`} title="설문 결과로" breadcrumb={[program.name, '설문 문항 편집']} />

      <h1 className="text-lg font-extrabold text-gray-900 mb-1">설문 문항 편집</h1>
      <p className="text-[12px] text-gray-500 mb-3">시작·종료에 참가자에게 물을 문항이에요. (단답 / 척도 1~5)</p>

      <SurveyEditor program={program} responseCount={responses.length} onDone={() => navigate(-1)} />
    </div>
  )
}

export default ProgramSurveyEditPage
