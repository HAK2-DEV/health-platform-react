import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { supabase } from '../../supabaseClient'
import { Image as ImageIcon, BarChart3, MessageSquare } from 'lucide-react'

// 운영자가 자기 프로그램에 미션을 직접 추가 (본인 (가) 진화)
// 인증 유형 3가지: 사진(requires_image) / 기록(requires_numeric) / 소감(requires_note)
//   다중 선택 가능 (최소 1개)
// 운영자 직접 생성 미션은 feature=NULL (017 자동 생성과 구분)
function MissionCreateModal({ program, isOpen, onClose, onSuccess }) {
  const [title, setTitle] = useState('')
  const [instruction, setInstruction] = useState('')
  const [point, setPoint] = useState(10)
  const [dailyLimit, setDailyLimit] = useState('')
  const [verificationType, setVerificationType] = useState('AUTO')
  const [requiresImage, setRequiresImage] = useState(true)
  const [requiresNumeric, setRequiresNumeric] = useState(false)
  const [requiresNote, setRequiresNote] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  // 모달 닫힘 시 reset
  useEffect(() => {
    if (!isOpen) {
      setTitle('')
      setInstruction('')
      setPoint(10)
      setDailyLimit('')
      setVerificationType('AUTO')
      setRequiresImage(true)
      setRequiresNumeric(false)
      setRequiresNote(false)
      setError(null)
      setIsSaving(false)
    }
  }, [isOpen])

  const validate = () => {
    if (!title.trim()) return '미션 제목을 입력해주세요'
    const p = parseInt(point)
    if (isNaN(p) || p < 1) return '점수는 1 이상이어야 합니다'
    if (!requiresImage && !requiresNumeric && !requiresNote) {
      return '인증 유형을 최소 1개 선택해주세요'
    }
    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }

    setIsSaving(true)
    setError(null)

    const { error: insertError } = await supabase
      .from('missions')
      .insert({
        program_id: program.id,
        feature: null,  // 운영자 직접 생성 표식
        title: title.trim(),
        instruction: instruction.trim() || null,
        verification_type: verificationType,
        point: parseInt(point),
        daily_limit: dailyLimit ? parseInt(dailyLimit) : null,
        requires_image: requiresImage,
        requires_numeric: requiresNumeric,
        requires_note: requiresNote,
        active_from: `${program.start_date}T00:00:00+09:00`,
        active_until: `${program.end_date}T23:59:59+09:00`,
      })

    if (insertError) {
      console.error('미션 생성 실패:', insertError)
      setError(insertError.message)
      setIsSaving(false)
      return
    }

    onSuccess?.()
    onClose()
  }

  // 인증 유형 토글 카드
  const TypeCard = ({ active, onClick, Icon, label }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={isSaving}
      className={`
        flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition disabled:opacity-50
        ${active
          ? 'border-emerald-500 bg-emerald-50'
          : 'border-gray-200 bg-white hover:border-gray-300'}
      `}
    >
      <Icon className={`w-5 h-5 ${active ? 'text-emerald-600' : 'text-gray-400'}`} />
      <span className={`text-xs ${active ? 'text-emerald-700 font-medium' : 'text-gray-600'}`}>
        {label}
      </span>
    </button>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {program && (
        <div className="p-6">
          <h2 className="text-xl font-medium text-gray-800 mb-1 pr-8">
            ✨ 미션 추가
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {program.name}
          </p>

          {/* 제목 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              미션 제목 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
              placeholder="예: 20분 이상 운동하기"
              disabled={isSaving}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
            />
          </div>

          {/* 안내 설명 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              안내 설명 (선택)
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              maxLength={200}
              placeholder="예: 20분 이상 운동하고 시간 기록하기"
              rows={2}
              disabled={isSaving}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50 resize-none"
            />
          </div>

          {/* 인증 유형 — 다중 선택 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              인증 유형 (최소 1개) *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <TypeCard
                active={requiresImage}
                onClick={() => setRequiresImage(!requiresImage)}
                Icon={ImageIcon}
                label="사진"
              />
              <TypeCard
                active={requiresNumeric}
                onClick={() => setRequiresNumeric(!requiresNumeric)}
                Icon={BarChart3}
                label="기록"
              />
              <TypeCard
                active={requiresNote}
                onClick={() => setRequiresNote(!requiresNote)}
                Icon={MessageSquare}
                label="소감"
              />
            </div>
          </div>

          {/* 점수 + 하루 최대 */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                점수 (P) *
              </label>
              <input
                type="number"
                value={point}
                onChange={(e) => setPoint(e.target.value)}
                min={1}
                disabled={isSaving}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                하루 최대 (선택)
              </label>
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                min={1}
                placeholder="무제한"
                disabled={isSaving}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* 승인 방식 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              승인 방식
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVerificationType('AUTO')}
                disabled={isSaving}
                className={`
                  p-2.5 rounded-xl border-2 text-sm transition disabled:opacity-50
                  ${verificationType === 'AUTO'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}
                `}
              >
                자동 승인
              </button>
              <button
                type="button"
                onClick={() => setVerificationType('MANUAL')}
                disabled={isSaving}
                className={`
                  p-2.5 rounded-xl border-2 text-sm transition disabled:opacity-50
                  ${verificationType === 'MANUAL'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}
                `}
              >
                운영자 심사
              </button>
            </div>
          </div>

          {/* 에러 */}
          {error && (
            <p className="mb-3 p-2 bg-red-100 text-red-700 rounded text-sm text-center">
              {error}
            </p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-[2] px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-md transition disabled:bg-gray-400"
            >
              {isSaving ? '저장 중...' : '미션 추가'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default MissionCreateModal
