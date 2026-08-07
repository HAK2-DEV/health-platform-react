import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, ChevronLeft, FileText, Check, ExternalLink, Pencil } from 'lucide-react'
import Modal from '../common/Modal'
import InfoTip from '../common/InfoTip'
import { QUIZ_AUDIENCES } from '../../lib/quizLibrary'

// 퀴즈 라이브러리 — 3단계: 대상자 → 주제 → 미리보기 → 「편집하기」로 폼(QuizCreatePage) 이어받기.
//   주제 클릭 = 모달 안 미리보기(읽기전용). 단계마다 뒤로가기 → 모달 유지.
//   해설·출처는 운영자 참고용으로 미리보기에서만 노출(발행본 미저장).
//
//   initialSelection ("audienceKey:topicKey"): 편집 폼에서 뒤로가기로 돌아왔을 때 미리보기 단계 복원.
//     편집하기 시 /posts URL 에 ?quizlib=aud:topic 저장 → 폼에서 navigate(-1) 시 이 모달 재오픈.
function QuizLibraryModal({ isOpen, onClose, programId, initialSelection = null }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [audienceKey, setAudienceKey] = useState(null)
  const [topicKey, setTopicKey] = useState(null)

  // 열릴 때 단계 초기화 — 파라미터 있으면 미리보기 복원, 없으면 대상자 단계
  useEffect(() => {
    if (!isOpen) return
    if (initialSelection) {
      const [a, t] = initialSelection.split(':')
      setAudienceKey(a)
      setTopicKey(t)
    } else {
      setAudienceKey(null)
      setTopicKey(null)
    }
  }, [isOpen, initialSelection])

  const audience = QUIZ_AUDIENCES.find(a => a.key === audienceKey) || null
  const topic = audience?.topics.find(t => t.key === topicKey) || null
  const step = !audience ? 'audience' : !topic ? 'topic' : 'preview'

  const handleClose = () => {
    onClose()
  }

  const startEdit = () => {
    // /posts URL 에 선택 저장 → 폼에서 뒤로가기 시 이 미리보기로 복원
    const next = new URLSearchParams(searchParams)
    next.set('quizlib', `${audienceKey}:${topicKey}`)
    setSearchParams(next, { replace: true })
    navigate(`/programs/${programId}/posts/quiz/new`, { state: { prefillTopic: topic } })
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="p-5">
        {/* ─── 1단계: 대상자 ─── */}
        {step === 'audience' && (
          <>
            <h2 className="text-lg font-bold text-gray-800 mb-3 pr-8">📚 퀴즈 템플릿</h2>
            <p className="text-[15px] font-semibold text-gray-700 mb-1">대상자를 선택하세요</p>
            <p className="text-xs text-gray-500 mb-4">출처 검증된 건강 상식 퀴즈를 제공합니다.</p>
            <div className="space-y-2">
              {QUIZ_AUDIENCES.map(a => (
                <div key={a.key} role="button" tabIndex={0}
                  onClick={() => setAudienceKey(a.key)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAudienceKey(a.key) } }}
                  className="w-full flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl hover:border-emerald-300 hover:bg-emerald-50/40 transition text-left cursor-pointer">
                  <span className="text-2xl">{a.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-gray-800">{a.label}</p>
                      <InfoTip side="top">{a.description.split(' · ').join('\n')}</InfoTip>
                    </div>
                    <p className="text-xs text-gray-400">주제 {a.topics.length}개</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                </div>
              ))}
            </div>
            <button type="button"
              onClick={() => { handleClose(); navigate(`/programs/${programId}/posts/quiz/new`) }}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-3 text-sm text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-xl transition">
              <FileText className="w-4 h-4" /> 빈 퀴즈 직접 만들기
            </button>
          </>
        )}

        {/* ─── 2단계: 주제 ─── */}
        {step === 'topic' && audience && (
          <>
            <button type="button" onClick={() => setAudienceKey(null)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
              <ChevronLeft className="w-4 h-4" /> 대상자
            </button>
            <h2 className="text-lg font-bold text-gray-800 mb-1 pr-8">{audience.emoji} {audience.label}</h2>
            <p className="text-xs text-gray-500 mb-4">주제를 선택하면 5문항을 미리 볼 수 있어요.</p>
            <div className="grid grid-cols-1 gap-2">
              {audience.topics.map(t => (
                <button key={t.key} type="button" onClick={() => setTopicKey(t.key)}
                  className="w-full flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-2xl hover:border-emerald-300 hover:bg-emerald-50/40 transition text-left">
                  <span className="text-xl">{t.emoji}</span>
                  <span className="flex-1 min-w-0 font-medium text-gray-800 truncate">{t.title}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">문항 {t.questions.length}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </>
        )}

        {/* ─── 3단계: 미리보기 ─── */}
        {step === 'preview' && topic && (
          <>
            <button type="button" onClick={() => setTopicKey(null)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
              <ChevronLeft className="w-4 h-4" /> 주제
            </button>
            <h2 className="text-lg font-bold text-gray-800 mb-1 pr-8">{topic.emoji} {topic.title} 퀴즈</h2>
            <p className="text-xs text-gray-500 mb-4">문항을 확인하고 「편집하기」로 점수·기간을 설정해 발행하세요.</p>
            <div className="space-y-2.5 mb-4">
              {topic.questions.map((q, i) => <QuestionPreview key={i} q={q} index={i} />)}
            </div>
            <button type="button" onClick={startEdit}
              className="w-full flex items-center justify-center gap-1.5 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-2xl transition">
              <Pencil className="w-4 h-4" /> 편집하기
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

// 문항 미리보기 (읽기전용) — 유형/문제/보기(정답 표시)/해설/출처
function QuestionPreview({ q, index }) {
  const typeLabel = q.type === 'MULTIPLE' ? '객관식' : q.type === 'OX' ? 'OX' : '주관식'
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-xs">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600">{typeLabel}</span>
        <span className="text-gray-400">Q{index + 1}</span>
      </div>
      <p className="text-gray-800 font-medium mb-1.5 leading-snug text-[13px]">{q.question_text}</p>

      {q.type === 'MULTIPLE' && (
        <ul className="space-y-0.5 mb-1.5">
          {q.options.map((opt, i) => (
            <li key={i} className={`flex items-center gap-1 ${i === q.correctIndex ? 'text-emerald-700 font-medium' : 'text-gray-600'}`}>
              {i === q.correctIndex ? <Check className="w-3 h-3 flex-shrink-0" /> : <span className="w-3 flex-shrink-0 inline-block" />}
              {opt}
            </li>
          ))}
        </ul>
      )}
      {q.type === 'OX' && <p className="mb-1.5 text-emerald-700 font-medium">정답: {q.oxAnswer}</p>}
      {q.type === 'SHORT' && <p className="mb-1.5 text-gray-500">주관식(수동채점) · 예시답안: {q.sampleAnswer}</p>}

      {q.explanation && <p className="text-gray-500 leading-snug">💡 {q.explanation}</p>}
      {q.source && (
        <a href={q.source.split(';')[0].trim()} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-emerald-600 hover:underline mt-0.5">
          <ExternalLink className="w-3 h-3" /> 출처
        </a>
      )}
    </div>
  )
}

export default QuizLibraryModal
