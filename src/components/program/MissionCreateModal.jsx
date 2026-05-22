import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { supabase } from '../../supabaseClient'
import { Image as ImageIcon, BarChart3, MessageSquare, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { SCHEDULE_MODES, WEEKDAY_OPTIONS } from '../../lib/constants'

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

  // 일정 옵션 (032 마이그레이션 — 미션 단위 schedule_mode/active_days/excluded_periods)
  //   대부분 미션은 매일+제외없음이라 디폴트 접힘 (UI 단순화)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleMode, setScheduleMode] = useState('ALL_DAYS')
  const [activeDays, setActiveDays] = useState([])
  const [excludedPeriods, setExcludedPeriods] = useState([])

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
      setShowSchedule(false)
      setScheduleMode('ALL_DAYS')
      setActiveDays([])
      setExcludedPeriods([])
      setError(null)
      setIsSaving(false)
    }
  }, [isOpen])

  const toggleActiveDay = (num) => {
    setActiveDays(prev =>
      prev.includes(num) ? prev.filter(d => d !== num) : [...prev, num].sort()
    )
  }
  const addExcludedPeriod = () => {
    setExcludedPeriods([...excludedPeriods, { start_date: '', end_date: '', reason: '' }])
  }
  const removeExcludedPeriod = (index) => {
    setExcludedPeriods(excludedPeriods.filter((_, i) => i !== index))
  }
  const updateExcludedPeriod = (index, field, value) => {
    const updated = [...excludedPeriods]
    updated[index] = { ...updated[index], [field]: value }
    setExcludedPeriods(updated)
  }

  const validate = () => {
    if (!title.trim()) return '미션 제목을 입력해주세요'
    const p = parseInt(point)
    if (isNaN(p) || p < 1) return '점수는 1 이상이어야 합니다'
    if (!requiresImage && !requiresNumeric && !requiresNote) {
      return '인증 유형을 최소 1개 선택해주세요'
    }
    if (scheduleMode === 'CUSTOM' && activeDays.length === 0) {
      return '운영 요일을 최소 1일 선택해주세요'
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
        // 일정 옵션 — 033 점수 트리거가 KST 기준으로 검사
        schedule_mode: scheduleMode,
        active_days: scheduleMode === 'CUSTOM' ? activeDays : [],
        excluded_periods: excludedPeriods.filter(p => p.start_date && p.end_date),
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

          {/* 일정 (선택) — 운영 요일 + 제외 기간 */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowSchedule(!showSchedule)}
              disabled={isSaving}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              {showSchedule ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              운영 일정 (선택) — {scheduleMode === 'ALL_DAYS' ? '매일' :
                                   scheduleMode === 'WEEKDAYS' ? '평일만' :
                                   scheduleMode === 'WEEKENDS' ? '주말만' :
                                   '직접 선택'}
              {excludedPeriods.filter(p => p.start_date && p.end_date).length > 0 && (
                <span className="text-xs text-amber-600 ml-1">
                  · 제외 {excludedPeriods.filter(p => p.start_date && p.end_date).length}건
                </span>
              )}
            </button>

            {showSchedule && (
              <div className="mt-3 bg-gray-50 p-3 rounded-md space-y-4">
                {/* 운영 요일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    운영 요일
                  </label>
                  <div className="space-y-1.5">
                    {SCHEDULE_MODES.map(mode => (
                      <label key={mode.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="missionScheduleMode"
                          value={mode.key}
                          checked={scheduleMode === mode.key}
                          onChange={(e) => setScheduleMode(e.target.value)}
                          disabled={isSaving}
                          className="text-emerald-500"
                        />
                        <span className="text-sm text-gray-700">{mode.label}</span>
                      </label>
                    ))}
                  </div>

                  {scheduleMode === 'CUSTOM' && (
                    <div className="flex gap-1 mt-2">
                      {WEEKDAY_OPTIONS.map(day => (
                        <button
                          key={day.num}
                          type="button"
                          onClick={() => toggleActiveDay(day.num)}
                          disabled={isSaving}
                          className={`
                            w-9 h-9 rounded-md text-sm transition disabled:opacity-50
                            ${activeDays.includes(day.num)
                              ? 'bg-emerald-500 text-white'
                              : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}
                          `}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 제외 기간 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      제외 기간 (휴일·휴가 등)
                    </label>
                    <button
                      type="button"
                      onClick={addExcludedPeriod}
                      disabled={isSaving}
                      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                    >
                      <Plus className="w-3 h-3" />
                      추가
                    </button>
                  </div>

                  {excludedPeriods.length === 0 ? (
                    <p className="text-xs text-gray-500 py-1">
                      제외 기간이 없습니다
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {excludedPeriods.map((period, index) => (
                        <div key={index} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                          <input
                            type="date"
                            value={period.start_date}
                            onChange={(e) => updateExcludedPeriod(index, 'start_date', e.target.value)}
                            disabled={isSaving}
                            className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                          />
                          <span className="text-xs text-gray-500">~</span>
                          <input
                            type="date"
                            value={period.end_date}
                            onChange={(e) => updateExcludedPeriod(index, 'end_date', e.target.value)}
                            disabled={isSaving}
                            className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                          />
                          <input
                            type="text"
                            value={period.reason}
                            onChange={(e) => updateExcludedPeriod(index, 'reason', e.target.value)}
                            placeholder="사유"
                            disabled={isSaving}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                          />
                          <button
                            type="button"
                            onClick={() => removeExcludedPeriod(index)}
                            disabled={isSaving}
                            className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
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
