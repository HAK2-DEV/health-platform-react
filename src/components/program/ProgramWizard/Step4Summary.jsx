import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Pencil, X } from 'lucide-react'
import { supabase } from '../../../supabaseClient'
import { useAuth } from '../../../hooks/useAuth'
import { queryKeys } from '../../../lib/queries'
import { CATEGORY, PROGRAM_TYPE, JOIN_TYPE } from '../../../lib/constants'
import { formatKoreanDate, isUpcomingByStartDate } from '../../../lib/formatters'
import { getProgramSurvey } from '../../../lib/surveyDefaults'
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'
import InfoTip from '../../common/InfoTip'
import SurveyEditor from '../SurveyEditor'

// 마법사 Step4 (구 Step5Complete 의 요약 + 게시 부분)
// 본인 (가) 진화 — 미션은 게시 후 운영자가 직접 추가
function Step4Summary({ initialData, programId, onPrev }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const [isPublishing, setIsPublishing] = useState(false)
  const [surveyEnabled, setSurveyEnabled] = useState(initialData?.survey_enabled ?? true)  // 신규 = 기본 ON
  const [surveyQuestions, setSurveyQuestions] = useState(initialData?.survey_questions ?? null)  // null = 카테고리 기본
  const [editorOpen, setEditorOpen] = useState(false)
  const [error, setError] = useState(null)
  const [showUpcomingConfirm, setShowUpcomingConfirm] = useState(false)

  useBodyScrollLock(editorOpen)

  // 설문 ON 시 실제로 물어볼 문항(커스텀 or 카테고리 기본) — 미리보기·편집 초기값
  const previewQuestions = getProgramSurvey({
    categories: initialData?.categories,
    theme: initialData?.theme,
    survey_questions: surveyQuestions,
  })

  // 미래 시작일이면 게시 전에 확인 모달 — 실수 방지(참여자는 그때까지 예약중)
  const handlePublish = () => {
    if (isUpcomingByStartDate(initialData?.start_date)) { setShowUpcomingConfirm(true); return }
    doPublish()
  }

  const doPublish = async () => {
    setIsPublishing(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('programs')
        .update({
          status: 'PUBLISHED',
          published_at: new Date().toISOString(),
          survey_enabled: surveyEnabled,
        })
        .eq('id', programId)

      if (updateError) throw updateError

      // myPrograms + publicPrograms 캐시 무효화 — 상태 전환(DRAFT→PUBLISHED) 즉시 반영
      queryClient.invalidateQueries({ queryKey: queryKeys.myPrograms(session.user.id) })
      queryClient.invalidateQueries({ queryKey: ['programs', 'public'] })

      // 첫 운영자 환영 투어 — 아직 안 본 경우 대시보드에서 1회 표시 (온보딩 A).
      //   localStorage 는 브라우저 공용이라 userId 로 키잉 → 계정별 1회(같은 기기 다른 계정도 각각 노출).
      if (!localStorage.getItem(`operator_welcome_seen_${session.user.id}`)) {
        sessionStorage.setItem('show_operator_welcome', '1')
        sessionStorage.setItem('operator_welcome_program', programId)  // 투어 마무리 CTA·적응형 필터용
      }

      // 게시 완료 → 대시보드
      navigate('/dashboard')
    } catch (err) {
      console.error('프로그램 게시 실패:', err)
      setError(err.message)
    } finally {
      setIsPublishing(false)
    }
  }

  // 카테고리 라벨
  const categoryLabels = (initialData?.categories || [])
    .map(key => Object.values(CATEGORY).find(c => c.key === key)?.label)
    .filter(Boolean)
    .join(', ')

  // 프로그램 유형
  const typeLabel = Object.values(PROGRAM_TYPE)
    .find(t => t.key === initialData?.program_type)?.label || '미지정'

  // 참여 방식
  const joinTypeLabel = Object.values(JOIN_TYPE)
    .find(j => j.key === initialData?.join_type)?.label || '미지정'

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        4단계: 요약 + 게시
      </h2>
      <p className="text-sm text-gray-600 mb-6 break-keep">
        설정한 내용을 확인하고 프로그램을 게시해주세요
      </p>

      {/* 설정 요약 */}
      <div className="bg-gray-50 p-4 rounded-xl mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-1">
          📋 프로그램 설정 요약
        </h3>
        <p className="text-[11px] text-amber-700 mb-3 flex items-start gap-1 break-keep">
          <span className="flex-shrink-0">🔒</span>
          <span>표시된 항목은 게시 후 바꿀 수 없어요. 한 번 더 확인해주세요.</span>
        </p>
        <dl className="space-y-2 text-sm">
          <div className="flex">
            <dt className="w-24 text-gray-600 flex-shrink-0">이름</dt>
            <dd className="flex-1 text-gray-800 break-words">{initialData?.name || '-'}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-gray-600 flex-shrink-0">기간</dt>
            <dd className="flex-1 text-gray-800">
              {formatKoreanDate(initialData?.start_date)} ~ {formatKoreanDate(initialData?.end_date)}
            </dd>
          </div>
          {/* 프로그램 유형 — Day 58 폐기. 레거시 DRAFT 에만 값 있을 때 표시 */}
          {initialData?.program_type && (
            <div className="flex">
              <dt className="w-24 text-gray-600 flex-shrink-0">유형</dt>
              <dd className="flex-1 text-gray-800">{typeLabel}</dd>
            </div>
          )}
          <div className="flex">
            <dt className="w-24 text-gray-600 flex-shrink-0">카테고리</dt>
            <dd className="flex-1 text-gray-800">{categoryLabels || '-'}<span className="ml-1.5 inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5 whitespace-nowrap align-middle">🔒 수정 불가</span></dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-gray-600 flex-shrink-0">옵션</dt>
            <dd className="flex-1 text-gray-800">
              {[
                (initialData?.community_enabled ?? initialData?.feed_enabled) && '💬 커뮤니티',
                (initialData?.ranking_enabled === false) ? '🚫 랭킹 미표시' : '📈 랭킹',
              ].filter(Boolean).join(' · ') || '기본'}
            </dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-gray-600 flex-shrink-0">참여 방식</dt>
            <dd className="flex-1 text-gray-800">{joinTypeLabel}<span className="ml-1.5 inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5 whitespace-nowrap align-middle">🔒 수정 불가</span></dd>
          </div>
          {initialData?.entry_question && (
            <div className="flex">
              <dt className="w-24 text-gray-600 flex-shrink-0">입장 질문</dt>
              <dd className="flex-1 text-gray-800 break-words whitespace-pre-wrap">
                {initialData.entry_question}
                <span className="ml-1.5 inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5 whitespace-nowrap align-middle">🔒 수정 불가</span>
              </dd>
            </div>
          )}
          <div className="flex">
            <dt className="w-24 text-gray-600 flex-shrink-0">공개 여부</dt>
            <dd className="flex-1 text-gray-800">
              {initialData?.is_public ? '공개' : '비공개'}
            </dd>
          </div>
          {initialData?.max_participants && (
            <div className="flex">
              <dt className="w-24 text-gray-600 flex-shrink-0">최대 인원</dt>
              <dd className="flex-1 text-gray-800">{initialData.max_participants}명</dd>
            </div>
          )}
        </dl>
      </div>

      {/* 참여 설문 — 시작·종료 설문(기본 ON). 상세는 툴팁. */}
      <div className={`w-full mb-6 p-4 rounded-xl border-2 transition ${surveyEnabled ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📋</span>
          <span className={`flex-1 flex items-center gap-1 text-sm font-medium ${surveyEnabled ? 'text-emerald-700' : 'text-gray-800'}`}>
            시작·종료 설문 받기
            <InfoTip>시작·종료에 참가자에게 목표·실천 정도를 물어 <b>변화</b>를 리포트로 보여줘요. 참가자는 스킵할 수 있어요.</InfoTip>
          </span>
          <button type="button" onClick={() => setSurveyEnabled((v) => !v)} aria-label="시작·종료 설문 토글"
            className={`relative w-10 h-6 rounded-full flex-shrink-0 transition ${surveyEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${surveyEnabled ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
        </div>

        {/* 문항 미리보기 + 편집 — 뭘 물어볼지 여기서 바로 확인·수정(발견성·투명성) */}
        {surveyEnabled && (
          <div className="mt-3 pt-3 border-t border-emerald-200/70">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-semibold text-emerald-800">이런 문항으로 물어봐요</span>
              <button type="button" onClick={() => setEditorOpen(true)}
                className="ml-auto inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-white text-emerald-700 border border-emerald-300 text-[12px] font-semibold hover:bg-emerald-100 transition">
                <Pencil className="w-3 h-3" /> 문항 편집
              </button>
            </div>
            <ol className="space-y-1">
              {previewQuestions.map((q, i) => (
                <li key={q.id || i} className="text-[12px] text-gray-700 break-keep leading-snug">
                  <span className="text-emerald-600 font-semibold">{i + 1}.</span> {q.q}
                  <span className="text-gray-400"> · {q.type === 'scale' ? '1~5 점수' : '단답'}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* 미션 추가 안내 */}
      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl mb-6">
        <h3 className="text-sm font-medium text-emerald-800 mb-1">
          ✨ 게시 후 미션을 추가해주세요
        </h3>
        <p className="text-xs text-emerald-700">
          프로그램 게시 후 활동 페이지의 <strong>"+ 미션 추가"</strong> 버튼으로
          참여자가 인증할 미션을 자유롭게 만들 수 있어요.
        </p>
      </div>

      {/* 에러 */}
      {error && (
        <p style={{ marginBottom: '9px' }} className="p-2 bg-red-100 text-red-700 rounded-xl text-sm text-center">
          {error}
        </p>
      )}

      {/* 버튼 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={isPublishing}
          className="flex-1 px-3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition whitespace-nowrap text-sm disabled:opacity-50"
        >
          이전
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPublishing}
          className="flex-[2] px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition disabled:bg-gray-400"
        >
          {isPublishing ? '게시 중...' : '🎉 프로그램 만들기'}
        </button>
      </div>

      {/* 문항 편집 모달 — 마법사 이탈 없이 그 자리에서 */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-4 pb-10">
            <div className="flex items-center gap-2 mb-1 sticky top-0 bg-white py-2 -mt-2 z-10">
              <h2 className="text-lg font-extrabold text-gray-900">설문 문항 편집</h2>
              <button type="button" onClick={() => setEditorOpen(false)} aria-label="닫기"
                className="ml-auto flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <p className="text-[12px] text-gray-500 mb-3">시작·종료에 참가자에게 물을 문항이에요. (단답 / 척도 1~5)</p>
            <SurveyEditor
              program={{ id: programId, categories: initialData?.categories, theme: initialData?.theme, survey_questions: surveyQuestions }}
              responseCount={0}
              onDone={(qs) => { setSurveyQuestions(qs); setEditorOpen(false) }}
            />
          </div>
        </div>
      )}
      {/* 미래 시작일 확인 — 게시 클릭 시 중앙 팝업 (강조). 실수 방지 */}
      {showUpcomingConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/45">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 text-center shadow-xl">
            <div className="text-4xl mb-2 leading-none">⏰</div>
            <h3 className="text-lg font-extrabold text-gray-900">시작일이 미래예요</h3>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed break-keep">
              <b className="text-gray-800">{formatKoreanDate(initialData?.start_date)}</b> (D-{Math.max(1, Math.ceil((new Date(`${initialData?.start_date}T00:00:00+09:00`) - Date.now()) / 86400000))}) 전까지 참여자는 <b>예약 상태</b>가 되어 미션을 인증할 수 없어요.<br />실수로 미래 날짜를 고른 게 아닌가요?
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" onClick={() => { setShowUpcomingConfirm(false); onPrev() }}
                className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition">시작일 수정하기</button>
              <button type="button" onClick={() => { setShowUpcomingConfirm(false); doPublish() }}
                className="w-full h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-[14px] font-bold transition">이대로 계속하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Step4Summary
