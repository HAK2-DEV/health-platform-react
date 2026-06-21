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
  const [quizEnabled, setQuizEnabled] = useState(true)        // 메뉴바 퀴즈 사용 (102)
  const [communityEnabled, setCommunityEnabled] = useState(true)  // 메뉴바 커뮤니티 사용 (102) = 피드 활성
  const [rankingEnabled, setRankingEnabled] = useState(true)  // 랭킹 메뉴 표시 (세부는 랭킹 설정)
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
      setQuizEnabled(program.quiz_enabled !== false)
      // 커뮤니티 메뉴 = 피드 활성. 102 미적용(컬럼 없음) 프로그램은 기존 feed_enabled 로 판단
      setCommunityEnabled(
        Object.prototype.hasOwnProperty.call(program, 'community_enabled')
          ? program.community_enabled !== false
          : !!program.feed_enabled
      )
      // ranking_enabled DEFAULT true — undefined/null 이면 켜진 상태로 (마법사와 동일 동작)
      setRankingEnabled(program.ranking_enabled !== false)
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
        // 커뮤니티 메뉴 사용 = 피드 활성 (둘을 하나로 통합)
        feed_enabled: communityEnabled,
        // 102 컬럼 — 마이그레이션 적용 후에만 저장(미적용 시 스킵, 하위호환)
        ...(Object.prototype.hasOwnProperty.call(program, 'quiz_enabled') ? { quiz_enabled: quizEnabled } : {}),
        ...(Object.prototype.hasOwnProperty.call(program, 'community_enabled') ? { community_enabled: communityEnabled } : {}),
        // 랭킹 메뉴 표시 — OFF 면 세부(시상대/추세/기간필터)도 자동 OFF. 세부 설정은 「랭킹 설정」.
        ranking_enabled: rankingEnabled,
        ...(rankingEnabled ? {} : { podium_enabled: false, trend_enabled: false, period_filter_enabled: false }),
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

          {/* 카테고리 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              카테고리 (복수 선택)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORY_LIST.map(category => {
                const isSelected = categories.includes(category.key)
                return (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => toggleCategory(category.key)}
                    disabled={isSaving}
                    className={`
                      flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border-2 text-sm transition disabled:opacity-50
                      ${isSelected
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}
                    `}
                  >
                    <span>{category.emoji}</span>
                    <span>{category.label}</span>
                  </button>
                )
              })}
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
                  켜면 랭킹 메뉴가 보여요. 세부(시상대·추세·기간필터)는 「랭킹 설정」에서 정해요.
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

          {/* 에러 */}
          {error && (
            <p className="mb-3 p-2 bg-red-100 text-red-700 rounded text-sm text-center">
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
