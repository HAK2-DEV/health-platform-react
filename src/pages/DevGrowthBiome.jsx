import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Droplets, Sun } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { fetchActivePrograms, fetchProgramOverview } from '../lib/queries'
import { computeStage, computeGrowthRatio, getStageLabel } from '../lib/gamification'
import { biomeForCategories, programLengthDays } from '../lib/biomes'
import ClayIslandScene from '../components/growth/ClayIslandScene'

// 성장 탭 v1 (베타) — 클레이 바이옴 섬. 숨긴 /dev/growth 에서 개발(참여자 비노출).
//   프로그램 1개 = 섬 1개, 인증(물)·출석(햇빛)이 쌓일수록 섬에 식물이 차오른다.
//   실데이터: fetchActivePrograms + fetchProgramOverview + gamification.js. 아트는 교체 가능.

const STAGE_MSG = [
  '씨앗을 심을 시간이에요',
  '씨앗이 자라 새싹이 되었어요~!',
  '새싹이 쑥쑥 자라고 있어요',
  '줄기가 단단해지고 있어요',
  '곧 꽃이 필 것 같아요',
  '활짝 만개했어요! 🎉',
]

export default function DevGrowthBiome() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user?.id
  const [selectedId, setSelectedId] = useState(null)

  const { data: programs, isLoading: loadingPrograms } = useQuery({
    queryKey: ['programs', 'active', userId],
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  // 참여 프로그램 정렬(최근 참여 우선) + 선택
  const sorted = useMemo(() => {
    return [...(programs || [])].sort((a, b) => new Date(b._joinedAt || 0) - new Date(a._joinedAt || 0))
  }, [programs])
  const program = sorted.find(p => p.id === selectedId) || sorted[0] || null

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['program-overview', program?.id, userId],
    queryFn: () => fetchProgramOverview(program.id, userId),
    enabled: !!program?.id && !!userId,
  })

  // 개발 테스트: 참여 프로그램이 없어도 씬을 띄우도록 목 데이터로 폴백(3D 파이프라인 확인용).
  const usingMock = !loadingPrograms && !program
  const eff = program || (usingMock ? { id: '__mock__', name: '테스트 섬', categories: ['WALKING'] } : null)
  const biome = biomeForCategories(eff?.categories)
  const activeDays = usingMock ? 4 : (overview?.activeDays || 0)
  const totalCount = usingMock ? 6 : (overview?.totalCount || 0)
  const programDays = programLengthDays(eff)
  const stage = computeStage({ activeDays, totalCount, programDays })
  const ratio = computeGrowthRatio({ activeDays, totalCount, programDays })
  const plantCount = Math.max(1, Math.min(12, 1 + Math.floor(totalCount / 2)))
  const bloomed = stage >= 5
  const pct = Math.round(ratio * 100)

  const loading = loadingPrograms || (!!program && loadingOverview)

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col"
      style={{ background: `linear-gradient(180deg, ${biome.sky[0]} 0%, ${biome.sky[1]} 100%)` }}>
      {/* 상단 바 */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1" style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <button type="button" onClick={() => navigate(-1)} aria-label="뒤로"
          className="w-9 h-9 rounded-full bg-white/70 backdrop-blur flex items-center justify-center text-gray-700 shadow-sm">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="ml-auto text-[10px] font-bold text-emerald-900/50 bg-white/50 px-2 py-1 rounded-full">베타 · /dev/growth</span>
      </div>

      {/* 빈 상태 / 로딩 */}
      {!loading && !eff ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <img src="/icons/growth/seed.png" alt="" className="w-24 h-24 object-contain mb-3 opacity-80" />
          <p className="text-[15px] font-bold text-emerald-900">아직 가꿀 섬이 없어요</p>
          <p className="text-[13px] text-emerald-800/60 mt-1">프로그램에 참여하면 나만의 섬이 생겨요</p>
        </div>
      ) : (
        <>
          {/* 헤드라인 (레퍼런스 톤) */}
          <div className="px-6 pt-1">
            {sorted.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                {sorted.map(p => (
                  <button key={p.id} type="button" onClick={() => setSelectedId(p.id)}
                    className={`flex-shrink-0 px-3 h-7 rounded-full text-[12px] font-bold whitespace-nowrap transition ${p.id === program.id ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white/40 text-emerald-900/60'}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[12px] font-bold text-emerald-800/60">{biome.name} · {eff?.name}</p>
            <h1 className="text-[22px] font-extrabold text-emerald-950 leading-tight mt-0.5 break-keep">
              {loading ? ' ' : STAGE_MSG[stage]}
            </h1>
          </div>

          {/* 섬 — R3F 떠 있는 클레이 섬. flex-1 min-h-0 로 남는 공간만 차지(카드는 항상 완전히 보임) */}
          <div className="flex-1 min-h-0 relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-40 rounded-full bg-white/30 animate-pulse" />
              </div>
            ) : (
              <ClayIslandScene plantCount={plantCount} growthRatio={ratio} />
            )}
          </div>

          {/* 하단 카드 — 레벨·진행 + 물/햇빛 + CTA */}
          <div className="px-4 pb-6" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}>
            <div className="bg-white/85 backdrop-blur rounded-3xl p-4 shadow-[0_16px_40px_-20px_rgba(30,70,45,.5)]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[15px] font-extrabold text-gray-900">레벨 {stage} · {getStageLabel('garden', stage)}</p>
                <p className="text-[15px] font-extrabold" style={{ color: biome.accent }}>{loading ? '—' : `${pct}%`}</p>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${loading ? 0 : pct}%`, background: `linear-gradient(90deg, ${biome.ground[0]}, ${biome.accent})` }} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-sky-50 px-3 py-2.5 flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-sky-500 flex-shrink-0" />
                  <div><p className="text-[11px] font-bold text-sky-700/70 leading-none">물 · 인증</p>
                    <p className="text-[17px] font-extrabold text-sky-800 tabular-nums leading-tight">{totalCount}</p></div>
                </div>
                <div className="rounded-2xl bg-amber-50 px-3 py-2.5 flex items-center gap-2">
                  <Sun className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div><p className="text-[11px] font-bold text-amber-700/70 leading-none">햇빛 · 출석</p>
                    <p className="text-[17px] font-extrabold text-amber-800 tabular-nums leading-tight">{activeDays}</p></div>
                </div>
              </div>
              <button type="button" onClick={() => eff.id !== '__mock__' && navigate(`/programs/${eff.id}?tab=missions`)}
                className="mt-3 w-full h-12 rounded-2xl text-white text-[15px] font-extrabold active:scale-[0.99] transition"
                style={{ background: `linear-gradient(135deg, ${biome.ground[0]}, ${biome.accent})` }}>
                오늘 인증하고 물 주기 💧
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
