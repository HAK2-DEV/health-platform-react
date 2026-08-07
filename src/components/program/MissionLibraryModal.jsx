import { useState, useEffect, useMemo, useRef } from 'react'
import Modal from '../common/Modal'
import { supabase } from '../../supabaseClient'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, X, Image as ImageIcon, BarChart3, MessageSquare, Pencil, Check } from 'lucide-react'
import { CATEGORY_LIST, SCHEDULE_MODES, WEEKDAY_OPTIONS } from '../../lib/constants'
import { MISSION_LIBRARY } from '../../lib/missionLibrary'
import { resolveMissionIcon } from '../../lib/missionIcons'

// 카테고리 칩 3D 아이콘 (실패 시 이모지 폴백)
function Cat3D({ cat }) {
  const [err, setErr] = useState(false)
  if (err) return <span>{cat.emoji}</span>
  // 마음관리는 명상 3D 아이콘 사용
  const src = cat.key === 'MINDCARE' ? '/icons/meditation/meditate.png' : `/icons/category/${cat.key.toLowerCase()}.png`
  return <img src={src} alt="" aria-hidden="true" onError={() => setErr(true)} className="w-4 h-4 object-contain" />
}
// 묶음 카드 3D 아이콘 — 묶음의 첫 미션 아이콘(3D) 사용. 없으면 이모지 폴백
function Bundle3D({ bundle }) {
  const [err, setErr] = useState(false)
  // 묶음에 icon 지정 있으면 그걸(전체 경로), 없으면 첫 미션 아이콘, 그것도 없으면 이모지
  const iconFile = bundle.missions?.find((m) => m.icon)?.icon
  const src = bundle.icon || (iconFile ? resolveMissionIcon(iconFile) : null)
  if (err || !src) return <span className="text-2xl">{bundle.emoji}</span>
  return <img src={src} alt="" aria-hidden="true" onError={() => setErr(true)} className="w-9 h-9 object-contain" />
}

// 인증 입력 유형 — 한 미션에 복수 선택 가능 (사진+소감 통합 등). missions.requires_* 와 매핑.
// 제출 화면(MissionVerifyPage)이 이미 사진/기록/소감을 한 미션에 같이 띄워 한 번에 제출함.
const INPUT_TYPES = [
  { field: 'requires_image', icon: ImageIcon, label: '사진 제출' },
  { field: 'requires_numeric', icon: BarChart3, label: '숫자 입력' },
  { field: 'requires_note', icon: MessageSquare, label: '소감 작성' },
]

// 추천 미션 라이브러리 모달
// 흐름:
//   1단계: 8개 묶음 카드 목록
//   2단계: 선택한 묶음의 미션 카드들 (토글 + 점수/한도 미세 조정) → "선택한 N개 추가" → INSERT
//
// 본인 의도: 라이브러리에서는 묶음으로 보여주고, 미션 생성 전에 운영자가 토글로 선택/조정
// onCustomCreate: "직접 만들기" 클릭 시 호출 — 부모가 라이브러리 닫고 MissionCreateModal 열도록
function MissionLibraryModal({ program, isOpen, onClose, onSuccess, onCustomCreate }) {
  const [step, setStep] = useState(1)              // 1: 묶음 선택, 2: 미션 조정
  const [bundle, setBundle] = useState(null)       // 선택된 묶음 메타
  const [drafts, setDrafts] = useState([])         // 묶음의 미션 작업본 (selected/point/daily_limit 조정 가능)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setErrorRaw] = useState(null)
  const [errorTick, setErrorTick] = useState(0)
  const errorRef = useRef(null)
  // 에러 설정 시 tick 증가 → 같은 메시지 재발생에도 스크롤 트리거
  const setError = (msg) => { setErrorRaw(msg); if (msg) setErrorTick(t => t + 1) }
  useEffect(() => {
    if (error && errorRef.current) errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [errorTick, error])

  // 카테고리 탭 — Day 65 본인 결정 (라이브러리 UX 단순화):
  //   카테고리별로 묶음을 그룹화 → 사용자가 카테고리 칩으로 탐색
  //   기본 선택: 프로그램의 첫 카테고리 (없으면 첫 카테고리)
  const [selectedCategory, setSelectedCategory] = useState(null)

  // Day 65 본인 피드백: Step 2 에서 라이브러리로 돌아올 때 활성 카테고리 탭이
  // 가로 스크롤 영역 안에서 보이도록 자동 스크롤. 카테고리 state 는 유지되지만
  // 가로 스크롤 위치가 초기화돼서 사용자가 다시 찾아야 했던 문제 해결.
  const tabStripRef = useRef(null)
  const activeTabRef = useRef(null)

  // 모달 닫힘 시 reset
  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setBundle(null)
      setDrafts([])
      setError(null)
      setIsSaving(false)
    } else if (program) {
      // 모달 열릴 때 프로그램의 첫 카테고리를 기본 선택
      const defaultCat = program.categories?.[0] || CATEGORY_LIST[0]?.key
      setSelectedCategory(defaultCat)
    }
  }, [isOpen, program])

  // Step 1 진입 시 활성 카테고리 탭을 가로 스크롤 영역 중앙으로 이동
  useEffect(() => {
    if (step !== 1) return
    const strip = tabStripRef.current
    const tab = activeTabRef.current
    if (!strip || !tab) return
    const offset = tab.offsetLeft - strip.clientWidth / 2 + tab.clientWidth / 2
    strip.scrollLeft = Math.max(0, offset)
  }, [step, selectedCategory])

  // 선택된 카테고리의 묶음들만 필터링 (카테고리당 묶음 카운트도 미리 계산해서 칩에 표시)
  const bundlesByCategory = useMemo(() => {
    const map = {}
    for (const b of MISSION_LIBRARY) {
      if (!map[b.category]) map[b.category] = []
      map[b.category].push(b)
    }
    return map
  }, [])

  const filteredBundles = useMemo(
    () => bundlesByCategory[selectedCategory] || [],
    [bundlesByCategory, selectedCategory]
  )

  const openBundle = (b) => {
    setBundle(b)
    // 일정 옵션 + UI 펼침 상태 디폴트로 초기화 — 미션마다 본인이 기간 디테일 잡을 수 있음
    setDrafts(b.missions.map(m => ({
      ...m,
      selected: true,
      schedule_mode: 'ALL_DAYS',
      active_days: [],
      excluded_periods: [],
      startDate: program.start_date,   // 예약 미션 — 미래로 두면 그날부터 활성화
      endDate: program.end_date,
      showSchedule: false,
      showPreview: false,
      showDetail: false,
      editingInstruction: false,
      // 084 — 입력별 점수/필수. 라이브러리에 per-input 값 있으면 우선(통합 미션), 없으면 단일 point 배치
      image_point: m.image_point ?? (m.requires_image ? (m.point ?? 10) : 10),
      numeric_point: m.numeric_point ?? (m.requires_numeric ? (m.point ?? 10) : 10),
      note_point: m.note_point ?? (m.requires_note ? (m.point ?? 5) : 5),
      image_required: m.image_required ?? true,
      numeric_required: m.numeric_required ?? true,
      note_required: m.note_required ?? true,
    })))
    setError(null)
    setMetricsEditIdx(null)
    setStep(2)
  }

  const goBackToList = () => {
    setStep(1)
    setBundle(null)
    setDrafts([])
    setMetricsEditIdx(null)
    setError(null)
  }

  const toggleMission = (idx) => {
    setDrafts(prev => prev.map((m, i) => i === idx ? { ...m, selected: !m.selected } : m))
  }

  const updateDraft = (idx, field, value) => {
    setDrafts(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  }

  // 기록 지표 편집 (별도 전체화면) — draft 의 metrics 배열 조작
  const [metricsEditIdx, setMetricsEditIdx] = useState(null)
  const setDraftMetrics = (idx, fn) => setDrafts(prev => prev.map((d, i) => i === idx ? { ...d, metrics: fn(Array.isArray(d.metrics) ? d.metrics : []) } : d))
  const MAX_METRICS = 4
  const addDraftMetric = (idx) => setDraftMetrics(idx, ms => ms.length >= MAX_METRICS ? ms : [...ms, { key: 'k' + Math.random().toString(36).slice(2, 8), label: '', unit: '', max: '', icon: '' }])
  const updateDraftMetric = (idx, mi, field, val) => setDraftMetrics(idx, ms => ms.map((x, j) => j === mi ? { ...x, [field]: val } : x))
  const removeDraftMetric = (idx, mi) => setDraftMetrics(idx, ms => ms.filter((_, j) => j !== mi))
  const editDraft = metricsEditIdx != null ? drafts[metricsEditIdx] : null
  const editMetrics = Array.isArray(editDraft?.metrics) ? editDraft.metrics : []

  // 입력별 점수 합계 (대표 점수 = 최대치)
  const draftTotal = (m) =>
    (m.requires_image ? (parseInt(m.image_point) || 0) : 0) +
    (m.requires_numeric ? (parseInt(m.numeric_point) || 0) : 0) +
    (m.requires_note ? (parseInt(m.note_point) || 0) : 0)

  // 일정 옵션 헬퍼 — 본인의 다른 코드와 일관 (Step1Basic 폐기 흐름 + MissionCreateModal)
  const toggleActiveDay = (idx, dayNum) => {
    setDrafts(prev => prev.map((m, i) => {
      if (i !== idx) return m
      const days = m.active_days.includes(dayNum)
        ? m.active_days.filter(d => d !== dayNum)
        : [...m.active_days, dayNum].sort()
      return { ...m, active_days: days }
    }))
  }
  const addExcludedPeriod = (idx) => {
    setDrafts(prev => prev.map((m, i) => i === idx
      ? { ...m, excluded_periods: [...m.excluded_periods, { start_date: '', end_date: '', reason: '' }] }
      : m
    ))
  }
  const removeExcludedPeriod = (idx, pIdx) => {
    setDrafts(prev => prev.map((m, i) => i === idx
      ? { ...m, excluded_periods: m.excluded_periods.filter((_, j) => j !== pIdx) }
      : m
    ))
  }
  const updateExcludedPeriod = (idx, pIdx, field, value) => {
    setDrafts(prev => prev.map((m, i) => {
      if (i !== idx) return m
      const updated = [...m.excluded_periods]
      updated[pIdx] = { ...updated[pIdx], [field]: value }
      return { ...m, excluded_periods: updated }
    }))
  }

  const selectedCount = drafts.filter(m => m.selected).length

  const handleAddSelected = async () => {
    if (!program || selectedCount === 0) {
      setError('미션을 1개 이상 선택해주세요')
      return
    }
    // CUSTOM 모드인데 요일 0개 선택된 미션 차단
    const invalidScheduleIdx = drafts.findIndex(m =>
      m.selected && m.schedule_mode === 'CUSTOM' && m.active_days.length === 0
    )
    if (invalidScheduleIdx >= 0) {
      setError(`"${drafts[invalidScheduleIdx].title}" 미션의 운영 요일을 최소 1일 선택해주세요`)
      return
    }
    // 예약 기간 — 종료일이 시작일보다 빠르면 차단
    const invalidPeriodIdx = drafts.findIndex(m =>
      m.selected && m.startDate && m.endDate && m.endDate < m.startDate
    )
    if (invalidPeriodIdx >= 0) {
      setError(`"${drafts[invalidPeriodIdx].title}" 미션의 종료일이 시작일보다 빠를 수 없어요`)
      return
    }
    // 인증 입력 유형 0개 차단 — 제출 화면이 비어버림 (명상형은 타이머 완료라 예외)
    const noInputIdx = drafts.findIndex(m =>
      m.selected && m.verify_style !== 'meditation' && !m.requires_image && !m.requires_numeric && !m.requires_note
    )
    if (noInputIdx >= 0) {
      setError(`"${drafts[noInputIdx].title}" 미션의 인증 입력을 1개 이상 선택해주세요`)
      return
    }
    // 필수 입력 0개 차단 (전부 선택일 수 없음) — 명상형 예외
    const noRequiredIdx = drafts.findIndex(m =>
      m.selected && m.verify_style !== 'meditation' &&
      !((m.requires_image && m.image_required !== false) ||
        (m.requires_numeric && m.numeric_required !== false) ||
        (m.requires_note && m.note_required !== false))
    )
    if (noRequiredIdx >= 0) {
      setError(`"${drafts[noRequiredIdx].title}" 미션은 필수 입력이 최소 1개 필요해요 (전부 선택일 수 없어요)`)
      return
    }

    setIsSaving(true)
    setError(null)

    // 선택된 미션만 INSERT — 각 미션의 일정 옵션 (schedule_mode/active_days/excluded_periods) 반영
    const bundleTitle = `${bundle.emoji} ${bundle.title}`
    const rows = drafts.filter(m => m.selected).map(m => {
      const isMed = m.verify_style === 'meditation'
      return {
      program_id: program.id,
      feature: null,
      title: m.title,
      instruction: m.instruction || null,
      verification_type: isMed ? 'AUTO' : m.verification_type,
      point: isMed ? (parseInt(m.point) || 0) : draftTotal(m),
      daily_limit: m.daily_limit ? parseInt(m.daily_limit) : null,
      // 명상(타이머) 인증 — 라이브러리 명상 미션
      verify_style: m.verify_style || 'standard',
      meditation_seconds: isMed ? (m.meditation_seconds || 180) : null,
      meditation_pattern: isMed ? (m.meditation_pattern || null) : null,
      meditation_music: null,
      requires_image: m.requires_image,
      requires_numeric: m.requires_numeric,
      requires_note: m.requires_note,
      // 084 — 입력별 점수/필수
      image_point: m.requires_image ? (parseInt(m.image_point) || 0) : null,
      numeric_point: m.requires_numeric ? (parseInt(m.numeric_point) || 0) : null,
      note_point: m.requires_note ? (parseInt(m.note_point) || 0) : null,
      image_required: m.requires_image ? (m.image_required !== false) : true,
      numeric_required: m.requires_numeric ? (m.numeric_required !== false) : true,
      note_required: m.requires_note ? (m.note_required !== false) : true,
      // 122 — 다중 지표 + 개요 통계 표시. 라벨/단위 있는 것만, max 는 숫자로 정규화.
      metrics: m.requires_numeric && Array.isArray(m.metrics)
        ? m.metrics
            .filter(x => (x.label || '').trim() || (x.unit || '').trim())
            .map(x => ({
              ...x,  // sumUnit/sumDivide 등 프리셋 추가 필드 보존
              key: x.key || ('k' + Math.random().toString(36).slice(2, 8)),
              label: (x.label || '').trim(),
              unit: (x.unit || '').trim(),
              max: x.max !== '' && x.max != null ? Number(x.max) : null,
              icon: (x.icon || '').trim() || null,
            }))
        : [],
      metric_aggregate: m.requires_numeric ? !!m.metric_aggregate : false,
      active_from: `${m.startDate || program.start_date}T00:00:00+09:00`,
      active_until: `${m.endDate || program.end_date}T23:59:59+09:00`,
      schedule_mode: m.schedule_mode,
      active_days: m.schedule_mode === 'CUSTOM' ? m.active_days : [],
      excluded_periods: m.excluded_periods.filter(p => p.start_date && p.end_date),
      bundle_title: bundleTitle,
      icon_path: m.icon || null,  // Day 65 — 라이브러리 사전 제작 아이콘 (075 마이그레이션)
      }
    })

    const { error: insertError } = await supabase.from('missions').insert(rows)

    if (insertError) {
      console.error('라이브러리 미션 추가 실패:', insertError)
      setError(insertError.message)
      setIsSaving(false)
      return
    }

    onSuccess?.()
    onClose()
  }

  // ─── 1단계: 카테고리 탭 + 그 카테고리 묶음 목록 ─────────────
  if (step === 1) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        {program && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-1 pr-8">
              💡 추천 미션 템플릿
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              카테고리에서 묶음을 골라 한 번에 여러 미션을 추가하세요
            </p>

            {/* 카테고리 칩 탭 — 가로 스크롤. 카테고리 옆에 묶음 개수 표시 */}
            <div ref={tabStripRef} className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 mb-4 scrollbar-hide">
              {CATEGORY_LIST.map(category => {
                const count = bundlesByCategory[category.key]?.length || 0
                const isActive = selectedCategory === category.key
                return (
                  <button
                    key={category.key}
                    ref={isActive ? activeTabRef : null}
                    type="button"
                    onClick={() => setSelectedCategory(category.key)}
                    className={`
                      flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition
                      ${isActive
                        ? 'bg-emerald-500 text-white shadow-sm font-medium'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                    `}
                  >
                    <Cat3D cat={category} />
                    <span>{category.label}</span>
                    {count > 0 && (
                      <span className={`text-xs ${isActive ? 'text-emerald-50' : 'text-gray-400'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* 선택된 카테고리의 묶음들 */}
            <div className="grid gap-2.5">
              {filteredBundles.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  이 카테고리에 추천 묶음이 없어요 — 직접 만들기를 사용해보세요
                </p>
              ) : (
                filteredBundles.map(b => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => openBundle(b)}
                    className="
                      flex items-center gap-3 p-3 rounded-2xl
                      border border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40
                      transition text-left
                    "
                  >
                    <div className="w-12 h-12 flex-shrink-0 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <Bundle3D bundle={b} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 text-sm truncate">
                        {b.title}
                      </h3>
                      <p className="text-xs text-gray-500 truncate">
                        {b.description}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        미션 {b.missions.length}개
                      </p>
                    </div>
                  </button>
                ))
              )}

              {/* 직접 만들기 — 항상 노출 (카테고리 무관) */}
              {onCustomCreate && (
                <button
                  type="button"
                  onClick={onCustomCreate}
                  className="
                    flex items-center gap-3 p-3 rounded-2xl
                    border-2 border-dashed border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40
                    transition text-left
                  "
                >
                  <div className="w-12 h-12 flex-shrink-0 bg-gray-50 rounded-xl flex items-center justify-center text-2xl">
                    ✋
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800 text-sm">
                      직접 만들기
                    </h3>
                    <p className="text-xs text-gray-500">
                      추천 외 원하는 미션을 자유롭게 추가
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    )
  }

  // ─── 2단계: 미션 조정 ─────────────────────────────────────
  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose}>
      {program && bundle && (
        <div className="p-6">
          <button
            type="button"
            onClick={goBackToList}
            disabled={isSaving}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            템플릿으로
          </button>

          <h2 className="text-xl font-semibold text-gray-800 mb-1 pr-8 flex items-center gap-2">
            <span className="w-8 h-8 flex items-center justify-center flex-shrink-0"><Bundle3D bundle={bundle} /></span>
            {bundle.title}
          </h2>
          <p className="text-xs text-gray-500 mb-5">
            추가할 미션을 선택하고 점수·한도를 조정해주세요
          </p>

          <div className="mission-fields space-y-3">
            {drafts.map((m, idx) => {
              return (
                <div
                  key={idx}
                  className={`
                    p-3 rounded-2xl border-2 transition
                    ${m.selected
                      ? 'border-emerald-400 bg-emerald-50/40'
                      : 'border-gray-200 bg-gray-50 opacity-60'}
                  `}
                >
                  {/* 헤더 — 체크박스 + 제목 + 수정 가능한 안내 문구 */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={m.selected}
                      onChange={() => toggleMission(idx)}
                      disabled={isSaving}
                      className="mt-1 w-4 h-4 accent-emerald-500 flex-shrink-0 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleMission(idx)}
                        disabled={isSaving}
                        className="block text-left w-full font-medium text-gray-800 text-sm"
                      >
                        {m.title}
                      </button>
                      {/* 안내 문구 — 연필 클릭 시 인라인 수정 (참여자에게 보이는 문구) */}
                      {m.editingInstruction ? (
                        <div className="mt-1">
                          <textarea
                            value={m.instruction || ''}
                            onChange={(e) => updateDraft(idx, 'instruction', e.target.value)}
                            disabled={isSaving}
                            rows={2}
                            autoFocus
                            placeholder="참여자에게 보일 안내 문구 (예: 오늘 운동한 순간을 사진으로 인증해요)"
                            className="w-full px-2 py-1.5 text-xs border border-emerald-300 rounded-md focus:outline-none focus:border-emerald-500 resize-none disabled:bg-gray-50"
                          />
                          <button
                            type="button"
                            onClick={() => updateDraft(idx, 'editingInstruction', false)}
                            disabled={isSaving}
                            className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" /> 완료
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-1 mt-0.5">
                          <p className="text-xs text-gray-500 break-keep leading-relaxed flex-1 min-w-0">
                            {m.instruction || <span className="text-gray-400 italic">안내 문구 없음</span>}
                          </p>
                          <button
                            type="button"
                            onClick={() => updateDraft(idx, 'editingInstruction', true)}
                            disabled={isSaving}
                            title="안내 문구 수정"
                            className="p-0.5 text-gray-400 hover:text-emerald-600 disabled:opacity-50 flex-shrink-0"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 점수 / 한도 / 승인 방식 미세 조정 — 선택된 미션만 활성 */}
                  {m.selected && (
                    <div className="mt-3 space-y-4">
                      {/* 명상 미션 — 입력·점수 편집 대신 요약(완료 점수만 조정) */}
                      {m.verify_style === 'meditation' && (
                        <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 p-3">
                          <p className="text-[13px] font-bold text-gray-800 flex items-center gap-1.5"><img src="/icons/meditation/meditate.png" alt="" className="w-5 h-5 object-contain" /> 명상 타이머 · {Math.round((m.meditation_seconds || 180) / 60)}분</p>
                          <p className="text-[11px] text-gray-500 mt-0.5 mb-2">호흡 가이드와 함께 앉아서 명상 후 자동 인증돼요.</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-gray-600">완료 점수</span>
                            <input type="number" min={1} value={m.point ?? 10}
                              onChange={(e) => updateDraft(idx, 'point', e.target.value)} disabled={isSaving}
                              className="w-16 px-2 py-1 text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50" />
                            <span className="text-[12px] text-gray-500">P</span>
                          </div>
                        </div>
                      )}

                      {m.verify_style !== 'meditation' && (<>
                      {/* 인증 입력 유형 — 복수 선택 (핵심, 항상 노출) */}
                      <div>
                        <label className="block text-[13px] font-bold text-gray-800 mb-2">
                          인증 입력 <span className="text-[11px] font-medium text-gray-400">1개 이상 · 여러 개면 한 화면에서 같이 제출</span>
                        </label>
                        <div className="flex gap-1.5 flex-wrap">
                          {INPUT_TYPES.map(t => {
                            const on = !!m[t.field]
                            const Icon = t.icon
                            return (
                              <button
                                key={t.field}
                                type="button"
                                onClick={() => updateDraft(idx, t.field, !on)}
                                disabled={isSaving}
                                className={`
                                  inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] border transition disabled:opacity-50
                                  ${on
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}
                                `}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {t.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* 입력별 점수 · 필수 (084) — 핵심, 항상 노출 */}
                      <div>
                        <label className="block text-[13px] font-bold text-gray-800 mb-2">입력별 점수 · 필수</label>
                        <div className="space-y-2">
                          {[
                            { f: 'image_point', r: 'image_required', on: m.requires_image, label: '사진 제출', Icon: ImageIcon },
                            { f: 'numeric_point', r: 'numeric_required', on: m.requires_numeric, label: '숫자 입력', Icon: BarChart3 },
                            { f: 'note_point', r: 'note_required', on: m.requires_note, label: '소감 작성', Icon: MessageSquare },
                          ].filter(row => row.on).map(row => (
                            <div key={row.f} className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 w-[4.5rem] flex-shrink-0 text-[13px] font-medium text-gray-700">
                                <row.Icon className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> {row.label}
                              </span>
                              <div className="relative w-[4.25rem] flex-shrink-0">
                                <input
                                  type="number"
                                  min={0}
                                  value={m[row.f] ?? 0}
                                  onChange={(e) => updateDraft(idx, row.f, e.target.value)}
                                  disabled={isSaving}
                                  className="w-full pl-2 pr-5 py-1 text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 pointer-events-none">P</span>
                              </div>
                              <div className="flex gap-1 flex-shrink-0 ml-auto">
                                {[{ v: true, t: '필수' }, { v: false, t: '선택' }].map(opt => (
                                  <button
                                    key={opt.t}
                                    type="button"
                                    onClick={() => updateDraft(idx, row.r, opt.v)}
                                    disabled={isSaving}
                                    className={`px-2.5 py-1 rounded text-xs border transition disabled:opacity-50
                                      ${(m[row.r] !== false) === opt.v
                                        ? (opt.v
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                                            : 'border-amber-400 bg-amber-50 text-amber-700 font-semibold')
                                        : 'border-gray-200 bg-white text-gray-500'}`}
                                  >
                                    {opt.t}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-[13px] text-gray-600">최대 <span className="font-bold text-emerald-600">{draftTotal(m)}P</span></p>
                      </div>
                      </>)}

                      {/* ── 상세 설정 (접기) — 하루 최대·승인·기간·일정·미리보기 ── */}
                      <div>
                        <button
                          type="button"
                          onClick={() => updateDraft(idx, 'showDetail', !m.showDetail)}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 text-[13px] font-bold text-gray-700 hover:text-gray-900 disabled:opacity-50"
                        >
                          {m.showDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          상세 설정
                          <span className="text-[11px] font-normal text-gray-400">하루 최대 · 승인 · 기간 · 일정 · 미리보기</span>
                        </button>

                        {m.showDetail && (
                          <div className="mt-3 space-y-4 border-l-2 border-gray-100 pl-3">
                      {/* 기록 지표 — 별도 편집기. 라이브러리에 지표가 정의된 묶음(러닝 등)만 노출 */}
                      {m.requires_numeric && Array.isArray(m.metrics) && m.metrics.length > 0 && (
                        <button type="button" onClick={() => setMetricsEditIdx(idx)} disabled={isSaving}
                          className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-white hover:border-emerald-300 transition text-left disabled:opacity-50">
                          <span className="text-base flex-shrink-0">📊</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-gray-800">기록 지표 {(m.metrics?.length || 0)}개</p>
                            <p className="text-[11px] text-gray-400 truncate">
                              {(m.metrics || []).map(x => x.label || '(이름 없음)').join(' · ') || '항목을 추가해보세요'}{m.metric_aggregate ? ' · 통계 표시' : ''}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        </button>
                      )}

                      {/* 하루 최대 — 라벨 옆 인라인 입력 */}
                      <div className="flex items-center gap-2">
                        <label className="text-[13px] font-bold text-gray-800 flex-shrink-0">하루 최대 <span className="font-normal text-gray-400 text-[11px]">(선택)</span></label>
                        <input
                          type="number"
                          value={m.daily_limit ?? ''}
                          onChange={(e) => updateDraft(idx, 'daily_limit', e.target.value)}
                          min={1}
                          placeholder="무제한"
                          disabled={isSaving}
                          className="w-24 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                        />
                      </div>

                      {/* 승인 방식 — 자동 / 운영자 심사 토글 */}
                      <div>
                        <label className="block text-[13px] font-bold text-gray-800 mb-2">
                          승인 방식
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => updateDraft(idx, 'verification_type', 'AUTO')}
                            disabled={isSaving}
                            className={`
                              px-2 py-2 rounded-md border text-[13px] transition disabled:opacity-50
                              ${m.verification_type === 'AUTO'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}
                            `}
                          >
                            ⚡ 자동 승인
                          </button>
                          <button
                            type="button"
                            onClick={() => updateDraft(idx, 'verification_type', 'MANUAL')}
                            disabled={isSaving}
                            className={`
                              px-2 py-2 rounded-md border text-[13px] transition disabled:opacity-50
                              ${m.verification_type === 'MANUAL'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}
                            `}
                          >
                            ✅ 운영자 심사
                          </button>
                        </div>
                      </div>

                      {/* 운영 기간 (예약) — 시작일을 미래로 두면 그날부터 활성화 */}
                      <div>
                        <label className="block text-[13px] font-bold text-gray-800 mb-2">
                          운영 기간 <span className="text-gray-400 font-normal text-[11px]">(시작일을 미래로 두면 예약 미션)</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={m.startDate || ''}
                            min={program.start_date}
                            max={program.end_date}
                            onChange={(e) => updateDraft(idx, 'startDate', e.target.value)}
                            disabled={isSaving}
                            className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                          />
                          <span className="text-gray-400 text-xs flex-shrink-0">~</span>
                          <input
                            type="date"
                            value={m.endDate || ''}
                            min={m.startDate || program.start_date}
                            max={program.end_date}
                            onChange={(e) => updateDraft(idx, 'endDate', e.target.value)}
                            disabled={isSaving}
                            className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                          />
                        </div>
                      </div>

                      {/* 운영 일정 (선택) — MissionCreateModal 패턴 */}
                      <div>
                        <button
                          type="button"
                          onClick={() => updateDraft(idx, 'showSchedule', !m.showSchedule)}
                          disabled={isSaving}
                          className="flex items-center gap-1 text-[13px] text-gray-600 hover:text-gray-800 disabled:opacity-50"
                        >
                          {m.showSchedule ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          <span className="font-bold">운영 일정</span> (선택) — {m.schedule_mode === 'ALL_DAYS' ? '매일' :
                                                m.schedule_mode === 'WEEKDAYS' ? '평일만' :
                                                m.schedule_mode === 'WEEKENDS' ? '주말만' : '직접 선택'}
                          {m.excluded_periods.filter(p => p.start_date && p.end_date).length > 0 && (
                            <span className="text-amber-600 ml-1">
                              · 제외 {m.excluded_periods.filter(p => p.start_date && p.end_date).length}건
                            </span>
                          )}
                        </button>

                        {m.showSchedule && (
                          <div className="mt-2 bg-gray-50 p-2 rounded-md space-y-3">
                            {/* 운영 요일 */}
                            <div>
                              <label className="block text-[11px] text-gray-500 mb-1">운영 요일</label>
                              <div className="space-y-1">
                                {SCHEDULE_MODES.map(mode => (
                                  <label key={mode.key} className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`mode-${idx}`}
                                      value={mode.key}
                                      checked={m.schedule_mode === mode.key}
                                      onChange={(e) => updateDraft(idx, 'schedule_mode', e.target.value)}
                                      disabled={isSaving}
                                      className="text-emerald-500 w-3 h-3"
                                    />
                                    <span className="text-[11px] text-gray-700">{mode.label}</span>
                                  </label>
                                ))}
                              </div>
                              {m.schedule_mode === 'CUSTOM' && (
                                <div className="flex gap-1 mt-2">
                                  {WEEKDAY_OPTIONS.map(day => (
                                    <button
                                      key={day.num}
                                      type="button"
                                      onClick={() => toggleActiveDay(idx, day.num)}
                                      disabled={isSaving}
                                      className={`
                                        w-7 h-7 rounded text-[11px] transition disabled:opacity-50
                                        ${m.active_days.includes(day.num)
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
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[11px] text-gray-500">제외 기간</label>
                                <button
                                  type="button"
                                  onClick={() => addExcludedPeriod(idx)}
                                  disabled={isSaving}
                                  className="flex items-center gap-0.5 text-xs text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  추가
                                </button>
                              </div>
                              {m.excluded_periods.length === 0 ? (
                                <p className="text-xs text-gray-400">제외 기간이 없습니다</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {m.excluded_periods.map((period, pIdx) => (
                                    <div key={pIdx} className="flex items-center gap-1 bg-white p-1.5 rounded border border-gray-200">
                                      <input
                                        type="date"
                                        value={period.start_date}
                                        onChange={(e) => updateExcludedPeriod(idx, pIdx, 'start_date', e.target.value)}
                                        disabled={isSaving}
                                        className="flex-1 min-w-0 px-1 py-0.5 text-[11px] border border-gray-200 rounded focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                                      />
                                      <span className="text-xs text-gray-400">~</span>
                                      <input
                                        type="date"
                                        value={period.end_date}
                                        onChange={(e) => updateExcludedPeriod(idx, pIdx, 'end_date', e.target.value)}
                                        disabled={isSaving}
                                        className="flex-1 min-w-0 px-1 py-0.5 text-[11px] border border-gray-200 rounded focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeExcludedPeriod(idx, pIdx)}
                                        disabled={isSaving}
                                        className="p-0.5 text-gray-400 hover:text-red-500 disabled:opacity-50 flex-shrink-0"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 참여자 제출 화면 미리보기 — 운영 일정 아래, 크게 */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            const willOpen = !m.showPreview
                            const container = e.currentTarget.parentElement
                            updateDraft(idx, 'showPreview', willOpen)
                            if (willOpen) {
                              // 미리보기 렌더 후 화면 중앙으로 스크롤
                              requestAnimationFrame(() => requestAnimationFrame(() => {
                                container?.querySelector('[data-preview]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              }))
                            }
                          }}
                          disabled={isSaving}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
                        >
                          {m.showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          참여자 제출 화면 미리보기
                        </button>
                        {m.showPreview && <div data-preview><SubmitPreview mission={m} /></div>}
                      </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {error && (
            <p ref={errorRef} className="mt-3 p-2 bg-red-100 text-red-700 rounded text-sm text-center">
              {error}
            </p>
          )}

          {/* 하단 sticky 액션 — 모달 스크롤 컨테이너 안에서 따라옴 */}
          <div className="sticky bottom-0 -mx-6 mt-5 bg-white border-t border-gray-100 px-5 py-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goBackToList}
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddSelected}
                disabled={isSaving || selectedCount === 0}
                className="flex-[2] px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition disabled:bg-gray-400"
              >
                {isSaving
                  ? '추가 중...'
                  : selectedCount === 0
                    ? '미션 선택'
                    : `선택한 ${selectedCount}개 미션 추가`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>

    {/* 기록 지표 — 별도 전체화면 편집기 */}
    {metricsEditIdx != null && editDraft && (
      <div className="fixed inset-0 z-[80] bg-white flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <button type="button" onClick={() => setMetricsEditIdx(null)} className="p-1 -ml-1 text-gray-500 hover:text-gray-800" aria-label="뒤로"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="text-lg font-bold text-gray-800">📊 기록 지표</h2>
          <span className="text-sm text-gray-400 truncate">· {editDraft.title}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-xs text-gray-400">입력받을 숫자 항목이에요. 거리·시간·칼로리처럼 여러 개 추가할 수 있어요.</p>
          {editMetrics.map((m, i) => (
            <div key={m.key} className="rounded-xl border border-gray-200 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400">지표 {i + 1}</span>
                <button type="button" onClick={() => removeDraftMetric(metricsEditIdx, i)} className="text-gray-300 hover:text-red-500 transition" aria-label="삭제"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-2">
                <div className="w-16 flex-shrink-0">
                  <label className="block text-[11px] text-gray-400 mb-1">아이콘</label>
                  <input value={m.icon} onChange={(e) => updateDraftMetric(metricsEditIdx, i, 'icon', e.target.value)} maxLength={2} placeholder="🏃"
                    className="w-full px-2 py-2 text-center text-base border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-[11px] text-gray-400 mb-1">항목명</label>
                  <input value={m.label} onChange={(e) => updateDraftMetric(metricsEditIdx, i, 'label', e.target.value)} maxLength={5} placeholder="예: 거리"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <label className="block text-[11px] text-gray-400 mb-1">단위</label>
                  <input value={m.unit} onChange={(e) => updateDraftMetric(metricsEditIdx, i, 'unit', e.target.value)} maxLength={6} placeholder="km"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-[11px] text-gray-400 mb-1">1회 한도</label>
                  <input type="number" min={0} step="any" value={m.max ?? ''} onChange={(e) => updateDraftMetric(metricsEditIdx, i, 'max', e.target.value)} placeholder="제한 없음"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
            </div>
          ))}
          {editMetrics.length < MAX_METRICS ? (
            <button type="button" onClick={() => addDraftMetric(metricsEditIdx)}
              className="w-full flex items-center justify-center gap-1 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-emerald-600 font-semibold text-sm hover:border-emerald-300 transition">
              <Plus className="w-4 h-4" strokeWidth={2.5} /> 지표 추가
            </button>
          ) : (
            <p className="text-center text-[11px] text-gray-400 py-1">지표는 최대 {MAX_METRICS}개까지예요</p>
          )}
          <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
            <input type="checkbox" checked={!!editDraft.metric_aggregate} onChange={(e) => updateDraft(metricsEditIdx, 'metric_aggregate', e.target.checked)} className="w-4 h-4 accent-emerald-600" />
            <span className="text-sm text-gray-700">개요에 통계 표시</span>
          </label>
          <p className="text-[11px] text-gray-400">1회 한도는 부정 입력 대비예요. 초과하면 인증이 거부돼요.</p>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
          <button type="button" onClick={() => setMetricsEditIdx(null)}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition">완료</button>
        </div>
      </div>
    )}
    </>
  )
}

// 참여자 제출 화면 목업 — 선택한 입력 유형대로 사진/기록/소감 입력을 보여줌 (읽기전용).
// 실제 화면(MissionVerifyPage)과 동일 구성: 제목 + 안내 + 입력들 + 제출 버튼.
function SubmitPreview({ mission }) {
  const hasAny = mission.requires_image || mission.requires_numeric || mission.requires_note
  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50/70 p-3">
      <p className="text-[11px] text-gray-400 mb-2">📱 참여자에게 이렇게 보여요</p>
      <div className="rounded-lg bg-white border border-gray-200 p-3 space-y-2.5">
        <div>
          <h4 className="font-bold text-gray-800 text-sm leading-tight">{mission.title || '(미션 제목)'}</h4>
          {mission.instruction && (
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{mission.instruction}</p>
          )}
        </div>

        {!hasAny && (
          <p className="text-xs text-amber-600">⚠️ 인증 입력을 1개 이상 선택하세요</p>
        )}

        {mission.requires_image && (
          <div>
            <p className="text-[11px] font-medium text-gray-600 mb-1">
              사진 <span className="text-emerald-600">{mission.image_point ?? 0}P</span>
              {mission.image_required === false && <span className="ml-1 text-amber-600">(선택)</span>}
            </p>
            <div className="flex items-center justify-center gap-1 h-16 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 text-xs">
              <ImageIcon className="w-4 h-4" /> 사진 첨부
            </div>
          </div>
        )}
        {mission.requires_numeric && (
          <div>
            <p className="text-[11px] font-medium text-gray-600 mb-1">
              기록 <span className="text-emerald-600">{mission.numeric_point ?? 0}P</span>
              {mission.numeric_required === false && <span className="ml-1 text-amber-600">(선택)</span>}
            </p>
            <div className="px-3 py-2 rounded-lg border-2 border-gray-200 text-gray-400 text-sm">숫자 입력 (예: 30)</div>
          </div>
        )}
        {mission.requires_note && (
          <div>
            <p className="text-[11px] font-medium text-gray-600 mb-1">
              한 줄 소감 <span className="text-emerald-600">{mission.note_point ?? 0}P</span>
              {mission.note_required === false && <span className="ml-1 text-amber-600">(선택)</span>}
            </p>
            <div className="px-3 py-2 rounded-lg border-2 border-gray-200 text-gray-400 text-sm">오늘 어땠나요? 한 줄로 남겨주세요</div>
          </div>
        )}

        <div className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-sm font-medium text-center opacity-90">
          제출하기 <span className="text-emerald-50 text-xs">(미리보기)</span>
        </div>
      </div>
    </div>
  )
}

export default MissionLibraryModal
