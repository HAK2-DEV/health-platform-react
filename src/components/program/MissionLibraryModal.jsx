import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { supabase } from '../../supabaseClient'
import { ChevronLeft, Image as ImageIcon, BarChart3, MessageSquare } from 'lucide-react'
import { CATEGORY } from '../../lib/constants'
import { MISSION_LIBRARY } from '../../lib/missionLibrary'

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

  // 모달 닫힘 시 reset
  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setBundle(null)
      setDrafts([])
      setError(null)
      setIsSaving(false)
    }
  }, [isOpen])

  const openBundle = (b) => {
    setBundle(b)
    setDrafts(b.missions.map(m => ({ ...m, selected: true })))
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

  const selectedCount = drafts.filter(m => m.selected).length

  const handleAddSelected = async () => {
    if (!program || selectedCount === 0) {
      setError('미션을 1개 이상 선택해주세요')
      return
    }

    setIsSaving(true)
    setError(null)

    // 선택된 미션만 INSERT — MissionCreateModal 의 INSERT 스키마와 동일
    // bundle_title 은 ProgramDetailPage 에서 그루핑 키 (이모지+제목 통째로 저장 → UI 자동 표시)
    const bundleTitle = `${bundle.emoji} ${bundle.title}`
    const rows = drafts.filter(m => m.selected).map(m => ({
      program_id: program.id,
      feature: null,
      title: m.title,
      instruction: m.instruction || null,
      verification_type: m.verification_type,
      point: parseInt(m.point) || 0,
      daily_limit: m.daily_limit ? parseInt(m.daily_limit) : null,
      requires_image: m.requires_image,
      requires_numeric: m.requires_numeric,
      requires_note: m.requires_note,
      active_from: `${program.start_date}T00:00:00+09:00`,
      active_until: `${program.end_date}T23:59:59+09:00`,
      // 일정 옵션은 디폴트 — 운영자가 나중에 미션 수정으로 조정 (MVP 의 단순함)
      schedule_mode: 'ALL_DAYS',
      active_days: [],
      excluded_periods: [],
      bundle_title: bundleTitle,
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

  // ─── 1단계: 묶음 카드 목록 ─────────────────────────────────
  if (step === 1) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        {program && (
          <div className="p-6">
            <h2 className="text-xl font-medium text-gray-800 mb-1 pr-8">
              💡 추천 미션 라이브러리
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              묶음을 골라 한 번에 여러 미션을 추가할 수 있어요
            </p>

            <div className="grid gap-2.5">
              {MISSION_LIBRARY.map(b => {
                const cat = CATEGORY[b.category] || CATEGORY.ETC
                return (
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
                    <div className="w-12 h-12 flex-shrink-0 bg-gray-50 rounded-xl flex items-center justify-center text-2xl">
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
                        {cat.emoji} {cat.label} · 미션 {b.missions.length}개
                      </p>
                    </div>
                  </button>
                )
              })}

              {/* 직접 만들기 — 라이브러리에서 빠져나가 MissionCreateModal 로 전환 */}
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
                      추천 외 본인 프로그램에 맞는 미션을 자유롭게 추가
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

          <h2 className="text-xl font-medium text-gray-800 mb-1 pr-8 flex items-center gap-2">
            <span className="text-2xl">{bundle.emoji}</span>
            {bundle.title}
          </h2>
          <p className="text-xs text-gray-500 mb-5">
            추가할 미션을 선택하고 점수·한도를 조정해주세요
          </p>

          <div className="space-y-3">
            {drafts.map((m, idx) => {
              const types = []
              if (m.requires_image) types.push({ icon: ImageIcon, label: '사진' })
              if (m.requires_numeric) types.push({ icon: BarChart3, label: '기록' })
              if (m.requires_note) types.push({ icon: MessageSquare, label: '소감' })

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
                  {/* 헤더 — 토글 + 제목 + 인증유형 칩 */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={m.selected}
                      onChange={() => toggleMission(idx)}
                      disabled={isSaving}
                      className="mt-1 w-4 h-4 accent-emerald-500"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 text-sm">{m.title}</h3>
                      {m.instruction && (
                        <p className="text-xs text-gray-500 mt-0.5">{m.instruction}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {types.map((t, i) => {
                          const Icon = t.icon
                          return (
                            <span
                              key={i}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white/80 text-emerald-700 text-[10px] rounded font-medium border border-emerald-100"
                            >
                              <Icon className="w-3 h-3" />
                              {t.label}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </label>

                  {/* 점수 / 한도 / 승인 방식 미세 조정 — 선택된 미션만 활성 */}
                  {m.selected && (
                    <div className="mt-3 pl-7 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-0.5">
                            점수 (P)
                          </label>
                          <input
                            type="number"
                            value={m.point}
                            onChange={(e) => updateDraft(idx, 'point', e.target.value)}
                            min={1}
                            disabled={isSaving}
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-0.5">
                            하루 최대 (선택)
                          </label>
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
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddSelected}
                disabled={isSaving || selectedCount === 0}
                className="flex-[2] px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-md transition disabled:bg-gray-400"
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

export default MissionLibraryModal
