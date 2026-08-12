import { useState } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Heart, Pencil } from 'lucide-react'
import { quitRecovery, RECOVERY_MILESTONES } from '../../lib/quitRecovery'
import FitText from '../common/FitText'

// 금연 테마 프로그램 — 상세 프로필 히어로 (목업 기반, 2026-06-28).
//   theme === 'QUIT_SMOKING' 일 때 기본 프로필 카드 대신 렌더.
//   배경 일러스트: /illustrations/themes/quit-smoking.png — 카드 전체 배경(cover, 상단 정렬로 인물 머리 보존),
//   좌측은 초록 그라데이션으로 덮어 텍스트(좌측 절반)와 안 겹치게. 없으면 초록 배경만.
//   props: programId, streak, savedAmount(원, null=준비중), healthScore(점, null=준비중), statusLabel
//   ※ 절약/건강 점수 계산식은 금연 데이터 모델 확정 후 연결 (현재 레이아웃 스캐폴드).
function QuitSmokingHero({ programId, streak = 0, savedAmount = null, healthScore = null, statusLabel = null, smokedToday = false, actionLabel = '기록하기', onAction }) {
  const navigate = useNavigate()
  const handleAction = onAction || (() => navigate(`/programs/${programId}?tab=missions`))
  // 오늘 절약 = (아낀 − 흡연)×개비당가. 흡연이 더 많으면 음수 → 빨간 마이너스 표시.
  const savingNeg = savedAmount != null && savedAmount < 0
  const savingValue = savedAmount == null ? '—' : `${savingNeg ? '−' : ''}${Math.abs(savedAmount).toLocaleString()}원`
  const rec = quitRecovery(streak)  // 연속 금연일 → 회복 단계
  const [recOpen, setRecOpen] = useState(false)
  useBodyScrollLock(recOpen)  // 기록 오버레이 — iOS 배경 스크롤 방지

  return (
    <>
    <div className="relative rounded-2xl overflow-hidden shadow-elevated mb-[9px] mx-auto w-[398px] max-w-full h-[220px] bg-gradient-to-br from-emerald-50 to-teal-50">
      {/* 일러스트 — 카드 전체 배경(cover), 상단 정렬(머리 보존). 없으면 숨김 */}
      <img
        src="/illustrations/themes/quit-smoking.webp"
        alt="" aria-hidden="true"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
        className="absolute inset-0 w-full h-full object-cover object-top"
      />
      {/* 좌측 텍스트 가독 그라데이션 — 52%에서 완전 투명 → 우측 인물(좌측 사람 포함) 안 가림 */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#eef7f1] from-[15%] to-transparent to-[52%]" />

      {/* 진행중 배지 — 좌상단 */}
      {statusLabel && (
        <span className="absolute top-3 left-4 z-20 inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[11px] font-bold shadow-sm">
          {statusLabel}
        </span>
      )}
      {/* 기록하기 — 우상단 */}
      <button
        type="button"
        onClick={handleAction}
        className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold shadow-sm transition"
      >
        <Pencil className="w-3.5 h-3.5" /> {actionLabel}
      </button>

      <div className="relative z-10 h-full flex flex-col px-4 pt-4 pb-3">
        {/* 텍스트 — 좌측 절반 (우측 인물과 안 겹침, 💚도 좌측에 머묾) */}
        <div className="max-w-[52%]">
          <h1 className="text-xl font-semibold text-gray-900 leading-tight">{smokedToday ? '오늘도 금연 도전!' : '오늘도 금연 성공!'}</h1>
          <p className="text-[12px] font-semibold text-gray-800 mt-1 leading-snug">작은 실천이 큰 변화를 만들어요 <span className="text-emerald-500">💚</span></p>
          <p className="text-[12px] text-gray-600 mt-1.5 leading-snug">서로 응원하며, 건강한 습관을 <br />함께 만들어요!</p>
        </div>

        {/* 지표 카드 — 하단 정렬 (연속 금연 / 오늘 절약 / 건강 점수) */}
        <div className="mt-auto rounded-xl bg-white/90 backdrop-blur-sm shadow-sm border border-white/60">
          <div className="flex">
            <Stat icon={<CalendarDays className="w-4 h-4 text-emerald-500" />} label="연속 금연" value={`${streak}일`} />
            <Divider />
            <Stat icon={<span className="text-[15px] leading-none text-gray-500">₩</span>} label="오늘 절약" value={savingValue} valueColor={savingNeg ? 'text-red-500' : 'text-emerald-600'} />
            <Divider />
            <Stat icon={<Heart className="w-4 h-4 text-rose-400 fill-current" />} label="회복 단계" value={`${rec.stage}단계`} onClick={() => setRecOpen(true)} />
          </div>
        </div>
      </div>
    </div>

    {/* 회복 단계 모달 — 「회복 단계」 클릭 시 중앙에 */}
    {recOpen && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40" onClick={() => setRecOpen(false)}>
        <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
          <div className="text-center mb-4">
            <div className="text-3xl mb-1">🌿</div>
            <h2 className="text-lg font-extrabold text-gray-900">금연 회복 단계</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">연속 금연 {streak}일 · {rec.stage}/{rec.total}단계</p>
          </div>
          <ul className="space-y-1.5">
            {RECOVERY_MILESTONES.map((m, i) => {
              const reached = streak >= m.days
              const isCurrent = (i + 1) === rec.stage
              return (
                <li key={i} className={`flex items-start gap-2.5 p-2.5 rounded-xl ${isCurrent ? 'bg-emerald-50 border border-emerald-200' : ''}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${reached ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{reached ? '✓' : i + 1}</span>
                  <div className="min-w-0">
                    <p className={`text-[13px] font-bold ${isCurrent ? 'text-emerald-700' : reached ? 'text-gray-800' : 'text-gray-400'}`}>
                      {m.title} <span className="text-[11px] font-normal text-gray-400">· {m.days === 0 ? '시작' : `${m.days}일~`}</span>
                    </p>
                    <p className={`text-[11px] leading-snug ${reached ? 'text-gray-500' : 'text-gray-400'}`}>{m.desc}</p>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="text-[10px] text-gray-400 text-center mt-3">일반적인 건강 정보예요 · 개인차가 있어요</p>
          <button type="button" onClick={() => setRecOpen(false)} className="w-full h-10 mt-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition">닫기</button>
        </div>
      </div>
    )}
    </>
  )
}

function Stat({ icon, label, value, valueColor = 'text-emerald-600', onClick }) {
  const inner = (
    <>
      <div className="flex items-center justify-center gap-1 text-[12px] text-gray-500 mb-1.5">
        {icon}<span className="whitespace-nowrap">{label}</span>
      </div>
      <FitText max={20} min={12} className={`font-extrabold ${valueColor} leading-none text-center`} title={typeof value === 'string' ? value : undefined}>{value}</FitText>
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="flex-1 px-2 py-4 text-center rounded-lg hover:bg-gray-50 transition">
        {inner}
      </button>
    )
  }
  return <div className="flex-1 px-2 py-4 text-center">{inner}</div>
}
function Divider() {
  return <div className="w-px my-3 bg-gray-200" />
}

export default QuitSmokingHero
