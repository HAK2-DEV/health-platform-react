import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../supabaseClient'
import Modal from '../common/Modal'

// 랭킹 설정 — 랭킹에 관한 토글만. (운영자 메뉴 「메뉴바 설정 → 랭킹 설정」)
//   ranking_enabled / podium / trend / period_filter. 랭킹 OFF 면 하위 토글 자동 OFF.
//   props: program, isOpen, onClose, onSuccess
function ToggleRow({ icon, title, desc, on, color, onClick, disabled }) {
  const ring = { sky: ['border-sky-500 bg-sky-50', 'text-sky-700', 'bg-sky-500'],
    amber: ['border-amber-500 bg-amber-50', 'text-amber-700', 'bg-amber-500'],
    violet: ['border-violet-500 bg-violet-50', 'text-violet-700', 'bg-violet-500'],
    cyan: ['border-cyan-500 bg-cyan-50', 'text-cyan-700', 'bg-cyan-500'] }[color] || ['border-emerald-500 bg-emerald-50', 'text-emerald-700', 'bg-emerald-500']
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`w-full mb-3 p-3 rounded-lg border-2 text-left transition disabled:opacity-50 ${on ? ring[0] : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      <div className="flex items-start gap-2.5">
        <span className="text-xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${on ? ring[1] : 'text-gray-800'}`}>{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
        </div>
        <div className={`relative w-9 h-5 rounded-full flex-shrink-0 transition mt-0.5 ${on ? ring[2] : 'bg-gray-300'}`}>
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </div>
      </div>
    </button>
  )
}

function RankingSettingsModal({ program, isOpen, onClose, onSuccess }) {
  const [podiumEnabled, setPodiumEnabled] = useState(false)
  const [trendEnabled, setTrendEnabled] = useState(false)
  const [periodFilterEnabled, setPeriodFilterEnabled] = useState(false)
  const [error, setError] = useState(null)

  const rankingOn = program?.ranking_enabled !== false  // 랭킹 메뉴 표시(프로그램 설정)

  useEffect(() => {
    if (!program || !isOpen) return
    setPodiumEnabled(!!program.podium_enabled)
    setTrendEnabled(!!program.trend_enabled)
    setPeriodFilterEnabled(!!program.period_filter_enabled)
    setError(null)
  }, [program, isOpen])

  const mutation = useMutation({
    mutationFn: async () => {
      const { error: e } = await supabase
        .from('programs')
        .update({
          podium_enabled: podiumEnabled,
          trend_enabled: trendEnabled,
          period_filter_enabled: periodFilterEnabled,
        })
        .eq('id', program.id)
      if (e) throw e
    },
    onSuccess: () => { onSuccess?.(); onClose() },
    onError: (e) => setError(e.message || '저장에 실패했어요'),
  })

  if (!program) return null
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-1">🏆 랭킹 설정</h2>
        <p className="text-xs text-gray-500 mb-4">{program.name}</p>

        {!rankingOn && (
          <p className="mb-3 p-2.5 bg-amber-50 border border-amber-200 text-amber-700 text-[12px] rounded-lg leading-relaxed">
            지금은 「랭킹 메뉴 표시」가 꺼져 있어요. 아래 설정은 <b>프로그램 설정에서 랭킹 메뉴를 켜면</b> 적용돼요.
          </p>
        )}

        <ToggleRow icon="🏆" title="랭킹 Top 3 (시상대)" color="amber"
          desc="랭킹 페이지에 1·2·3등 시상대 시각화. 끄면 평면 랭킹."
          on={podiumEnabled} disabled={mutation.isPending} onClick={() => setPodiumEnabled(v => !v)} />
        <ToggleRow icon="📊" title="본인 14일 점수 추세" color="violet"
          desc="본인 요약 카드에 최근 14일 점수 스파크라인. 꾸준함 시각화."
          on={trendEnabled} disabled={mutation.isPending} onClick={() => setTrendEnabled(v => !v)} />
        <ToggleRow icon="⏱️" title="기간 필터 (최근 7일 / 30일)" color="cyan"
          desc="참여자가 '전체 / 최근 7일 / 최근 30일' 토글로 단기 분위기 확인 가능."
          on={periodFilterEnabled} disabled={mutation.isPending} onClick={() => setPeriodFilterEnabled(v => !v)} />

        {error && <p className="mb-3 p-2 bg-red-100 text-red-700 rounded text-sm text-center">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={mutation.isPending}
            className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50">닫기</button>
          <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-[1.4] h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition disabled:opacity-50">
            {mutation.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default RankingSettingsModal
