import { AnimatePresence, motion } from 'framer-motion'
import { X, Users } from 'lucide-react'
import UserAvatar from '../common/UserAvatar'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

// 참여자 명단 — 화면 중앙 팝업. ranking(get_program_ranking) 배열을 그대로 사용.
//   props: isOpen, onClose, participants[{user_id,nickname,avatar_path,rank,total_score}], myUserId, showScore, onManage(운영자용, 선택)
export default function ParticipantListModal({ isOpen, onClose, participants = [], myUserId, showScore = false, onManage }) {
  useBodyScrollLock(isOpen)
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.34, 1.4, 0.64, 1] }}>
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <Users className="w-5 h-5 text-emerald-600" />
              <h3 className="text-[16px] font-extrabold text-gray-900">참여자 {participants.length}명</h3>
              <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-2 py-2">
              {participants.length === 0 ? (
                <p className="text-[13px] text-gray-400 text-center py-10">아직 참여자가 없어요.</p>
              ) : participants.map((p, i) => {
                const isMe = p.user_id === myUserId
                return (
                  <div key={p.user_id || i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isMe ? 'bg-emerald-50' : ''}`}>
                    {showScore && <span className="w-6 text-center text-[13px] font-bold text-gray-400 tabular-nums flex-shrink-0">{p.rank ?? i + 1}</span>}
                    <UserAvatar avatarPath={p.avatar_path} nickname={p.nickname} size="md" viewable />
                    <span className={`flex-1 min-w-0 truncate text-[14px] font-medium ${isMe ? 'text-emerald-800' : 'text-gray-800'}`}>
                      {p.nickname}{isMe && <span className="ml-1 text-[11px] text-emerald-600">(나)</span>}
                    </span>
                    {showScore && <span className="text-[13px] font-semibold text-gray-500 flex-shrink-0 tabular-nums">{p.total_score ?? 0}P</span>}
                  </div>
                )
              })}
            </div>
            {onManage && (
              <div className="border-t border-gray-100 p-3">
                <button type="button" onClick={onManage} className="w-full h-11 rounded-xl bg-gray-50 text-gray-700 text-[14px] font-semibold hover:bg-gray-100 transition">참여 유저 관리</button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
