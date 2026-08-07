import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import Modal from '../common/Modal'
import ConfirmModal from '../common/ConfirmModal'
import UserAvatar from '../common/UserAvatar'
import LoadingState from '../common/LoadingState'
import { fetchInquiry, fetchInquiryComments, addInquiryComment, deleteInquiry } from '../../lib/queries'

const STATUS_META = {
  open:     { label: '답변대기', cls: 'bg-amber-50 text-amber-600' },
  answered: { label: '답변완료', cls: 'bg-emerald-50 text-emerald-600' },
  closed:   { label: '종료',     cls: 'bg-gray-100 text-gray-500' },
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 문의 상세 — 본문 + 댓글 스레드(작성자↔관리자). 비번 게이트는 부모(InquiryBoard)가 처리.
function InquiryDetailModal({ inquiryId, userId, isAdmin, isOpen, onClose, onChanged }) {
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)

  // 모달이 다른 문의로 열릴 때마다 입력/상태 초기화 (이전 busy 가 남아 입력 막히는 것 방지)
  useEffect(() => {
    if (isOpen) { setComment(''); setError(null); setBusy(false); setConfirmDel(false) }
  }, [isOpen, inquiryId])

  const { data: inquiry, isLoading } = useQuery({
    queryKey: ['inquiry', inquiryId],
    queryFn: () => fetchInquiry(inquiryId),
    enabled: isOpen && !!inquiryId,
  })
  const { data: comments = [], isLoading: isCommentsLoading } = useQuery({
    queryKey: ['inquiry-comments', inquiryId],
    queryFn: () => fetchInquiryComments(inquiryId),
    enabled: isOpen && !!inquiryId,
  })

  const amAuthor = inquiry?.author_id === userId
  const canComment = amAuthor || isAdmin
  const canDelete = amAuthor || isAdmin

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['inquiry-comments', inquiryId] })
    queryClient.invalidateQueries({ queryKey: ['inquiry', inquiryId] })
    onChanged?.()
  }

  const handleAddComment = async () => {
    if (!comment.trim()) return
    setBusy(true); setError(null)
    try {
      await addInquiryComment(inquiryId, userId, comment.trim())
      setComment('')
      refetch()
    } catch (e) {
      setError(e?.message || '답글 등록에 실패했어요')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    try {
      await deleteInquiry(inquiryId)
      onChanged?.()
      onClose()
    } catch (e) {
      setError(e?.message || '삭제에 실패했어요')
    } finally {
      setBusy(false)
      setConfirmDel(false)
    }
  }

  const status = STATUS_META[inquiry?.status] || STATUS_META.open

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 pt-2">
        {isLoading || !inquiry ? (
          <LoadingState />
        ) : (
          <>
            {/* 헤더 */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
                {inquiry.is_private && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">🔒 비공개</span>}
              </div>
              {canDelete && (
                <button type="button" onClick={() => setConfirmDel(true)} disabled={busy}
                  className="p-1.5 -mr-1 text-gray-300 hover:text-red-500 transition" aria-label="삭제">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <h2 className="text-lg font-bold text-gray-800 break-keep">{inquiry.title}</h2>
            <p className="text-[11px] text-gray-400 mt-1">
              {inquiry.users?.nickname || '사용자'} · {fmtDate(inquiry.created_at)}
            </p>
            <p className="mt-3 text-[14px] text-gray-700 leading-relaxed break-keep whitespace-pre-wrap">{inquiry.body}</p>

            {/* 댓글 스레드 */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-[13px] font-bold text-gray-400 mb-3">답변 {comments.length > 0 && `· ${comments.length}`}</p>
              {isCommentsLoading ? (
                <p className="text-[13px] text-gray-300 py-2">답변 불러오는 중…</p>
              ) : comments.length === 0 ? (
                <p className="text-[13px] text-gray-400 py-2">아직 답변이 없어요. 관리자가 확인 후 답변드려요.</p>
              ) : (
                <div className="space-y-3">
                  {comments.map(c => (
                    <div key={c.id} className={`flex gap-2.5 ${c.is_admin ? '' : ''}`}>
                      <UserAvatar avatarPath={c.users?.avatar_path} nickname={c.users?.nickname} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-gray-700">
                          {c.users?.nickname || '사용자'}
                          {c.is_admin && <span className="ml-1.5 text-[10px] text-emerald-600 font-bold">👑 관리자</span>}
                          <span className="ml-1.5 text-[10px] text-gray-300 font-normal">{fmtDate(c.created_at)}</span>
                        </p>
                        <p className={`text-[13px] leading-relaxed break-keep whitespace-pre-wrap mt-0.5 rounded-xl px-3 py-2 ${c.is_admin ? 'bg-emerald-50 text-gray-700' : 'bg-gray-50 text-gray-700'}`}>{c.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 답글 입력 — 작성자/관리자만 */}
            {canComment ? (
              <div className="mt-4">
                <textarea
                  value={comment} onChange={e => setComment(e.target.value)} disabled={busy} rows={2}
                  placeholder={isAdmin ? '답변을 입력하세요' : '추가 문의를 입력하세요'}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 disabled:bg-gray-50 resize-none text-sm"
                />
                {error && <p className="mt-2 text-xs text-red-500 text-center">{error}</p>}
                <button
                  type="button" onClick={handleAddComment} disabled={busy || !comment.trim()}
                  className="w-full mt-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
                >
                  {busy ? '등록 중...' : '답글 등록'}
                </button>
              </div>
            ) : (
              <p className="mt-4 text-[12px] text-gray-400 text-center">답변은 관리자와 작성자만 남길 수 있어요.</p>
            )}

            <button
              type="button" onClick={onClose}
              className="w-full mt-3 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition"
            >
              닫기
            </button>
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={handleDelete}
        title="문의 삭제"
        message="이 문의를 삭제할까요? 답변도 함께 삭제돼요."
        confirmLabel="삭제"
        danger
        busy={busy}
      />
    </Modal>
  )
}

export default InquiryDetailModal
