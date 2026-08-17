import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Pencil } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { queryKeys, fetchProgram, fetchProgramSurveyResults, fetchUserDemographics } from '../../lib/queries'
import { getProgramSurvey } from '../../lib/surveyDefaults'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import StickyBackBar from '../../components/common/StickyBackBar'
import SurveyResults from '../../components/program/SurveyResults'
import SurveyChange from '../../components/program/SurveyChange'
import HP2030Report from '../../components/program/HP2030Report'

// 운영자 — 설문 결과(시작·종료·변화). 라우트: /programs/:id/stats/survey
function ProgramStatsSurveyPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id
  const [view, setView] = useState(null)  // null → 데이터 따라 기본값 결정

  const { data: program, isLoading: isProgramLoading } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })
  const isOwner = program?.owner_id === userId

  const { data: startResponses = [], isLoading: isStartLoading } = useQuery({
    queryKey: ['survey-results', id, 'start'],
    queryFn: () => fetchProgramSurveyResults({ programId: id, phase: 'start' }),
    enabled: !!session && !!id && isOwner,
  })
  const { data: endResponses = [], isLoading: isEndLoading } = useQuery({
    queryKey: ['survey-results', id, 'end'],
    queryFn: () => fetchProgramSurveyResults({ programId: id, phase: 'end' }),
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
  // 형평성 분해용 — 응답자 성별·연령대
  const respondentIds = [...new Set([...startResponses, ...endResponses].map((r) => r.user_id))]
  const { data: demographics = {} } = useQuery({
    queryKey: ['survey-demographics', id, respondentIds.length],
    queryFn: () => fetchUserDemographics(respondentIds),
    enabled: !!session && !!id && isOwner && respondentIds.length > 0,
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

  const startQuestions = getProgramSurvey(program, 'start')
  const endQuestions = getProgramSurvey(program, 'end')
  const hasEnd = endResponses.length > 0
  const isLoading = isStartLoading || isEndLoading
  // 기본 뷰: 종료 응답이 있으면 「변화」, 없으면 「시작」
  const effView = view ?? (hasEnd ? 'change' : 'start')
  const shownResponses = effView === 'end' ? endResponses : startResponses
  const shownCount = shownResponses.length
  const rate = partCount > 0 ? Math.round((shownCount / partCount) * 100) : null

  // 탭 — 시작·종료는 항상(사전 편집 위해), 변화·HP2030은 종료 응답이 있을 때만
  const tabs = [{ key: 'start', label: '시작' }, { key: 'end', label: '종료' }, ...(hasEnd ? [{ key: 'change', label: '변화' }, { key: 'hp2030', label: 'HP2030' }] : [])]

  return (
    <div className="px-4 pt-2 pb-8 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats`} title="통계로" breadcrumb={[program.name, '통계', '설문 결과']} />

      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-extrabold text-gray-900">설문 결과</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">
            {(effView === 'change' || effView === 'hp2030')
              ? `시작 ${startResponses.length}명 · 종료 ${endResponses.length}명`
              : `${shownCount}명 응답${rate != null ? ` · 참여 ${partCount}명 중 ${rate}%` : ''}`}
          </p>
        </div>
        {(effView === 'start' || effView === 'end') && (
          <button type="button" onClick={() => navigate(`/programs/${id}/survey/edit${effView === 'end' ? '?phase=end' : ''}`)}
            className="flex-shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-full bg-gray-100 text-gray-600 text-[13px] font-semibold hover:bg-gray-200 transition">
            <Pencil className="w-3.5 h-3.5" /> {effView === 'end' ? '종료 문항 편집' : '문항 편집'}
          </button>
        )}
      </div>

      {/* 시작 / 종료 / 변화 전환 */}
      {tabs.length > 1 && (
        <div className="flex gap-1 p-1 mb-4 rounded-xl bg-gray-100">
          {tabs.map((t) => (
            <button key={t.key} type="button" onClick={() => setView(t.key)}
              className={`flex-1 h-8 rounded-lg text-[13px] font-semibold transition ${effView === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : effView === 'change' ? (
        <SurveyChange startQuestions={startQuestions} endQuestions={endQuestions} startResponses={startResponses} endResponses={endResponses} demographics={demographics} />
      ) : effView === 'hp2030' ? (
        <HP2030Report program={program} startQuestions={startQuestions} endQuestions={endQuestions} startResponses={startResponses} endResponses={endResponses} demographics={demographics} partCount={partCount} />
      ) : shownResponses.length === 0 ? (
        <EmptyState icon="/icons/feature/survey.png" title="아직 응답이 없어요"
          description={effView === 'end' ? '참가자가 종료 설문에 답하면 여기 모여요. 위 「종료 문항 편집」으로 미리 문항을 정할 수 있어요.' : '참가자가 설문에 답하면 여기에 모여요.'} />
      ) : (
        <SurveyResults questions={effView === 'end' ? endQuestions : startQuestions} responses={shownResponses} />
      )}
    </div>
  )
}

export default ProgramStatsSurveyPage
