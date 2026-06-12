import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { supabase } from '../../supabaseClient'
import { Image as ImageIcon, BarChart3, MessageSquare, ChevronDown, ChevronUp, ChevronLeft, Plus, X } from 'lucide-react'
import { SCHEDULE_MODES, WEEKDAY_OPTIONS } from '../../lib/constants'

// 운영자가 자기 프로그램에 미션을 직접 추가/수정 (본인 (가) 진화)
// 인증 유형 3가지: 사진(requires_image) / 기록(requires_numeric) / 소감(requires_note)
//   다중 선택 가능 (최소 1개)
// 운영자 직접 생성 미션은 feature=NULL (017 자동 생성과 구분)
//
// editMission prop 있으면 수정 모드 (UPDATE), 없으면 생성 모드 (INSERT)
// onBack: 라이브러리에서 「직접 만들기」로 진입한 경우 — 라이브러리로 돌아가기 (생성 모드만)
function MissionCreateModal({ program, isOpen, onClose, onSuccess, editMission, onBack }) {
  const isEditMode = !!editMission

  const [title, setTitle] = useState('')
  const [instruction, setInstruction] = useState('')
  const [dailyLimit, setDailyLimit] = useState('')
  const [verificationType, setVerificationType] = useState('AUTO')
  const [requiresImage, setRequiresImage] = useState(true)
  const [requiresNumeric, setRequiresNumeric] = useState(false)
  const [requiresNote, setRequiresNote] = useState(false)
  // 입력별 점수 + 필수/선택 (084) — 대표 point 는 합계로 파생
  const [imagePoint, setImagePoint] = useState(10)
  const [numericPoint, setNumericPoint] = useState(10)
  const [notePoint, setNotePoint] = useState(5)
  const [imageRequired, setImageRequired] = useState(true)
  const [numericRequired, setNumericRequired] = useState(true)
  const [noteRequired, setNoteRequired] = useState(true)

  // 일정 옵션 (032 마이그레이션 — 미션 단위 schedule_mode/active_days/excluded_periods)
  //   대부분 미션은 매일+제외없음이라 디폴트 접힘 (UI 단순화)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleMode, setScheduleMode] = useState('ALL_DAYS')
  const [activeDays, setActiveDays] = useState([])
  const [excludedPeriods, setExcludedPeriods] = useState([])

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  // 모달 닫힘 시 reset / 열림 시 editMission 으로 prefill
  useEffect(() => {
    if (!isOpen) {
      setTitle('')
      setInstruction('')
      setDailyLimit('')
      setVerificationType('AUTO')
      setRequiresImage(true)
      setRequiresNumeric(false)
      setRequiresNote(false)
      setImagePoint(10)
      setNumericPoint(10)
      setNotePoint(5)
      setImageRequired(true)
      setNumericRequired(true)
      setNoteRequired(true)
      setShowSchedule(false)
      setScheduleMode('ALL_DAYS')
      setActiveDays([])
      setExcludedPeriods([])
      setError(null)
      setIsSaving(false)
      return
    }
    // 열림 + 수정 모드 → 기존 값으로 prefill
    if (editMission) {
      setTitle(editMission.title || '')
      setInstruction(editMission.instruction || '')
      setDailyLimit(editMission.daily_limit ?? '')
      setVerificationType(editMission.verification_type || 'AUTO')
      setRequiresImage(!!editMission.requires_image)
      setRequiresNumeric(!!editMission.requires_numeric)
      setRequiresNote(!!editMission.requires_note)
      // 입력별 점수/필수 — per-input 값 있으면 그대로, 없으면(legacy) 첫 선택 타입에 point 배치(합계 보존)
      const _legacy = editMission.image_point == null && editMission.numeric_point == null && editMission.note_point == null
      const _p = editMission.point ?? 10
      const _first = editMission.requires_image ? 'image' : editMission.requires_numeric ? 'numeric' : 'note'
      setImagePoint(!_legacy ? (editMission.image_point ?? 10) : (editMission.requires_image ? (_first === 'image' ? _p : 0) : 10))
      setNumericPoint(!_legacy ? (editMission.numeric_point ?? 10) : (editMission.requires_numeric ? (_first === 'numeric' ? _p : 0) : 10))
      setNotePoint(!_legacy ? (editMission.note_point ?? 5) : (editMission.requires_note ? (_first === 'note' ? _p : 0) : 5))
      setImageRequired(editMission.image_required ?? true)
      setNumericRequired(editMission.numeric_required ?? true)
      setNoteRequired(editMission.note_required ?? true)
      const hasSchedule =
        (editMission.schedule_mode && editMission.schedule_mode !== 'ALL_DAYS') ||
        (editMission.excluded_periods && editMission.excluded_periods.length > 0)
      setShowSchedule(hasSchedule)
      setScheduleMode(editMission.schedule_mode || 'ALL_DAYS')
      setActiveDays(editMission.active_days || [])
      setExcludedPeriods(editMission.excluded_periods || [])
    }
  }, [isOpen, editMission])

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

  // 입력별 점수 합계 (대표 점수 = 최대치 — 다 제출했을 때)
  const pointFor = (on, val) => (on ? (parseInt(val) || 0) : 0)
  const totalPoint =
    pointFor(requiresImage, imagePoint) +
    pointFor(requiresNumeric, numericPoint) +
    pointFor(requiresNote, notePoint)
  const requiredPoint =
    (requiresImage && imageRequired ? (parseInt(imagePoint) || 0) : 0) +
    (requiresNumeric && numericRequired ? (parseInt(numericPoint) || 0) : 0) +
    (requiresNote && noteRequired ? (parseInt(notePoint) || 0) : 0)

  const INPUT_ROWS = [
    { key: 'image', on: requiresImage, label: '사진', Icon: ImageIcon, point: imagePoint, setPoint: setImagePoint, required: imageRequired, setRequired: setImageRequired },
    { key: 'numeric', on: requiresNumeric, label: '기록', Icon: BarChart3, point: numericPoint, setPoint: setNumericPoint, required: numericRequired, setRequired: setNumericRequired },
    { key: 'note', on: requiresNote, label: '소감', Icon: MessageSquare, point: notePoint, setPoint: setNotePoint, required: noteRequired, setRequired: setNoteRequired },
  ]

  const validate = () => {
    if (!title.trim()) return '미션 제목을 입력해주세요'
    if (!requiresImage && !requiresNumeric && !requiresNote) {
      return '인증 유형을 최소 1개 선택해주세요'
    }
    if (totalPoint < 1) return '점수 합계는 1 이상이어야 합니다'
    const anyRequired =
      (requiresImage && imageRequired) ||
      (requiresNumeric && numericRequired) ||
      (requiresNote && noteRequired)
    if (!anyRequired) return '필수 입력을 최소 1개 지정해주세요 (전부 선택일 수 없어요)'
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

    const payload = {
      title: title.trim(),
      instruction: instruction.trim() || null,
      verification_type: verificationType,
      point: totalPoint,
      daily_limit: dailyLimit ? parseInt(dailyLimit) : null,
      requires_image: requiresImage,
      requires_numeric: requiresNumeric,
      requires_note: requiresNote,
      // 084 — 입력별 점수/필수 (미사용 입력은 point NULL → 채점 합산서 제외)
      image_point: requiresImage ? (parseInt(imagePoint) || 0) : null,
      numeric_point: requiresNumeric ? (parseInt(numericPoint) || 0) : null,
      note_point: requiresNote ? (parseInt(notePoint) || 0) : null,
      image_required: requiresImage ? imageRequired : true,
      numeric_required: requiresNumeric ? numericRequired : true,
      note_required: requiresNote ? noteRequired : true,
      // 일정 옵션 — 033 점수 트리거가 KST 기준으로 검사
      schedule_mode: scheduleMode,
      active_days: scheduleMode === 'CUSTOM' ? activeDays : [],
      excluded_periods: excludedPeriods.filter(p => p.start_date && p.end_date),
    }

    let opError = null
    if (isEditMode) {
      // 수정 — 안전 컬럼만 UPDATE (program_id, feature, active_from/until, bundle_title 등은 보존)
      const { error } = await supabase
        .from('missions')
        .update(payload)
        .eq('id', editMission.id)
      opError = error
    } else {
      // 신규 — 모든 컬럼 INSERT
      const { error } = await supabase
        .from('missions')
        .insert({
          ...payload,
          program_id: program.id,
          feature: null,  // 운영자 직접 생성 표식
          active_from: `${program.start_date}T00:00:00+09:00`,
          active_until: `${program.end_date}T23:59:59+09:00`,
        })
      opError = error
    }

    if (opError) {
      console.error(isEditMode ? '미션 수정 실패:' : '미션 생성 실패:', opError)
      setError(opError.message)
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
          {onBack && !isEditMode && (
            <button
              type="button"
              onClick={onBack}
              disabled={isSaving}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              라이브러리로
            </button>
          )}
          <h2 className="text-xl font-semibold text-gray-800 mb-1 pr-8">
            {isEditMode ? '✏️ 미션 수정' : '✨ 미션 추가'}
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

          {/* 입력별 점수 · 필수 (084) */}
          {(requiresImage || requiresNumeric || requiresNote) && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                입력별 점수 · 필수 *
              </label>
              <p className="text-xs text-gray-400 mb-2">
                선택 입력은 제출 시 건너뛸 수 있고, 작성하면 추가 점수예요.
              </p>
              <div className="space-y-2">
                {INPUT_ROWS.filter(r => r.on).map(r => (
                  <div key={r.key} className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 w-14 flex-shrink-0 text-sm font-medium text-gray-700">
                      <r.Icon className="w-4 h-4 text-emerald-600" /> {r.label}
                    </span>
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="number"
                        min={0}
                        value={r.point}
                        onChange={(e) => r.setPoint(e.target.value)}
                        disabled={isSaving}
                        className="w-full pl-2 pr-6 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">P</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {[{ v: true, label: '필수' }, { v: false, label: '선택' }].map(opt => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => r.setRequired(opt.v)}
                          disabled={isSaving}
                          className={`px-2.5 py-1.5 rounded-md border text-xs transition disabled:opacity-50
                            ${r.required === opt.v
                              ? (opt.v
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                                  : 'border-amber-400 bg-amber-50 text-amber-700 font-semibold')
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                최대 <span className="font-bold text-emerald-600">{totalPoint}P</span>
                {requiredPoint !== totalPoint && (
                  <> · 필수만 제출 시 <span className="font-semibold text-gray-700">{requiredPoint}P</span></>
                )}
              </p>
            </div>
          )}

          {/* 하루 최대 */}
          <div className="mb-4">
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

            {/* AUTO 안내 — 검수 없이 즉시 점수. 부적절 인증 우려 시 수동 권장 */}
            {verificationType === 'AUTO' && (
              <>
                {/* 승인 버튼 ↔ 안내 박스 사이 투명 스페이서 (앱 섹션 간격 16px) */}
                <div aria-hidden className="h-4" />
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed">
                  자동 승인은 검수 없이 즉시 점수가 지급돼요. 정확성이 중요하거나 랭킹 경쟁이 있다면
                  「운영자 심사」를 권장해요. (자동 승인이라도 나중에 피드에서 「점수 제외」할 수 있어요.)
                </p>
              </>
            )}
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
              className="flex-[2] px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition disabled:bg-gray-400"
            >
              {isSaving ? '저장 중...' : (isEditMode ? '미션 수정 저장' : '미션 추가')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default MissionCreateModal
