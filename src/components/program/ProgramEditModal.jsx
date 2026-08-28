import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { supabase } from '../../supabaseClient'
import { CATEGORY_LIST, PROGRAM } from '../../lib/constants'
import { formatKoreanDate } from '../../lib/formatters'
import CoverImageUploader from '../common/CoverImageUploader'

// 운영자가 PUBLISHED 프로그램의 안전 항목만 수정.
// 수정 가능: name, description, categories, end_date, max_participants, is_public
// 수정 불가 (자식 데이터 충돌 우려):
//   start_date (참여자 활동 시작 이후 변경 불가),
//   features / score_rules / approval_mode / bundle_image_numeric (missions 재생성 필요)
//
// end_date 변경 시 027 트리거가 자동으로 missions.active_until 동기화.
function ProgramEditModal({ program, isOpen, onClose, onSuccess }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categories, setCategories] = useState([])
  const [endDate, setEndDate] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [previewEnabled, setPreviewEnabled] = useState(false)
  const [inviteRequiresApproval, setInviteRequiresApproval] = useState(false)
  const [publicRequiresApproval, setPublicRequiresApproval] = useState(false)  // 공개 프로그램 FREE↔APPROVAL(G27)
  const [quizEnabled, setQuizEnabled] = useState(true)        // 메뉴바 퀴즈 사용 (102)
  const [communityEnabled, setCommunityEnabled] = useState(true)  // 메뉴바 커뮤니티 사용 (102) = 피드 활성
  const [rankingEnabled, setRankingEnabled] = useState(true)  // 랭킹 메뉴 표시 (세부는 랭킹 설정)
  const [classFeatureEnabled, setClassFeatureEnabled] = useState(false)  // 클래스 메뉴 사용 — 생성 후에도 토글 가능(기존엔 2단계에서만 설정)
  const [signupLeadDays, setSignupLeadDays] = useState(null)  // 클래스 신청 개방(시작 N일 전). null=항상
  const [signupOpenTime, setSignupOpenTime] = useState('')    // 개방 시각 'HH:MM'. 빈값=클래스 시작 시각과 동일(기존 동작)
  // 팀 기능 (126) — 랭킹이 켜져 있어야 동작
  const [teamEnabled, setTeamEnabled] = useState(false)
  const [teamScoreMode, setTeamScoreMode] = useState('sum')
  const [teamSizeType, setTeamSizeType] = useState('range')
  const [teamSizeMin, setTeamSizeMin] = useState(2)
  const [teamSizeMax, setTeamSizeMax] = useState(4)
  const [teamSizeFixed, setTeamSizeFixed] = useState(4)
  const [changeTabEnabled, setChangeTabEnabled] = useState(false)  // 금연 「내 변화」 탭 (140)
  const [progressEnabled, setProgressEnabled] = useState(true)     // 「나의 진행 현황」 카드 표시 (145, 개요 흡수)
  const [savingSubtract, setSavingSubtract] = useState(true)       // 금연 「오늘 절약」 흡연 차감 (139, 개요 흡수)
  const [coverImagePath, setCoverImagePath] = useState(null)
  const [inviteCode, setInviteCode] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  // 모달 열릴 때마다 program 데이터로 초기화
  useEffect(() => {
    if (program && isOpen) {
      setName(program.name || '')
      setDescription(program.description || '')
      setCategories(program.categories || [])
      setEndDate(program.end_date || '')
      setMaxParticipants(program.max_participants ?? '')
      setIsPublic(!!program.is_public)
      setPreviewEnabled(!!program.preview_enabled)
      setInviteRequiresApproval(!!program.invite_requires_approval)
      setPublicRequiresApproval(program.join_type === 'APPROVAL')
      setQuizEnabled(program.quiz_enabled !== false)
      // 커뮤니티 메뉴 = 피드 활성. 102 미적용(컬럼 없음) 프로그램은 기존 feed_enabled 로 판단
      setCommunityEnabled(
        Object.prototype.hasOwnProperty.call(program, 'community_enabled')
          ? program.community_enabled !== false
          : !!program.feed_enabled
      )
      // ranking_enabled DEFAULT true — undefined/null 이면 켜진 상태로 (마법사와 동일 동작)
      setRankingEnabled(program.ranking_enabled !== false)
      setClassFeatureEnabled(!!program.class_feature_enabled)
      setSignupLeadDays(program.class_signup_lead_days ?? null)
      // TIME 은 'HH:MM:SS' 로 오는데 input[type=time] 은 'HH:MM' 을 받는다
      setSignupOpenTime((program.class_signup_open_time || '').slice(0, 5))
      // TIME 은 'HH:MM:SS' 로 오는데 input[type=time] 은 'HH:MM' 을 받는다
      setSignupOpenTime((program.class_signup_open_time || '').slice(0, 5))
      setChangeTabEnabled(program.change_tab_enabled === true)
      setProgressEnabled(program.overview_progress_enabled !== false)
      setSavingSubtract(program.saving_subtract_smoking !== false)
      // 팀 기능 (126)
      setTeamEnabled(!!program.team_enabled)
      setTeamScoreMode(program.team_score_mode || 'sum')
      setTeamSizeType(program.team_size_type || 'range')
      setTeamSizeMin(program.team_size_min || 2)
      setTeamSizeMax(program.team_size_max || 4)
      setTeamSizeFixed(program.team_size_fixed || 4)
      setCoverImagePath(program.cover_image_path || null)
      setInviteCode(program.invite_code || '')
      setError(null)
      setIsSaving(false)
    }
  }, [program, isOpen])

  const toggleCategory = (key) => {
    if (categories.includes(key)) {
      setCategories(categories.filter(c => c !== key))
    } else {
      setCategories([...categories, key])
    }
  }

  const validate = () => {
    if (!name.trim()) return '프로그램 이름을 입력해주세요'
    if (name.length > PROGRAM.NAME_MAX_LENGTH) {
      return `프로그램 이름은 최대 ${PROGRAM.NAME_MAX_LENGTH}자까지 가능합니다`
    }
    if (!endDate) return '종료일을 입력해주세요'
    if (program?.start_date && endDate < program.start_date) {
      return '종료일은 시작일 이후여야 합니다'
    }
    if (description.length > PROGRAM.DESCRIPTION_MAX_LENGTH) {
      return `목표 설명은 최대 ${PROGRAM.DESCRIPTION_MAX_LENGTH}자까지 가능합니다`
    }
    if (categories.length === 0) return '카테고리를 최소 1개 선택해주세요'
    return null
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('programs')
      .update({
        name: name.trim(),
        description: description.trim(),
        categories,
        end_date: endDate,
        max_participants: maxParticipants === '' ? null : parseInt(maxParticipants),
        is_public: isPublic,
        preview_enabled: previewEnabled,
        ...(program.join_type === 'INVITE_CODE' ? { invite_requires_approval: inviteRequiresApproval } : {}),
        ...(program.join_type !== 'INVITE_CODE' ? { join_type: publicRequiresApproval ? 'APPROVAL' : 'FREE' } : {}),  // G27 — 공개 승인 전환
        // 커뮤니티 메뉴 사용 = 피드 활성 (둘을 하나로 통합)
        feed_enabled: communityEnabled,
        // 102 컬럼 — 마이그레이션 적용 후에만 저장(미적용 시 스킵, 하위호환)
        ...(Object.prototype.hasOwnProperty.call(program, 'quiz_enabled') ? { quiz_enabled: quizEnabled } : {}),
        ...(Object.prototype.hasOwnProperty.call(program, 'community_enabled') ? { community_enabled: communityEnabled } : {}),
        // 클래스 메뉴 사용 — 생성 후에도 켜고 끌 수 있게 (기존엔 2단계에서만 설정됨)
        class_feature_enabled: classFeatureEnabled,
        class_signup_lead_days: signupLeadDays || null,   // 클래스 신청 개방(null/0=항상)
        class_signup_open_time: signupOpenTime || null,   // 개방 시각(null=클래스 시작 시각과 동일)
        // 랭킹 메뉴 표시 — OFF 면 세부(시상대/추세/기간필터)도 자동 OFF. 세부 설정은 「랭킹 설정」.
        ranking_enabled: rankingEnabled,
        ...(rankingEnabled ? {} : { podium_enabled: false, trend_enabled: false, period_filter_enabled: false }),
        // 금연 「내 변화」 탭 (140) — 컬럼 적용 시에만 저장
        ...(Object.prototype.hasOwnProperty.call(program, 'change_tab_enabled') ? { change_tab_enabled: changeTabEnabled } : {}),
        // 개요 흡수 — 진행현황 카드 표시(145) / 금연 절약 차감(139), 컬럼 적용 시에만
        ...(Object.prototype.hasOwnProperty.call(program, 'overview_progress_enabled') ? { overview_progress_enabled: progressEnabled } : {}),
        ...(Object.prototype.hasOwnProperty.call(program, 'saving_subtract_smoking') ? { saving_subtract_smoking: savingSubtract } : {}),
        // 팀 기능 (126) — 토글 그대로 저장 (랭킹 OFF 시엔 화면에서 안 보일 뿐)
        team_enabled: teamEnabled,
        team_score_mode: teamEnabled ? teamScoreMode : null,
        team_size_type: teamEnabled ? teamSizeType : null,
        team_size_min: (teamEnabled && teamSizeType === 'range') ? teamSizeMin : null,
        team_size_max: (teamEnabled && teamSizeType === 'range') ? teamSizeMax : null,
        team_size_fixed: (teamEnabled && teamSizeType === 'fixed') ? teamSizeFixed : null,
        cover_image_path: coverImagePath,
        // INVITE_CODE 모드면 코드 수정 반영 — 빈 칸이면 기존 코드 유지(공백 저장 안 함)
        ...(program.join_type === 'INVITE_CODE' && inviteCode.trim()
          ? { invite_code: inviteCode.trim() }
          : {}),
      })
      .eq('id', program.id)

    if (updateError) {
      console.error('프로그램 수정 실패:', updateError)
      setError(updateError.message)
      setIsSaving(false)
      return
    }

    onSuccess?.()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {program && (
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-1 pr-8">
            ✏️ 프로그램 수정
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {program.name}
          </p>

          {/* 대표 사진 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              대표 사진 (선택)
            </label>
            <CoverImageUploader
              ownerId={program.owner_id}
              imagePath={coverImagePath}
              onChange={setCoverImagePath}
              categories={categories}
              name={name}
              disabled={isSaving}
            />
          </div>

          {/* 이름 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              프로그램 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={PROGRAM.NAME_MAX_LENGTH}
              disabled={isSaving}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
            />
          </div>

          {/* 운영 기간 — 시작일 readonly */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              운영 기간
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-gray-50 border-2 border-gray-200 rounded-md text-sm text-gray-500">
                {formatKoreanDate(program.start_date)}
              </div>
              <span className="text-gray-500">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={program.start_date}
                disabled={isSaving}
                className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              시작일은 수정 불가. 종료일만 변경 가능 — 미션 활성 기간도 자동 동기화돼요.
            </p>
          </div>

          {/* 목표 설명 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              목표 설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={PROGRAM.DESCRIPTION_MAX_LENGTH}
              rows={3}
              disabled={isSaving}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50 resize-none"
            />
          </div>

          {/* 카테고리 — 생성 후 변경 불가 (카테고리가 테마·메뉴 구성을 결정하므로) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border-2 border-gray-200 bg-gray-50 text-sm text-gray-700">
              {(() => {
                const c = CATEGORY_LIST.find(x => categories.includes(x.key))
                return c
                  ? <><span>{c.emoji}</span><span>{c.label}</span></>
                  : <span className="text-gray-400">미설정</span>
              })()}
              <span className="ml-auto text-[11px] text-gray-400">🔒 생성 후 변경 불가</span>
            </div>
          </div>

          {/* 최대 참여 인원 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              최대 참여 인원 (선택)
            </label>
            <input
              type="number"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              min={1}
              placeholder="무제한"
              disabled={isSaving}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
            />
          </div>

          {/* 공개 여부 */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                disabled={isSaving}
                className="w-4 h-4 text-emerald-500"
              />
              <span className="text-sm text-gray-700">공개 검색 허용</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              다른 사용자들의 둘러보기에 노출돼요
            </p>
          </div>

          {/* 참여 전 미리보기 — 검색 노출과 별개로 내부 열람 허용 */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={previewEnabled}
                onChange={(e) => setPreviewEnabled(e.target.checked)}
                disabled={isSaving}
                className="w-4 h-4 text-emerald-500"
              />
              <span className="text-sm text-gray-700">참여 전 둘러보기 허용</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              비참여자도 참여 전 미션·커뮤니티·랭킹을 볼 수 있어요 (인증·작성은 참여 후)
            </p>
          </div>

          {/* 공개 프로그램 승인 — join_type FREE↔APPROVAL 전환(G27) */}
          {program.join_type !== 'INVITE_CODE' && (
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publicRequiresApproval}
                  onChange={(e) => setPublicRequiresApproval(e.target.checked)}
                  disabled={isSaving}
                  className="w-4 h-4 text-emerald-500"
                />
                <span className="text-sm text-gray-700">참여 시 운영자 승인 필요</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6 break-keep leading-relaxed">
                켜면 참여 신청이 바로 승인되지 않고 승인 대기로 들어가요. 이미 참여 중인 사람은 그대로예요.
              </p>
            </div>
          )}

          {/* 초대코드 승인 — 비공개(INVITE_CODE) 프로그램만 */}
          {program.join_type === 'INVITE_CODE' && (
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inviteRequiresApproval}
                  onChange={(e) => setInviteRequiresApproval(e.target.checked)}
                  disabled={isSaving}
                  className="w-4 h-4 text-emerald-500"
                />
                <span className="text-sm text-gray-700">초대코드 입장 시 운영자 승인</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6 break-keep leading-relaxed">
                켜면 코드를 입력해도 바로 참여되지 않고 승인 대기로 들어가요 (코드 유출 대비)
              </p>
            </div>
          )}

          {/* 초대 코드 — INVITE_CODE 프로그램만 노출 */}
          {program.join_type === 'INVITE_CODE' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                초대 코드
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                disabled={isSaving}
                placeholder="비우면 기존 코드 유지"
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                참가자에게 이 코드로 참여 안내. 변경하면 기존 코드는 즉시 무효 — 새로 공유 필요.
              </p>
            </div>
          )}

          {/* 퀴즈 사용 — 끄면 참여자 탭바 + 운영자 메뉴바 설정에서 숨김 (102) */}
          <button
            type="button"
            onClick={() => setQuizEnabled(!quizEnabled)}
            disabled={isSaving}
            className={`w-full mb-3 p-3 rounded-lg border-2 text-left transition disabled:opacity-50 ${quizEnabled ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-xl">📋</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${quizEnabled ? 'text-indigo-700' : 'text-gray-800'}`}>퀴즈 메뉴 사용</p>
                <p className="text-xs text-gray-500 mt-0.5">끄면 퀴즈 탭이 참여자에게 안 보이고 메뉴바 설정에서도 숨겨져요.</p>
              </div>
              <div className={`relative w-9 h-5 rounded-full flex-shrink-0 transition mt-0.5 ${quizEnabled ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${quizEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </div>
          </button>

          {/* 커뮤니티 사용 (102) */}
          <button
            type="button"
            onClick={() => setCommunityEnabled(!communityEnabled)}
            disabled={isSaving}
            className={`w-full mb-3 p-3 rounded-lg border-2 text-left transition disabled:opacity-50 ${communityEnabled ? 'border-rose-500 bg-rose-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-xl">💬</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${communityEnabled ? 'text-rose-700' : 'text-gray-800'}`}>커뮤니티 메뉴 사용</p>
                <p className="text-xs text-gray-500 mt-0.5">인증 피드 포함. 끄면 커뮤니티 탭이 참여자에게 안 보이고 메뉴바 설정에서도 숨겨져요.</p>
              </div>
              <div className={`relative w-9 h-5 rounded-full flex-shrink-0 transition mt-0.5 ${communityEnabled ? 'bg-rose-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${communityEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </div>
          </button>

          {/* 클래스 사용 — 생성 후에도 토글 가능. 켜면 클래스 일정 운영, 끄면 탭 숨김 */}
          <button
            type="button"
            onClick={() => setClassFeatureEnabled(!classFeatureEnabled)}
            disabled={isSaving}
            className={`w-full mb-3 p-3 rounded-lg border-2 text-left transition disabled:opacity-50 ${classFeatureEnabled ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-xl">📅</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${classFeatureEnabled ? 'text-teal-700' : 'text-gray-800'}`}>클래스 메뉴 사용</p>
                <p className="text-xs text-gray-500 mt-0.5">요가·필라테스처럼 정해진 시간에 모이는 수업 일정을 운영해요. 끄면 클래스 탭이 참여자에게 안 보여요.</p>
              </div>
              <div className={`relative w-9 h-5 rounded-full flex-shrink-0 transition mt-0.5 ${classFeatureEnabled ? 'bg-teal-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${classFeatureEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </div>
          </button>

          {/* 클래스 신청 개방 시점 — 주차별 클래스 미리 신청 방지 */}
          {classFeatureEnabled && (
            <div className="mb-3 -mt-1 p-3 rounded-lg border border-gray-200 bg-white">
              <p className="text-sm font-medium text-gray-800">클래스 신청은 언제부터?</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-2 break-keep">주차별 클래스를 미리 만들어도 <b className="text-emerald-700">시작 며칠 전부터</b> 신청이 열려요. (먼 미래 클래스 미리 신청 방지)</p>
              <select value={signupLeadDays ?? 0} onChange={(e) => setSignupLeadDays(Number(e.target.value) || null)}
                className="w-full h-10 px-2.5 rounded-lg border-2 border-gray-200 bg-white text-sm text-gray-700 focus:border-emerald-400 focus:outline-none">
                <option value={0}>항상 열림 (만들면 바로 신청)</option>
                <option value={1}>시작 1일 전부터</option>
                <option value={3}>시작 3일 전부터</option>
                <option value={7}>시작 1주 전부터</option>
                <option value={14}>시작 2주 전부터</option>
              </select>

              {/* 개방 «시각» — 안 정하면 클래스 시작 시각과 같은 시각에 열린다.
                  (저녁 7시 클래스는 3일 전 저녁 7시에야 열려서 "그날 아침부터" 라는 기대와 어긋났다.
                   시각을 고정하면 오전·저녁 클래스가 모두 같은 시각에 열려 선착순이 공평해진다) */}
              {signupLeadDays > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-800">그날 몇 시에 열까요?</p>
                  <p className="text-xs text-gray-500 mt-0.5 mb-2 break-keep">
                    비워두면 <b className="text-gray-600">클래스 시작 시각</b>과 같은 시각에 열려요
                    (저녁 7시 클래스 → 저녁 7시 개방). 시각을 정하면 모든 클래스가 그 시각에 함께 열려요.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={signupOpenTime}
                      onChange={(e) => setSignupOpenTime(e.target.value)}
                      className="flex-1 min-w-0 h-10 px-2.5 rounded-lg border-2 border-gray-200 bg-white text-sm text-gray-700 focus:border-emerald-400 focus:outline-none"
                    />
                    {signupOpenTime && (
                      <button type="button" onClick={() => setSignupOpenTime('')}
                        className="flex-shrink-0 h-10 px-3 rounded-lg border-2 border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition">
                        지우기
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 금연 테마 — 랭킹/팀 대신 「내 변화」 탭 토글 */}
          {program?.theme === 'QUIT_SMOKING' && (
            <button
              type="button"
              onClick={() => setChangeTabEnabled(!changeTabEnabled)}
              disabled={isSaving}
              className={`w-full mb-3 p-3 rounded-lg border-2 text-left transition disabled:opacity-50 ${changeTabEnabled ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-xl">📈</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${changeTabEnabled ? 'text-emerald-700' : 'text-gray-800'}`}>「내 변화」 탭 사용</p>
                  <p className="text-xs text-gray-500 mt-0.5">참가자가 자신의 기분·흡연 변화를 한눈에 봐요. 운영자에겐 「참가자 추세」 탭으로 보여요.</p>
                </div>
                <div className={`relative w-9 h-5 rounded-full flex-shrink-0 transition mt-0.5 ${changeTabEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${changeTabEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </button>
          )}

          {/* 금연 설정 — 「오늘 절약」 흡연 차감 (139, 개요 흡수) */}
          {program?.theme === 'QUIT_SMOKING' && (
            <button
              type="button"
              onClick={() => setSavingSubtract(!savingSubtract)}
              disabled={isSaving}
              className={`w-full mb-3 p-3 rounded-lg border-2 text-left transition disabled:opacity-50 ${savingSubtract ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-xl">🚭</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${savingSubtract ? 'text-emerald-700' : 'text-gray-800'}`}>흡연 시 절약액 차감</p>
                  <p className="text-xs text-gray-500 mt-0.5">{savingSubtract ? '핀 만큼 「오늘 절약」이 마이너스로 표시돼요.' : '안 핀 만큼만 절약으로 표시돼요 (마이너스 없음).'}</p>
                </div>
                <div className={`relative w-9 h-5 rounded-full flex-shrink-0 transition mt-0.5 ${savingSubtract ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${savingSubtract ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </button>
          )}

          {/* 랭킹·팀 — 금연 테마에선 숨김 */}
          {program?.theme !== 'QUIT_SMOKING' && (<>
          {/* 랭킹 표시 — 끄면 랭킹 페이지/탭에서 숨김 (단순 습관 형성 모드) */}
          <button
            type="button"
            onClick={() => setRankingEnabled(!rankingEnabled)}
            disabled={isSaving}
            className={`
              w-full mb-3 p-3 rounded-lg border-2 text-left transition disabled:opacity-50
              ${rankingEnabled
                ? 'border-sky-500 bg-sky-50'
                : 'border-gray-200 bg-white hover:border-gray-300'}
            `}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-xl">📈</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${rankingEnabled ? 'text-sky-700' : 'text-gray-800'}`}>
                  랭킹 메뉴 표시
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  켜면 랭킹 메뉴가 보여요. 세부(시상대·기간필터)는 「랭킹 설정」에서 정해요.
                </p>
              </div>
              <div className={`
                relative w-9 h-5 rounded-full flex-shrink-0 transition mt-0.5
                ${rankingEnabled ? 'bg-sky-500' : 'bg-gray-300'}
              `}>
                <div className={`
                  absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                  ${rankingEnabled ? 'translate-x-4' : 'translate-x-0.5'}
                `} />
              </div>
            </div>
          </button>

          {/* 시상대·추세·기간 필터는 「랭킹 설정」에서 (운영자 메뉴 → 메뉴바 설정 → 랭킹 설정) */}

          {/* 팀 기능 (126) — 랭킹이 켜져 있어야 동작 */}
          <button
            type="button"
            onClick={() => setTeamEnabled(!teamEnabled)}
            disabled={isSaving}
            className={`w-full mb-3 p-3 rounded-lg border-2 text-left transition disabled:opacity-50 ${teamEnabled ? 'border-violet-500 bg-violet-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-xl">👥</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${teamEnabled ? 'text-violet-700' : 'text-gray-800'}`}>팀 기능 사용</p>
                <p className="text-xs text-gray-500 mt-0.5">팀 생성·초대는 참여자가 해요. 운영자는 규칙만 정하고, 랭킹 탭에 팀 순위가 보여요.</p>
              </div>
              <div className={`relative w-9 h-5 rounded-full flex-shrink-0 transition mt-0.5 ${teamEnabled ? 'bg-violet-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${teamEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </div>
          </button>

          {teamEnabled && !rankingEnabled && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 break-keep">
              ⚠️ 팀 랭킹은 랭킹 메뉴 안에 표시돼요. <span className="font-medium">랭킹 메뉴를 켜야</span> 팀 기능이 동작해요.
            </p>
          )}
          {teamEnabled && rankingEnabled && (
            <div className="rounded-lg border-2 border-violet-200 bg-violet-50/40 p-3 mb-3 space-y-4">
              {/* 점수 방식 */}
              <div>
                <p className="text-sm font-medium text-gray-800 mb-1.5">팀 점수 방식</p>
                <div className="flex gap-2">
                  {[{ v: 'sum', l: '합계 + 평균' }, { v: 'average', l: '평균만' }].map(o => (
                    <button key={o.v} type="button" disabled={isSaving} onClick={() => setTeamScoreMode(o.v)}
                      className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm text-center transition disabled:opacity-50 ${teamScoreMode === o.v ? 'border-violet-500 bg-violet-50 text-violet-700 font-medium' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                      {o.l}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed break-keep mt-2">
                  {teamScoreMode === 'sum'
                    ? '팀원 점수 합계로 순위를 매겨요. 인당 평균도 함께 보여 작은 팀도 인정받아요.'
                    : '팀원 점수의 평균으로 순위를 매겨요. 인원수가 많아도 유리하지 않아요.'}
                </p>
              </div>
              {/* 정원 정책 */}
              <div>
                <p className="text-sm font-medium text-gray-800 mb-1.5">팀 정원 정책</p>
                <div className="flex gap-2">
                  {[{ v: 'range', l: '범위형' }, { v: 'fixed', l: '고정형' }].map(o => (
                    <button key={o.v} type="button" disabled={isSaving} onClick={() => setTeamSizeType(o.v)}
                      className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm text-center transition disabled:opacity-50 ${teamSizeType === o.v ? 'border-violet-500 bg-violet-50 text-violet-700 font-medium' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                      {o.l}
                    </button>
                  ))}
                </div>
                {teamSizeType === 'range' ? (
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <select value={teamSizeMin} disabled={isSaving}
                        onChange={e => { const v = Number(e.target.value); setTeamSizeMin(v); if (v > teamSizeMax) setTeamSizeMax(v) }}
                        className="px-3 py-2 rounded-lg border-2 border-gray-200 bg-white text-sm text-gray-700 focus:border-violet-400 focus:outline-none disabled:opacity-50">
                        {[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}명</option>)}
                      </select>
                      <span className="text-gray-400 text-sm">~</span>
                      <select value={teamSizeMax} disabled={isSaving}
                        onChange={e => setTeamSizeMax(Number(e.target.value))}
                        className="px-3 py-2 rounded-lg border-2 border-gray-200 bg-white text-sm text-gray-700 focus:border-violet-400 focus:outline-none disabled:opacity-50">
                        {[2,3,4,5,6,7,8].filter(n => n >= teamSizeMin).map(n => <option key={n} value={n}>{n}명</option>)}
                      </select>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed break-keep mt-2">
                      팀장이 이 범위 안에서 팀 정원을 직접 골라요. 2명부터 랭킹에 반영돼요.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3">
                    <select value={teamSizeFixed} disabled={isSaving}
                      onChange={e => setTeamSizeFixed(Number(e.target.value))}
                      className="px-3 py-2 rounded-lg border-2 border-gray-200 bg-white text-sm text-gray-700 focus:border-violet-400 focus:outline-none disabled:opacity-50">
                      {[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}명</option>)}
                    </select>
                    <p className="text-xs text-gray-600 leading-relaxed break-keep mt-2">
                      모든 팀의 정원이 {teamSizeFixed}명으로 고정돼요. {teamSizeFixed}명이 다 모여야 팀이 활성화돼요.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 「나의 진행 현황」 카드 표시 (145, 개요 흡수) — 이 카드가 있는 테마(표준/레거시)에서만.
              러닝(러닝 인사이트로 대체)·금연(카드 없음)·식단(자체 도넛 사용)에선 토글 숨김. */}
          {program?.theme !== 'RUNNING' && program?.categories?.[0] !== 'DIET' && (
            <button
              type="button"
              onClick={() => setProgressEnabled(!progressEnabled)}
              disabled={isSaving}
              className={`w-full mb-3 p-3 rounded-lg border-2 text-left transition disabled:opacity-50 ${progressEnabled ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-xl">📈</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${progressEnabled ? 'text-emerald-700' : 'text-gray-800'}`}>「나의 진행 현황」 카드 표시</p>
                  <p className="text-xs text-gray-500 mt-0.5">끄면 개요의 진행 현황 카드(활동일·참여율·연속·진행률)가 안 보여요.</p>
                </div>
                <div className={`relative w-9 h-5 rounded-full flex-shrink-0 transition mt-0.5 ${progressEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${progressEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </button>
          )}
          </>)}

          {/* 에러 */}
          {error && (
            <p style={{ marginBottom: '9px' }} className="p-2 bg-red-100 text-red-700 rounded text-sm text-center">
              {error}
            </p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-[2] px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition disabled:bg-gray-400"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ProgramEditModal
