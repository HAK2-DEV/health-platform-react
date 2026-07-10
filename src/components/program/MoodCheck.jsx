import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import { fetchTodayMood, upsertMood } from '../../lib/queries'

// 오늘의 기분 체크 — 금연 테마 전용 위젯 (본인 결정 B, 2026-06-28).
//   미션과 별개. 하루 1건(mood_logs upsert). 5단계 이모지 선택 + 기록.
//   아이콘: /icons/mood/{key}.png (없으면 emoji 폴백).
//   props: programId, userId
const MOODS = [
  { value: 5, key: 'great', label: '상쾌해요', emoji: '😄' },
  { value: 4, key: 'good',  label: '괜찮아요', emoji: '🙂' },
  { value: 3, key: 'ok',    label: '보통이에요', emoji: '😐' },
  { value: 2, key: 'edgy',  label: '예민해요', emoji: '😟' },
  { value: 1, key: 'hard',  label: '힘들어요', emoji: '😣' },
]

function MoodCheck({ programId, userId }) {
  const queryClient = useQueryClient()
  const queryKey = ['mood-today', programId, userId]

  const { data: savedMood } = useQuery({
    queryKey,
    queryFn: () => fetchTodayMood({ programId, userId }),
    enabled: !!programId && !!userId,
  })

  const [selected, setSelected] = useState(null)
  useEffect(() => { if (savedMood != null) setSelected(savedMood) }, [savedMood])

  const mutation = useMutation({
    mutationFn: (mood) => upsertMood({ programId, userId, mood }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const recorded = savedMood != null
  const dirty = selected != null && selected !== savedMood

  return (
    <div className="relative overflow-hidden bg-white rounded-2xl shadow-elevated p-3 mb-[9px] mx-auto w-[398px] max-w-full">
      {/* 클립보드 일러스트 — 우상단 장식 (없으면 숨김) */}
      <img
        src="/illustrations/themes/mood-check.webp"
        alt="" aria-hidden="true"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
        className="absolute top-0 right-1 w-28 h-28 object-contain pointer-events-none"
      />
      <div className="relative z-10 pr-24">
      <h3 className="text-[15px] font-extrabold text-gray-900">오늘의 기분 체크</h3>
      <p className="text-[12px] text-gray-500 mt-0.5">
        {recorded ? '오늘 기분을 기록했어요. 바꿀 수도 있어요.' : '지금 내 기분을 선택해보세요.'}
      </p>
      </div>

      <div className="relative z-10 flex gap-1.5 mt-1.5 mb-1.5">
        {MOODS.map(m => {
          const on = selected === m.value
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setSelected(m.value)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border transition ${on ? 'border-emerald-400 bg-emerald-50/70' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <span className="relative w-8 h-8 flex items-center justify-center">
                {/* emoji 를 뒤에 깔고, 아이콘 img 가 덮음 — img 실패 시 숨겨져 emoji 노출 */}
                <span className="text-2xl leading-none">{m.emoji}</span>
                <img
                  src={`/icons/mood/${m.key}.png`}
                  alt=""
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                  className="absolute inset-0 w-8 h-8 object-contain"
                />
                {on && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-white">
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className={`text-[10px] leading-tight ${on ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>{m.label}</span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => selected != null && mutation.mutate(selected)}
        disabled={selected == null || mutation.isPending || (recorded && !dirty)}
        className="relative z-10 w-full h-8 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
      >
        {mutation.isPending
          ? (<><Loader2 className="w-4 h-4 animate-spin" /> 기록 중...</>)
          : recorded && !dirty
            ? '오늘 기분 기록 완료 ✓'
            : recorded ? '기분 변경하기' : '기분 기록하기'}
      </button>
    </div>
  )
}

export default MoodCheck
