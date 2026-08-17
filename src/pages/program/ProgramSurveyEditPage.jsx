import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram, fetchProgramSurveyResults } from '../../lib/queries'
import LoadingState from '../../components/common/LoadingState'
import StickyBackBar from '../../components/common/StickyBackBar'
import SurveyEditor from '../../components/program/SurveyEditor'

// 운영자 — 설문 문항 편집 페이지. 라우트: /programs/:id/survey/edit  (?phase=end → 종료 문구)
function ProgramSurveyEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const location = useLocation()
  const phase = sp.get('phase') === 'end' ? 'end' : 'start'
  // 운영자 메뉴(설문 설정)에서 진입했으면 뒤로가기 = 그 메뉴 시트로 복귀
  const backOp = location.state?.backToOpMenu
  const goBack = backOp ? () => navigate(`/programs/${id}?opmenu=${backOp}`, { replace: true }) : undefined
  const { session } = useAuth()
  const userId = session?.user?.id

  const { data: program, isLoading } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })
  const isOwner = program?.owner_id === userId

  const { data: responses = [] } = useQuery({
    queryKey: ['survey-results', id, phase],
    queryFn: () => fetchProgramSurveyResults({ programId: id, phase }),
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
      <StickyBackBar onClick={goBack} fallbackPath={backOp ? `/programs/${id}?opmenu=${backOp}` : `/programs/${id}/stats/survey`} title={backOp === 'survey' ? '설문 설정으로' : '설문 결과로'} breadcrumb={backOp === 'survey' ? [program.name, '설문 설정', phase === 'end' ? '종료 문항 편집' : '시작 문항 편집'] : [program.name, phase === 'end' ? '종료 문항 편집' : '시작 문항 편집']} />

      <h1 className="text-lg font-extrabold text-gray-900 mb-1">{phase === 'end' ? '종료 설문 문항 편집' : '시작 설문 문항 편집'}</h1>
      <p className="text-[12px] text-gray-500 mb-3">참가자에게 물을 문항이에요. (단답 / 척도 1~5)</p>

      <SurveyEditor program={program} responseCount={responses.length} phase={phase} onDone={goBack || (() => navigate(-1))} />
    </div>
  )
}

export default ProgramSurveyEditPage
