import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ChevronRight } from 'lucide-react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'

// 운영자 프로그램 시작 셋업 — 첫 미션을 만든 뒤 「설문 → 환영 → 초대」를 화면 중앙에서 안내.
//   인라인 박스보다 강조되도록 중앙 팝업 체크리스트. 각 단계는 부모가 정의(steps).
//   steps: [{ key, icon, title, desc, done, guard?, ctaLabel, onAction }]
//   guard:true 인 단계(초대)는 앞 단계가 비어있으면 "기본값으로 두고 진행할까요?" 확인 후 실행.
export default function OperatorSetupModal({ steps = [], onClose }) {
  useBodyScrollLock(true)
  useBackButtonClose(true, onClose)
  const doneCount = steps.filter((s) => s.done).length
  const [confirming, setConfirming] = useState(null)   // 가드 확인 중인 step

  const handleStep = (s) => {
    if (s.guard) {
      const incomplete = steps.filter((x) => x.key !== s.key && !x.done)
      if (incomplete.length > 0) { setConfirming({ step: s, incomplete }); return }
    }
    s.onAction()
  }

  if (confirming) {
    const names = confirming.incomplete.map((x) => x.title).join(' · ')
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-black/50" />
        <motion.div
          className="relative w-full max-w-sm bg-white rounded-3xl p-6 text-center shadow-2xl"
          initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        >
          <div className="text-3xl mb-1 leading-none">📝</div>
          <h3 className="text-lg font-extrabold text-gray-900">아직 작성 안 한 게 있어요</h3>
          <p className="text-[13px] text-gray-600 mt-2 leading-relaxed break-keep">
            <b className="text-gray-800">{names}</b>를 아직 안 했어요.<br />기본값으로 두고 초대할까요?
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button type="button" onClick={() => { const s = confirming.step; setConfirming(null); s.onAction() }}
              className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition">
              기본값으로 초대하기
            </button>
            <button type="button" onClick={() => setConfirming(null)}
              className="w-full h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-[14px] font-bold transition">
              먼저 작성할게요
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
        initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        <div className="text-center mb-4">
          <div className="text-3xl mb-1 leading-none">🚀</div>
          <h3 className="text-lg font-extrabold text-gray-900">거의 다 됐어요!</h3>
          <p className="text-[12.5px] text-gray-500 mt-1 leading-relaxed break-keep">
            참여자를 맞이하기 전, 아래만 마치면 준비 끝이에요.
          </p>
          <p className="text-[11px] font-bold text-emerald-600 mt-1.5">{doneCount}/{steps.length} 완료</p>
        </div>

        <ul className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={s.key}
              className={`flex items-center gap-3 p-3 rounded-2xl border ${s.done ? 'bg-emerald-50/60 border-emerald-100' : 'bg-white border-gray-200'}`}>
              <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-extrabold ${s.done ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {s.done ? <Check className="w-4 h-4" /> : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-[13.5px] font-bold ${s.done ? 'text-emerald-700' : 'text-gray-800'}`}>{s.title}</p>
                <p className="text-[11.5px] text-gray-400 leading-snug truncate">{s.desc}</p>
              </div>
              {s.done ? (
                <span className="flex-shrink-0 text-[11px] font-bold text-emerald-600">완료</span>
              ) : (
                <button type="button" onClick={() => handleStep(s)}
                  className="flex-shrink-0 inline-flex items-center gap-0.5 pl-3 pr-2 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold transition active:scale-[0.98]">
                  {s.ctaLabel} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>

        <button type="button" onClick={onClose}
          className="mt-4 w-full h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-[14px] font-bold transition">
          나중에 할게요
        </button>
      </motion.div>
    </div>
  )
}
