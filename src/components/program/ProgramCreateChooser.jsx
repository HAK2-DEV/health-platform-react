import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, BookOpen, ChevronRight, ChevronLeft, ChevronDown, Loader2, Check, Users } from 'lucide-react'
import { PROGRAM_PRESETS, durationLabel } from '../../lib/programLibrary'
import { QUIZ_AUDIENCES } from '../../lib/quizLibrary'
import { fetchPresetUsageCounts } from '../../lib/queries'

// 프리셋 quizTopicKey 에 맞는 퀴즈가 있는 대상자만 (없으면 대상자 선택 UI 미표시)
const audiencesForPreset = (p) => (p?.quizTopicKey ? QUIZ_AUDIENCES.filter(a => (a.topics || []).some(t => t.key === p.quizTopicKey)) : [])
import { PROGRAM_THEME } from '../../lib/constants'

// 프로그램 생성 진입 선택화면 (2026-06-28 본인 결정: 마법사 전 「직접 만들기 vs 라이브러리」).
//   라이브러리 → 프리셋 선택 → 미션 체크(기본 전체) → DRAFT 생성. 미션 1개만 골라도 됨.
//   props:
//     onDirect — 「직접 만들기」 → 기존 마법사
//     onPickPreset(key, selectedMissionKeys) — DRAFT 생성 후 마법사 재진입
//     busyKey — 생성 중인 프리셋 key (스피너/중복 클릭 방지)

// 미션 한 줄 설명 — 일정/인증 방식 요약
function missionHint(m) {
  if (m.verify_style === 'meditation') return `명상 타이머 · ${Math.round((m.meditation_seconds || 180) / 60)}분`
  if (m.verify_style === 'meal') return 'AI 칼로리 기록'
  const parts = []
  if (m.metric_aggregate) parts.push('누적')
  else if (m.schedule_mode === 'WEEKDAYS') parts.push('평일')
  else if (m.schedule_mode === 'WEEKENDS') parts.push('주말')
  const proof = []
  if (m.requires_image ?? true) proof.push('사진')
  if (m.requires_numeric) proof.push(m.metrics?.[0]?.label || '숫자')
  if (m.requires_note) proof.push('소감')
  parts.push(proof.join('+'))
  return parts.filter(Boolean).join(' · ')
}

function ProgramCreateChooser({ onDirect, onPickPreset, onBack, busyKey }) {
  const [view, setView] = useState('choose')       // 'choose' | 'library' | 'detail'
  const [preset, setPreset] = useState(null)        // 선택된 프리셋
  const [selected, setSelected] = useState([])      // 선택된 미션 key[]
  const [duration, setDuration] = useState(null)    // 선택된 기간(일)
  const [audienceKey, setAudienceKey] = useState('general_adult')  // 번들 퀴즈 대상자
  const [recOpen, setRecOpen] = useState(false)     // 추천 미션 섹션 펼침

  // 프리셋별 운영자 수 (마이그 135 RPC) — 라이브러리에서만 필요
  const { data: usage = {} } = useQuery({
    queryKey: ['preset-usage-counts'],
    queryFn: fetchPresetUsageCounts,
    enabled: view !== 'choose',
    staleTime: 5 * 60 * 1000,
  })

  const openDetail = (p) => {
    setPreset(p)
    setSelected(p.missions.map(m => m.key))          // 메인 미션만 기본 체크(추천은 미체크)
    setDuration(p.durationDays)                       // 기본 기간
    setAudienceKey(audiencesForPreset(p)[0]?.key || 'general_adult')  // 기본 대상자
    setRecOpen(false)
    setView('detail')
  }
  const toggle = (key) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  return (
    <div className="min-h-screen bg-white px-5 pt-8 pb-10 max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {/* ─── 선택: 직접 vs 라이브러리 ─── */}
        {view === 'choose' && (
          <motion.div key="choose" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
            {onBack && (
              <button type="button" onClick={onBack} className="p-1.5 -ml-1.5 mb-2 rounded-full hover:bg-gray-100" aria-label="뒤로">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <div className="text-center mb-7">
              <img src="/icons/growth/sprout.png" alt="" aria-hidden="true" className="w-24 h-24 object-contain mx-auto mb-2" />
              <h1 className="text-xl font-extrabold text-gray-900">어떻게 시작할까요?</h1>
            </div>
            <div className="space-y-3">
              <button type="button" onClick={onDirect} className="w-full flex items-center gap-4 p-5 rounded-2xl border border-gray-200 hover:border-emerald-300 hover:bg-gray-50 transition text-left">
                <span className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><Sparkles className="w-6 h-6" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-gray-800">직접 만들기</h2>
                  <p className="text-xs text-gray-500 mt-0.5">빈 화면에서 내 프로그램을 자유롭게 구성해요</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
              <button type="button" onClick={() => setView('library')} className="w-full flex items-center gap-4 p-5 rounded-2xl border border-gray-200 hover:border-emerald-300 hover:bg-gray-50 transition text-left">
                <span className="w-12 h-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0"><BookOpen className="w-6 h-6" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-gray-800">템플릿에서 시작</h2>
                  <p className="text-xs text-gray-500 mt-0.5">미션까지 준비된 프로그램을 골라 바로 시작해요</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── 라이브러리 목록 ─── */}
        {view === 'library' && (
          <motion.div key="library" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.25 }}>
            <div className="flex items-center gap-2 mb-5">
              <button type="button" onClick={() => setView('choose')} className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
              <h1 className="text-lg font-bold text-gray-900">프로그램 템플릿</h1>
            </div>
            <p className="text-[12px] text-gray-500 mb-4">고르면 미션까지 채워진 임시저장 프로그램이 만들어져요. 이름·기간은 다음 단계에서 조정해요.</p>
            <div className="space-y-3">
              {PROGRAM_PRESETS.map(p => (
                <button key={p.key} type="button" onClick={() => openDetail(p)} className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-emerald-300 hover:bg-gray-50 transition text-left">
                  <span className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-2xl flex-shrink-0">
                    {p.iconSrc ? <img src={p.iconSrc} alt="" className="w-8 h-8 object-contain" /> : p.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-gray-800 truncate">{p.name}</h2>
                    <p className="text-[12px] text-gray-500 truncate">{p.description}</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      미션 {p.missions.length}개 · {p.durationDays}일
                      {usage[p.key] > 0 && (
                        <span className="text-gray-400"> · 👥 운영자 {usage[p.key]}명</span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── 프리셋 상세 + 미션 선택 ─── */}
        {view === 'detail' && preset && (
          <motion.div key="detail" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.25 }}>
            <div className="flex items-center gap-2 mb-4">
              <button type="button" onClick={() => setView('library')} disabled={!!busyKey} className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 disabled:opacity-50"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
              <h1 className="text-lg font-bold text-gray-900 truncate flex items-center gap-1.5 min-w-0">
                {preset.iconSrc && <img src={preset.iconSrc} alt="" className="w-6 h-6 object-contain flex-shrink-0" />}
                <span className="truncate">{preset.iconSrc ? preset.name : `${preset.emoji} ${preset.name}`}</span>
              </h1>
            </div>
            <p className="text-[13px] text-gray-600 mb-1">{preset.description}</p>
            {usage[preset.key] > 0 && (
              <p className="inline-flex items-center gap-1 text-[12px] text-emerald-700 font-medium mb-1">
                <Users className="w-3.5 h-3.5" /> {usage[preset.key]}명의 운영자가 이 프로그램으로 시작했어요
              </p>
            )}
            {/* 기간 선택 — durationOptions 있을 때(예: 금연 1/3/6개월) */}
            {preset.durationOptions?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-700 mb-1.5">
                  {preset.theme === PROGRAM_THEME.QUIT_SMOKING ? '금연 프로그램 기간을 설정해주세요' : '기간을 설정해주세요'}
                </p>
                <div className="flex gap-2">
                  {preset.durationOptions.map(d => (
                    <button key={d} type="button" onClick={() => setDuration(d)} disabled={!!busyKey}
                      className={`flex-1 h-9 rounded-lg text-sm font-bold border transition ${duration === d ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {durationLabel(d)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[15px] font-semibold text-gray-800 mb-3">
              미션을 골라주세요
              {!preset.durationOptions?.length && (
                <span className="text-[12px] font-normal text-gray-400 ml-1.5">· 기본 {preset.durationDays}일</span>
              )}
            </p>

            <div className="space-y-2.5 mb-6">
              {preset.missions.map(m => {
                const on = selected.includes(m.key)
                return (
                  <button key={m.key} type="button" onClick={() => toggle(m.key)} disabled={!!busyKey}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition disabled:opacity-60 ${on ? 'border-emerald-400 bg-emerald-50/60' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <span className={`w-6 h-6 mt-0.5 rounded-md flex items-center justify-center flex-shrink-0 border ${on ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-transparent'}`}>
                      <Check className="w-4 h-4" strokeWidth={3} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-gray-900">{m.title}</p>
                      <p className="text-[14px] text-gray-600 leading-relaxed mt-1 break-keep">{m.instruction}</p>
                      {/* 랭킹 없는 프리셋(금연 등)은 포인트가 무의미 → 숨김 */}
                      <p className="text-[12px] font-semibold text-emerald-700 mt-1.5">
                        {missionHint(m)}{preset.rankingEnabled !== false ? ` · ${m.point ?? 10}P` : ''}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 추천 미션 — 접이식, 기본 미체크(서브 미션) */}
            {preset.recommendedMissions?.length > 0 && (
              <div className="mb-6">
                <button type="button" onClick={() => setRecOpen(o => !o)} disabled={!!busyKey}
                  className="w-full flex items-center gap-1.5 mb-2.5 disabled:opacity-60">
                  <span className="text-[14px] font-bold text-gray-800">💡 추천 미션</span>
                  <span className="text-[12px] text-gray-400">{preset.recommendedMissions.length}개 · 필요하면 추가</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${recOpen ? 'rotate-180' : ''}`} />
                </button>
                {recOpen && (
                  <div className="space-y-2.5">
                    {preset.recommendedMissions.map(m => {
                      const on = selected.includes(m.key)
                      return (
                        <button key={m.key} type="button" onClick={() => toggle(m.key)} disabled={!!busyKey}
                          className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition disabled:opacity-60 ${on ? 'border-emerald-400 bg-emerald-50/60' : 'border-gray-200 hover:bg-gray-50'}`}>
                          <span className={`w-6 h-6 mt-0.5 rounded-md flex items-center justify-center flex-shrink-0 border ${on ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-transparent'}`}>
                            <Check className="w-4 h-4" strokeWidth={3} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-bold text-gray-900">{m.title}</p>
                            <p className="text-[14px] text-gray-600 leading-relaxed mt-1 break-keep">{m.instruction}</p>
                            <p className="text-[12px] font-semibold text-emerald-700 mt-1.5">
                              {missionHint(m)}{preset.rankingEnabled !== false ? ` · ${m.point ?? 10}P` : ''}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 대상자 선택 — 맞는 지식 퀴즈가 함께 발행됨 (퀴즈 있는 프리셋만) */}
            {audiencesForPreset(preset).length > 1 && (
              <div className="mb-6">
                <p className="text-[15px] font-bold text-gray-900">누구를 위한 프로그램인가요?</p>
                <p className="text-[13px] text-gray-500 mb-2.5">대상자에 맞는 <b className="text-gray-700">지식 퀴즈</b>가 함께 만들어져요.</p>
                <div className="flex gap-2">
                  {audiencesForPreset(preset).map(a => {
                    const on = audienceKey === a.key
                    return (
                      <button key={a.key} type="button" onClick={() => setAudienceKey(a.key)} disabled={!!busyKey}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-[13px] font-bold transition disabled:opacity-60 ${on ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {a.emoji} {a.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <button type="button" onClick={() => onPickPreset(preset.key, selected, duration, audienceKey)} disabled={!!busyKey || selected.length === 0}
              className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-60">
              {busyKey === preset.key
                ? (<><Loader2 className="w-4 h-4 animate-spin" /> 만드는 중...</>)
                : `이 프로그램으로 시작 (미션 ${selected.length}개)`}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ProgramCreateChooser
