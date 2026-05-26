import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { MISSION_LIBRARY } from '../../../lib/missionLibrary'

// 2단계: 프로그램 옵션
//   - 피드 활성화 (커뮤니티 모드)
//   - 포디움 활성화 (Top 3 시상대)
//   - 추천 미션 미리보기 (Step 1 카테고리 매칭 — 옵션 C)
//
// 본인 결정 (Day 58): 기존 program_type 선택 폐기 — 의사결정에 의미 없는 라벨이었음.
//   미션 단위 플래그 (requires_image / requires_numeric / requires_note) 가 실제 분기 담당.
//   유형 선택보다 옵션 + 만들 수 있는 미션 미리보기가 운영자 입장에 더 직관적.
function Step2Type({ initialData, onNext, onSave, onPrev }) {
  const [feedEnabled, setFeedEnabled] = useState(initialData?.feed_enabled || false)
  // ranking_enabled DEFAULT true — 기존/신규 모두 켜진 상태로 시작
  const [rankingEnabled, setRankingEnabled] = useState(
    initialData?.ranking_enabled !== undefined ? !!initialData.ranking_enabled : true
  )
  const [podiumEnabled, setPodiumEnabled] = useState(initialData?.podium_enabled || false)
  const [previewOpen, setPreviewOpen] = useState(true)

  // Step 1 에서 선택한 카테고리들에 매칭되는 추천 미션 묶음
  const selectedCategories = initialData?.categories || []
  const recommendedBundles = MISSION_LIBRARY.filter(b =>
    selectedCategories.length === 0 || selectedCategories.includes(b.category)
  )

  const collectData = () => ({
    // program_type 폐기 (Day 58) — 새 프로그램은 NULL 로 저장
    feed_enabled: feedEnabled,
    ranking_enabled: rankingEnabled,
    // 랭킹 꺼져있으면 포디움도 의미 없음 → 자동으로 false
    podium_enabled: rankingEnabled ? podiumEnabled : false,
  })

  const handleNext = () => onNext(collectData())
  const handleSave = () => onSave(collectData())

  return (
    <div>
      <h2 className="text-xl font-medium text-gray-800 mb-2">
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
              피드 활성화 (커뮤니티 모드)
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

      {/* 랭킹 표시 토글 — 끄면 랭킹 페이지에 안 나옴 (단순 습관 형성 프로그램용) */}
      <button
        type="button"
        onClick={() => setRankingEnabled(!rankingEnabled)}
        className={`
          w-full p-4 rounded-2xl border-2 text-left transition mb-3
          ${rankingEnabled
            ? 'border-sky-500 bg-sky-50'
            : 'border-gray-200 bg-white hover:border-gray-300'}
        `}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">📈</span>
          <div className="flex-1">
            <div className={`font-medium mb-1 ${rankingEnabled ? 'text-sky-700' : 'text-gray-800'}`}>
              랭킹 표시
            </div>
            <div className="text-sm text-gray-600">
              참여자 간 점수 순위를 보여줘요. 끄면 경쟁 요소 없는 순수 습관 형성 프로그램이 돼요.
            </div>
          </div>
          <div className={`
            relative w-10 h-6 rounded-full flex-shrink-0 transition
            ${rankingEnabled ? 'bg-sky-500' : 'bg-gray-300'}
          `}>
            <div className={`
              absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
              ${rankingEnabled ? 'translate-x-4' : 'translate-x-0.5'}
            `} />
          </div>
        </div>
      </button>

      {/* 포디움 토글 — 랭킹 ON 일 때만 노출 */}
      {rankingEnabled && (
        <button
          type="button"
          onClick={() => setPodiumEnabled(!podiumEnabled)}
          className={`
            w-full p-4 rounded-2xl border-2 text-left transition mb-6
            ${podiumEnabled
              ? 'border-amber-500 bg-amber-50'
              : 'border-gray-200 bg-white hover:border-gray-300'}
          `}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">🏆</span>
            <div className="flex-1">
              <div className={`font-medium mb-1 ${podiumEnabled ? 'text-amber-700' : 'text-gray-800'}`}>
                포디움 활성화 (Top 3 시상대)
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
      )}
      {!rankingEnabled && <div className="mb-6" />}

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
          className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition"
        >
          이전
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition"
        >
          임시 저장
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition"
        >
          다음
        </button>
      </div>
    </div>
  )
}

export default Step2Type
