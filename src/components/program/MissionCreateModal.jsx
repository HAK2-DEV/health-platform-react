import { useState, useEffect, useRef, Fragment } from 'react'
import { supabase } from '../../supabaseClient'
import { Image as ImageIcon, BarChart3, MessageSquare, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, X, Check } from 'lucide-react'
import MissionIconPicker from './MissionIconPicker'
import { SCHEDULE_MODES, WEEKDAY_OPTIONS } from '../../lib/constants'
import { toKSTDateString } from '../../lib/formatters'

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
  const [iconPath, setIconPath] = useState(null)  // 미션 아이콘 (프리셋 경로 | 커스텀 URL | null)
  // 입력별 점수 + 필수/선택 (084) — 대표 point 는 합계로 파생
  const [imagePoint, setImagePoint] = useState(10)
  const [numericPoint, setNumericPoint] = useState(10)
  const [notePoint, setNotePoint] = useState(5)
  const [imageRequired, setImageRequired] = useState(true)
  const [numericRequired, setNumericRequired] = useState(true)
  const [noteRequired, setNoteRequired] = useState(true)
  // 다중 지표 (122) — 거리·시간·칼로리처럼 여러 숫자 항목. metricAggregate = 개요 통계 표시.
  const [metrics, setMetrics] = useState([])  // [{ key, label, unit, max, icon }]
  const [metricAggregate, setMetricAggregate] = useState(false)
  const [metricsEditOpen, setMetricsEditOpen] = useState(false)  // 별도 전체화면 지표 편집기
  const newKey = () => 'k' + Math.random().toString(36).slice(2, 8)
  const MAX_METRICS = 4
  const addMetric = () => setMetrics(m => m.length >= MAX_METRICS ? m : [...m, { key: newKey(), label: '', unit: '', max: '', icon: '' }])
  const updateMetric = (i, field, val) => setMetrics(m => m.map((x, idx) => idx === i ? { ...x, [field]: val } : x))
  const removeMetric = (i) => setMetrics(m => m.filter((_, idx) => idx !== i))

  // 일정 옵션 (032 마이그레이션 — 미션 단위 schedule_mode/active_days/excluded_periods)
  //   대부분 미션은 매일+제외없음이라 디폴트 접힘 (UI 단순화)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleMode, setScheduleMode] = useState('ALL_DAYS')
  const [activeDays, setActiveDays] = useState([])
  const [excludedPeriods, setExcludedPeriods] = useState([])
  const [isMain, setIsMain] = useState(true)  // 달리기 메인/서브(주간 스트릭 색)
  // 예약 미션 — 운영 기간 (시작일 미래 → 예약)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [step, setStep] = useState(1)   // 3단계 마법사 (1.기본 2.인증·점수 3.운영)
  const TOTAL_STEPS = 4
  const STEP_LABELS = ['제목 설정', '아이콘 설정', '인증·점수', '운영']
  const [error, setErrorRaw] = useState(null)
  const [errorTick, setErrorTick] = useState(0)
  const errorRef = useRef(null)
  // 에러 설정 시 tick 증가 → 같은 메시지 재발생에도 스크롤 트리거
  const setError = (msg) => { setErrorRaw(msg); if (msg) setErrorTick(t => t + 1) }
  useEffect(() => {
    if (error && errorRef.current) errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [errorTick, error])

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
      setIconPath(null)
      setImagePoint(10)
      setNumericPoint(10)
      setNotePoint(5)
      setImageRequired(true)
      setNumericRequired(true)
      setNoteRequired(true)
      setMetrics([])
      setMetricAggregate(false)
      setMetricsEditOpen(false)
      setShowSchedule(false)
      setScheduleMode('ALL_DAYS')
      setActiveDays([])
      setExcludedPeriods([])
      setIsMain(true)
      setStartDate(program?.start_date || '')
      setEndDate(program?.end_date || '')
      setError(null)
      setIsSaving(false)
      setStep(1)
      return
    }
    // 열림 + 수정 모드 → 기존 값으로 prefill
    if (editMission) {
      setStep(1)
      setTitle(editMission.title || '')
      setInstruction(editMission.instruction || '')
      setDailyLimit(editMission.daily_limit ?? '')
      setVerificationType(editMission.verification_type || 'AUTO')
      setRequiresImage(!!editMission.requires_image)
      setRequiresNumeric(!!editMission.requires_numeric)
      setRequiresNote(!!editMission.requires_note)
      setIconPath(editMission.icon_path ?? null)
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
      // 다중 지표 — metrics 있으면 그대로, 없으면 레거시 단일(metric_unit) 변환
      const _src = Array.isArray(editMission.metrics) && editMission.metrics.length
        ? editMission.metrics
        : (editMission.metric_unit ? [{ key: 'value', label: '기록', unit: editMission.metric_unit, max: editMission.max_per_entry, icon: '' }] : [])
      setMetrics(_src.map(m => ({ ...m, key: m.key || newKey(), label: m.label || '', unit: m.unit || '', max: m.max ?? '', icon: m.icon || '' })))
      setMetricAggregate(!!editMission.metric_aggregate)
      const hasSchedule =
        (editMission.schedule_mode && editMission.schedule_mode !== 'ALL_DAYS') ||
        (editMission.excluded_periods && editMission.excluded_periods.length > 0)
      setShowSchedule(hasSchedule)
      setScheduleMode(editMission.schedule_mode || 'ALL_DAYS')
      setActiveDays(editMission.active_days || [])
      setExcludedPeriods(editMission.excluded_periods || [])
      setIsMain(editMission.is_main !== false)
      setStartDate(editMission.active_from ? toKSTDateString(editMission.active_from) : (program?.start_date || ''))
      setEndDate(editMission.active_until ? toKSTDateString(editMission.active_until) : (program?.end_date || ''))
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

  // 단계별 검증
  const validateStep1 = () => {
    if (!title.trim()) return '미션 제목을 입력해주세요'
    return null
  }
  const validateStep2 = () => {
    if (!requiresImage && !requiresNumeric && !requiresNote) return '인증 유형을 최소 1개 선택해주세요'
    if (totalPoint < 1) return '점수 합계는 1 이상이어야 합니다'
    const anyRequired =
      (requiresImage && imageRequired) || (requiresNumeric && numericRequired) || (requiresNote && noteRequired)
    if (!anyRequired) return '필수 입력을 최소 1개 지정해주세요 (전부 선택일 수 없어요)'
    return null
  }
  const validateStep3 = () => {
    if (scheduleMode === 'CUSTOM' && activeDays.length === 0) return '운영 요일을 최소 1일 선택해주세요'
    if (startDate && endDate && endDate < startDate) return '종료일이 시작일보다 빠를 수 없어요'
    return null
  }

  // 다음/이전 — 현재 단계 검증 통과 시에만 진행
  const goNext = () => {
    // 1=기본(제목) · 2=아이콘(검증 없음) · 3=인증·점수 · 4=운영
    const v = step === 1 ? validateStep1() : step === 3 ? validateStep2() : null
    if (v) { setError(v); return }
    setError(null)
    setStep(s => Math.min(TOTAL_STEPS, s + 1))
  }
  const goPrev = () => { setError(null); setStep(s => Math.max(1, s - 1)) }

  const handleSave = async () => {
    // 전 단계 방어 검증 — 오류 시 해당 단계로 이동
    const e1 = validateStep1(); if (e1) { setStep(1); setError(e1); return }
    const e2 = validateStep2(); if (e2) { setStep(3); setError(e2); return }
    const e3 = validateStep3(); if (e3) { setStep(4); setError(e3); return }

    setIsSaving(true)
    setError(null)

    const payload = {
      title: title.trim(),
      instruction: instruction.trim() || null,
      icon_path: iconPath || null,
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
      // 다중 지표 (122) — 숫자 입력 미션만. 라벨·단위 있는 것만 저장.
      metrics: requiresNumeric
        ? metrics
            .filter(m => (m.label || '').trim() || (m.unit || '').trim())
            .map(m => ({
              ...m,  // sumUnit/sumDivide 등 프리셋 추가 필드 보존
              key: m.key || newKey(),
              label: (m.label || '').trim(),
              unit: (m.unit || '').trim(),
              max: m.max !== '' && m.max != null ? Number(m.max) : null,
              icon: (m.icon || '').trim() || null,
            }))
        : [],
      metric_aggregate: requiresNumeric ? metricAggregate : false,
      metric_unit: null,   // 레거시 — 다중 지표로 대체
      max_per_entry: null, // 레거시 — 지표별 max 로 대체
      // 일정 옵션 — 033 점수 트리거가 KST 기준으로 검사
      schedule_mode: scheduleMode,
      active_days: scheduleMode === 'CUSTOM' ? activeDays : [],
      excluded_periods: excludedPeriods.filter(p => p.start_date && p.end_date),
      is_main: isMain,   // 메인/서브(달리기 주간 스트릭 색)
      // 예약 미션 운영 기간 — 생성·수정 모두 반영 (시작 미래 → 예약)
      active_from: `${startDate || program.start_date}T00:00:00+09:00`,
      active_until: `${endDate || program.end_date}T23:59:59+09:00`,
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

  if (!isOpen || !program) return null
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-5" onClick={onClose}>
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto bg-white rounded-2xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          {onBack && !isEditMode && step === 1 && (
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
          <h2 className="text-xl font-semibold text-gray-800 mb-4 pr-8 flex items-baseline gap-2 min-w-0">
            <span className="flex-shrink-0">{isEditMode ? '✏️ 미션 수정' : '✨ 미션 추가'}</span>
            <span className="text-sm font-normal text-gray-400 truncate min-w-0">{program.name}</span>
          </h2>

          {/* 스텝 인디케이터 */}
          <div className="flex items-center mb-5">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1
              const active = step === n
              const done = step > n
              return (
                <Fragment key={n}>
                  {i > 0 && <div className={`flex-1 h-0.5 mt-[14px] mx-1 rounded-full ${step >= n ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold ${done || active ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {done ? <Check className="w-4 h-4" /> : n}
                    </div>
                    <span className={`mt-1 text-[10px] font-medium text-center leading-tight w-12 ${active ? 'text-emerald-600' : 'text-gray-400'}`}>{label}</span>
                  </div>
                </Fragment>
              )
            })}
          </div>

          {/* ── 1단계: 기본 ── */}
          {step === 1 && (<>
          <p className="text-[12px] text-gray-500 leading-relaxed mb-4 bg-gray-50 rounded-lg p-2.5 break-keep">
            참여자에게 보여줄 미션의 <b className="text-gray-700">이름</b>과 <b className="text-gray-700">안내</b>를 적어요.
            <br />예) “20분 이상 걷기”처럼 행동이 분명한 이름이 좋아요.
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
          </>)}

          {/* ── 2단계: 아이콘 ── */}
          {step === 2 && (<>
          <p className="text-[12px] text-gray-500 leading-relaxed mb-4 bg-gray-50 rounded-lg p-2.5 break-keep">
            미션을 대표할 <b className="text-gray-700">아이콘</b>을 골라요. 목록·인증 화면에서 한눈에 구분돼요.
            <br />직접 업로드하거나 기본 아이콘 중에 고르면 되고, 없어도 괜찮아요.
          </p>
          {/* 미션 아이콘 (선택) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              미션 아이콘 (선택)
            </label>
            <MissionIconPicker
              ownerId={program.owner_id}
              value={iconPath}
              onChange={setIconPath}
              disabled={isSaving}
            />
          </div>
          </>)}

          {/* ── 3단계: 인증·점수 ── */}
          {step === 3 && (<>
          <p className="text-[12px] text-gray-500 leading-relaxed mb-4 bg-gray-50 rounded-lg p-2.5 break-keep">
            참여자가 <b className="text-gray-700">어떻게 인증</b>할지와 <b className="text-gray-700">점수</b>를 정해요.
            복수 선택 가능해요.<br /> <b className="text-gray-700">필수</b>는 꼭 제출해야 점수를 받고,
            <b className="text-gray-700">선택</b>은 안 해도 되지만 하면 추가 점수예요.
          </p>
          {/* 인증 유형 — 다중 선택 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              인증 방법 (최소 1개) *
            </label>
            <p className="text-sm text-gray-400 mb-2 break-keep">
              📷 사진 = 인증샷 <br /> 📊 기록 = 숫자 입력(걸음수·시간 등) <br /> 💬 소감 = 한 줄 글
            </p>
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

          {/* 기록 지표 (122) — 라이브러리(러닝 등)에서 온 미션만 편집 가능. 직접 만들기에선 추가 불가. */}
          {requiresNumeric && metrics.length > 0 && (
            <button type="button" onClick={() => setMetricsEditOpen(true)} disabled={isSaving}
              className="w-full flex items-center gap-2.5 mb-4 p-3 rounded-xl border border-gray-200 bg-gray-50/60 hover:border-emerald-300 transition text-left disabled:opacity-50">
              <span className="text-lg flex-shrink-0">📊</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">기록 지표 {metrics.length}개</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {metrics.map(m => m.label || '(이름 없음)').join(' · ')}{metricAggregate ? ' · 개요 통계 표시' : ''}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </button>
          )}
          </>)}

          {/* ── 4단계: 운영 ── */}
          {step === 4 && (<>
          <p className="text-[12px] text-gray-500 leading-relaxed mb-4 bg-gray-50 rounded-lg p-2.5 break-keep">
            미션을 <b className="text-gray-700">언제·어떻게 운영</b>할지 정해요. <br /> 나중에 언제든 수정할 수 있어요.
          </p>
          {/* 달리기 전용 — 메인/서브 (주간 스트릭 색 구분) */}
          {program?.theme === 'RUNNING' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">메인 미션 · 서브 미션</label>
              <p className="text-[12px] text-gray-500 mb-2.5 break-keep leading-relaxed">
                꼭 해야 할 <b className="text-gray-700">핵심 미션</b>은 메인, 하면 좋은 <b className="text-gray-700">보조·선택 미션</b>은 서브로 정해요.
                프로그램 홈의 <b className="text-gray-700">주간 스트릭(요일 도장)</b>에서 메인은 <b className="text-emerald-600">초록</b>, 서브는 <b className="text-amber-600">앰버</b>로 칠해져 한눈에 구분돼요.
                <br /><span className="text-gray-400">예: 「평일 3km 달리기」 = 메인 · 「주말 함께 달리기」 = 서브</span>
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsMain(true)} disabled={isSaving}
                  className={`flex-1 rounded-lg border-2 py-2.5 px-2 text-center transition ${isMain ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className={`block text-sm font-bold ${isMain ? 'text-emerald-700' : 'text-gray-500'}`}>🟢 메인 미션</span>
                  <span className={`block text-[11px] font-medium mt-0.5 ${isMain ? 'text-emerald-600/80' : 'text-gray-400'}`}>꼭 해야 할 핵심 미션</span>
                </button>
                <button type="button" onClick={() => setIsMain(false)} disabled={isSaving}
                  className={`flex-1 rounded-lg border-2 py-2.5 px-2 text-center transition ${!isMain ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className={`block text-sm font-bold ${!isMain ? 'text-amber-700' : 'text-gray-500'}`}>🟡 서브 미션</span>
                  <span className={`block text-[11px] font-medium mt-0.5 ${!isMain ? 'text-amber-600/80' : 'text-gray-400'}`}>하면 좋은 보조 미션</span>
                </button>
              </div>
            </div>
          )}
          {/* 하루 최대 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              하루 최대 (선택)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative w-28">
                <input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  min={1}
                  placeholder="∞"
                  disabled={isSaving}
                  className="w-full pl-3 pr-7 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50 text-center"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">회</span>
              </div>
              <span className="text-xs text-gray-400">비우면 무제한</span>
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

          {/* 운영 기간 (예약) — 시작일을 미래로 두면 그날부터 활성화 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              운영 기간 <span className="text-xs font-normal text-gray-400">(시작일을 미래로 두면 예약 미션)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                min={program.start_date}
                max={program.end_date}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isSaving}
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
              />
              <span className="text-gray-400 flex-shrink-0">~</span>
              <input
                type="date"
                value={endDate}
                min={startDate || program.start_date}
                max={program.end_date}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isSaving}
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
              />
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
          </>)}

          {/* 에러 */}
          {error && (
            <p ref={errorRef} style={{ marginTop: '-7px', marginBottom: '9px' }} className="p-2 bg-red-100 text-red-700 rounded text-sm text-center">
              {error}
            </p>
          )}

          {/* 버튼 — 이전 / 다음 / 저장 */}
          <div className="flex gap-2">
            {step === 1 ? (
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition disabled:opacity-50"
              >
                취소
              </button>
            ) : (
              <button
                type="button"
                onClick={goPrev}
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition disabled:opacity-50"
              >
                이전
              </button>
            )}
            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={goNext}
                disabled={isSaving}
                className="flex-[2] px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition"
              >
                다음
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-[2] px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition disabled:bg-gray-400"
              >
                {isSaving ? '저장 중...' : (isEditMode ? '미션 수정 저장' : '미션 추가')}
              </button>
            )}
          </div>
      </div>

      {/* 기록 지표 — 별도 전체화면 편집기 (모달 위 오버레이) */}
      {metricsEditOpen && (
        <div className="fixed inset-0 z-[80] bg-white flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <button type="button" onClick={() => setMetricsEditOpen(false)} className="p-1 -ml-1 text-gray-500 hover:text-gray-800" aria-label="뒤로"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-800">📊 기록 지표</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <p className="text-xs text-gray-400">입력받을 숫자 항목이에요. 거리·시간·칼로리처럼 여러 개 추가할 수 있어요.</p>
            {metrics.map((m, i) => (
              <div key={m.key} className="rounded-xl border border-gray-200 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">지표 {i + 1}</span>
                  <button type="button" onClick={() => removeMetric(i)} className="text-gray-300 hover:text-red-500 transition" aria-label="삭제"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex gap-2">
                  <div className="w-16 flex-shrink-0">
                    <label className="block text-[11px] text-gray-400 mb-1">아이콘</label>
                    <input value={m.icon} onChange={(e) => updateMetric(i, 'icon', e.target.value)} maxLength={2} placeholder="🏃"
                      className="w-full px-2 py-2 text-center text-base border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[11px] text-gray-400 mb-1">항목명</label>
                    <input value={m.label} onChange={(e) => updateMetric(i, 'label', e.target.value)} maxLength={5} placeholder="예: 거리"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[11px] text-gray-400 mb-1">단위</label>
                    <input value={m.unit} onChange={(e) => updateMetric(i, 'unit', e.target.value)} maxLength={6} placeholder="km"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[11px] text-gray-400 mb-1">1회 한도</label>
                    <input type="number" min={0} step="any" value={m.max} onChange={(e) => updateMetric(i, 'max', e.target.value)} placeholder="제한 없음"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>
              </div>
            ))}
            {metrics.length < MAX_METRICS ? (
              <button type="button" onClick={addMetric}
                className="w-full flex items-center justify-center gap-1 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-emerald-600 font-semibold text-sm hover:border-emerald-300 transition">
                <Plus className="w-4 h-4" strokeWidth={2.5} /> 지표 추가
              </button>
            ) : (
              <p className="text-center text-[11px] text-gray-400 py-1">지표는 최대 {MAX_METRICS}개까지예요</p>
            )}
            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <input type="checkbox" checked={metricAggregate} onChange={(e) => setMetricAggregate(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
              <span className="text-sm text-gray-700">개요에 통계 표시</span>
            </label>
            <p className="text-[11px] text-gray-400">1회 한도는 부정 입력 대비예요. 초과하면 인증이 거부돼요.</p>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
            <button type="button" onClick={() => setMetricsEditOpen(false)}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition">완료</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MissionCreateModal
