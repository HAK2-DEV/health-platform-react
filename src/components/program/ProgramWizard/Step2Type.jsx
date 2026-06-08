import { useState } from 'react'
import { ChevronDown, ChevronUp, Trophy, Sprout, Sparkles } from 'lucide-react'
import { MISSION_LIBRARY } from '../../../lib/missionLibrary'

// 1차 트랙 — 본인 결정 (Day 65): 「랭킹 / 성장」 2개로 단순화. 성장 선택 시 정원/별자리 서브 선택.
// 베타 단계: 성장 트랙 「개발 중」 으로 비활성. 랭킹만 가능 (본인 결정 2026-06-05).
const PRIMARY_TRACKS = [
  {
    key: 'RANKING',
    label: '🏆 랭킹',
    icon: Trophy,
    accent: 'amber',
    headline: '점수 순위 경쟁',
    description: '참여자 간 점수 순위. 포디움·추세·기간 필터 등 옵션이 풍부해요.',
  },
  {
    key: 'GROWTH',  // 2차 분류로 GARDEN/CONSTELLATION 선택
    label: '🌱 성장',
    icon: Sprout,
    accent: 'emerald',
    headline: '개인 정원·별자리',
    description: '경쟁 없이 본인 정원·별자리를 키우는 느낌.\n인증=물·별, 출석=햇빛·연결선.',
    comingSoon: true,  // 베타엔 비활성
  },
]

// 2차 — 성장 트랙 안의 컨셉 선택
const GROWTH_CONCEPTS = [
  {
    key: 'GARDEN',
    label: '🌷 정원',
    icon: Sprout,
    description: '씨앗에서 만개까지 5단계. 만개한 꽃은 도감에 모임.',
  },
  {
    key: 'CONSTELLATION',
    label: '✨ 별자리',
    icon: Sparkles,
    description: '본인의 은하에 별 5개 점등 + 연결선. 5단계로 별자리 완성.',
  },
]

const STREAK_PRESETS = [
  { key: 'short', label: '단기', days: [3, 7], hint: '~2주 프로그램' },
  { key: 'medium', label: '중간', days: [7, 14], hint: '2-4주 프로그램' },
  { key: 'long', label: '장기', days: [7, 14, 30], hint: '1달+ 프로그램' },
  { key: 'custom', label: '사용자 정의', days: null, hint: '직접 입력' },
]

// Day 65: 옵션 토글 카드 헬퍼 — 토글을 제목 옆에 배치해서 설명이 전체 폭 사용.
// 본인 피드백: 토글이 텍스트 영역 압박해서 줄바꿈 부자연스러움.
const ACCENT_MAP = {
  emerald: { border: 'border-emerald-500 bg-emerald-50', title: 'text-emerald-700', bg: 'bg-emerald-500' },
  amber:   { border: 'border-amber-500 bg-amber-50',     title: 'text-amber-700',   bg: 'bg-amber-500' },
  violet:  { border: 'border-violet-500 bg-violet-50',   title: 'text-violet-700',  bg: 'bg-violet-500' },
  cyan:    { border: 'border-cyan-500 bg-cyan-50',       title: 'text-cyan-700',    bg: 'bg-cyan-500' },
}
function OptionToggle({ emoji, title, description, enabled, onToggle, accent = 'emerald' }) {
  const a = ACCENT_MAP[accent] || ACCENT_MAP.emerald
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full p-4 rounded-2xl border-2 text-left transition mb-3 ${
        enabled ? a.border : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl flex-shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`font-medium whitespace-nowrap ${enabled ? a.title : 'text-gray-800'}`}>
              {title}
            </p>
            <div className={`relative w-10 h-6 rounded-full flex-shrink-0 transition ${enabled ? a.bg : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                enabled ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </div>
          </div>
          {/* 설명은 토글 ON 일 때만 표시 (본인 결정) — OFF 시 카드 간결화 */}
          {enabled && (
            <p className="text-sm text-gray-600 leading-relaxed break-keep mt-2">
              {description}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

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
  // Day 65: 2단계 선택 구조 — 1차 (랭킹/성장) → 2차 (성장이면 정원/별자리).
  // 기존 ranking_enabled boolean / gamification_type 호환.
  const initialType = initialData?.gamification_type
    || (initialData?.ranking_enabled === false ? 'GARDEN' : 'RANKING')
  const [primaryTrack, setPrimaryTrack] = useState(
    initialType === 'RANKING' ? 'RANKING' : 'GROWTH'
  )
  const [growthConcept, setGrowthConcept] = useState(
    initialType === 'CONSTELLATION' ? 'CONSTELLATION' : 'GARDEN'
  )
  const isRanking = primaryTrack === 'RANKING'
  const isGrowth = primaryTrack === 'GROWTH'
  const gamificationType = isRanking ? 'RANKING' : growthConcept  // DB 저장값

  const [podiumEnabled, setPodiumEnabled] = useState(initialData?.podium_enabled || false)
  const [trendEnabled, setTrendEnabled] = useState(initialData?.trend_enabled || false)
  const [periodFilterEnabled, setPeriodFilterEnabled] = useState(initialData?.period_filter_enabled || false)

  // 성장형 트랙의 연속 보너스 프리셋
  const [streakPreset, setStreakPreset] = useState(initialData?.streak_preset || 'medium')
  const [streakMilestonesInput, setStreakMilestonesInput] = useState(
    (initialData?.streak_milestones || []).join(', ')
  )

  const [previewOpen, setPreviewOpen] = useState(false)  // 기본 닫힘 (본인 결정)

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
      <p className="text-sm text-gray-600 mb-6 break-keep">
        프로그램의 분위기를 정해요. 미션은 발행 후 자유롭게 추가/수정할 수 있어요.
      </p>

      {/* 피드 활성화 토글 */}
      <OptionToggle
        emoji="📷"
        title="커뮤니티 피드"
        description="참여자끼리 서로의 인증을 사진 피드로 보고 좋아요·댓글로 응원할 수 있어요."
        enabled={feedEnabled}
        onToggle={() => setFeedEnabled(!feedEnabled)}
        accent="emerald"
      />

      {/* 1차 트랙 선택 — 랭킹 / 성장. 각 카드에 헤드라인 + 짧은 설명.
          베타: 성장은 「개발 중」 으로 비활성. 클릭하면 안내 후 강제로 랭킹 유지 */}
      <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
        <span className="inline-block w-1 h-4 bg-emerald-500 rounded-full" />
        참여 동기 방식
      </h3>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {PRIMARY_TRACKS.map(t => {
          const active = primaryTrack === t.key
          const accentBorder = {
            amber: 'border-amber-500 bg-amber-50',
            emerald: 'border-emerald-500 bg-emerald-50',
          }[t.accent]
          const disabled = t.comingSoon
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { if (!disabled) setPrimaryTrack(t.key) }}
              disabled={disabled}
              aria-disabled={disabled}
              className={`relative p-4 rounded-2xl border-2 text-left transition ${
                disabled ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                : active ? accentBorder
                : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {disabled && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-gray-700 text-white text-[9px] rounded font-semibold">
                  곧 출시
                </span>
              )}
              <p className={`text-base font-semibold ${active && !disabled ? 'text-gray-800 mb-1' : 'text-gray-500'}`}>
                {t.label}
              </p>
              {/* 헤드라인 — 선택된 카드만 표시 (본인 결정). 비선택은 라벨만 */}
              {active && !disabled && (
                <p className="text-[11px] text-gray-600 leading-snug break-keep">
                  {t.headline}
                </p>
              )}
            </button>
          )
        })}
      </div>
      {/* 선택된 트랙 상세 설명 — \n 줄바꿈 지원 */}
      <p className="text-xs text-gray-600 px-2 mb-4 leading-relaxed whitespace-pre-line">
        {PRIMARY_TRACKS.find(t => t.key === primaryTrack)?.description}
      </p>

      {/* 성장 트랙 선택 시 — 2차: 정원 vs 별자리 */}
      {isGrowth && (
        <div className="mb-4">
          {/* 본인 결정 — 헤더 위 5px 여백 (설명과 시각 분리) */}
          <div className="h-[5px]" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
            <span className="inline-block w-1 h-4 bg-emerald-500 rounded-full" />
            성장 컨셉 선택
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {GROWTH_CONCEPTS.map(c => {
              const active = growthConcept === c.key
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setGrowthConcept(c.key)}
                  className={`p-3 rounded-2xl border-2 text-left transition ${
                    active ? 'border-emerald-400 bg-white' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className={`text-sm font-medium mb-0.5 ${active ? 'text-emerald-700' : 'text-gray-700'}`}>
                    {c.label}
                  </p>
                  <p className="text-[11px] text-gray-500 leading-snug">
                    {c.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 성장형 트랙 — 연속 보너스 프리셋 */}
      {isGrowth && (
        <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
          <p className="text-sm font-medium text-gray-800 mb-1">⭐ 연속 참여 보너스</p>
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
        <div className="mb-3">
          <OptionToggle
            emoji="🏆"
            title="랭킹 Top 3 (시상대)"
            description="랭킹 페이지 상단에 1·2·3등을 올림픽 시상대처럼 강조해서 표시해요. 끄면 평면 랭킹만."
            enabled={podiumEnabled}
            onToggle={() => setPodiumEnabled(!podiumEnabled)}
            accent="amber"
          />
          <OptionToggle
            emoji="📊"
            title="본인 14일 점수 추세"
            description="랭킹 페이지 본인 요약 카드에 최근 14일 점수 그래프(스파크라인)를 보여줘요. 꾸준함 시각화."
            enabled={trendEnabled}
            onToggle={() => setTrendEnabled(!trendEnabled)}
            accent="violet"
          />
          <OptionToggle
            emoji="⏱️"
            title="기간 필터 (7일 / 30일)"
            description="참여자가 랭킹을 '전체 / 최근 7일 / 최근 30일' 로 전환해서 볼 수 있어요. 단기 분위기 환기에 좋음."
            enabled={periodFilterEnabled}
            onToggle={() => setPeriodFilterEnabled(!periodFilterEnabled)}
            accent="cyan"
          />
        </div>
      )}

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
              <div className="grid gap-2 min-w-0">
                {recommendedBundles.map(b => (
                  <div
                    key={b.key}
                    className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100 w-full min-w-0"
                  >
                    <span className="text-xl flex-shrink-0">{b.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 break-keep">{b.title}</p>
                      <p className="text-[11px] text-gray-500 leading-snug break-keep mt-0.5">
                        {b.description}<br />
                        <span className="text-gray-400">미션 {b.missions.length}개</span>
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
