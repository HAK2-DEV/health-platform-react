import { useState, useEffect, useRef, Fragment } from 'react'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import { supabase } from '../../supabaseClient'
import { Image as ImageIcon, BarChart3, MessageSquare, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, X, Check, Info } from 'lucide-react'
import MissionIconPicker from './MissionIconPicker'
import { SCHEDULE_MODES, WEEKDAY_OPTIONS } from '../../lib/constants'
import { toKSTDateString } from '../../lib/formatters'

// ⓘ 클릭 시 라벨/제목 줄 위로 뜨는 툴팁. 부모가 relative(폼 폭)여야 가운데 정렬됨.
function InfoTip({ tipKey, tipOpen, onToggle, children }) {
  return (
    <>
      <button type="button" onClick={() => onToggle(tipKey)} className="text-gray-400 hover:text-emerald-500 transition flex-shrink-0" aria-label="도움말">
        <Info className="w-4 h-4" />
      </button>
      {tipOpen === tipKey && (
        <span className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-20 w-[92%] max-w-[300px] text-[13px] font-normal text-white bg-gray-800 rounded-xl px-4 py-3 shadow-xl leading-relaxed break-keep text-center">
          {children}
        </span>
      )}
    </>
  )
}

// 필드 라벨 — 통일된 위계: 굵은 라벨 + 배지(필수/선택/무) + ⓘ 툴팁
//   required=true → 필수, required=false → 선택, required 미지정 → 배지 없음
function FieldLabel({ title, required, tipKey, tipOpen, onToggle, children }) {
  return (
    <div className="relative flex items-center gap-1.5 mb-1.5">
      <span className="text-[15px] font-bold text-gray-800">{title}</span>
      {required === true && <span className="text-[11px] font-bold text-rose-500">필수</span>}
      {required === false && <span className="text-[11px] font-medium text-gray-400">선택</span>}
      {children && <InfoTip tipKey={tipKey} tipOpen={tipOpen} onToggle={onToggle}>{children}</InfoTip>}
    </div>
  )
}

// 운영자가 자기 프로그램에 미션을 직접 추가/수정 (본인 (가) 진화)
// 인증 유형 3가지: 사진(requires_image) / 기록(requires_numeric) / 소감(requires_note)
//   다중 선택 가능 (최소 1개)
// 운영자 직접 생성 미션은 feature=NULL (017 자동 생성과 구분)
//
// editMission prop 있으면 수정 모드 (UPDATE), 없으면 생성 모드 (INSERT)
// onBack: 라이브러리에서 「직접 만들기」로 진입한 경우 — 라이브러리로 돌아가기 (생성 모드만)
function MissionCreateModal({ program, isOpen, onClose, onSuccess, editMission, onBack }) {
  useBodyScrollLock(isOpen)  // iOS 배경 스크롤 방지
  // 하드웨어 뒤로가기 — 만들기 흐름이면 「이전」(onBack: 라이브러리 복귀), 편집이면 닫기.
  useBackButtonClose(isOpen, onBack || onClose)
  const kbInset = useKeyboardInset()   // iOS 키보드 높이 — 제목·설명·지표 입력 시 카드 위로
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

  // ── 명상(타이머) 인증 — 마음관리(MINDCARE) 전용 4번째 스타일 ──
  const [verifyStyle, setVerifyStyle] = useState('standard')   // 'standard' | 'meditation'
  const [medMinutes, setMedMinutes] = useState(3)              // 명상 길이(분)
  const [medPattern, setMedPattern] = useState({ inhale: 4, hold1: 4, exhale: 4, hold2: 4 })  // 박스호흡 기본(운영자 커스텀)
  const [medPoint, setMedPoint] = useState(10)                // 완료 점수
  // 다중 지표 (122) — 거리·시간·칼로리처럼 여러 숫자 항목. metricAggregate = 개요 통계 표시.
  const [metrics, setMetrics] = useState([])  // [{ key, label, unit, max, icon }]
  const [metricAggregate, setMetricAggregate] = useState(false)
  const [metricsEditOpen, setMetricsEditOpen] = useState(false)  // 별도 전체화면 지표 편집기
  useBackButtonClose(metricsEditOpen, () => setMetricsEditOpen(false))  // 하드웨어 뒤로가기 = 지표편집 닫기(스택 최상단)
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
  const [tipOpen, setTipOpen] = useState(null)   // 도움말 툴팁 — 열린 필드 키(null=닫힘)
  const toggleTip = (k) => setTipOpen(t => t === k ? null : k)
  const [step, setStep] = useState(1)   // 6단계 (1.제목 2.일정 3.아이콘 4.인증방법 5.점수 6.운영)
  const TOTAL_STEPS = 6
  const STEP_LABELS = ['제목', '일정', '아이콘', '인증', '점수', '운영']
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
      setVerifyStyle('standard')
      setMedMinutes(3)
      setMedPattern({ inhale: 4, hold1: 4, exhale: 4, hold2: 4 })
      setMedPoint(10)
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
      setVerifyStyle(editMission.verify_style || 'standard')
      setMedMinutes(editMission.meditation_seconds ? Math.max(1, Math.round(editMission.meditation_seconds / 60)) : 3)
      setMedPattern(editMission.meditation_pattern || { inhale: 4, hold1: 4, exhale: 4, hold2: 4 })
      setMedPoint(editMission.point ?? 10)
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
    { key: 'image', on: requiresImage, label: '사진 제출', Icon: ImageIcon, point: imagePoint, setPoint: setImagePoint, required: imageRequired, setRequired: setImageRequired },
    { key: 'numeric', on: requiresNumeric, label: '숫자 입력', Icon: BarChart3, point: numericPoint, setPoint: setNumericPoint, required: numericRequired, setRequired: setNumericRequired },
    { key: 'note', on: requiresNote, label: '소감 작성', Icon: MessageSquare, point: notePoint, setPoint: setNotePoint, required: noteRequired, setRequired: setNoteRequired },
  ]

  // 단계별 검증
  const validateStep1 = () => {
    if (!title.trim()) return '미션 제목을 입력해주세요'
    return null
  }
  const validateSchedule = () => {
    if (startDate && endDate && endDate < startDate) return '종료일이 시작일보다 빠를 수 없어요'
    if (scheduleMode === 'CUSTOM' && activeDays.length === 0) return '운영 요일을 최소 1일 선택해주세요'
    return null
  }
  const isMed = verifyStyle === 'meditation'   // 명상(타이머) 인증 스타일
  const validateMethod = () => {
    if (isMed) return null   // 명상형은 타이머 완료가 인증 → 사진/기록/소감 불필요
    if (!requiresImage && !requiresNumeric && !requiresNote) return '인증 방법을 최소 1개 선택해주세요'
    return null
  }
  const validatePoints = () => {
    if (isMed) { if ((parseInt(medPoint) || 0) < 1) return '완료 점수는 1 이상이어야 합니다'; return null }
    if (totalPoint < 1) return '점수 합계는 1 이상이어야 합니다'
    const anyRequired =
      (requiresImage && imageRequired) || (requiresNumeric && numericRequired) || (requiresNote && noteRequired)
    if (!anyRequired) return '필수 입력을 최소 1개 지정해주세요 (전부 선택일 수 없어요)'
    return null
  }

  // 다음/이전 — 현재 단계 검증 통과 시에만 진행
  const goNext = () => {
    // 1=제목 · 2=아이콘(검증X) · 3=인증방법 · 4=점수 · 5=운영
    const v = step === 1 ? validateStep1() : step === 2 ? validateSchedule() : step === 4 ? validateMethod() : step === 5 ? validatePoints() : null
    if (v) { setError(v); return }
    setError(null)
    setStep(s => Math.min(TOTAL_STEPS, s + 1))
  }
  const goPrev = () => { setError(null); setStep(s => Math.max(1, s - 1)) }

  const handleSave = async () => {
    // 전 단계 방어 검증 — 오류 시 해당 단계로 이동
    const e1 = validateStep1(); if (e1) { setStep(1); setError(e1); return }
    const es = validateSchedule(); if (es) { setStep(2); setError(es); return }
    const em = validateMethod(); if (em) { setStep(4); setError(em); return }
    const ep = validatePoints(); if (ep) { setStep(5); setError(ep); return }

    setIsSaving(true)
    setError(null)

    const payload = {
      title: title.trim(),
      instruction: instruction.trim() || null,
      icon_path: iconPath || null,
      verification_type: isMed ? 'AUTO' : verificationType,   // 명상은 자기보고 신뢰 → AUTO
      point: isMed ? (parseInt(medPoint) || 0) : totalPoint,
      daily_limit: dailyLimit ? parseInt(dailyLimit) : null,
      // 명상(타이머) 인증 — 스타일/시간/호흡패턴. 아니면 standard.
      verify_style: verifyStyle,
      meditation_seconds: isMed ? Math.max(30, medMinutes * 60) : null,
      meditation_pattern: isMed ? medPattern : null,
      meditation_music: null,
      // 명상형은 사진/기록/소감 없음
      requires_image: isMed ? false : requiresImage,
      requires_numeric: isMed ? false : requiresNumeric,
      requires_note: isMed ? false : requiresNote,
      // 084 — 입력별 점수/필수 (미사용 입력은 point NULL → 채점 합산서 제외)
      image_point: (!isMed && requiresImage) ? (parseInt(imagePoint) || 0) : null,
      numeric_point: (!isMed && requiresNumeric) ? (parseInt(numericPoint) || 0) : null,
      note_point: (!isMed && requiresNote) ? (parseInt(notePoint) || 0) : null,
      image_required: (!isMed && requiresImage) ? imageRequired : true,
      numeric_required: (!isMed && requiresNumeric) ? numericRequired : true,
      note_required: (!isMed && requiresNote) ? noteRequired : true,
      // 다중 지표 (122) — 숫자 입력 미션만. 라벨·단위 있는 것만 저장.
      metrics: (!isMed && requiresNumeric)
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
      metric_aggregate: (!isMed && requiresNumeric) ? metricAggregate : false,
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
        flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 transition disabled:opacity-50
        ${active
          ? 'border-emerald-500 bg-emerald-50'
          : 'border-gray-200 bg-white hover:border-gray-300'}
      `}
    >
      <Icon className={`w-6 h-6 ${active ? 'text-emerald-600' : 'text-gray-400'}`} />
      <span className={`text-[13px] ${active ? 'text-emerald-700 font-semibold' : 'text-gray-600'}`}>
        {label}
      </span>
    </button>
  )

  if (!isOpen || !program) return null
  const isMindcare = Array.isArray(program.categories) && program.categories.includes('MINDCARE')  // 명상형 노출 조건
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-5" style={{ paddingBottom: kbInset ? kbInset + 20 : undefined, transition: 'padding-bottom .2s ease' }} onClick={onClose}>
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto bg-white rounded-2xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          {onBack && !isEditMode && step === 1 && (
            <button
              type="button"
              onClick={onBack}
              disabled={isSaving}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              템플릿으로
            </button>
          )}
          <h2 className="text-xl font-semibold text-gray-800 mb-4 pr-8 flex items-baseline gap-2 min-w-0">
            <span className="flex-shrink-0">{isEditMode ? '✏️ 미션 수정' : '✨ 미션 추가'}</span>
            <span className="text-sm font-normal text-gray-400 truncate min-w-0">{program.name}</span>
          </h2>

          {/* 스텝 인디케이터 */}
          <div className="flex items-start mb-5">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1
              const active = step === n
              const done = step > n
              return (
                <Fragment key={n}>
                  {i > 0 && <div className={`flex-1 h-0.5 mt-[14px] mx-1 rounded-full ${step >= n ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
                  <div className="flex flex-col items-center flex-shrink-0 w-11">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold ${done || active ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {done ? <Check className="w-4 h-4" /> : n}
                    </div>
                    <span className={`mt-1 text-[10px] font-medium text-center leading-tight w-full ${active ? 'text-emerald-600' : 'text-gray-400'}`}>{label}</span>
                  </div>
                </Fragment>
              )
            })}
          </div>

          {/* ── 1단계: 기본 ── */}
          {step === 1 && (<>
          {/* 제목 */}
          <div className="mb-4">
            <FieldLabel title="미션 제목" required tipKey="title" tipOpen={tipOpen} onToggle={toggleTip}>
              행동이 분명한 이름이 좋아요.<br />예: <b className="text-emerald-300">“20분 이상 걷기”</b>
            </FieldLabel>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => setTipOpen(null)}
              maxLength={50}
              placeholder="예: 20분 이상 걷기"
              disabled={isSaving}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
            />
          </div>

          {/* 미션 설명 */}
          <div className="mb-4">
            <FieldLabel title="미션 설명" required={false} tipKey="desc" tipOpen={tipOpen} onToggle={toggleTip}>
              참여자가 <b className="text-emerald-300">무엇을 어떻게</b> 할지 구체적으로 적어요.<br />예: “20분 이상 걷고 이동 거리를 기록해요.”
            </FieldLabel>
            <textarea
              ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 320) + 'px' } }}
              value={instruction}
              onChange={(e) => { setInstruction(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 320) + 'px' }}
              onFocus={() => setTipOpen(null)}
              maxLength={200}
              placeholder="예: 20분 이상 걷고 시간 기록하기"
              rows={2}
              disabled={isSaving}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50 resize-none overflow-hidden"
            />
          </div>

          {/* 인증 방식 — 빠른 추가를 위해 1단계에 노출(가장 중요한 선택). 세부(필수·점수)는 뒤 단계 기본값. */}
          {!isMed && (
          <div className="mb-2">
            <FieldLabel title="인증 방식" required tipKey="verify1" tipOpen={tipOpen} onToggle={toggleTip}>
              참여자가 제출할 방법이에요. 여러 개 골라도 돼요.<br />📷 사진 · 📊 숫자 · 💬 소감
            </FieldLabel>
            <div className="grid grid-cols-3 gap-2.5">
              <TypeCard active={requiresImage} onClick={() => setRequiresImage(!requiresImage)} Icon={ImageIcon} label="사진 제출" />
              <TypeCard active={requiresNumeric} onClick={() => setRequiresNumeric(!requiresNumeric)} Icon={BarChart3} label="숫자 입력" />
              <TypeCard active={requiresNote} onClick={() => setRequiresNote(!requiresNote)} Icon={MessageSquare} label="소감 작성" />
            </div>
            <p className="text-[12px] text-gray-400 mt-1.5">기본값(사진·10P·상시)으로 <b className="text-gray-500">바로 추가</b>하거나, <b className="text-gray-500">세부 설정</b>에서 일정·점수·운영을 조정하세요.</p>
          </div>
          )}
          </>)}

          {/* ── 2단계: 일정 ── */}
          {step === 2 && (<>
          <div className="relative flex items-center gap-1.5 mb-2 mt-1">
            <h3 className="text-[18px] font-bold text-gray-900 break-keep">언제 운영할까요?</h3>
            <InfoTip tipKey="when" tipOpen={tipOpen} onToggle={toggleTip}>
              미션이 열리는 기간과 요일을 정해요. 비워두면 프로그램 전체 기간·매일로 열려요.
            </InfoTip>
          </div>
          <p className="text-[15px] text-gray-600 mb-6 break-keep">기간·요일 모두 선택 · 나중에 수정 가능</p>

          {/* 운영 기간 (예약) — 시작일을 미래로 두면 그날부터 활성화 */}
          <div className="mb-4">
            <FieldLabel title="운영 기간" required={false} tipKey="period" tipOpen={tipOpen} onToggle={toggleTip}>
              비우면 프로그램 전체 기간에 열려요. <b className="text-emerald-300">시작일을 미래로</b> 두면 그날 자동 시작되는 예약 미션이 돼요.
            </FieldLabel>
            {/* 좌우 배치 + 내용 크기(w-auto) — 전체폭은 낭비, flex-1+min-w-0 은 폭이 좁아 "일" 잘림 */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                aria-label="시작일"
                value={startDate}
                min={program.start_date}
                max={program.end_date}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isSaving}
                className="w-auto px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
              />
              <span className="text-gray-400 flex-shrink-0">~</span>
              <input
                type="date"
                aria-label="종료일"
                value={endDate}
                min={startDate || program.start_date}
                max={program.end_date}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isSaving}
                className="w-auto px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* 운영 일정 (선택) — 운영 요일 + 제외 기간 */}
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

          {/* ── 3단계: 아이콘 ── */}
          {step === 3 && (<>
          {/* 미션 아이콘 (선택) */}
          <div className="mb-4">
            <FieldLabel title="미션 아이콘" required={false} tipKey="icon" tipOpen={tipOpen} onToggle={toggleTip}>
              목록·인증 화면에서 미션을 한눈에 구분해줘요.<br />직접 업로드하거나 기본 아이콘에서 골라요. 없어도 괜찮아요.
            </FieldLabel>
            <MissionIconPicker
              ownerId={program.owner_id}
              value={iconPath}
              onChange={setIconPath}
              disabled={isSaving}
            />
          </div>
          </>)}

          {/* ── 4단계: 인증 방법 ── */}
          {step === 4 && (<>
          {/* 마음관리 전용 — 인증 스타일 선택(일반 vs 명상 타이머) */}
          {isMindcare && (
            <div className="grid grid-cols-2 gap-2 mb-5 mt-1">
              {[
                { v: 'standard', emoji: '📷', label: '일반 인증', desc: '사진·기록·소감' },
                { v: 'meditation', img: '/icons/meditation/meditate.png', label: '명상 타이머', desc: '앉아서 명상 후 완료' },
              ].map(o => {
                const on = verifyStyle === o.v
                return (
                  <button key={o.v} type="button" onClick={() => setVerifyStyle(o.v)} disabled={isSaving}
                    className={`rounded-xl border-2 p-3 text-center transition ${on ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    {o.img
                      ? <img src={o.img} alt="" draggable="false" className="w-9 h-9 mx-auto mb-1 object-contain" />
                      : <span className="block text-2xl leading-none mb-1">{o.emoji}</span>}
                    <span className={`block text-[15px] font-bold ${on ? 'text-emerald-700' : 'text-gray-600'}`}>{o.label}</span>
                    <span className="block text-[11px] text-gray-400 mt-0.5">{o.desc}</span>
                  </button>
                )
              })}
            </div>
          )}

          {isMed ? (
          /* 명상형 설정 — 시간 + 호흡 패턴 */
          <div className="mb-4">
            <div className="relative flex items-center gap-1.5 mb-2">
              <h3 className="text-[18px] font-bold text-gray-900 break-keep">명상을 어떻게 진행할까요?</h3>
              <InfoTip tipKey="med" tipOpen={tipOpen} onToggle={toggleTip}>
                참여자가 앉아서 타이머 동안 명상해요. 음악·호흡 가이드가 함께 나오고, 시간이 끝나면 완료로 인증돼요.
              </InfoTip>
            </div>
            <p className="text-[15px] text-gray-600 mb-6 break-keep">시간과 호흡 패턴을 정해요 · 완료는 정직하게 믿어요</p>

            {/* 명상 시간 */}
            <FieldLabel title="명상 시간" tipKey="medtime" tipOpen={tipOpen} onToggle={toggleTip}>
              참여자가 명상할 길이예요.
            </FieldLabel>
            <div className="flex gap-2 mb-6">
              {[3, 5, 10, 15].map(m => (
                <button key={m} type="button" onClick={() => setMedMinutes(m)} disabled={isSaving}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-[15px] font-bold transition ${medMinutes === m ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {m}분
                </button>
              ))}
            </div>

            {/* 호흡 패턴 */}
            <FieldLabel title="호흡 패턴 (초)" required={false} tipKey="medbreath" tipOpen={tipOpen} onToggle={toggleTip}>
              화면의 원이 커졌다 작아지며 호흡을 안내해요. 기본은 <b className="text-emerald-300">박스 호흡 4-4-4-4</b>. 초 단위로 바꿀 수 있어요.
            </FieldLabel>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'inhale', label: '들숨' },
                { key: 'hold1', label: '멈춤' },
                { key: 'exhale', label: '날숨' },
                { key: 'hold2', label: '멈춤' },
              ].map(b => (
                <div key={b.key} className="text-center">
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">{b.label}</label>
                  <input type="number" min={0} max={20} value={medPattern[b.key]}
                    onChange={(e) => setMedPattern(p => ({ ...p, [b.key]: Math.max(0, Math.min(20, parseInt(e.target.value) || 0)) }))}
                    disabled={isSaving}
                    className="w-full px-2 py-2 text-center text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 disabled:bg-gray-50" />
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-gray-400">멈춤을 0으로 두면 「들숨 → 날숨」만 반복해요 (초심자용).</p>
          </div>
          ) : (
          /* 기존 인증 방법 — 다중 선택 */
          <div className="mb-4">
            <div className="relative flex items-center gap-1.5 mb-2 mt-1">
              <h3 className="text-[18px] font-bold text-gray-900 break-keep">미션을 어떻게 인증할까요?</h3>
              <InfoTip tipKey="verify" tipOpen={tipOpen} onToggle={toggleTip}>
                📷 사진 = 인증샷 · 📊 기록 = 숫자 입력(걸음·시간 등) · 💬 소감 = 한 줄 글<br />여러 개 골라도 돼요.
              </InfoTip>
            </div>
            <p className="text-[15px] text-gray-600 mb-6 break-keep">참여자가 제출할 방법을 골라요 · 여러 개 선택 가능</p>
            <div className="grid grid-cols-3 gap-2.5">
              <TypeCard active={requiresImage} onClick={() => setRequiresImage(!requiresImage)} Icon={ImageIcon} label="사진 제출" />
              <TypeCard active={requiresNumeric} onClick={() => setRequiresNumeric(!requiresNumeric)} Icon={BarChart3} label="숫자 입력" />
              <TypeCard active={requiresNote} onClick={() => setRequiresNote(!requiresNote)} Icon={MessageSquare} label="소감 작성" />
            </div>
          </div>
          )}
          </>)}

          {/* ── 5단계: 점수 ── */}
          {step === 5 && (<>
          {isMed ? (
          /* 명상 완료 점수 (단일) */
          <div className="mb-4">
            <div className="relative flex items-center gap-1.5 mb-2 mt-1">
              <h3 className="text-[18px] font-bold text-gray-900 break-keep">완료하면 몇 점을 줄까요?</h3>
              <InfoTip tipKey="medpoint" tipOpen={tipOpen} onToggle={toggleTip}>
                명상 타이머를 끝까지 마치면 받는 점수예요. 습관 형성이 목적이라 부담 없는 점수를 권해요.
              </InfoTip>
            </div>
            <p className="text-[15px] text-gray-600 mb-6 break-keep">명상을 완료하면 주는 점수</p>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-700"><img src="/icons/meditation/meditate.png" alt="" className="w-5 h-5 object-contain" /> 완료 점수</span>
              <div className="relative w-[5rem]">
                <input type="number" min={1} value={medPoint} onChange={(e) => setMedPoint(e.target.value)} disabled={isSaving}
                  className="w-full pl-2 pr-6 py-1.5 text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">P</span>
              </div>
            </div>
          </div>
          ) : (<>
          <div className="relative flex items-center gap-1.5 mb-2 mt-1">
            <h3 className="text-[18px] font-bold text-gray-900 break-keep">점수를 어떻게 줄까요?</h3>
            <InfoTip tipKey="points" tipOpen={tipOpen} onToggle={toggleTip}>
              각 입력에 점수를 매겨요. <b className="text-emerald-300">필수</b>는 꼭 제출해야 점수를 받고, <b className="text-emerald-300">선택</b>은 안 해도 되지만 하면 추가 점수예요.
            </InfoTip>
          </div>
          <p className="text-[15px] text-gray-600 mb-6 break-keep">입력마다 점수와 필수·선택을 정해요</p>

          {/* 입력별 점수 · 필수 (084) */}
          {(requiresImage || requiresNumeric || requiresNote) && (
            <div className="mb-4">
              <div className="space-y-2">
                {INPUT_ROWS.filter(r => r.on).map(r => (
                  <div key={r.key} className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 w-[4.75rem] flex-shrink-0 text-sm font-medium text-gray-700">
                      <r.Icon className="w-4 h-4 text-emerald-600 flex-shrink-0" /> {r.label}
                    </span>
                    <div className="relative w-[4.5rem] flex-shrink-0">
                      <input
                        type="number"
                        min={0}
                        value={r.point}
                        onChange={(e) => r.setPoint(e.target.value)}
                        disabled={isSaving}
                        className="w-full pl-2 pr-6 py-1.5 text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">P</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 ml-auto">
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
              <p className="mt-3 text-[15px] text-gray-600">
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
          </>)}

          {/* ── 6단계: 운영 ── */}
          {step === 6 && (<>
          <div className="relative flex items-center gap-1.5 mb-2 mt-1">
            <h3 className="text-[18px] font-bold text-gray-900 break-keep">어떻게 운영할까요?</h3>
            <InfoTip tipKey="ops" tipOpen={tipOpen} onToggle={toggleTip}>
              승인 방식·하루 최대 등을 정해요. 여기 설정은 모두 나중에 언제든 바꿀 수 있어요.
            </InfoTip>
          </div>
          <p className="text-[15px] text-gray-600 mb-6 break-keep">대부분 선택 항목이에요 · 나중에 수정 가능</p>

          {/* 달리기 전용 — 메인/서브 (주간 스트릭 색 구분) */}
          {program?.theme === 'RUNNING' && (
            <div className="mb-4">
              <FieldLabel title="메인 미션 · 서브 미션" tipKey="mainsub" tipOpen={tipOpen} onToggle={toggleTip}>
                꼭 해야 할 <b className="text-emerald-300">핵심</b>은 메인, 하면 좋은 <b className="text-emerald-300">보조</b>는 서브.<br />
                주간 스트릭에서 메인=<b className="text-emerald-300">초록</b>, 서브=<b className="text-amber-300">앰버</b>로 구분돼요.<br />
                <span className="text-gray-300">예: 「평일 3km」=메인 · 「주말 함께」=서브</span>
              </FieldLabel>
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
            <FieldLabel title="하루 최대" required={false} tipKey="daily" tipOpen={tipOpen} onToggle={toggleTip}>
              하루에 이 미션을 <b className="text-emerald-300">몇 번까지</b> 인증할 수 있는지 정해요. 비우면 무제한이에요.
            </FieldLabel>
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
            <FieldLabel title="승인 방식" tipKey="approve" tipOpen={tipOpen} onToggle={toggleTip}>
              <b className="text-emerald-300">자동 승인</b> = 제출 즉시 점수 지급.<br /><b className="text-emerald-300">운영자 심사</b> = 운영자가 확인한 뒤 점수 지급.
            </FieldLabel>
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


          </>)}

          {/* 에러 */}
          {error && (
            <p ref={errorRef} style={{ marginTop: '-7px', marginBottom: '9px' }} className="p-2 bg-red-100 text-red-700 rounded text-sm text-center">
              {error}
            </p>
          )}

          {/* 버튼 — 1단계: 바로 추가 + 세부 설정 링크(빠른 추가). 그 외: 이전·다음·저장 */}
          {step === 1 ? (
            <div className="space-y-2">
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
                  {isSaving ? '저장 중...' : (isEditMode ? '바로 저장' : '바로 추가')}
                </button>
              </div>
              <button
                type="button"
                onClick={goNext}
                disabled={isSaving}
                className="w-full text-[13px] text-gray-500 hover:text-emerald-600 font-medium py-1.5 transition disabled:opacity-50"
              >
                일정 · 점수 · 운영 등 세부 설정 ›
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition disabled:opacity-50"
              >
                이전
              </button>
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
          )}
      </div>

      {/* 기록 지표 — 별도 전체화면 편집기 (모달 위 오버레이) */}
      {metricsEditOpen && (
        <div className="fixed inset-0 z-[80] bg-white flex flex-col" style={{ paddingBottom: kbInset || undefined, transition: 'padding-bottom .2s ease' }} onClick={(e) => e.stopPropagation()}>
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
