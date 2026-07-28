// 팀 초대 수락 모달 — 화면 중앙 카드. 알림 클릭 시 자동으로 뜸.
//   props: invite({ teamName, emoji, leaderNickname, memberCount, capacity }),
//          isOpen, error, onAccept, onDecline, onClose, busy
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

function TeamInviteAcceptModal({ invite, isOpen, error, onAccept, onDecline, onClose, busy = false }) {
  useBodyScrollLock(isOpen)  // iOS 배경 스크롤 방지
  if (!isOpen || !invite) return null
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-5" onClick={onClose}>
      <div className="w-full max-w-xs bg-white rounded-2xl p-6 shadow-xl text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center text-3xl mb-3">
          {invite.emoji || '👥'}
        </div>
        <p className="text-xs font-bold text-violet-500 mb-1">팀 초대가 도착했어요</p>
        <h3 className="text-lg font-bold text-gray-800 break-keep">
          '{invite.teamName}' 팀에<br />초대받았어요
        </h3>
        <p className="text-[13px] text-gray-500 mt-2">
          {invite.leaderNickname && <>팀장 <span className="font-medium text-gray-700">{invite.leaderNickname}</span> · </>}
          👤 {invite.memberCount}/{invite.capacity}명
        </p>

        {error && (
          <p className="mt-4 p-2.5 bg-red-50 text-red-600 rounded-lg text-[13px] font-medium break-keep">{error}</p>
        )}

        {error ? (
          // 수락 불가(정원 초과 등) — 닫기/거절만
          <div className="flex gap-2 mt-4">
            <button
              type="button" onClick={onClose} disabled={busy}
              className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50"
            >
              닫기
            </button>
            <button
              type="button" onClick={onDecline} disabled={busy}
              className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 transition disabled:opacity-50"
            >
              {busy ? '처리 중...' : '초대 거절'}
            </button>
          </div>
        ) : (
          <div className="flex gap-2 mt-5">
            <button
              type="button" onClick={onDecline} disabled={busy}
              className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50"
            >
              거절하기
            </button>
            <button
              type="button" onClick={onAccept} disabled={busy}
              className="flex-[1.4] h-11 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-bold transition disabled:opacity-50"
            >
              {busy ? '처리 중...' : '수락하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default TeamInviteAcceptModal
