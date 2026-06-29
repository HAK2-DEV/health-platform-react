import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, BookOpen, ChevronRight, ChevronLeft, Loader2, Check, Users } from 'lucide-react'
import { PROGRAM_PRESETS, durationLabel } from '../../lib/programLibrary'
import { fetchPresetUsageCounts } from '../../lib/queries'

// 프로그램 생성 진입 선택화면 (2026-06-28 본인 결정: 마법사 전 「직접 만들기 vs 라이브러리」).
//   라이브러리 → 프리셋 선택 → 미션 체크(기본 전체) → DRAFT 생성. 미션 1개만 골라도 됨.
//   props:
//     onDirect — 「직접 만들기」 → 기존 마법사
//     onPickPreset(key, selectedMissionKeys) — DRAFT 생성 후 마법사 재진입
//     busyKey — 생성 중인 프리셋 key (스피너/중복 클릭 방지)

// 미션 한 줄 설명 — 일정/인증 방식 요약
function missionHint(m) {
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

  // 프리셋별 운영자 수 (마이그 135 RPC) — 라이브러리에서만 필요
  const { data: usage = {} } = useQuery({
    queryKey: ['preset-usage-counts'],
    queryFn: fetchPresetUsageCounts,
    enabled: view !== 'choose',
    staleTime: 5 * 60 * 1000,
  })

  const openDetail = (p) => {
    setPreset(p)
    setSelected(p.missions.map(m => m.key))          // 기본 전체 선택
    setDuration(p.durationDays)                       // 기본 기간
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
              <div className="text-4xl mb-2">🌱</div>
              <h1 className="text-xl font-extrabold text-gray-900">어떻게 시작할까요?</h1>
              <p className="text-[13px] text-gray-500 mt-1">처음부터 만들거나, 준비된 프로그램으로 빠르게 시작해요.</p>
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
                  <h2 className="font-bold text-gray-800">라이브러리에서 시작</h2>
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
              <h1 className="text-lg font-bold text-gray-900">프로그램 라이브러리</h1>
            </div>
            <p className="text-[12px] text-gray-500 mb-4">고르면 미션까지 채워진 임시저장 프로그램이 만들어져요. 이름·기간은 다음 단계에서 조정해요.</p>
            <div className="space-y-3">
              {PROGRAM_PRESETS.map(p => (
                <button key={p.key} type="button" onClick={() => openDetail(p)} className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-emerald-300 hover:bg-gray-50 transition text-left">
                  <span className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-2xl flex-shrink-0">{p.emoji}</span>
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
              <h1 className="text-lg font-bold text-gray-900 truncate">{preset.emoji} {preset.name}</h1>
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
                <p className="text-xs font-semibold text-gray-700 mb-1.5">기간</p>
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

            <p className="text-[12px] text-gray-400 mb-3">
              넣을 미션을 골라주세요{!preset.durationOptions?.length ? ` · 기본 ${preset.durationDays}일` : ''}
            </p>

            <div className="space-y-2 mb-6">
              {preset.missions.map(m => {
                const on = selected.includes(m.key)
                return (
                  <button key={m.key} type="button" onClick={() => toggle(m.key)} disabled={!!busyKey}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition disabled:opacity-60 ${on ? 'border-emerald-400 bg-emerald-50/60' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 border ${on ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-transparent'}`}>
                      <Check className="w-4 h-4" strokeWidth={3} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{m.title}</p>
                      <p className="text-[12px] text-gray-500 leading-snug">{m.instruction}</p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">{missionHint(m)} · {m.point ?? 10}P</p>
                    </div>
                  </button>
                )
              })}
            </div>

            <button type="button" onClick={() => onPickPreset(preset.key, selected, duration)} disabled={!!busyKey || selected.length === 0}
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
