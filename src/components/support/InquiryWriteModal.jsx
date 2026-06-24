import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { createInquiry } from '../../lib/queries'

const TITLE_MAX = 100

// 문의 작성 모달 — 제목/내용 + 비공개(비밀번호) 옵션.
function InquiryWriteModal({ isOpen, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setTitle(''); setBody(''); setIsPrivate(false); setPassword(''); setBusy(false); setError(null)
    }
  }, [isOpen])

  const handleSubmit = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    if (!body.trim()) { setError('내용을 입력해주세요'); return }
    if (isPrivate && !password.trim()) { setError('비공개 글은 비밀번호가 필요해요'); return }
    setBusy(true); setError(null)
    try {
      const id = await createInquiry(title.trim(), body.trim(), isPrivate, password)
      onCreated?.(id)
      onClose()
    } catch (e) {
      setError(e?.message || '문의 등록에 실패했어요')
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 pt-2">
        <h2 className="text-xl font-bold text-gray-800 mb-1">문의하기</h2>
        <p className="text-sm text-gray-500 mb-4 break-keep">
          궁금한 점이나 불편한 점을 남겨주세요. 관리자가 확인하고 답변드려요.
        </p>

        <label className="block text-sm font-medium text-gray-700 mb-1.5">제목</label>
        <input
          type="text" value={title} onChange={e => setTitle(e.target.value)}
          maxLength={TITLE_MAX} disabled={busy} placeholder="문의 제목"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 disabled:bg-gray-50"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1.5 mt-4">내용</label>
        <textarea
          value={body} onChange={e => setBody(e.target.value)} disabled={busy} rows={5}
          placeholder="문의 내용을 자세히 적어주세요"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 disabled:bg-gray-50 resize-none"
        />

        {/* 비공개 토글 */}
        <button
          type="button" onClick={() => setIsPrivate(v => !v)} disabled={busy}
          className={`w-full mt-4 p-3 rounded-xl border-2 text-left transition disabled:opacity-50 ${isPrivate ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🔒</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${isPrivate ? 'text-emerald-700' : 'text-gray-800'}`}>비공개 문의</p>
              <p className="text-xs text-gray-500 mt-0.5">관리자와 나만 볼 수 있어요. 열람 시 비밀번호가 필요해요.</p>
            </div>
            <div className={`relative w-9 h-5 rounded-full flex-shrink-0 transition ${isPrivate ? 'bg-emerald-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPrivate ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </div>
        </button>

        {isPrivate && (
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            disabled={busy} placeholder="열람용 비밀번호"
            className="w-full mt-2 px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 disabled:bg-gray-50"
          />
        )}

        {error && (
          <p className="mt-4 p-2.5 bg-red-50 text-red-600 rounded-lg text-sm text-center break-keep">{error}</p>
        )}

        <div className="flex gap-2 mt-6">
          <button
            type="button" onClick={onClose} disabled={busy}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button" onClick={handleSubmit} disabled={busy}
            className="flex-[2] px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-xl transition disabled:opacity-50"
          >
            {busy ? '등록 중...' : '문의 등록'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default InquiryWriteModal
