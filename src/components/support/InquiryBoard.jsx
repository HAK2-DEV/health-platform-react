import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Plus, ChevronRight } from 'lucide-react'
import EmptyState from '../common/EmptyState'
import LoadingState from '../common/LoadingState'
import { fetchInquiries, checkInquiryPassword } from '../../lib/queries'
import InquiryWriteModal from './InquiryWriteModal'
import InquiryDetailModal from './InquiryDetailModal'

const STATUS_META = {
  open:     { label: '답변대기', cls: 'bg-amber-50 text-amber-600' },
  answered: { label: '답변완료', cls: 'bg-emerald-50 text-emerald-600' },
  closed:   { label: '종료',     cls: 'bg-gray-100 text-gray-500' },
}
const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}.${d.getDate()}`
}

// 1:1 문의 게시판 — 목록 + 작성 + 상세(댓글). 비공개 글은 열람 시 비번 확인(관리자 통과).
function InquiryBoard({ userId, isAdmin, roleReady = true, deepLinkInquiryId, onConsumeDeepLink }) {
  const queryClient = useQueryClient()
  const [writeOpen, setWriteOpen] = useState(false)
  const [openInquiryId, setOpenInquiryId] = useState(null)
  const [pwTarget, setPwTarget] = useState(null)   // 비번 프롬프트 대상 문의
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(null)
  const [pwBusy, setPwBusy] = useState(false)

  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ['inquiries'],
    queryFn: fetchInquiries,
    enabled: !!userId,
  })

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['inquiries'] })

  const openInquiry = (inq) => {
    if (inq.is_private && !isAdmin) {
      setPwTarget(inq); setPwInput(''); setPwError(null)
    } else {
      setOpenInquiryId(inq.id)
    }
  }

  const submitPassword = async () => {
    if (!pwTarget) return
    setPwBusy(true); setPwError(null)
    try {
      const ok = await checkInquiryPassword(pwTarget.id, pwInput)
      if (ok) {
        setOpenInquiryId(pwTarget.id)
        setPwTarget(null)
      } else {
        setPwError('비밀번호가 일치하지 않아요')
      }
    } catch (e) {
      setPwError(e?.message || '확인에 실패했어요')
    } finally {
      setPwBusy(false)
    }
  }

  // 알림 딥링크(?inquiry=) — 목록 + role 확정 후 해당 문의 열기(비공개면 비번 게이트, 관리자 통과)
  useEffect(() => {
    if (!deepLinkInquiryId || inquiries.length === 0 || !roleReady) return
    const inq = inquiries.find(i => i.id === deepLinkInquiryId)
    if (inq) openInquiry(inq)
    onConsumeDeepLink?.()
  }, [deepLinkInquiryId, inquiries, roleReady]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {/* 작성 버튼 */}
      <button
        type="button"
        onClick={() => setWriteOpen(true)}
        className="w-full mb-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-bold flex items-center justify-center gap-1.5 transition"
      >
        <Plus className="w-4 h-4" /> 새 문의 작성
      </button>

      {isLoading ? (
        <LoadingState />
      ) : inquiries.length === 0 ? (
        <EmptyState icon="💬" title="문의 내역이 없어요" description="궁금한 점을 자유롭게 남겨주세요." variant="mint" />
      ) : (
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          {inquiries.map(inq => {
            const st = STATUS_META[inq.status] || STATUS_META.open
            return (
              <button
                key={inq.id}
                type="button"
                onClick={() => openInquiry(inq)}
                className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {inq.is_private && <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                    <p className="text-[14px] font-semibold text-gray-800 truncate">{inq.title}</p>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {isAdmin && <>{inq.users?.nickname || '사용자'} · </>}{fmtDate(inq.created_at)}
                  </p>
                </div>
                <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            )
          })}
        </div>
      )}

      {/* 작성 모달 */}
      <InquiryWriteModal
        isOpen={writeOpen}
        onClose={() => setWriteOpen(false)}
        onCreated={() => refetch()}
      />

      {/* 상세 모달 */}
      <InquiryDetailModal
        inquiryId={openInquiryId}
        userId={userId}
        isAdmin={isAdmin}
        isOpen={!!openInquiryId}
        onClose={() => setOpenInquiryId(null)}
        onChanged={refetch}
      />

      {/* 비밀번호 프롬프트 (화면 중앙) */}
      {pwTarget && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-5" onClick={() => setPwTarget(null)}>
          <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <h4 className="text-[15px] font-bold text-gray-800 mb-1">🔒 비공개 문의</h4>
            <p className="text-[13px] text-gray-500 mb-3 break-keep">열람하려면 비밀번호를 입력하세요.</p>
            <input
              type="password" value={pwInput} autoFocus
              onChange={e => setPwInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitPassword() }}
              disabled={pwBusy} placeholder="비밀번호"
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 disabled:bg-gray-50"
            />
            {pwError && <p className="mt-2 text-xs text-red-500">{pwError}</p>}
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setPwTarget(null)} disabled={pwBusy}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50">취소</button>
              <button type="button" onClick={submitPassword} disabled={pwBusy || !pwInput.trim()}
                className="flex-[1.4] h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition disabled:opacity-50">
                {pwBusy ? '확인 중...' : '열람'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InquiryBoard
