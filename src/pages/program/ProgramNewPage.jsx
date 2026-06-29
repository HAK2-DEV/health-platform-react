import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchMyLiveProgramCount, createProgramFromPreset } from '../../lib/queries'
import { MAX_PROGRAMS_BETA } from '../../lib/constants'
import ProgramCreateChooser from '../../components/program/ProgramCreateChooser'
import WizardLayout from '../../components/program/ProgramWizard/WizardLayout'
import WizardIntro from '../../components/program/ProgramWizard/WizardIntro'
import Step1Basic from '../../components/program/ProgramWizard/Step1Basic'
import Step2Type from '../../components/program/ProgramWizard/Step2Type'
import Step3JoinConditions from '../../components/program/ProgramWizard/Step3JoinConditions'
import Step4Summary from '../../components/program/ProgramWizard/Step4Summary'
import LoadingState from '../../components/common/LoadingState'


function ProgramNewPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get('id') // DRAFT 재진입 — 있으면 그 프로그램 로드 후 마법사 진행

  const [currentStep, setCurrentStep] = useState(1)
  const [programId, setProgramId] = useState(null)
  const [programData, setProgramData] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingDraft, setIsLoadingDraft] = useState(!!draftId)
  const [error, setError] = useState(null)
  const [showIntro, setShowIntro] = useState(!draftId)  // 새 생성 진입 인트로 (~1.5초)
  const [showChooser, setShowChooser] = useState(!draftId)  // 마법사 전 「직접 만들기 vs 라이브러리」 선택화면
  const [creatingKey, setCreatingKey] = useState(null)      // 라이브러리 프리셋 생성 중 key
  const [step1AtEnd, setStep1AtEnd] = useState(false)   // 2단계에서 이전 → 1단계 마지막 서브스텝부터
  const [step3AtEnd, setStep3AtEnd] = useState(false)   // 4단계에서 이전 → 3단계 마지막 서브스텝부터

  // 베타 한도 검사 — 새 생성(draftId 없음)일 때만. DRAFT 재진입은 검사 안 함
  //   (이미 만든 임시저장 이어가기 + 게시 시점 트리거가 최종 방어).
  //   어드민(users.role='ADMIN')은 한도 면제 — DB 트리거(081)도 동일하게 면제.
  const isNewCreation = !draftId
  const { data: gate, isLoading: isCountLoading } = useQuery({
    queryKey: ['program-limit-gate', session?.user?.id],
    queryFn: async () => {
      const [count, roleRes] = await Promise.all([
        fetchMyLiveProgramCount(session.user.id),
        supabase.from('users').select('role').eq('id', session.user.id).maybeSingle(),
      ])
      return { count, isAdmin: roleRes.data?.role === 'ADMIN' }
    },
    enabled: !!session && isNewCreation,
    // 진입할 때마다 최신 카운트 — 직전에 프로그램을 삭제했어도 즉시 반영 (stale 차단 방지)
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const atLimit = isNewCreation && !!gate && !gate.isAdmin && gate.count >= MAX_PROGRAMS_BETA

  // 단계 전환 시 페이지 상단으로 자동 스크롤 — App.jsx 의 라우트 변경 스크롤은
  //   같은 /programs/new 안에서 step state 만 바꾸니까 작동 X
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [currentStep])

  // DRAFT 재진입 — programs 로드 후 state 초기화
  useEffect(() => {
    if (!draftId || !session) return
    const loadDraft = async () => {
      setIsLoadingDraft(true)
      setError(null)
      const { data, error: loadErr } = await supabase
        .from('programs')
        .select('*')
        .eq('id', draftId)
        .eq('owner_id', session.user.id)  // 보안 — 본인 프로그램만
        .maybeSingle()
      if (loadErr) {
        console.error('DRAFT 로드 실패:', loadErr)
        setError(loadErr.message)
        setIsLoadingDraft(false)
        return
      }
      if (!data) {
        setError('해당 임시저장을 찾을 수 없어요')
        setIsLoadingDraft(false)
        return
      }
      if (data.status !== 'DRAFT') {
        setError('이미 게시된 프로그램입니다. 임시저장만 마법사로 재진입할 수 있어요')
        setIsLoadingDraft(false)
        return
      }
      setProgramId(data.id)
      setProgramData(data)
      setIsLoadingDraft(false)
    }
    loadDraft()
  }, [draftId, session])

  // 프로그램 INSERT 또는 UPDATE
  const saveProgram = async (stepData) => {
    if (!session) return null

    setIsSaving(true)
    setError(null)

    try {
      // 첫 저장 = INSERT
      if (!programId) {
        const { data, error: insertError } = await supabase
          .from('programs')
          .insert({
            owner_id: session.user.id,
            status: 'DRAFT',
            ...stepData,
          })
          .select()
          .single()

        if (insertError) throw insertError

        setProgramId(data.id)
        setProgramData({ ...programData, ...stepData })
        return data
      }

      // 이후 저장 = UPDATE
      const { data, error: updateError } = await supabase
        .from('programs')
        .update(stepData)
        .eq('id', programId)
        .select()
        .single()

      if (updateError) throw updateError

      setProgramData({ ...programData, ...stepData })
      return data
    } catch (err) {
      console.error('프로그램 저장 실패:', err)
      setError(err.message)
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const handleNext = async (stepData) => {
    const result = await saveProgram(stepData)
    if (result) setCurrentStep(currentStep + 1)
  }

  const handleSave = async (stepData) => {
    const result = await saveProgram(stepData)
    if (result) {
      // myPrograms 캐시 무효화 — 대시보드/프로그램 탭에서 새 DRAFT 즉시 노출
      // (staleTime 5분 정책으로 자동 refetch 안 됨 → 명시적 invalidate 필요)
      queryClient.invalidateQueries({ queryKey: queryKeys.myPrograms(session.user.id) })
      navigate('/dashboard')
    }
  }

  // 라이브러리 프리셋 선택 → DRAFT 프로그램+미션 생성 → 마법사 재진입(?id=)으로 이름·날짜 마무리
  const handlePickPreset = async (presetKey, selectedKeys, durationDays) => {
    if (creatingKey) return
    setCreatingKey(presetKey)
    setError(null)
    try {
      const newId = await createProgramFromPreset({ presetKey, userId: session.user.id, selectedKeys, durationDays })
      queryClient.invalidateQueries({ queryKey: queryKeys.myPrograms(session.user.id) })
      navigate(`/programs/new?id=${newId}`, { replace: true })
    } catch (err) {
      console.error('프리셋 생성 실패:', err)
      setError(err.message || '프로그램을 만들지 못했어요')
      setCreatingKey(null)
    }
  }

  const handlePrev = () => {
    // 다음 단계 → 이전 단계로 돌아갈 땐 그 단계의 마지막 서브스텝부터 보이게
    if (currentStep === 2) setStep1AtEnd(true)
    if (currentStep === 4) setStep3AtEnd(true)
    setCurrentStep(currentStep - 1)
  }

  if (isLoadingDraft) {
    return <LoadingState variant="page" text="임시저장 불러오는 중..." />
  }

  // 새 생성인데 한도 확인 중 — 마법사가 draft 를 만들기 전에 먼저 검사
  if (isNewCreation && isCountLoading) {
    return <LoadingState variant="page" text="확인 중..." />
  }

  // 베타 한도 도달 — 마법사 진입 차단 (draft 생성 전에)
  if (atLimit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="text-5xl mb-4">🌱</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          베타에선 프로그램 {MAX_PROGRAMS_BETA}개까지예요
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-xs">
          지금은 운영자 한 명당 최대 {MAX_PROGRAMS_BETA}개의 프로그램을 운영할 수 있어요.
          새로 만들려면 기존 프로그램을 삭제한 뒤 다시 시도해주세요.
        </p>
        <button
          type="button"
          onClick={() => navigate('/programs')}
          className="px-6 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-medium rounded-xl transition"
        >
          내 프로그램 보기
        </button>
      </div>
    )
  }

  // 생성 방식 선택 — 한도 검사 통과 후, 인트로/마법사 전. 「직접 만들기」 또는 「라이브러리」.
  if (isNewCreation && showChooser) {
    return (
      <ProgramCreateChooser
        onDirect={() => setShowChooser(false)}
        onPickPreset={handlePickPreset}
        onBack={() => navigate(-1)}
        busyKey={creatingKey}
      />
    )
  }

  // 새 생성 진입 인트로 — 한도 검사 통과 후 ~1.5초, 그다음 1단계
  if (isNewCreation && showIntro) {
    return <WizardIntro onDone={() => setShowIntro(false)} />
  }

  return (
    <WizardLayout currentStep={currentStep}>
      {error && (
        <p className="p-2 bg-red-100 text-red-700 rounded-[10px] text-sm text-center" style={{ marginBottom: '9px' }}>
          {error}
        </p>
      )}

      {isSaving && (
        <p className="p-2 bg-blue-100 text-blue-700 rounded-[10px] text-sm text-center" style={{ marginBottom: '9px' }}>
          저장 중...
        </p>
      )}

      {currentStep === 1 && (
        <Step1Basic
          initialData={programData}
          onNext={handleNext}
          onSave={handleSave}
          enterAtEnd={step1AtEnd}
        />
      )}

      {currentStep === 2 && (
        <Step2Type
          initialData={programData}
          onNext={handleNext}
          onSave={handleSave}
          onPrev={handlePrev}
        />
      )}

      {currentStep === 3 && (
        <Step3JoinConditions
          initialData={programData}
          onNext={handleNext}
          onSave={handleSave}
          onPrev={handlePrev}
          enterAtEnd={step3AtEnd}
        />
      )}

      {currentStep === 4 && (
        <Step4Summary
          initialData={programData}
          programId={programId}
          onPrev={handlePrev}
        />
      )}
    </WizardLayout>
  )
}

export default ProgramNewPage
