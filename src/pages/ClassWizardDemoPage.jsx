import { useState } from 'react'
import WizardLayout from '../components/program/ProgramWizard/WizardLayout'

// 데모 — 마법사 「강사 클래스 운영」 토글 + 출석 확정 방식 선택(설명 카드). /class-wizard-demo
//   실제로는 2단계(프로그램 옵션)에서 운동/달리기 카테고리일 때 노출 예정. 문구·UI 확정용.
const METHODS = [
  {
    key: 'operator_roll', icon: '/icons/class/roll.png', title: '운영자 출석부 체크', tag: '추천',
    desc: '클래스가 끝나면 운영자(또는 강사)가 참가자 명단에서 참석자를 직접 체크해요. 가장 정확하고 부정 출석이 없어요.',
    caution: '매 클래스마다 명단 체크 한 번이 필요해요.',
  },
  {
    key: 'venue_code', icon: '/icons/class/code.png', title: '현장 출석 코드',
    desc: '강사가 현장에서 그날의 6자리 코드를 알려주면, 참가자가 앱에 입력해 스스로 출석해요. 운영자 손이 덜 가요.',
    caution: '코드가 밖으로 공유되면 현장에 없어도 출석될 수 있어요.',
  },
  {
    key: 'self_approve', icon: '/icons/class/hand.png', title: '자가출석 + 운영자 승인',
    desc: "참가자가 '출석'을 누르면 신청이 쌓이고, 운영자가 미션 인증처럼 한 번에 승인/거절해요. 익숙한 방식이에요.",
    caution: '승인 전까지는 포인트가 지급되지 않아요.',
  },
]

function MethodCard({ m, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full p-4 rounded-[10px] border-2 text-left transition ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
      style={{ marginBottom: '9px' }}
    >
      <div className="flex items-start gap-3">
        <img src={m.icon} alt="" aria-hidden="true" className="w-9 h-9 object-contain flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-bold ${selected ? 'text-emerald-700' : 'text-gray-800'}`}>{m.title}</p>
            {m.tag && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold flex-shrink-0">{m.tag}</span>}
            <span className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-emerald-500' : 'border-gray-300'}`}>
              {selected && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
            </span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed break-keep mt-1.5">{m.desc}</p>
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-2 break-keep">⚠️ {m.caution}</p>
        </div>
      </div>
    </button>
  )
}

export default function ClassWizardDemoPage() {
  const [enabled, setEnabled] = useState(false)
  const [method, setMethod] = useState('operator_roll')

  return (
    <WizardLayout currentStep={2}>
      <h2 className="text-xl font-semibold text-gray-800" style={{ marginBottom: '5px' }}>강사 클래스 운영</h2>
      <p className="text-sm text-gray-600 break-keep" style={{ marginBottom: '18px' }}>
        발행 후에도 「프로그램 설정」에서 바꿀 수 있어요.
      </p>

      {/* 기능 토글 */}
      <button
        type="button"
        onClick={() => setEnabled(v => !v)}
        className={`w-full p-4 rounded-[10px] border-2 text-left transition ${enabled ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
        style={{ marginBottom: '9px' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">🧘</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className={`font-medium whitespace-nowrap ${enabled ? 'text-emerald-700' : 'text-gray-800'}`}>강사 클래스 운영</p>
              <div className={`relative w-10 h-6 rounded-full flex-shrink-0 transition ${enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed break-keep mt-2">
              특정 날짜에 외부 강사가 진행하는 클래스(요가·필라테스·크로스핏 등) 일정을 운영해요. 참가자는 일정을 보고 신청·출석할 수 있어요.
            </p>
          </div>
        </div>
      </button>

      {/* 출석 확정 방식 — 토글 ON 일 때만 */}
      {enabled && (
        <div className="rounded-[10px] border-2 border-emerald-200 bg-emerald-50/40 p-4" style={{ marginTop: '9px', marginBottom: '18px' }}>
          <p className="text-base font-bold text-gray-800" style={{ marginBottom: '3px' }}>출석 확정 방식</p>
          <p className="text-sm text-gray-600 leading-relaxed break-keep" style={{ marginBottom: '12px' }}>
            참가자의 클래스 출석을 어떻게 확정할지 골라요.<br />출석이 확정되면 <b className="text-emerald-700">포인트·연속인증</b>에 반영돼요.
          </p>
          {METHODS.map(m => (
            <MethodCard key={m.key} m={m} selected={method === m.key} onSelect={() => setMethod(m.key)} />
          ))}
        </div>
      )}

      {/* 버튼 (데모용) */}
      <div className="flex" style={{ gap: '9px' }}>
        <button type="button" className="flex-1 px-3 py-3 bg-gray-100 text-gray-700 font-medium rounded-[10px] text-sm">이전</button>
        <button type="button" className="flex-1 px-3 py-3 bg-gray-100 text-gray-700 font-medium rounded-[10px] text-sm">임시 저장</button>
        <button type="button" className="flex-1 px-3 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-bold rounded-[10px] text-sm">다음</button>
      </div>
    </WizardLayout>
  )
}
