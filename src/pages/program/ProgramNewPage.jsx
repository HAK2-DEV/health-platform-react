import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import WizardLayout from '../../components/program/ProgramWizard/WizardLayout'
import Step1Basic from '../../components/program/ProgramWizard/Step1Basic'
import Step2Type from '../../components/program/ProgramWizard/Step2Type'
import Step3Features from '../../components/program/ProgramWizard/Step3Features'   // ⭐ 추가
import Step4Scoring from '../../components/program/ProgramWizard/Step4Scoring'   // ⭐ 추가
import Step5Complete from '../../components/program/ProgramWizard/Step5Complete'   // ⭐ 추가


function ProgramNewPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  
  const [currentStep, setCurrentStep] = useState(1)
  const [programId, setProgramId] = useState(null)
  const [programData, setProgramData] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  
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
  
  // 다음 단계
  const handleNext = async (stepData) => {
    const result = await saveProgram(stepData)
    if (result) {
      setCurrentStep(currentStep + 1)
    }
  }
  
  // 임시 저장
  const handleSave = async (stepData) => {
    const result = await saveProgram(stepData)
    if (result) {
      navigate('/dashboard')
    }
  }
  
    // 이전 단계 (저장 없이 이동만)                                ⭐ 추가
  const handlePrev = () => {
    setCurrentStep(currentStep - 1)
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
      
      {currentStep === 2 && (                                  /* ⭐ 진화 */
        <Step2Type 
          initialData={programData}
          onNext={handleNext}
          onSave={handleSave}
          onPrev={handlePrev}
        />
      )}
      
      {currentStep === 3 && (
  <Step3Features 
    initialData={programData}
    onNext={handleNext}
    onSave={handleSave}
    onPrev={handlePrev}
  />
)}

{currentStep === 4 && (
  <Step4Scoring 
    initialData={programData}
    onNext={handleNext}
    onSave={handleSave}
    onPrev={handlePrev}
  />
)}

{currentStep === 5 && (
  <Step5Complete 
    initialData={programData}
    programId={programId}
    onPrev={handlePrev}
  />
)}
    </WizardLayout>
  )
}

export default ProgramNewPage