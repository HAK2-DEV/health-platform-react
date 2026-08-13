import { useState } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import { motion, AnimatePresence } from 'framer-motion'

// 팁 아이콘 — 3D 아이콘 이미지, 로드 실패 시에만 이모지로 대체(겹침 없음)
function TipIcon({ src, emoji }) {
  const [err, setErr] = useState(false)
  if (err || !src) return <span className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-2xl leading-none mt-0.5">{emoji}</span>
  return <img src={src} alt="" aria-hidden="true" onError={() => setErr(true)} className="w-9 h-9 flex-shrink-0 object-contain mt-0.5" />
}

// 프로그램 참여 팁 바텀시트 — 둘러보기 하단 「프로그램 참여 팁」 CTA 클릭 시.
//   팁 초안 (본인 수정 가능): 꾸준함·동행 컨셉에 맞춘 5가지.
const TIPS = [
  { icon: '/icons/feature/target.png', emoji: '🎯', title: '작은 목표부터', body: '처음부터 무리하지 말고 하루 10분·1,000보처럼 작게 시작해요. 꾸준함이 강도보다 중요해요.' },
  { icon: '/icons/feature/bell.png', emoji: '🔔', title: '알림을 켜두세요', body: '인증 리마인드 알림을 켜두면 깜빡임이 줄어 연속 기록이 한결 쉬워져요.' },
  { icon: '/icons/cheer/people.png', emoji: '🤝', title: '혼자보다 함께', body: '커뮤니티 피드에서 서로의 인증에 응원을 남기면 동기부여가 오래가요.' },
  { icon: '/icons/feature/attendance.png', emoji: '📅', title: '내 리듬에 맞게', body: '기간·강도·카테고리가 내 생활 리듬에 맞는 프로그램을 고르면 끝까지 가기 쉬워요.' },
  { icon: '/icons/growth/sprout.png', emoji: '🌱', title: '빠진 날도 괜찮아요', body: '하루 놓쳐도 다음 날 다시 시작하면 돼요. 완벽보다 회복이 중요해요.' },
]

function ParticipationTipsSheet({ isOpen, onClose }) {
  useBodyScrollLock(isOpen)  // iOS 배경 스크롤 방지
  useBackButtonClose(isOpen, onClose)  // 하드웨어 뒤로가기 = 닫기
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[61] max-w-2xl mx-auto bg-white rounded-t-3xl px-5 pt-3"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-800 mb-1">💡 프로그램 참여 팁</h3>
            <p className="text-xs text-gray-500 mb-4">꾸준히, 그리고 즐겁게 이어가는 작은 비결</p>
            <div className="space-y-2.5 max-h-[58vh] overflow-y-auto -mx-1 px-1">
              {TIPS.map((t, i) => (
                <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-2xl">
                  <TipIcon src={t.icon} emoji={t.emoji} />
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-gray-800">{t.title}</p>
                    <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed break-keep">{t.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-12 mt-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition"
            >
              확인
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default ParticipationTipsSheet
