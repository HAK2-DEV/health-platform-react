import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, Bug } from 'lucide-react'
import Modal from '../common/Modal'
import { createInquiry } from '../../lib/queries'
import { collectDeviceInfo, formatDeviceInfo, summarizeDeviceInfo } from '../../lib/deviceInfo'

const TITLE_MAX = 100
const BODY_MIN = 15          // 「안 돼요」 한 줄로 끝나는 신고를 막는 최소선

// 빈도 — 키보드를 띄우지 않는 선택지로 둔다. 「한 번만」과 「항상」은 원인이 완전히 다르다.
const FREQUENCY = ['항상 그래요', '가끔 그래요', '한 번만 그랬어요']

// 본문에 넣어줄 뼈대. 빈 칸을 채우는 쪽이 백지보다 훨씬 잘 써진다.
//   ⚠️ 커서 싸움을 피하려고 «버튼을 눌렀을 때만» 넣는다. 처음부터 채워두면
//      모바일에서 지우고 쓰기가 번거롭다.
const TEMPLATE = `■ 어느 화면에서

■ 무엇을 하려다가

■ 다시 나타나게 하는 순서
 1)
 2)

■ 기대한 결과 / 실제 결과

■ 화면에 뜬 오류 문구(있으면 그대로)
 `

// 버그 신고 작성 — 제목 + 내용 하나. 기기·버전은 사람이 아니라 «코드가» 채운다.
//   설계 의도는 docs/BUG_LOG.md 의 「접수할 때 반드시 같이 묻는 것」과 짝을 이룬다.
function BugReportWriteModal({ isOpen, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [freq, setFreq] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [password, setPassword] = useState('')
  const [guideOpen, setGuideOpen] = useState(true)
  const [infoOpen, setInfoOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // 모달이 열린 시점의 환경을 잡는다(화면 크기·글자 배율은 지금 값이 의미 있다).
  const info = useMemo(() => (isOpen ? collectDeviceInfo() : null), [isOpen])

  useEffect(() => {
    if (isOpen) {
      setTitle(''); setBody(''); setFreq(''); setIsPrivate(false); setPassword('')
      setGuideOpen(true); setInfoOpen(false); setBusy(false); setError(null)
    }
  }, [isOpen])

  const insertTemplate = () => setBody(prev => (prev.trim() ? prev : TEMPLATE))

  const handleSubmit = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    if (body.trim().length < BODY_MIN) {
      setError('무엇을 하다가 생겼는지 조금만 더 적어주세요. 그래야 다시 재현해볼 수 있어요')
      return
    }
    if (isPrivate && !password.trim()) { setError('비공개 글은 비밀번호가 필요해요'); return }

    const composed = [
      body.trim(),
      freq ? `\n\n■ 얼마나 자주: ${freq}` : '',
      `\n\n────────── 자동으로 붙은 기기 정보 ──────────\n${formatDeviceInfo(info)}`,
    ].join('')

    setBusy(true); setError(null)
    try {
      const id = await createInquiry(title.trim(), composed, isPrivate, password, 'bug')
      onCreated?.(id)
      onClose()
    } catch (e) {
      setError(e?.message || '신고 등록에 실패했어요')
      setBusy(false)
    }
  }

  return (
    // fill — 스크롤 영역과 버튼을 «형제» 로 둔다. sticky 로 두면 구형 안드에서 시트가
    //   52vh 로 갇힐 때 버튼이 입력칸을 덮어 «누를 수조차» 없다(2026-09-17 노트9).
    //   [[components/program/MissionCreateModal]] [[components/common/Modal]]
    <Modal isOpen={isOpen} onClose={onClose} fill>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 pt-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
            <Bug className="w-4 h-4 text-rose-500" />
          </span>
          <h2 className="text-xl font-bold text-gray-800">버그 신고</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4 break-keep">
          이상한 점을 발견하셨나요? 아래 안내대로 적어주시면 훨씬 빨리 고칠 수 있어요.
        </p>

        {/* 잘 쓰는 법 — 기본 펼침. 이 한 칸이 신고의 질을 좌우한다. */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden mb-4">
          <button
            type="button" onClick={() => setGuideOpen(v => !v)}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left"
            aria-expanded={guideOpen}
          >
            <span className="text-[13px] font-bold text-amber-900 flex-1 break-keep">
              이렇게 적어주시면 바로 고칠 수 있어요
            </span>
            <ChevronDown className={`w-4 h-4 text-amber-600 flex-shrink-0 transition-transform ${guideOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className={`grid transition-all duration-200 ${guideOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <ul className="px-3.5 pb-3 space-y-1.5 text-[12.5px] text-amber-900/90 leading-relaxed break-keep">
                <li>· <b>어느 화면</b>에서 생겼는지 (예: 기록하기 → 사진 첨부)</li>
                <li>· <b>무엇을 누르다가</b> 생겼는지, 눌렀던 순서 그대로</li>
                <li>· <b>기대한 것과 실제로 벌어진 것</b> (예: 저장될 줄 알았는데 창이 닫혔어요)</li>
                <li>· <b>오류 문구</b>가 떴다면 대괄호 안 코드까지 그대로</li>
                <li>· 기기·안드로이드 버전·앱 버전은 <b>자동으로 붙으니</b> 안 적으셔도 돼요</li>
              </ul>
            </div>
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1.5">제목</label>
        <input
          type="text" value={title} onChange={e => setTitle(e.target.value)}
          maxLength={TITLE_MAX} disabled={busy}
          placeholder="예) 사진을 고르고 오면 쓰던 글이 사라져요"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-rose-400 disabled:bg-gray-50"
        />

        <div className="flex items-center justify-between mt-4 mb-1.5">
          <label className="block text-sm font-medium text-gray-700">내용</label>
          <button
            type="button" onClick={insertTemplate} disabled={busy || !!body.trim()}
            className="text-[12px] font-bold text-rose-500 hover:text-rose-600 disabled:text-gray-300 transition"
          >
            양식 넣기
          </button>
        </div>
        <textarea
          value={body} onChange={e => setBody(e.target.value)} disabled={busy} rows={7}
          placeholder={'예)\n글쓰기에서 사진 첨부를 눌러 갤러리에서 사진을 고르고 돌아왔더니,\n쓰고 있던 글이 전부 지워져 있었어요.\n\n1) 커뮤니티 → 글쓰기\n2) 제목·내용 입력\n3) 사진 첨부 → 갤러리에서 1장 선택\n4) 앱으로 돌아오면 내용이 비어 있음\n\n항상 그런 건 아니고 사진을 오래 고를 때 그래요.'}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-rose-400 disabled:bg-gray-50 resize-none text-[14px] leading-relaxed"
        />

        {/* 빈도 — 키보드 없이 한 번 탭. */}
        <p className="text-sm font-medium text-gray-700 mt-4 mb-1.5">얼마나 자주 생기나요?</p>
        <div className="grid grid-cols-3 gap-2">
          {FREQUENCY.map(f => {
            const on = freq === f
            return (
              <button
                key={f} type="button" disabled={busy}
                onClick={() => setFreq(on ? '' : f)}
                className={`py-2.5 px-1 rounded-xl border-2 text-[12.5px] font-bold break-keep transition disabled:opacity-50 ${
                  on ? 'border-rose-400 bg-rose-50 text-rose-600' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                {f}
              </button>
            )
          })}
        </div>

        {/* 자동 수집 정보 — 숨기지 않는다. 무엇이 함께 가는지 보고 보내게 한다. */}
        {info && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
            <button
              type="button" onClick={() => setInfoOpen(v => !v)}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left"
              aria-expanded={infoOpen}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-bold text-gray-700">함께 보내는 기기 정보</p>
                <p className="text-[11px] text-gray-400 truncate mt-0.5">{summarizeDeviceInfo(info)}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${infoOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`grid transition-all duration-200 ${infoOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="overflow-hidden">
                <pre className="px-3.5 pb-3 text-[11px] text-gray-500 leading-relaxed whitespace-pre-wrap break-all font-mono">
                  {formatDeviceInfo(info)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* 비공개 토글 — 기본은 공개. 같은 증상을 본 테스터가 「나도요」 할 수 있어야 한다. */}
        <button
          type="button" onClick={() => setIsPrivate(v => !v)} disabled={busy}
          className={`w-full mt-3 p-3 rounded-xl border-2 text-left transition disabled:opacity-50 ${isPrivate ? 'border-rose-400 bg-rose-50' : 'border-gray-200 bg-white'}`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🔒</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${isPrivate ? 'text-rose-700' : 'text-gray-800'}`}>비공개로 신고</p>
              <p className="text-xs text-gray-500 mt-0.5 break-keep">관리자와 나만 볼 수 있어요. 공개로 두면 다른 분이 같은 증상을 보탤 수 있어요.</p>
            </div>
            <div className={`relative w-9 h-5 rounded-full flex-shrink-0 transition ${isPrivate ? 'bg-rose-400' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPrivate ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </div>
        </button>

        {isPrivate && (
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            disabled={busy} placeholder="열람용 비밀번호"
            className="w-full mt-2 px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-rose-400 disabled:bg-gray-50"
          />
        )}

        {error && (
          <p className="mt-4 p-2.5 bg-red-50 text-red-600 rounded-lg text-sm text-center break-keep">{error}</p>
        )}
      </div>

      {/* 취소·신고 — 스크롤 영역의 형제라 콘텐츠를 덮지 않는다. */}
      <div className="flex-shrink-0 px-6 pt-2.5 pb-3 bg-white border-t border-gray-100 flex gap-2">
        <button
          type="button" onClick={onClose} disabled={busy}
          className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button" onClick={handleSubmit} disabled={busy}
          className="flex-[2] px-4 py-3 bg-gradient-to-r from-rose-400 to-orange-400 hover:from-rose-500 hover:to-orange-500 text-white font-bold rounded-xl transition disabled:opacity-50"
        >
          {busy ? '보내는 중...' : '버그 신고하기'}
        </button>
      </div>
    </Modal>
  )
}

export default BugReportWriteModal
