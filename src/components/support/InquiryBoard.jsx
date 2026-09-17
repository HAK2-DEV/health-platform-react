import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Plus, ChevronRight, Bug } from 'lucide-react'
import EmptyState from '../common/EmptyState'
import LoadingState from '../common/LoadingState'
import { fetchInquiries, checkInquiryPassword } from '../../lib/queries'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import { useKeyboardOverlay } from '../../hooks/useKeyboardOverlay'
import InquiryWriteModal from './InquiryWriteModal'
import BugReportWriteModal from './BugReportWriteModal'
import InquiryDetailModal from './InquiryDetailModal'

const STATUS_META = {
  open:     { label: '답변대기', cls: 'bg-amber-50 text-amber-600' },
  answered: { label: '답변완료', cls: 'bg-emerald-50 text-emerald-600' },
  closed:   { label: '종료',     cls: 'bg-gray-100 text-gray-500' },
}
// 버그 신고는 「답변」보다 「처리」가 맞는 말이라 같은 status 를 다르게 읽어준다.
const BUG_STATUS_META = {
  open:     { label: '확인중',   cls: 'bg-amber-50 text-amber-600' },
  answered: { label: '답변완료', cls: 'bg-emerald-50 text-emerald-600' },
  closed:   { label: '처리완료', cls: 'bg-gray-100 text-gray-500' },
}
const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}.${d.getDate()}`
}

// 문의·버그 신고 게시판 — 목록 + 작성 + 상세(댓글). 비공개 글은 열람 시 비번 확인(관리자 통과).
//   category 로 같은 테이블을 두 탭으로 나눠 쓴다('general' = 1:1 문의 / 'bug' = 버그 신고).
function InquiryBoard({ userId, isAdmin, roleReady = true, deepLinkInquiryId, onConsumeDeepLink, category = 'general' }) {
  const isBug = category === 'bug'
  const queryClient = useQueryClient()
  const [writeOpen, setWriteOpen] = useState(false)
  const [openInquiryId, setOpenInquiryId] = useState(null)
  const [pwTarget, setPwTarget] = useState(null)   // 비번 프롬프트 대상 문의
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(null)
  const [pwBusy, setPwBusy] = useState(false)
  useBackButtonClose(!!pwTarget, () => setPwTarget(null))  // 하드웨어 뒤로가기 = 비번 모달 닫기
  // 키보드 — 비번 프롬프트는 공용 Modal 이 아닌 자체 fixed 오버레이다. 구형 안드(노트9=안드10)는
  //   창이 안 줄어 정중앙 카드가 키보드에 가리므로 위쪽 정렬 + 52vh 로 가둔다. [[hooks/useKeyboardOverlay]]
  const { overlayStyle, cardStyle } = useKeyboardOverlay(16)

  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ['inquiries', category],
    queryFn: () => fetchInquiries(category),
    enabled: !!userId,
  })

  // 접두 일치라 ['inquiries', 'bug'] · ['inquiries', 'general'] 둘 다 무효화된다.
  //   실시간 동기화(useRealtimeSync)도 같은 키를 쓴다.
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
  //   ⚠️ 목록이 category 로 걸러지므로 알림의 tab 과 글의 분류가 같아야 찾는다.
  //      link_path 분기는 마이그 267 에서 처리.
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
        className={`w-full mb-3 px-4 py-3 rounded-2xl text-white font-bold flex items-center justify-center gap-1.5 transition ${
          isBug
            ? 'bg-gradient-to-r from-rose-400 to-orange-400 hover:from-rose-500 hover:to-orange-500'
            : 'bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600'
        }`}
      >
        {isBug ? <Bug className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {isBug ? '버그 신고하기' : '새 문의 작성'}
      </button>

      {isLoading ? (
        <LoadingState />
      ) : inquiries.length === 0 ? (
        isBug ? (
          <EmptyState icon="🐞" title="신고된 버그가 없어요" description="이상한 점을 발견하면 알려주세요. 빠르게 확인해 고칠게요." variant="mint" />
        ) : (
          <EmptyState icon="💬" title="문의 내역이 없어요" description="궁금한 점을 자유롭게 남겨주세요." variant="mint" />
        )
      ) : (
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          {inquiries.map(inq => {
            const meta = isBug ? BUG_STATUS_META : STATUS_META
            const st = meta[inq.status] || meta.open
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

      {/* 작성 모달 — 버그는 기기 정보를 자동으로 붙이는 전용 모달을 쓴다. */}
      {isBug ? (
        <BugReportWriteModal
          isOpen={writeOpen}
          onClose={() => setWriteOpen(false)}
          onCreated={() => refetch()}
        />
      ) : (
        <InquiryWriteModal
          isOpen={writeOpen}
          onClose={() => setWriteOpen(false)}
          onCreated={() => refetch()}
        />
      )}

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
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-5" style={overlayStyle} onClick={() => setPwTarget(null)}>
          <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl max-h-[85vh] overflow-y-auto" style={cardStyle} onClick={e => e.stopPropagation()}>
            <h4 className="text-[15px] font-bold text-gray-800 mb-1">🔒 비공개 {isBug ? '신고' : '문의'}</h4>
            <p className="text-[13px] text-gray-500 mb-3 break-keep">열람하려면 비밀번호를 입력하세요.</p>
            <input
              type="password" value={pwInput} autoFocus
              onChange={e => setPwInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitPassword() }}
              disabled={pwBusy} placeholder="비밀번호"
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 disabled:bg-gray-50"
            />
            {pwError && <p className="mt-2 text-xs text-red-500">{pwError}</p>}
            {/* 취소·열람 — 카드 하단에 sticky. 구형 안드에서 52vh 로 갇히거나 큰 글꼴로 내용이
                길어져도 버튼이 스크롤 밖으로 밀리지 않게. (카드 padding 이 p-5 → -mx-5 px-5) */}
            <div className="sticky bottom-0 -mx-5 px-5 pt-2.5 pb-0.5 bg-white border-t border-gray-100 flex gap-2">
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
