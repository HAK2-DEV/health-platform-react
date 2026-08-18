import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Lock, Check, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'
import { supabase } from '../../supabaseClient'
import { queryKeys, fetchQuizForEdit } from '../../lib/queries'
import LoadingState from '../../components/common/LoadingState'

// 퀴즈 생성 페이지 — 운영자 전용
// 라우트: /programs/:id/posts/quiz/new
//   제목/설명/기한/정답공개 + 문제 동적 추가 (객관식/서술형/OX)
//   문제별 점수 + award_mode(맞추면/틀려도) + grading_mode(서술형 자동/수동)
//   저장: quizzes INSERT → quiz_questions bulk INSERT

const QUESTION_TYPES = [
  { value: 'MULTIPLE', label: '객관식', emoji: '🔢' },
  { value: 'OX', label: 'OX', emoji: '⭕' },
  { value: 'SHORT', label: '서술형', emoji: '✍️' },
]

// 새 문제 기본값
const newQuestion = (type = 'MULTIPLE') => ({
  type,
  question_text: '',
  point: 10,
  award_mode: 'CORRECT_ONLY',
  grading_mode: 'AUTO',
  options: ['', ''],
  correctIndex: 0,
  oxAnswer: 'O',
  shortAnswer: '',
  explanation: '',  // 해설 (객관식/OX) — 정답 공개 ON 시 참가자에게 노출. 서술형은 미사용
  source: '',       // 출처 URL (선택) — 정답 공개 시 해설 옆에 링크로 노출 (마이그 202)
  included: true,   // 발행 포함 여부 (문항 앞 체크박스). 라이브러리 prefill 시 확인용
})

// 객관식 보기 셔플 (정답이 항상 보기1인 패턴 방지) — 라이브러리 prefill 용
const shuffleLibOptions = (options, correctIndex) => {
  const arr = options.map((text, i) => ({ text, isAnswer: i === correctIndex }))
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return { options: arr.map(o => o.text), correctIndex: arr.findIndex(o => o.isAnswer) }
}

// 라이브러리 문항 → QuizCreatePage 내부 문항 형태 (해설·출처 이월, 예시답안은 발행본에 미포함)
const mapLibQuestion = (q) => {
  const base = newQuestion(q.type)
  if (q.type === 'MULTIPLE') {
    const s = shuffleLibOptions(q.options, q.correctIndex ?? 0)
    return { ...base, question_text: q.question_text, point: q.point ?? 10, options: s.options, correctIndex: s.correctIndex, award_mode: q.award_mode || 'CORRECT_ONLY', explanation: q.explanation || '', source: q.source || '' }
  }
  if (q.type === 'OX') {
    return { ...base, question_text: q.question_text, point: q.point ?? 10, oxAnswer: q.oxAnswer || 'O', award_mode: q.award_mode || 'CORRECT_ONLY', explanation: q.explanation || '', source: q.source || '' }
  }
  // SHORT — 해설 미사용
  return { ...base, question_text: q.question_text, point: q.point ?? 10, grading_mode: q.grading_mode || 'MANUAL', shortAnswer: q.shortAnswer || '', award_mode: q.award_mode || 'CORRECT_ONLY' }
}

// ISO → datetime-local 입력값(YYYY-MM-DDTHH:mm, 로컬 기준)
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// DB quiz_questions 행 → QuizCreatePage 내부 문항 형태 (편집 prefill)
const mapDbQuestion = (q) => {
  const base = newQuestion(q.type)
  const common = {
    ...base,
    question_text: q.question_text || '',
    point: q.point ?? 10,
    award_mode: q.award_mode || 'CORRECT_ONLY',
    explanation: q.explanation || '',
    source: q.source || '',
    included: true,
  }
  if (q.type === 'MULTIPLE') {
    return { ...common, options: Array.isArray(q.options) && q.options.length ? q.options : ['', ''], correctIndex: Number(q.correct_answer) || 0 }
  }
  if (q.type === 'OX') {
    return { ...common, oxAnswer: q.correct_answer === 'X' ? 'X' : 'O' }
  }
  return { ...common, grading_mode: q.grading_mode || 'MANUAL', shortAnswer: q.correct_answer || '' }
}

function QuizCreatePage() {
  const { id, quizId } = useParams()
  const isEdit = !!quizId
  const navigate = useNavigate()
  const kbInset = useKeyboardInset()   // iOS 키보드 높이 — 해설 등 입력 시 카드/푸터가 안 가리게
  const location = useLocation()
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  // 편집 모드 — 기존 퀴즈 + 문항(정답 포함) 로드 → prefill. 제출이 있으면 문항 잠금.
  const { data: editData, isLoading: editLoading } = useQuery({
    queryKey: queryKeys.quizEdit(quizId),
    queryFn: () => fetchQuizForEdit(quizId),
    enabled: isEdit,
  })
  const submissionCount = editData?.submissionCount || 0
  const questionsLocked = isEdit && submissionCount > 0

  // 퀴즈 라이브러리에서 「편집해서 만들기」로 넘어온 경우 — 제목·문항 prefill
  const prefillTopic = location.state?.prefillTopic || null

  const [title, setTitle] = useState(prefillTopic ? `${prefillTopic.title} 퀴즈` : '')
  const [description, setDescription] = useState(prefillTopic ? `${prefillTopic.title} 건강 상식 퀴즈` : '')
  const [startAt, setStartAt] = useState('')
  const [dueAt, setDueAt] = useState('')
  const dueAtRef = useRef(null)
  const contentRef = useRef(null)   // 단계 콘텐츠 스크롤 영역 (문제 추가·이동 시 맨 위로)

  // 시작일 선택 직후 종료일 picker 자동 오픈 (Chrome/Edge/Firefox 모두 showPicker 지원)
  //   onChange 는 user gesture 컨텍스트라 showPicker 호출 허용.
  const handleStartChange = (e) => {
    const v = e.target.value
    setStartAt(v)
    if (!v) return
    requestAnimationFrame(() => {
      try {
        dueAtRef.current?.showPicker?.()
      } catch {
        // 브라우저 미지원 → 사용자가 직접 클릭
      }
    })
  }

  // 종료일 선택 직후 picker 닫고 살짝 스크롤 — 다음 입력(정답 공개/문제)로 시선 유도
  const handleDueChange = (e) => {
    setDueAt(e.target.value)
    if (!e.target.value) return
    requestAnimationFrame(() => {
      try { dueAtRef.current?.blur?.() } catch {}
      window.scrollBy({ top: 400, behavior: 'smooth' })
    })
  }
  const [revealMode, setRevealMode] = useState('AFTER_CLOSE')  // IMMEDIATE | AFTER_CLOSE | NEVER
  const [questions, setQuestions] = useState(
    prefillTopic ? prefillTopic.questions.map(mapLibQuestion) : [newQuestion()]
  )
  const [error, setError] = useState(null)
  // 3단계 마법사 — 1.기본 2.문제(1개씩) 3.발행
  const [step, setStep] = useState(1)
  const [qIndex, setQIndex] = useState(0)
  const STEP_LABELS = ['기본', '문제', '발행']
  const backPath = `/programs/${id}?tab=quizzes&panel=quiz`
  // 나가기 — 히스토리 있으면 뒤로(중복 엔트리 안 쌓임), 딥링크 진입이면 매니저로 replace.
  //   (push 로 매니저 URL 을 또 쌓으면 뒤로가기가 만들기로 돌아오는 무한 루프 발생)
  const exitToManager = () => {
    if (location.key !== 'default') navigate(-1)
    else navigate(backPath, { replace: true })
  }

  // 단계/문제 전환 시 콘텐츠를 맨 위로 (문제 추가하면 새 문제가 위에서 보이게)
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [step, qIndex])

  // 편집 데이터 도착 시 1회 prefill
  const prefilledRef = useRef(false)
  useEffect(() => {
    if (!editData?.quiz || prefilledRef.current) return
    prefilledRef.current = true
    const q = editData.quiz
    setTitle(q.title || '')
    setDescription(q.description || '')
    setStartAt(toLocalInput(q.start_at))
    setDueAt(toLocalInput(q.due_at))
    setRevealMode(q.reveal_mode || (q.reveal_answers ? 'IMMEDIATE' : 'AFTER_CLOSE'))
    setQuestions((editData.questions || []).map(mapDbQuestion))
  }, [editData])

  // ─── 문제 조작 ───────────────────────────────────────
  const updateQuestion = (idx, patch) => {
    setQuestions(qs => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)))
  }
  const addQuestion = () => setQuestions(qs => [...qs, newQuestion()])
  const removeQuestion = (idx) => setQuestions(qs => qs.filter((_, i) => i !== idx))

  const updateOption = (qIdx, oIdx, value) => {
    setQuestions(qs => qs.map((q, i) => {
      if (i !== qIdx) return q
      const options = q.options.map((o, j) => (j === oIdx ? value : o))
      return { ...q, options }
    }))
  }
  const addOption = (qIdx) => {
    setQuestions(qs => qs.map((q, i) => (i === qIdx ? { ...q, options: [...q.options, ''] } : q)))
  }
  const removeOption = (qIdx, oIdx) => {
    setQuestions(qs => qs.map((q, i) => {
      if (i !== qIdx) return q
      const options = q.options.filter((_, j) => j !== oIdx)
      // 정답 인덱스 보정
      let correctIndex = q.correctIndex
      if (oIdx === correctIndex) correctIndex = 0
      else if (oIdx < correctIndex) correctIndex -= 1
      return { ...q, options, correctIndex }
    }))
  }

  // ─── 검증 + 저장 ─────────────────────────────────────
  const validate = () => {
    if (!title.trim()) return '퀴즈 제목을 입력해주세요'
    if (startAt && dueAt && new Date(startAt) >= new Date(dueAt)) {
      return '종료일은 시작일 이후여야 해요'
    }
    // 제출이 있는 퀴즈(문항 잠금)는 메타데이터만 수정 — 문항 검증 생략
    if (questionsLocked) return null
    // 체크(포함)된 문항만 검증·발행
    const picked = questions.filter(q => q.included)
    if (picked.length === 0) return '발행할 문항을 1개 이상 체크해주세요'
    for (let i = 0; i < picked.length; i++) {
      const q = picked[i]
      const n = i + 1
      if (!q.question_text.trim()) return `${n}번 문제 내용을 입력해주세요`
      if (q.point < 0) return `${n}번 문제 점수는 0 이상이어야 해요`
      if (q.type === 'MULTIPLE') {
        const filled = q.options.filter(o => o.trim())
        if (filled.length < 2) return `${n}번 문제는 보기를 2개 이상 입력해주세요`
        if (!q.options[q.correctIndex]?.trim()) return `${n}번 문제의 정답 보기를 선택해주세요`
      }
      if (q.type === 'SHORT' && q.grading_mode === 'AUTO' && !q.shortAnswer.trim()) {
        return `${n}번 서술형(자동 채점)은 정답을 입력해주세요`
      }
    }
    return null
  }

  const computeCorrectAnswer = (q) => {
    if (q.type === 'MULTIPLE') return String(q.correctIndex)
    if (q.type === 'OX') return q.oxAnswer
    if (q.type === 'SHORT') return q.grading_mode === 'AUTO' ? q.shortAnswer.trim() : null
    return null
  }

  // 내부 문항 → quiz_questions 행
  const toQuestionRow = (quiz_id) => (q, idx) => ({
    quiz_id,
    type: q.type,
    question_text: q.question_text.trim(),
    options: q.type === 'MULTIPLE' ? q.options.filter(o => o.trim()) : null,
    correct_answer: computeCorrectAnswer(q),
    point: Number(q.point) || 0,
    award_mode: q.award_mode,
    grading_mode: q.type === 'SHORT' ? q.grading_mode : 'AUTO',
    // 해설 — 객관식/OX 만. 정답 공개 ON 시 참가자 결과 화면에 노출
    explanation: q.type !== 'SHORT' && q.explanation?.trim() ? q.explanation.trim() : null,
    // 출처 URL — 정답 공개 시 해설 옆 링크로 노출 (마이그 202)
    source: q.type !== 'SHORT' && q.source?.trim() ? q.source.trim() : null,
    order_index: idx,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        // ── 편집 저장 ──
        // 1) 메타데이터 UPDATE
        const { error: upErr } = await supabase
          .from('quizzes')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            start_at: startAt ? new Date(startAt).toISOString() : null,
            due_at: dueAt ? new Date(dueAt).toISOString() : null,
            reveal_mode: revealMode,
            reveal_answers: revealMode === 'IMMEDIATE',   // 레거시 동기화
          })
          .eq('id', quizId)
        if (upErr) throw upErr

        // 2) 문항 — 제출이 없을 때만 통째로 교체(삭제 후 재삽입). 제출 있으면 잠금(건드리지 않음).
        if (!questionsLocked) {
          const { error: delErr } = await supabase.from('quiz_questions').delete().eq('quiz_id', quizId)
          if (delErr) throw delErr
          const rows = questions.filter(q => q.included).map(toQuestionRow(quizId))
          const { error: insErr } = await supabase.from('quiz_questions').insert(rows)
          if (insErr) throw insErr
        }
        return { id: quizId }
      }

      // ── 신규 생성 ──
      // 1) quizzes INSERT
      const { data: quiz, error: qErr } = await supabase
        .from('quizzes')
        .insert({
          program_id: id,
          title: title.trim(),
          description: description.trim() || null,
          start_at: startAt ? new Date(startAt).toISOString() : null,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          reveal_mode: revealMode,
          reveal_answers: revealMode === 'IMMEDIATE',   // 레거시 동기화
          created_by: userId,
        })
        .select()
        .single()
      if (qErr) throw qErr

      // 2) quiz_questions bulk INSERT
      const rows = questions.filter(q => q.included).map(toQuestionRow(quiz.id))
      const { error: qqErr } = await supabase.from('quiz_questions').insert(rows)
      if (qqErr) {
        // 롤백 — 문제 INSERT 실패 시 quiz 제거 (orphan 방지)
        await supabase.from('quizzes').delete().eq('id', quiz.id)
        throw qqErr
      }
      return quiz
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programQuizzes(id) })
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: queryKeys.quizEdit(quizId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.programQuizStats(id) })
        exitToManager()   // 수정 저장 — 퀴즈 관리자로 복귀
      } else {
        // 신규 발행 — 관리 패널(다시 편집 모달) 이 아니라 퀴즈 화면(목록) 으로 나가기
        navigate(`/programs/${id}?tab=quizzes`, { replace: true })
      }
    },
    onError: (err) => {
      console.error('퀴즈 저장 실패:', err)
      setError(err.message || '퀴즈 저장에 실패했어요')
    },
  })

  const handleSubmit = () => {
    const v = validate()
    if (v) { setError(v); return }
    setError(null)
    createMutation.mutate()
  }

  // ─── 마법사 단계 검증·이동 ─────────────────────────────
  const validateBasic = () => {
    if (!title.trim()) return '퀴즈 제목을 입력해주세요'
    if (startAt && dueAt && new Date(startAt) >= new Date(dueAt)) return '종료일은 시작일 이후여야 해요'
    return null
  }
  const validateOneQuestion = (q, n) => {
    if (!q || !q.included) return null
    if (!q.question_text.trim()) return `${n}번 문제 내용을 입력해주세요`
    if (q.point < 0) return `${n}번 문제 점수는 0 이상이어야 해요`
    if (q.type === 'MULTIPLE') {
      const filled = q.options.filter(o => o.trim())
      if (filled.length < 2) return `${n}번 문제는 보기를 2개 이상 입력해주세요`
      if (!q.options[q.correctIndex]?.trim()) return `${n}번 문제의 정답 보기를 선택해주세요`
    }
    if (q.type === 'SHORT' && q.grading_mode === 'AUTO' && !q.shortAnswer.trim()) return `${n}번 서술형(자동 채점)은 정답을 입력해주세요`
    return null
  }
  const goNext = () => {
    setError(null)
    if (step === 1) {
      const v = validateBasic(); if (v) { setError(v); return }
      setStep(2); setQIndex(0); return
    }
    if (step === 2) {
      if (!questionsLocked) {
        const v = validateOneQuestion(questions[qIndex], qIndex + 1); if (v) { setError(v); return }
      }
      if (qIndex < questions.length - 1) { setQIndex(i => i + 1); return }
      if (!questionsLocked && questions.filter(q => q.included).length === 0) { setError('발행할 문항을 1개 이상 체크해주세요'); return }
      setStep(3); return
    }
  }
  const goPrev = () => {
    setError(null)
    if (step === 3) { setStep(2); setQIndex(Math.max(0, questions.length - 1)); return }
    if (step === 2) { if (qIndex > 0) { setQIndex(i => i - 1) } else { setStep(1) }; return }
    exitToManager()   // step 1 취소
  }
  const addQuestionAndGo = () => { setQuestions(qs => [...qs, newQuestion()]); setQIndex(questions.length); setError(null) }
  const removeQuestionAt = (idx) => {
    setQuestions(qs => qs.filter((_, i) => i !== idx))
    setQIndex(i => Math.max(0, Math.min(i, questions.length - 2)))
  }

  const includedQuestions = questions.filter(q => q.included)
  const totalPoint = includedQuestions.reduce((s, q) => s + (Number(q.point) || 0), 0)

  // 편집 데이터 로딩 중
  if (isEdit && editLoading) return <LoadingState variant="page" />

  const LockedNotice = () => questionsLocked ? (
    <div className="flex items-start gap-2 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-700 leading-relaxed">
      <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>이미 {submissionCount}명이 제출해 <b>문항은 수정할 수 없어요</b>(응답·점수 보존). 제목·설명·기한·정답 공개만 변경돼요.</span>
    </div>
  ) : null

  return (
    <div className="min-h-screen flex items-start justify-center px-2 py-4 sm:p-4 bg-gray-50">
      <div className="w-full max-w-2xl my-2 sm:my-4 bg-white rounded-2xl shadow-xl p-4 sm:p-6 flex flex-col" style={{ maxHeight: `calc(90dvh - ${kbInset}px)`, transition: 'max-height .2s ease' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className="text-lg font-bold text-gray-800 flex-shrink-0">{isEdit ? '✏️ 퀴즈 수정' : '📝 퀴즈 만들기'}</h1>
            <span className="text-xs text-gray-400 truncate">발행 {includedQuestions.length}개 · {totalPoint}점</span>
          </div>
          <button type="button" onClick={exitToManager} className="p-1.5 -mr-1.5 text-gray-400 hover:text-gray-700" title="닫기"><X className="w-5 h-5" /></button>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {STEP_LABELS.map((_, i) => {
            const n = i + 1
            return (
              <span
                key={n}
                className={`h-1.5 rounded-full transition-all ${step === n ? 'w-5 bg-emerald-500' : 'w-1.5 bg-gray-200'}`}
              />
            )
          })}
        </div>

        {/* 단계 콘텐츠 (필요 시 카드 내부 스크롤) */}
        <div ref={contentRef} className="flex-1 overflow-y-auto -mx-1 px-1">
          {/* 1단계 — 기본 정보 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">제목 <span className="text-emerald-600">(필수)</span></label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 1주차 건강 상식 퀴즈" maxLength={60}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">설명 <span className="font-normal text-gray-400">(선택)</span></label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="퀴즈 안내 문구"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">풀이 기한 <span className="font-normal text-gray-400">(선택)</span></label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0 whitespace-nowrap"><Calendar className="w-3 h-3" /> 시작</p>
                    <input type="datetime-local" value={startAt} onChange={handleStartChange}
                      className="min-w-0 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500" />
                    {startAt && <button type="button" onClick={() => setStartAt('')} className="text-[11px] text-gray-400 hover:text-red-500 transition flex-shrink-0">지우기</button>}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0 whitespace-nowrap"><Calendar className="w-3 h-3" /> 종료</p>
                    <input ref={dueAtRef} type="datetime-local" value={dueAt} onChange={handleDueChange} min={startAt || undefined}
                      className="min-w-0 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500" />
                    {dueAt && <button type="button" onClick={() => setDueAt('')} className="text-[11px] text-gray-400 hover:text-red-500 transition flex-shrink-0">지우기</button>}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">시작 비우면 즉시 시작 / 종료 비우면 무기한</p>
              </div>
              <div>
                <p className="text-sm text-gray-700 mb-1.5">참가자에게 정답 공개</p>
                <div className="flex gap-1.5">
                  {[
                    { v: 'IMMEDIATE', label: '즉시 공개' },
                    { v: 'AFTER_CLOSE', label: '마감 후 공개' },
                    { v: 'NEVER', label: '비공개' },
                  ].map(m => (
                    <button key={m.v} type="button" onClick={() => setRevealMode(m.v)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border-2 transition
                        ${revealMode === m.v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  {revealMode === 'IMMEDIATE' ? '제출 직후 본인이 정답·해설을 봐요.'
                    : revealMode === 'AFTER_CLOSE' ? '마감(종료일) 후, 응시한 본인이 자기 답·정답을 복습해요(전체 공개 아님).'
                    : '참가자에겐 정답·해설을 공개하지 않아요(운영자만 확인).'}
                </p>
              </div>
            </div>
          )}

          {/* 2단계 — 문제 (한 문제씩) */}
          {step === 2 && (
            <div>
              <LockedNotice />
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-700">문제 {qIndex + 1} / {questions.length}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setQIndex(i => Math.max(0, i - 1))} disabled={qIndex === 0}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent" title="이전 문제"><ChevronLeft className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setQIndex(i => Math.min(questions.length - 1, i + 1))} disabled={qIndex === questions.length - 1}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent" title="다음 문제"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
              <fieldset disabled={questionsLocked} className={`min-w-0 ${questionsLocked ? 'opacity-60' : ''}`}>
                <QuestionEditor
                  key={qIndex}
                  index={qIndex}
                  question={questions[qIndex]}
                  canRemove={questions.length > 1}
                  onChange={(patch) => updateQuestion(qIndex, patch)}
                  onRemove={() => removeQuestionAt(qIndex)}
                  onUpdateOption={(oIdx, val) => updateOption(qIndex, oIdx, val)}
                  onAddOption={() => addOption(qIndex)}
                  onRemoveOption={(oIdx) => removeOption(qIndex, oIdx)}
                />
                {!questionsLocked && (
                  <button type="button" onClick={addQuestionAndGo}
                    className="w-full mt-3 flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/50 text-gray-600 hover:text-emerald-700 rounded-2xl transition">
                    <Plus className="w-4 h-4" /> 문제 추가
                  </button>
                )}
              </fieldset>
            </div>
          )}

          {/* 3단계 — 발행 요약 */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">아래 내용으로 {isEdit ? '저장' : '발행'}할게요. 잘못된 게 있으면 「이전」으로 돌아가 고쳐요.</p>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-gray-500 flex-shrink-0">제목</span><span className="font-medium text-gray-800 truncate">{title || '(없음)'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">발행 문항</span><span className="font-medium text-gray-800">{includedQuestions.length}개</span></div>
                <div className="flex justify-between"><span className="text-gray-500">총점</span><span className="font-bold text-emerald-600">{totalPoint}점</span></div>
                <div className="flex justify-between"><span className="text-gray-500">기한</span><span className="font-medium text-gray-800">{startAt || dueAt ? `${startAt ? '시작 지정' : '즉시'} ~ ${dueAt ? '종료 지정' : '무기한'}` : '제한 없음'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">정답 공개</span><span className="font-medium text-gray-800">{revealMode === 'IMMEDIATE' ? '즉시 공개' : revealMode === 'AFTER_CLOSE' ? '마감 후 공개' : '비공개'}</span></div>
              </div>
              <LockedNotice />
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 p-2 bg-red-100 text-red-700 rounded-xl text-sm text-center">{error}</p>
        )}

        {/* 푸터 — 이전 / 다음 / 발행 */}
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={goPrev} disabled={createMutation.isPending}
            className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50">
            {step === 1 ? '취소' : '이전'}
          </button>
          {step < 3 ? (
            <button type="button" onClick={goNext}
              className="flex-[1.6] h-11 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-bold transition">
              {step === 2 && qIndex < questions.length - 1 ? '다음 문제' : '다음'}
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={createMutation.isPending}
              className="flex-[1.6] h-11 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-bold transition disabled:bg-gray-400">
              {createMutation.isPending ? '저장 중...' : isEdit ? '수정 저장' : '퀴즈 발행'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 문제 편집 카드 ─────────────────────────────────────
function QuestionEditor({ index, question: q, canRemove, onChange, onRemove, onUpdateOption, onAddOption, onRemoveOption }) {
  const included = q.included !== false
  const [showExpl, setShowExpl] = useState(!!q.explanation || !!q.source)   // 해설/출처 있으면 펼침, 없으면 「+ 해설 추가」로 접기
  const [explJustOpened, setExplJustOpened] = useState(false)   // 「+ 해설 추가」로 직접 열 때만 자동 포커스(템플릿에서 처음부터 펼쳐진 건 포커스 X → 키보드 안 튐)
  return (
    <div className={`rounded-2xl border-2 p-4 space-y-2.5 transition ${included ? 'border-emerald-400 bg-emerald-50/40' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
      {/* 헤더 — 발행 포함 토글 + 삭제 (문제 번호는 바깥 "문제 N/N" 에 있음) */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 cursor-pointer">
          {/* 발행 포함 체크박스 — 해제하면 이 문항은 발행에서 제외 */}
          <input
            type="checkbox"
            checked={included}
            onChange={(e) => onChange({ included: e.target.checked })}
            className="w-4 h-4 accent-emerald-500"
            title="발행에 포함"
          />
          발행 포함
        </label>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-500 transition"
            title="문제 삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 유형 선택 */}
      <div className="flex gap-1.5">
        {QUESTION_TYPES.map(t => {
          const active = q.type === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ type: t.value })}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border-2 transition
                ${active ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              {t.emoji} {t.label}
            </button>
          )
        })}
      </div>

      {/* 문제 내용 — 내용 많으면 아래로 자동 확장 */}
      <textarea
        ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 320) + 'px' } }}
        value={q.question_text}
        onChange={(e) => { onChange({ question_text: e.target.value }); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 320) + 'px' }}
        rows={2}
        placeholder="문제를 입력해주세요"
        className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 resize-none overflow-hidden text-sm"
      />

      {/* 유형별 정답 입력 */}
      {q.type === 'MULTIPLE' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">보기 · <span className="text-emerald-600 font-semibold">정답을 체크해주세요</span></p>
          {q.options.map((opt, oIdx) => (
            <div key={oIdx} className="flex items-start gap-2 min-w-0">
              <button
                type="button"
                onClick={() => onChange({ correctIndex: oIdx })}
                title="정답으로 지정"
                className={`w-6 h-6 mt-1 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition ${
                  q.correctIndex === oIdx
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-white border-gray-300 text-transparent hover:border-emerald-400'
                }`}
              >
                <Check className="w-4 h-4" strokeWidth={3} />
              </button>
              <textarea
                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px' } }}
                value={opt}
                onChange={(e) => { onUpdateOption(oIdx, e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px' }}
                rows={1}
                placeholder={`보기 ${oIdx + 1}`}
                className="flex-1 min-w-0 px-3 py-1.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 resize-none overflow-hidden text-sm"
              />
              {q.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => onRemoveOption(oIdx)}
                  className="p-1 mt-1 text-gray-400 hover:text-red-500 transition flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={onAddOption}
            className="text-xs text-emerald-600 hover:text-emerald-700"
          >
            + 보기 추가
          </button>
        </div>
      )}

      {q.type === 'OX' && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">정답 선택</p>
          <div className="flex gap-2">
          {['O', 'X'].map(v => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ oxAnswer: v })}
              className={`flex-1 py-2 text-lg font-bold rounded-lg border-2 transition
                ${q.oxAnswer === v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
            >
              {v === 'O' ? '⭕ O' : '❌ X'}
            </button>
          ))}
          </div>
        </div>
      )}

      {q.type === 'SHORT' && (
        <div className="space-y-2">
          {/* 채점 방식 */}
          <div className="flex gap-1.5">
            {[
              { v: 'AUTO', label: '정답 일치 자동 채점' },
              { v: 'MANUAL', label: '운영자 수동 채점' },
            ].map(m => (
              <button
                key={m.v}
                type="button"
                onClick={() => onChange({ grading_mode: m.v })}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border-2 transition
                  ${q.grading_mode === m.v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {q.grading_mode === 'AUTO' && (
            <input
              type="text"
              value={q.shortAnswer}
              onChange={(e) => onChange({ shortAnswer: e.target.value })}
              placeholder="정답 (정확히 일치해야 정답 처리)"
              className="w-full px-3 py-1.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 text-sm"
            />
          )}
          {q.grading_mode === 'MANUAL' && (q.award_mode || 'CORRECT_ONLY') === 'CORRECT_ONLY' && (
            <p className="flex items-start gap-1.5 px-0.5 text-[11px] leading-snug text-amber-700 break-keep">
              <span className="flex-shrink-0">💡</span>
              <span>이 조합은 <b>매 제출마다 직접 채점</b>해야 점수·랭킹에 반영돼요. 방치하면 제출이 「채점 대기」로 멈춰요.</span>
            </p>
          )}
        </div>
      )}

      {/* 해설 — 객관식/OX 만. 정답 공개 ON 시 참가자가 제출 후 정답과 함께 봄 (서술형 제외).
          기본 접힘 — 내용 있으면 펼침, 없으면 「+ 해설 추가」로 공간 절약 */}
      {q.type !== 'SHORT' && (
        showExpl ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">💡 해설 (선택)</label>
              {!q.explanation && (
                <button type="button" onClick={() => setShowExpl(false)}
                  className="text-[11px] text-gray-400 hover:text-gray-600">접기</button>
              )}
            </div>
            <textarea
              ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 320) + 'px' } }}
              value={q.explanation || ''}
              onChange={(e) => { onChange({ explanation: e.target.value }); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 320) + 'px' }}
              rows={2}
              autoFocus={explJustOpened}
              placeholder="정답에 대한 해설 (정답 공개 시 참가자에게 노출돼요)"
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 resize-none overflow-hidden text-sm"
            />
            <input
              type="url"
              value={q.source || ''}
              onChange={(e) => onChange({ source: e.target.value })}
              placeholder="🔗 출처 링크 (선택 · https://…) — 해설 옆에 표시돼 신뢰도를 높여요"
              className="w-full mt-1.5 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>
        ) : (
          <button type="button" onClick={() => { setShowExpl(true); setExplJustOpened(true) }}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700">
            <Plus className="w-3.5 h-3.5" /> 💡 해설 추가 <span className="font-normal text-gray-400">(선택)</span>
          </button>
        )
      )}

      {/* 점수 + award_mode */}
      <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">점수</label>
          <input
            type="number"
            min={0}
            value={q.point}
            onChange={(e) => onChange({ point: e.target.value })}
            className="w-16 px-2 py-1 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 text-sm text-center"
          />
        </div>
        <div className="flex gap-1.5 flex-1">
          {[
            { v: 'CORRECT_ONLY', label: '맞추면' },
            { v: 'ALWAYS', label: '틀려도' },
          ].map(a => (
            <button
              key={a.v}
              type="button"
              onClick={() => onChange({ award_mode: a.v })}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border-2 transition
                ${q.award_mode === a.v ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              {a.label} 지급
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default QuizCreatePage
