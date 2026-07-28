import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createReport, REPORT_REASON_PRESETS } from '../../lib/queries'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

// 신고 모달 — 사유(선택) 입력 후 신고. (한줄 설명 모달과 동일 오버레이 스타일)
//   props: isOpen, onClose, programId, targetType('post'|'verification'), targetId, onReported
function ReportModal({ isOpen, onClose, programId, targetType, targetId, onReported }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => { if (isOpen) { setReason(''); setError(null); setDone(false); setShowHelp(false) } }, [isOpen])
  useBodyScrollLock(isOpen)  // iOS 배경 스크롤 방지

  const mutation = useMutation({
    mutationFn: () => createReport({ programId, targetType, targetId, reason: reason.trim() || null }),
    onSuccess: () => { setDone(true); onReported?.() },
    onError: (e) => {
      if (e?.code === '23505' || /duplicate/i.test(e?.message || '')) setError('이미 신고한 게시물이에요.')
      else setError(e.message || '신고에 실패했어요')
    },
  })

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-5" onClick={onClose}>
      <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="text-center py-2">
            <div className="text-3xl mb-2">🚩</div>
            <p className="text-[14px] font-bold text-gray-800 mb-1">신고가 접수됐어요</p>
            <p className="text-[12px] text-gray-500 mb-4">누적되면 자동으로 가려집니다.</p>
            <button type="button" onClick={onClose} className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition">확인</button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 mb-1">
              <h4 className="text-[15px] font-bold text-gray-800">🚩 신고</h4>
              <span className="relative inline-flex">
                <button type="button" aria-label="신고가 어떻게 처리되는지 설명"
                  onClick={() => setShowHelp(v => !v)}
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{ width: 15, height: 15, borderRadius: '50%', background: '#eef1ee', color: '#4b544f', fontSize: 10, fontWeight: 700 }}>?</button>
                {showHelp && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowHelp(false)} />
                    <div className="absolute bottom-full left-0 mb-2 z-20 w-60 rounded-lg bg-gray-900 text-white text-[11.5px] font-normal leading-relaxed px-3.5 py-3 shadow-lg divide-y divide-white/10">
                      <p className="pb-2.5"><b>여러 명이 신고해야 가려져요.</b><br />한 명만으로는 안 숨겨져요.</p>
                      <p className="py-2.5"><b>삭제가 아니에요.</b><br />잠깐 가려졌다가 괜찮으면 다시 보여요.</p>
                      <p className="pt-2.5"><b>신고한 사람은 비밀이에요.</b><br />운영자만 볼 수 있어요.</p>
                    </div>
                  </>
                )}
              </span>
            </div>
            <p className="text-[12px] text-gray-500 mb-2">신고 사유를 골라주세요 (선택). 누적되면 자동으로 가려집니다.</p>
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
            {error && <p className="p-2 bg-red-50 text-red-600 text-xs rounded text-center mb-2">{error}</p>}
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition">취소</button>
              <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}
                className="flex-[1.4] h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition disabled:opacity-50">
                {mutation.isPending ? '접수 중...' : '신고하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ReportModal
