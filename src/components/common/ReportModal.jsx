import { useState, useEffect } from 'react'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban } from 'lucide-react'
import { createReport, REPORT_REASON_PRESETS } from '../../lib/queries'
import { blockUser, BLOCK_AFFECTED_QUERY_PREFIXES } from '../../lib/blocks'
import { useAuth } from '../../hooks/useAuth'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'

// 신고 모달 — 사유(선택) 입력 후 신고. (한줄 설명 모달과 동일 오버레이 스타일)
//   props: isOpen, onClose, programId, targetType('post'|'verification'|'comment'|'community_comment'|'user'), targetId, onReported
//         targetUserId, targetNickname — 있으면 「이 사용자 차단하기」 옵션 노출(2026-09-15, Play UGC 정책의 인앱 차단 요건)
//         onBlocked — 차단 완료 후 호출(목록 재조회 등)
const KIND_LABEL = { post: '게시물', verification: '인증', comment: '댓글', community_comment: '댓글', user: '사용자' }

function ReportModal({ isOpen, onClose, programId, targetType, targetId, onReported, targetUserId = null, targetNickname = null, onBlocked }) {
  const { session } = useAuth()
  const myId = session?.user?.id ?? null
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)        // 신고 접수 완료
  const [blocked, setBlocked] = useState(false)  // 차단 완료
  const [blockOnly, setBlockOnly] = useState(false)   // 신고 없이 차단만 하는 경로(문구가 «신고 접수» 로 보이면 안 됨)
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [reportUser, setReportUser] = useState(false)   // 262: 콘텐츠 대신 «사용자 자체»를 신고 (UGC 정책: UGC 와 사용자 모두 신고 가능해야)
  const [showHelp, setShowHelp] = useState(false)
  const kbInset = useKeyboardInset()   // iOS 키보드 높이 — 사유 입력 시 카드 위로

  useEffect(() => { if (isOpen) { setReason(''); setError(null); setDone(false); setBlocked(false); setBlockOnly(false); setConfirmBlock(false); setReportUser(false); setShowHelp(false) } }, [isOpen])
  useBodyScrollLock(isOpen)  // iOS 배경 스크롤 방지
  useBackButtonClose(isOpen, onClose)  // 하드웨어 뒤로가기 = 닫기

  const mutation = useMutation({
    mutationFn: () => (reportUser && targetUserId)
      ? createReport({ programId, targetType: 'user', targetId: targetUserId, reason: reason.trim() || null })
      : createReport({ programId, targetType, targetId, reason: reason.trim() || null }),
    onSuccess: () => { setDone(true); onReported?.() },
    onError: (e) => {
      if (e?.code === '23505' || /duplicate/i.test(e?.message || '')) setError(`이미 신고한 ${(reportUser && targetUserId) ? '사용자' : (KIND_LABEL[targetType] || '대상')}이에요.`)
      else setError(e.message || '신고에 실패했어요')
    },
  })

  const blockMutation = useMutation({
    mutationFn: () => blockUser(myId, targetUserId),
    onSuccess: () => {
      for (const k of BLOCK_AFFECTED_QUERY_PREFIXES) queryClient.invalidateQueries({ queryKey: k })
      setBlocked(true)
      onBlocked?.()
    },
    onError: (e) => setError(e.message || '차단에 실패했어요'),
  })

  const canBlock = !!targetUserId && !!myId && targetUserId !== myId

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-5" style={{ paddingBottom: kbInset ? kbInset + 20 : undefined, transition: 'padding-bottom .2s ease' }} onClick={onClose}>
      <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {blocked ? (
          <div className="text-center py-2">
            <div className="text-3xl mb-2">🚫</div>
            <p className="text-[14px] font-bold text-gray-800 mb-1">{targetNickname ? `${targetNickname} 님을 차단했어요` : '차단했어요'}</p>
            <p className="text-[12px] text-gray-500 mb-4 leading-relaxed break-keep">이 사용자의 게시물·댓글·인증·응원이 더 이상 보이지 않아요. 「프로필 › 계정 설정 › 차단 관리」에서 언제든 해제할 수 있어요.</p>
            <button type="button" onClick={onClose} className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition">확인</button>
          </div>
        ) : (done || blockOnly) ? (
          <div className="text-center py-2">
            {done ? (
              <>
                <div className="text-3xl mb-2">🚩</div>
                <p className="text-[14px] font-bold text-gray-800 mb-1">신고가 접수됐어요</p>
                <p className="text-[12px] text-gray-500 mb-4">{(reportUser && targetUserId) ? '운영자가 확인 후 처리해요.' : (targetType === 'post' || targetType === 'verification') ? '누적되면 자동으로 가려집니다.' : '운영자가 확인 후 처리해요.'}</p>
              </>
            ) : (
              <>
                <div className="text-3xl mb-2">🚫</div>
                <p className="text-[14px] font-bold text-gray-800 mb-3">사용자 차단</p>
              </>
            )}
            {canBlock && !confirmBlock && (
              <button type="button" onClick={() => setConfirmBlock(true)}
                className="w-full h-10 mb-2 rounded-xl border border-gray-200 text-gray-600 text-[13px] font-semibold hover:bg-gray-50 transition inline-flex items-center justify-center gap-1.5">
                <Ban className="w-3.5 h-3.5" /> 이 사용자도 차단하기
              </button>
            )}
            {canBlock && confirmBlock && (
              <div className="mb-2 p-3 rounded-xl bg-gray-50 text-left">
                <p className="text-[12px] text-gray-700 leading-relaxed break-keep mb-2">{targetNickname ? `${targetNickname} 님을 차단하면` : '차단하면'} 이 사용자의 게시물·댓글·인증·응원이 내 화면에서 사라져요. 상대에게는 알리지 않아요.</p>
                <button type="button" onClick={() => blockMutation.mutate()} disabled={blockMutation.isPending}
                  className="w-full h-10 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-[13px] font-bold transition disabled:opacity-50">
                  {blockMutation.isPending ? '차단 중...' : '차단하기'}
                </button>
              </div>
            )}
            {error && <p className="p-2 bg-red-50 text-red-600 text-xs rounded text-center mb-2">{error}</p>}
            <button type="button" onClick={onClose} className={`w-full h-11 rounded-xl text-sm font-bold transition ${done ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{done ? '확인' : '취소'}</button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 mb-1">
              <h4 className="text-[15px] font-bold text-gray-800">🚩 {targetType === 'user' ? '사용자 신고' : '신고'}</h4>
              <span className="relative inline-flex">
                <button type="button" aria-label="신고가 어떻게 처리되는지 설명"
                  onClick={() => setShowHelp(v => !v)}
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{ width: 15, height: 15, borderRadius: '50%', background: '#eef1ee', color: '#4b544f', fontSize: 10, fontWeight: 700 }}>?</button>
                {showHelp && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowHelp(false)} />
                    <div className="absolute bottom-full left-0 mb-2 z-20 w-60 rounded-lg bg-gray-900 text-white text-[11.5px] font-normal leading-relaxed px-3.5 py-3 shadow-lg divide-y divide-white/10">
                      <p className="pb-2.5"><b>운영자가 72시간 안에 확인해요.</b><br />게시물·인증은 여러 명이 신고하면 먼저 가려져요.</p>
                      <p className="py-2.5"><b>삭제가 아니에요.</b><br />잠깐 가려졌다가 괜찮으면 다시 보여요.</p>
                      <p className="pt-2.5"><b>신고한 사람은 비밀이에요.</b><br />운영자만 볼 수 있어요.</p>
                    </div>
                  </>
                )}
              </span>
            </div>
            <p className="text-[12px] text-gray-500 mb-2">{targetNickname && targetType === 'user' ? `${targetNickname} 님을 신고해요. ` : ''}신고 사유를 골라주세요 (선택).</p>
            {/* 기본 사유 프리셋 — 탭하면 사유 채움(다시 탭하면 해제) */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {REPORT_REASON_PRESETS.map(p => (
                <button key={p} type="button" onClick={() => setReason(r => (r === p ? '' : p))}
                  className={`px-2.5 py-1 rounded-full text-[12px] font-semibold border transition ${reason === p ? 'bg-amber-500 border-amber-500 text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                  {p}
                </button>
              ))}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={200}
              autoFocus
              placeholder="사유 (선택) — 예: 스팸, 부적절한 내용"
              style={{ fontSize: '13px' }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400 resize-none leading-relaxed"
            />
            <p className="text-[11px] text-gray-400 text-right mt-0.5">{reason.length}/200</p>
            {canBlock && targetType !== 'user' && (
              <label className="flex items-start gap-2 mb-2 text-[12px] text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={reportUser} onChange={(e) => setReportUser(e.target.checked)} className="mt-0.5 accent-amber-500" />
                <span className="leading-snug break-keep">이 {KIND_LABEL[targetType] || '콘텐츠'}가 아니라 <b>{targetNickname ? `${targetNickname} 님` : '작성자'} 자체</b>를 신고할래요 (반복 괴롭힘·사칭 등)</span>
              </label>
            )}
            {error && <p className="p-2 bg-red-50 text-red-600 text-xs rounded text-center mb-2">{error}</p>}
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition">취소</button>
              <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}
                className="flex-[1.4] h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition disabled:opacity-50">
                {mutation.isPending ? '접수 중...' : '신고하기'}
              </button>
            </div>
            {/* 신고 없이 바로 차단 — 1:1 상호작용 앱의 인앱 차단 요건 */}
            {canBlock && (
              <button type="button" onClick={() => { setBlockOnly(true); setConfirmBlock(true) }}
                className="w-full mt-2 h-9 text-[12px] text-gray-400 hover:text-gray-700 transition inline-flex items-center justify-center gap-1">
                <Ban className="w-3.5 h-3.5" /> 신고 대신 {targetNickname ? `${targetNickname} 님` : '이 사용자'} 차단하기
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default ReportModal
