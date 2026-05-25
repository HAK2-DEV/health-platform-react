import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import WizardLayout from '../../components/program/ProgramWizard/WizardLayout'
import Step1Basic from '../../components/program/ProgramWizard/Step1Basic'
import Step2Type from '../../components/program/ProgramWizard/Step2Type'
import Step3JoinConditions from '../../components/program/ProgramWizard/Step3JoinConditions'
import Step4Summary from '../../components/program/ProgramWizard/Step4Summary'


function ProgramNewPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get('id') // DRAFT 재진입 — 있으면 그 프로그램 로드 후 마법사 진행

  const [currentStep, setCurrentStep] = useState(1)
  const [programId, setProgramId] = useState(null)
  const [programData, setProgramData] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingDraft, setIsLoadingDraft] = useState(!!draftId)
  const [error, setError] = useState(null)

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
    if (result) navigate('/dashboard')
  }

  const handlePrev = () => {
    setCurrentStep(currentStep - 1)
  }

  if (isLoadingDraft) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center text-gray-500">
        임시저장 불러오는 중...
      </div>
    )
  }

  return (
    <WizardLayout currentStep={currentStep}>
      {error && (
        <p className="p-2 mb-4 bg-red-100 text-red-700 rounded text-sm text-center">
          {error}
        </p>
      )}

      {isSaving && (
        <p className="p-2 mb-4 bg-blue-100 text-blue-700 rounded text-sm text-center">
          저장 중...
        </p>
      )}

      {currentStep === 1 && (
        <Step1Basic
          initialData={programData}
          onNext={handleNext}
          onSave={handleSave}
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
