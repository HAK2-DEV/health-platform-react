import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { MISSION_LIBRARY } from '../../../lib/missionLibrary'
import { CATEGORY } from '../../../lib/constants'

// 2단계: 사용할 메뉴 — 퀴즈/커뮤니티/랭킹 메뉴 on/off (프로그램 설정과 동일) + 추천 미션 미리보기.
//   성장(정원/별자리) 트랙은 베타 비활성 → 랭킹 메뉴 토글로 단순화. 세부(시상대·추세·기간필터)는 발행 후 「랭킹 설정」.
const ACCENT_MAP = {
  indigo:  { border: 'border-indigo-500 bg-indigo-50',   title: 'text-indigo-700',  bg: 'bg-indigo-500' },
  rose:    { border: 'border-rose-500 bg-rose-50',       title: 'text-rose-700',    bg: 'bg-rose-500' },
  sky:     { border: 'border-sky-500 bg-sky-50',         title: 'text-sky-700',     bg: 'bg-sky-500' },
  emerald: { border: 'border-emerald-500 bg-emerald-50', title: 'text-emerald-700', bg: 'bg-emerald-500' },
  violet:  { border: 'border-violet-500 bg-violet-50',   title: 'text-violet-700',  bg: 'bg-violet-500' },
}

// 2지선다 선택 버튼 (점수 방식·정원 정책)
function Seg({ options, value, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map(o => (
        <button
          key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`flex-1 px-3 py-2 rounded-[10px] border-2 text-sm text-center transition ${
            value === o.value
              ? 'border-violet-500 bg-violet-50 text-violet-700 font-medium'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// 정원 숫자 선택 (min~max 범위)
function NumSelect({ value, onChange, min, max }) {
  const opts = []
  for (let i = min; i <= max; i++) opts.push(i)
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="px-3 py-2 rounded-[10px] border-2 border-gray-200 bg-white text-sm text-gray-700 focus:border-violet-400 focus:outline-none"
    >
      {opts.map(n => <option key={n} value={n}>{n}명</option>)}
    </select>
  )
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

  // 팀 기능 — 랭킹 메뉴가 켜져 있어야 동작(팀 랭킹이 랭킹 탭에 노출되므로)
  const [teamEnabled, setTeamEnabled] = useState(!!initialData?.team_enabled)
  const [teamScoreMode, setTeamScoreMode] = useState(initialData?.team_score_mode || 'sum')
  const [teamSizeType, setTeamSizeType] = useState(initialData?.team_size_type || 'range')
  const [teamSizeMin, setTeamSizeMin] = useState(initialData?.team_size_min || 2)
  const [teamSizeMax, setTeamSizeMax] = useState(initialData?.team_size_max || 4)
  const [teamSizeFixed, setTeamSizeFixed] = useState(initialData?.team_size_fixed || 4)
  // 금연 카테고리 — 「내 변화」 탭 사용 (랭킹/팀 대신). 신규 생성 시 금연이면 기본 ON.
  const [changeTabEnabled, setChangeTabEnabled] = useState(
    initialData?.change_tab_enabled != null
      ? initialData.change_tab_enabled === true
      : (initialData?.categories || []).includes(CATEGORY.NO_SMOKING.key)
  )

  const [previewOpen, setPreviewOpen] = useState(false)

  // 범위형 최소 변경 시 최대가 더 작아지지 않게 보정
  const handleMinChange = (v) => {
    setTeamSizeMin(v)
    if (v > teamSizeMax) setTeamSizeMax(v)
  }
  // 팀 기능은 랭킹이 켜져 있을 때만 실제 활성
  const teamOn = teamEnabled && rankingEnabled

  // Step 1 에서 선택한 카테고리들에 매칭되는 추천 미션 묶음
  const selectedCategories = initialData?.categories || []
  // 금연 카테고리 = 금연 테마 전체 적용 (랭킹/팀 숨김, 「내 변화」 탭, theme=QUIT_SMOKING)
  const isQuitCat = selectedCategories.includes(CATEGORY.NO_SMOKING.key)
  const recommendedBundles = MISSION_LIBRARY.filter(b =>
    selectedCategories.length === 0 || selectedCategories.includes(b.category)
  )

  const collectData = () => {
    const base = {
      feed_enabled: communityEnabled,
      community_enabled: communityEnabled,
      quiz_enabled: quizEnabled,
      gamification_type: 'RANKING',  // NOT NULL — 표시는 ranking_enabled 로 제어
      streak_preset: 'medium',
      streak_milestones: null,
    }
    // 금연 카테고리 = 금연 테마 전체 적용. 랭킹·팀 없음, 「내 변화」 탭 토글.
    if (isQuitCat) {
      return {
        ...base,
        theme: 'QUIT_SMOKING',
        ranking_enabled: false,
        change_tab_enabled: changeTabEnabled,
        team_enabled: false,
        team_score_mode: null, team_size_type: null,
        team_size_min: null, team_size_max: null, team_size_fixed: null,
      }
    }
    // 그 외 — 기존 동작 (랭킹·팀 토글)
    return {
      ...base,
      theme: null,
      ranking_enabled: rankingEnabled,
      change_tab_enabled: false,
      team_enabled: teamEnabled,
      team_score_mode: teamEnabled ? teamScoreMode : null,
      team_size_type: teamEnabled ? teamSizeType : null,
      team_size_min: teamEnabled && teamSizeType === 'range' ? teamSizeMin : null,
      team_size_max: teamEnabled && teamSizeType === 'range' ? teamSizeMax : null,
      team_size_fixed: teamEnabled && teamSizeType === 'fixed' ? teamSizeFixed : null,
    }
  }

  const handleNext = () => onNext(collectData())
  const handleSave = () => onSave(collectData())

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800" style={{ marginBottom: '5px' }}>2단계: 사용할 메뉴</h2>
      <p className="text-sm text-gray-600 break-keep" style={{ marginBottom: '18px' }}>
        참여자에게 보일 메뉴를 켜고 꺼요. <br />발행 후에도 「프로그램 설정」에서 바꿀 수 있어요.
      </p>

      {/* 금연 카테고리 안내 — 테마 전체 적용 */}
      {isQuitCat && (
        <div className="flex items-start gap-2 p-3 rounded-[10px] bg-emerald-50 border border-emerald-100" style={{ marginBottom: '9px' }}>
          <span className="text-lg flex-shrink-0">🚭</span>
          <p className="text-[12px] text-emerald-800 leading-relaxed break-keep">
            금연 전용 화면으로 운영돼요 — 상단 금연 현황(연속 금연·절약), 오늘의 기분 체크, 금연 팁이 자동으로 들어가요. 랭킹 대신 「내 변화」 탭을 쓸 수 있어요.
          </p>
        </div>
      )}

      <OptionToggle
        emoji="📋" title="퀴즈 메뉴 사용" accent="indigo"
        description="끄면 퀴즈 탭이 참여자에게 안 보이고 메뉴바 설정에서도 숨겨져요."
        enabled={quizEnabled} onToggle={() => setQuizEnabled(v => !v)}
      />
      <OptionToggle
        emoji="💬" title={isQuitCat ? '응원 메뉴 사용' : '커뮤니티 메뉴 사용'} accent="rose"
        description={isQuitCat
          ? '담당자·참가자가 서로 응원해요. 끄면 응원 탭이 참여자에게 안 보여요.'
          : '인증 피드 포함. 끄면 커뮤니티 탭이 참여자에게 안 보이고 메뉴바 설정에서도 숨겨져요.'}
        enabled={communityEnabled} onToggle={() => setCommunityEnabled(v => !v)}
      />
      {/* 금연 — 랭킹/팀 대신 「내 변화」 탭 토글 */}
      {isQuitCat && (
        <OptionToggle
          emoji="📈" title="「내 변화」 탭 사용" accent="emerald"
          description="참가자가 자신의 기분·흡연 변화를 한눈에 봐요. 운영자에겐 「참가자 추세」 탭으로 보여 참가자별 변화를 확인할 수 있어요."
          enabled={changeTabEnabled} onToggle={() => setChangeTabEnabled(v => !v)}
        />
      )}

      {/* 랭킹·팀 — 금연 카테고리에선 숨김 */}
      {!isQuitCat && (<>
      <OptionToggle
        emoji="📈" title="랭킹 메뉴 표시" accent="sky"
        description="켜면 랭킹 메뉴가 보여요. 세부(시상대·기간 필터)는 발행 후 「랭킹 설정」에서 정해요."
        enabled={rankingEnabled} onToggle={() => setRankingEnabled(v => !v)}
      />

      <OptionToggle
        emoji="👥" title="팀 기능 사용" accent="violet"
        description="참여자끼리 팀을 만들어 함께 도전해요. 랭킹 탭에 팀 랭킹이 함께 보여요."
        enabled={teamEnabled} onToggle={() => setTeamEnabled(v => !v)}
      />

      {/* 팀 기능 세부 설정 — 켜졌을 때만 */}
      {teamEnabled && !rankingEnabled && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-[10px] px-3 py-2 break-keep" style={{ marginBottom: '9px' }}>
          ⚠️ 팀 랭킹은 랭킹 메뉴 안에 표시돼요. <span className="font-medium">랭킹 메뉴를 켜야</span> 팀 기능이 동작해요.
        </p>
      )}
      {teamOn && (
        <div className="rounded-[10px] border-2 border-violet-200 bg-violet-50/40 p-4 space-y-4" style={{ marginBottom: '9px' }}>
          {/* 점수 방식 */}
          <div>
            <p className="text-sm font-medium text-gray-800" style={{ marginBottom: '6px' }}>팀 점수 방식</p>
            <Seg
              value={teamScoreMode}
              onChange={setTeamScoreMode}
              options={[
                { value: 'sum', label: '합계 + 평균' },
                { value: 'average', label: '평균만' },
              ]}
            />
            <p className="text-xs text-gray-600 leading-relaxed break-keep mt-2">
              {teamScoreMode === 'sum'
                ? '팀원 점수 합계로 순위를 매겨요. 인당 평균도 함께 보여 작은 팀도 인정받아요.'
                : '팀원 점수의 평균으로 순위를 매겨요. 인원수가 많아도 유리하지 않아요.'}
            </p>
          </div>

          {/* 정원 정책 */}
          <div>
            <p className="text-sm font-medium text-gray-800" style={{ marginBottom: '6px' }}>팀 정원 정책</p>
            <Seg
              value={teamSizeType}
              onChange={setTeamSizeType}
              options={[
                { value: 'range', label: '범위형' },
                { value: 'fixed', label: '고정형' },
              ]}
            />
            {teamSizeType === 'range' ? (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <NumSelect value={teamSizeMin} onChange={handleMinChange} min={2} max={8} />
                  <span className="text-gray-400 text-sm">~</span>
                  <NumSelect value={teamSizeMax} onChange={setTeamSizeMax} min={teamSizeMin} max={8} />
                </div>
                <p className="text-xs text-gray-600 leading-relaxed break-keep mt-2">
                  팀장이 이 범위 안에서 팀 정원을 직접 골라요. 2명부터 랭킹에 반영돼요.
                </p>
              </div>
            ) : (
              <div className="mt-3">
                <NumSelect value={teamSizeFixed} onChange={setTeamSizeFixed} min={2} max={8} />
                <p className="text-xs text-gray-600 leading-relaxed break-keep mt-2">
                  모든 팀의 정원이 {teamSizeFixed}명으로 고정돼요. {teamSizeFixed}명이 다 모여야 팀이 활성화돼요.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      </>)}

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
