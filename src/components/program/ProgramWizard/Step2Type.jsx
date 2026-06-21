import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { MISSION_LIBRARY } from '../../../lib/missionLibrary'

// 2단계: 사용할 메뉴 — 퀴즈/커뮤니티/랭킹 메뉴 on/off (프로그램 설정과 동일) + 추천 미션 미리보기.
//   성장(정원/별자리) 트랙은 베타 비활성 → 랭킹 메뉴 토글로 단순화. 세부(시상대·추세·기간필터)는 발행 후 「랭킹 설정」.
const ACCENT_MAP = {
  indigo:  { border: 'border-indigo-500 bg-indigo-50',   title: 'text-indigo-700',  bg: 'bg-indigo-500' },
  rose:    { border: 'border-rose-500 bg-rose-50',       title: 'text-rose-700',    bg: 'bg-rose-500' },
  sky:     { border: 'border-sky-500 bg-sky-50',         title: 'text-sky-700',     bg: 'bg-sky-500' },
  emerald: { border: 'border-emerald-500 bg-emerald-50', title: 'text-emerald-700', bg: 'bg-emerald-500' },
}
function OptionToggle({ emoji, title, description, enabled, onToggle, accent = 'emerald' }) {
  const a = ACCENT_MAP[accent] || ACCENT_MAP.emerald
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full p-4 rounded-[10px] border-2 text-left transition ${enabled ? a.border : 'border-gray-200 bg-white hover:border-gray-300'}`}
      style={{ marginBottom: '9px' }}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl flex-shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`font-medium whitespace-nowrap ${enabled ? a.title : 'text-gray-800'}`}>{title}</p>
            <div className={`relative w-10 h-6 rounded-full flex-shrink-0 transition ${enabled ? a.bg : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </div>
          {/* 설명은 ON 일 때만 (OFF 시 카드 간결화) */}
          {enabled && <p className="text-xs text-gray-600 leading-relaxed break-keep mt-2">{description}</p>}
        </div>
      </div>
    </button>
  )
}

function Step2Type({ initialData, onNext, onSave, onPrev }) {
  // 커뮤니티 메뉴 사용 (= 피드 활성). 기본 ON — DRAFT 재진입 시 저장값 사용
  const [communityEnabled, setCommunityEnabled] = useState(
    initialData?.community_enabled !== undefined ? !!initialData.community_enabled
      : initialData?.feed_enabled !== undefined ? !!initialData.feed_enabled : true
  )
  const [quizEnabled, setQuizEnabled] = useState(initialData?.quiz_enabled !== false)
  const [rankingEnabled, setRankingEnabled] = useState(initialData?.ranking_enabled !== false)

  const [previewOpen, setPreviewOpen] = useState(false)

  // Step 1 에서 선택한 카테고리들에 매칭되는 추천 미션 묶음
  const selectedCategories = initialData?.categories || []
  const recommendedBundles = MISSION_LIBRARY.filter(b =>
    selectedCategories.length === 0 || selectedCategories.includes(b.category)
  )

  const collectData = () => ({
    // 커뮤니티 메뉴 사용 = 피드 활성 (둘 통합)
    feed_enabled: communityEnabled,
    community_enabled: communityEnabled,
    quiz_enabled: quizEnabled,
    // 랭킹 메뉴 표시. 켜면 RANKING, 끄면 성장 트랙 없음(베타) → null
    ranking_enabled: rankingEnabled,
    gamification_type: rankingEnabled ? 'RANKING' : null,
    // 성장 트랙(연속 보너스)은 베타 비활성 — 기본값 유지
    streak_preset: 'medium',
    streak_milestones: null,
  })

  const handleNext = () => onNext(collectData())
  const handleSave = () => onSave(collectData())

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800" style={{ marginBottom: '5px' }}>2단계: 사용할 메뉴</h2>
      <p className="text-sm text-gray-600 break-keep" style={{ marginBottom: '18px' }}>
        참여자에게 보일 메뉴를 켜고 꺼요. <br />발행 후에도 「프로그램 설정」에서 바꿀 수 있어요.
      </p>

      <OptionToggle
        emoji="📋" title="퀴즈 메뉴 사용" accent="indigo"
        description="끄면 퀴즈 탭이 참여자에게 안 보이고 메뉴바 설정에서도 숨겨져요."
        enabled={quizEnabled} onToggle={() => setQuizEnabled(v => !v)}
      />
      <OptionToggle
        emoji="💬" title="커뮤니티 메뉴 사용" accent="rose"
        description="인증 피드 포함. 끄면 커뮤니티 탭이 참여자에게 안 보이고 메뉴바 설정에서도 숨겨져요."
        enabled={communityEnabled} onToggle={() => setCommunityEnabled(v => !v)}
      />
      <OptionToggle
        emoji="📈" title="랭킹 메뉴 표시" accent="sky"
        description="켜면 랭킹 메뉴가 보여요. 세부(시상대·기간 필터)는 발행 후 「랭킹 설정」에서 정해요."
        enabled={rankingEnabled} onToggle={() => setRankingEnabled(v => !v)}
      />

      {/* 추천 미션 미리보기 — Step 1 카테고리 매칭 */}
      <div className="bg-gray-50/60 rounded-[10px] border border-gray-200 overflow-hidden" style={{ marginTop: '9px', marginBottom: '18px' }}>
        <button
          type="button"
          onClick={() => setPreviewOpen(!previewOpen)}
          className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-gray-100/40 transition"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">💡</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800">추천 미션 묶음 미리보기</p>
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
              <p className="text-xs text-gray-500 py-2 text-center">Step 1 에서 카테고리를 먼저 선택해주세요</p>
            ) : (
              <div className="grid gap-2 min-w-0">
                {recommendedBundles.map(b => (
                  <div key={b.key} className="flex items-start gap-3 p-3 bg-white rounded-[10px] border border-gray-100 w-full min-w-0">
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
              ℹ️ 이건 참고용 예시예요. 발행 후 <span className="font-medium">"➕ 미션 추가"</span> 에서 원하는 미션을 자유롭게 만들 수 있어요.
            </p>
          </div>
        )}
      </div>

      {/* 버튼 */}
      <div className="flex" style={{ gap: '9px' }}>
        <button type="button" onClick={onPrev}
          className="flex-1 px-3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-[10px] transition whitespace-nowrap text-sm">이전</button>
        <button type="button" onClick={handleSave}
          className="flex-1 px-3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-[10px] transition whitespace-nowrap text-sm">임시 저장</button>
        <button type="button" onClick={handleNext}
          className="flex-1 px-3 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-[10px] transition whitespace-nowrap text-sm">다음</button>
      </div>
    </div>
  )
}

export default Step2Type
