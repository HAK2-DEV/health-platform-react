import { useState } from 'react'
import { ChevronDown, ChevronUp, Trophy, Sprout, Sparkles } from 'lucide-react'
import { MISSION_LIBRARY } from '../../../lib/missionLibrary'

// 게이미피케이션 트랙 옵션 (Day 65 본인 결정)
const TRACKS = [
  {
    key: 'RANKING',
    label: '랭킹',
    icon: Trophy,
    accent: 'amber',
    description: '점수 순위로 경쟁. 포디움·추세·기간 필터 등 옵션 풍부.',
  },
  {
    key: 'GARDEN',
    label: '정원',
    icon: Sprout,
    accent: 'emerald',
    description: '인증=물, 출석=햇빛. 씨앗에서 만개까지 5단계 성장.',
  },
  {
    key: 'CONSTELLATION',
    label: '별자리',
    icon: Sparkles,
    accent: 'violet',
    description: '인증=별 점등, 출석=연결선. 5단계로 별자리 완성.',
  },
]

const STREAK_PRESETS = [
  { key: 'short', label: '단기', days: [3, 7], hint: '~2주 프로그램' },
  { key: 'medium', label: '중간', days: [7, 14], hint: '2-4주 프로그램' },
  { key: 'long', label: '장기', days: [7, 14, 30], hint: '1달+ 프로그램' },
  { key: 'custom', label: '사용자 정의', days: null, hint: '직접 입력' },
]

// 2단계: 프로그램 옵션
//   - 피드 활성화 (커뮤니티 모드)
//   - 포디움 활성화 (Top 3 시상대)
//   - 추천 미션 미리보기 (Step 1 카테고리 매칭 — 옵션 C)
//
// 본인 결정 (Day 58): 기존 program_type 선택 폐기 — 의사결정에 의미 없는 라벨이었음.
//   미션 단위 플래그 (requires_image / requires_numeric / requires_note) 가 실제 분기 담당.
//   유형 선택보다 옵션 + 만들 수 있는 미션 미리보기가 운영자 입장에 더 직관적.
function Step2Type({ initialData, onNext, onSave, onPrev }) {
  // 기본값 ON — DRAFT 재진입 시에만 저장값 사용
  const [feedEnabled, setFeedEnabled] = useState(
    initialData?.feed_enabled !== undefined ? !!initialData.feed_enabled : true
  )
  // Day 65: 게이미피케이션 트랙 선택 (랭킹 / 정원 / 별자리).
  // 기존 ranking_enabled boolean → gamification_type 으로 통합. RANKING 이면 ranking_enabled=true.
  const [gamificationType, setGamificationType] = useState(
    initialData?.gamification_type
      || (initialData?.ranking_enabled === false ? 'GARDEN' : 'RANKING')
  )
  const isRanking = gamificationType === 'RANKING'
  const isGrowth = gamificationType === 'GARDEN' || gamificationType === 'CONSTELLATION'

  const [podiumEnabled, setPodiumEnabled] = useState(initialData?.podium_enabled || false)
  const [trendEnabled, setTrendEnabled] = useState(initialData?.trend_enabled || false)
  const [periodFilterEnabled, setPeriodFilterEnabled] = useState(initialData?.period_filter_enabled || false)

  // 성장형 트랙의 연속 보너스 프리셋
  const [streakPreset, setStreakPreset] = useState(initialData?.streak_preset || 'medium')
  const [streakMilestonesInput, setStreakMilestonesInput] = useState(
    (initialData?.streak_milestones || []).join(', ')
  )

  const [previewOpen, setPreviewOpen] = useState(true)

  // Step 1 에서 선택한 카테고리들에 매칭되는 추천 미션 묶음
  const selectedCategories = initialData?.categories || []
  const recommendedBundles = MISSION_LIBRARY.filter(b =>
    selectedCategories.length === 0 || selectedCategories.includes(b.category)
  )

  // custom 일 때 사용자 입력 → 숫자 배열 (1-365 사이만 유효, 정렬, 중복 제거)
  const parseCustomMilestones = () => {
    const nums = streakMilestonesInput
      .split(/[,\s]+/)
      .map(s => parseInt(s, 10))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 365)
    return Array.from(new Set(nums)).sort((a, b) => a - b)
  }

  const collectData = () => ({
    // program_type 폐기 (Day 58) — 새 프로그램은 NULL 로 저장
    feed_enabled: feedEnabled,
    // Day 65 — gamification_type 으로 통합. ranking_enabled 는 호환성 위해 같이 저장.
    gamification_type: gamificationType,
    ranking_enabled: isRanking,
    // 랭킹 트랙 일 때만 하위 옵션 유효
    podium_enabled: isRanking ? podiumEnabled : false,
    trend_enabled: isRanking ? trendEnabled : false,
    period_filter_enabled: isRanking ? periodFilterEnabled : false,
    // 성장형 트랙 일 때만 연속 보너스 프리셋 적용
    streak_preset: isGrowth ? streakPreset : 'medium',
    streak_milestones: isGrowth && streakPreset === 'custom' ? parseCustomMilestones() : null,
  })

  const handleNext = () => onNext(collectData())
  const handleSave = () => onSave(collectData())

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        2단계: 프로그램 옵션
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        프로그램의 분위기를 정해요. 미션은 발행 후 자유롭게 추가/수정할 수 있어요.
      </p>

      {/* 피드 활성화 토글 */}
      <button
        type="button"
        onClick={() => setFeedEnabled(!feedEnabled)}
        className={`
          w-full p-4 rounded-2xl border-2 text-left transition mb-3
          ${feedEnabled
            ? 'border-emerald-500 bg-emerald-50'
            : 'border-gray-200 bg-white hover:border-gray-300'}
        `}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">📷</span>
          <div className="flex-1">
            <div className={`font-medium mb-1 ${feedEnabled ? 'text-emerald-700' : 'text-gray-800'}`}>
              피드 활성화<br />(커뮤니티 모드)
            </div>
            <div className="text-sm text-gray-600">
              참여자끼리 서로의 인증을 사진 피드로 보고 좋아요·댓글로 응원할 수 있어요
            </div>
          </div>
          <div className={`
            relative w-10 h-6 rounded-full flex-shrink-0 transition
            ${feedEnabled ? 'bg-emerald-500' : 'bg-gray-300'}
          `}>
            <div className={`
              absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
              ${feedEnabled ? 'translate-x-4' : 'translate-x-0.5'}
            `} />
          </div>
        </div>
      </button>

      {/* 게이미피케이션 트랙 선택 — Day 65 본인 결정 (랭킹 / 정원 / 별자리). */}
      <p className="text-xs text-gray-500 font-medium mb-2 px-1">참여 동기 방식</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {TRACKS.map(t => {
          const Icon = t.icon
          const active = gamificationType === t.key
          const accentBorder = {
            amber: 'border-amber-500 bg-amber-50',
            emerald: 'border-emerald-500 bg-emerald-50',
            violet: 'border-violet-500 bg-violet-50',
          }[t.accent]
          const accentIcon = {
            amber: 'text-amber-600',
            emerald: 'text-emerald-600',
            violet: 'text-violet-600',
          }[t.accent]
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setGamificationType(t.key)}
              className={`p-3 rounded-2xl border-2 text-center transition ${
                active ? accentBorder : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <Icon className={`w-6 h-6 mx-auto mb-1 ${active ? accentIcon : 'text-gray-400'}`} />
              <p className={`text-sm font-medium ${active ? 'text-gray-800' : 'text-gray-600'}`}>{t.label}</p>
            </button>
          )
        })}
      </div>
      {/* 선택된 트랙 설명 */}
      <p className="text-xs text-gray-600 px-2 mb-4 leading-relaxed">
        {TRACKS.find(t => t.key === gamificationType)?.description}
      </p>

      {/* 성장형 트랙 — 연속 보너스 프리셋 */}
      {isGrowth && (
        <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
          <p className="text-sm font-medium text-gray-800 mb-1">⭐ 연속 보너스 마일스톤</p>
          <p className="text-xs text-gray-500 mb-3">
            며칠 연속 참여하면 특별 보상을 받을지 정해요. 프로그램 기간에 맞춰 선택.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {STREAK_PRESETS.map(p => {
              const active = streakPreset === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setStreakPreset(p.key)}
                  className={`p-2.5 rounded-xl border-2 text-left transition ${
                    active ? 'border-emerald-500 bg-white' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className={`text-sm font-medium ${active ? 'text-emerald-700' : 'text-gray-700'}`}>
                    {p.label}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {p.days ? `${p.days.join('·')}일 연속` : p.hint}
                  </p>
                </button>
              )
            })}
          </div>
          {streakPreset === 'custom' && (
            <div>
              <input
                type="text"
                value={streakMilestonesInput}
                onChange={(e) => setStreakMilestonesInput(e.target.value)}
                placeholder="예: 5, 10, 15"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                쉼표로 구분, 1-365 사이 숫자. 입력값: {parseCustomMilestones().join('·') || '없음'}일 연속
              </p>
            </div>
          )}
        </div>
      )}

      {/* 포디움 / 추세 / 기간 필터 — 랭킹 트랙 일 때만 노출 (기존 옵션) */}
      {isRanking && (
        <>
          {/* 포디움 토글 */}
          <button
            type="button"
            onClick={() => setPodiumEnabled(!podiumEnabled)}
            className={`
              w-full p-4 rounded-2xl border-2 text-left transition mb-3
              ${podiumEnabled
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 bg-white hover:border-gray-300'}
            `}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">🏆</span>
              <div className="flex-1">
                <div className={`font-medium mb-1 ${podiumEnabled ? 'text-amber-700' : 'text-gray-800'}`}>
                  랭킹 Top 3 (시상대)
                </div>
                <div className="text-sm text-gray-600">
                  랭킹 페이지 상단에 1·2·3등을 올림픽 시상대처럼 강조해서 표시해요. 끄면 평면 랭킹만.
                </div>
              </div>
              <div className={`
                relative w-10 h-6 rounded-full flex-shrink-0 transition
                ${podiumEnabled ? 'bg-amber-500' : 'bg-gray-300'}
              `}>
                <div className={`
                  absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                  ${podiumEnabled ? 'translate-x-4' : 'translate-x-0.5'}
                `} />
              </div>
            </div>
          </button>

          {/* 추세 표시 토글 — 본인 14일 점수 sparkline */}
          <button
            type="button"
            onClick={() => setTrendEnabled(!trendEnabled)}
            className={`
              w-full p-4 rounded-2xl border-2 text-left transition mb-3
              ${trendEnabled
                ? 'border-violet-500 bg-violet-50'
                : 'border-gray-200 bg-white hover:border-gray-300'}
            `}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">📊</span>
              <div className="flex-1">
                <div className={`font-medium mb-1 ${trendEnabled ? 'text-violet-700' : 'text-gray-800'}`}>
                  본인 14일 점수 추세 표시
                </div>
                <div className="text-sm text-gray-600">
                  랭킹 페이지의 본인 요약 카드에 최근 14일 점수 그래프(스파크라인)를 보여줘요. 꾸준함 시각화.
                </div>
              </div>
              <div className={`
                relative w-10 h-6 rounded-full flex-shrink-0 transition
                ${trendEnabled ? 'bg-violet-500' : 'bg-gray-300'}
              `}>
                <div className={`
                  absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                  ${trendEnabled ? 'translate-x-4' : 'translate-x-0.5'}
                `} />
              </div>
            </div>
          </button>

          {/* 기간 필터 토글 — 전체 / 최근 7일 / 최근 30일 */}
          <button
            type="button"
            onClick={() => setPeriodFilterEnabled(!periodFilterEnabled)}
            className={`
              w-full p-4 rounded-2xl border-2 text-left transition mb-6
              ${periodFilterEnabled
                ? 'border-cyan-500 bg-cyan-50'
                : 'border-gray-200 bg-white hover:border-gray-300'}
            `}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">⏱️</span>
              <div className="flex-1">
                <div className={`font-medium mb-1 ${periodFilterEnabled ? 'text-cyan-700' : 'text-gray-800'}`}>
                  기간 필터 표시 (최근 7일 / 30일)
                </div>
                <div className="text-sm text-gray-600">
                  참여자가 랭킹을 '전체 / 최근 7일 / 최근 30일' 로 전환해서 볼 수 있어요. 단기 분위기 환기에 좋음.
                </div>
              </div>
              <div className={`
                relative w-10 h-6 rounded-full flex-shrink-0 transition
                ${periodFilterEnabled ? 'bg-cyan-500' : 'bg-gray-300'}
              `}>
                <div className={`
                  absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                  ${periodFilterEnabled ? 'translate-x-4' : 'translate-x-0.5'}
                `} />
              </div>
            </div>
          </button>
        </>
      )}
      {!isRanking && !isGrowth && <div className="mb-6" />}

      {/* 추천 미션 미리보기 — Step 1 카테고리 매칭 */}
      <div className="bg-gray-50/60 rounded-2xl border border-gray-200 mb-6 overflow-hidden">
        <button
          type="button"
          onClick={() => setPreviewOpen(!previewOpen)}
          className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-gray-100/40 transition"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">💡</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800">
                추천 미션 묶음 미리보기
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                선택한 카테고리에 맞는 묶음 {recommendedBundles.length}개 — 발행 후 한 번에 추가 가능
              </p>
            </div>
          </div>
          {previewOpen
            ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        </button>

        {previewOpen && (
          <div className="px-4 pb-4">
            {recommendedBundles.length === 0 ? (
              <p className="text-xs text-gray-500 py-2 text-center">
                Step 1 에서 카테고리를 먼저 선택해주세요
              </p>
            ) : (
              <div className="grid gap-2">
                {recommendedBundles.map(b => (
                  <div
                    key={b.key}
                    className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100"
                  >
                    <span className="text-xl flex-shrink-0">{b.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{b.title}</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {b.description} · 미션 {b.missions.length}개
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-emerald-700 mt-3 leading-relaxed">
              ℹ️ 이건 어디까지나 참고용 예시예요. 발행 후 <span className="font-medium">"➕ 미션 추가"</span> 에서
              본인이 원하는 미션을 자유롭게 만들 수 있어요.
            </p>
          </div>
        )}
      </div>

      {/* 버튼 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="flex-1 px-3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition whitespace-nowrap text-sm"
        >
          이전
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 px-3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition whitespace-nowrap text-sm"
        >
          임시 저장
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="flex-1 px-3 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition whitespace-nowrap text-sm"
        >
          다음
        </button>
      </div>
    </div>
  )
}

export default Step2Type
