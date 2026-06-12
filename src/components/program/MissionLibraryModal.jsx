import { useState, useEffect, useMemo, useRef } from 'react'
import Modal from '../common/Modal'
import { supabase } from '../../supabaseClient'
import { ChevronLeft, ChevronDown, ChevronUp, Plus, X, Image as ImageIcon, BarChart3, MessageSquare, Pencil, Check } from 'lucide-react'
import { CATEGORY_LIST, SCHEDULE_MODES, WEEKDAY_OPTIONS } from '../../lib/constants'
import { MISSION_LIBRARY } from '../../lib/missionLibrary'

// 인증 입력 유형 — 한 미션에 복수 선택 가능 (사진+소감 통합 등). missions.requires_* 와 매핑.
// 제출 화면(MissionVerifyPage)이 이미 사진/기록/소감을 한 미션에 같이 띄워 한 번에 제출함.
const INPUT_TYPES = [
  { field: 'requires_image', icon: ImageIcon, label: '사진' },
  { field: 'requires_numeric', icon: BarChart3, label: '기록' },
  { field: 'requires_note', icon: MessageSquare, label: '소감' },
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
  const [error, setError] = useState(null)

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
      showSchedule: false,
      showPreview: false,
      editingInstruction: false,
      // 084 — 입력별 점수/필수 (라이브러리 미션은 단일타입이라 해당 타입에 point 배치)
      image_point: m.requires_image ? (m.point ?? 10) : 10,
      numeric_point: m.requires_numeric ? (m.point ?? 10) : 10,
      note_point: m.requires_note ? (m.point ?? 5) : 5,
      image_required: true,
      numeric_required: true,
      note_required: true,
    })))
    setError(null)
    setStep(2)
  }

  const goBackToList = () => {
    setStep(1)
    setBundle(null)
    setDrafts([])
    setError(null)
  }

  const toggleMission = (idx) => {
    setDrafts(prev => prev.map((m, i) => i === idx ? { ...m, selected: !m.selected } : m))
  }

  const updateDraft = (idx, field, value) => {
    setDrafts(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  }

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
    // 인증 입력 유형 0개 차단 — 제출 화면이 비어버림
    const noInputIdx = drafts.findIndex(m =>
      m.selected && !m.requires_image && !m.requires_numeric && !m.requires_note
    )
    if (noInputIdx >= 0) {
      setError(`"${drafts[noInputIdx].title}" 미션의 인증 입력을 1개 이상 선택해주세요`)
      return
    }
    // 필수 입력 0개 차단 (전부 선택일 수 없음)
    const noRequiredIdx = drafts.findIndex(m =>
      m.selected &&
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
    const rows = drafts.filter(m => m.selected).map(m => ({
      program_id: program.id,
      feature: null,
      title: m.title,
      instruction: m.instruction || null,
      verification_type: m.verification_type,
      point: draftTotal(m),
      daily_limit: m.daily_limit ? parseInt(m.daily_limit) : null,
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
      active_from: `${program.start_date}T00:00:00+09:00`,
      active_until: `${program.end_date}T23:59:59+09:00`,
      schedule_mode: m.schedule_mode,
      active_days: m.schedule_mode === 'CUSTOM' ? m.active_days : [],
      excluded_periods: m.excluded_periods.filter(p => p.start_date && p.end_date),
      bundle_title: bundleTitle,
      icon_path: m.icon || null,  // Day 65 — 라이브러리 사전 제작 아이콘 (075 마이그레이션)
    }))

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
              💡 추천 미션 라이브러리
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
                    <span>{category.emoji}</span>
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
                    <div className="w-12 h-12 flex-shrink-0 bg-emerald-50 rounded-xl flex items-center justify-center text-2xl">
                      {b.emoji}
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
            라이브러리로
          </button>

          <h2 className="text-xl font-semibold text-gray-800 mb-1 pr-8 flex items-center gap-2">
            <span className="text-2xl">{bundle.emoji}</span>
            {bundle.title}
          </h2>
          <p className="text-xs text-gray-500 mb-5">
            추가할 미션을 선택하고 점수·한도를 조정해주세요
          </p>

          <div className="space-y-3">
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
                    <div className="mt-3 pl-7 space-y-2.5">
                      {/* 인증 입력 유형 — 복수 선택 (사진+소감 통합 등) */}
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">
                          인증 입력 <span className="text-gray-400">(1개 이상 · 여러 개면 한 화면에서 같이 제출)</span>
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
                                  inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition disabled:opacity-50
                                  ${on
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}
                                `}
                              >
                                <Icon className="w-3 h-3" />
                                {t.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* 입력별 점수 · 필수 (084) */}
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">입력별 점수 · 필수</label>
                        <div className="space-y-1.5">
                          {[
                            { f: 'image_point', r: 'image_required', on: m.requires_image, label: '사진', Icon: ImageIcon },
                            { f: 'numeric_point', r: 'numeric_required', on: m.requires_numeric, label: '기록', Icon: BarChart3 },
                            { f: 'note_point', r: 'note_required', on: m.requires_note, label: '소감', Icon: MessageSquare },
                          ].filter(row => row.on).map(row => (
                            <div key={row.f} className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-0.5 w-11 flex-shrink-0 text-[11px] font-medium text-gray-600">
                                <row.Icon className="w-3 h-3 text-emerald-600" /> {row.label}
                              </span>
                              <div className="relative flex-1 min-w-0">
                                <input
                                  type="number"
                                  min={0}
                                  value={m[row.f] ?? 0}
                                  onChange={(e) => updateDraft(idx, row.f, e.target.value)}
                                  disabled={isSaving}
                                  className="w-full pl-2 pr-5 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">P</span>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                {[{ v: true, t: '필수' }, { v: false, t: '선택' }].map(opt => (
                                  <button
                                    key={opt.t}
                                    type="button"
                                    onClick={() => updateDraft(idx, row.r, opt.v)}
                                    disabled={isSaving}
                                    className={`px-2 py-1 rounded text-[11px] border transition disabled:opacity-50
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
                        <p className="mt-1 text-[11px] text-gray-500">최대 <span className="font-bold text-emerald-600">{draftTotal(m)}P</span></p>
                      </div>

                      {/* 하루 최대 */}
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-0.5">하루 최대 (선택)</label>
                        <input
                          type="number"
                          value={m.daily_limit ?? ''}
                          onChange={(e) => updateDraft(idx, 'daily_limit', e.target.value)}
                          min={1}
                          placeholder="무제한"
                          disabled={isSaving}
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                        />
                      </div>

                      {/* 승인 방식 — 자동 / 운영자 심사 토글 */}
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-0.5">
                          승인 방식
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => updateDraft(idx, 'verification_type', 'AUTO')}
                            disabled={isSaving}
                            className={`
                              px-2 py-1.5 rounded-md border text-xs transition disabled:opacity-50
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
                              px-2 py-1.5 rounded-md border text-xs transition disabled:opacity-50
                              ${m.verification_type === 'MANUAL'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}
                            `}
                          >
                            ✅ 운영자 심사
                          </button>
                        </div>
                      </div>

                      {/* 운영 일정 (선택) — MissionCreateModal 패턴 */}
                      <div>
                        <button
                          type="button"
                          onClick={() => updateDraft(idx, 'showSchedule', !m.showSchedule)}
                          disabled={isSaving}
                          className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-800 disabled:opacity-50"
                        >
                          {m.showSchedule ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          운영 일정 (선택) — {m.schedule_mode === 'ALL_DAYS' ? '매일' :
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
                          onClick={() => updateDraft(idx, 'showPreview', !m.showPreview)}
                          disabled={isSaving}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
                        >
                          {m.showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          참여자 제출 화면 미리보기
                        </button>
                        {m.showPreview && <SubmitPreview mission={m} />}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {error && (
            <p className="mt-3 p-2 bg-red-100 text-red-700 rounded text-sm text-center">
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
