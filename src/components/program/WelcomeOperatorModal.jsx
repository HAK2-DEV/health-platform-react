import { useState } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

// 첫 프로그램 발행 직후 1회 표시되는 환영 캐러셀 (온보딩 A).
//   표시 여부는 localStorage('operator_welcome_seen') 로 1회 제어 (DashboardPage 에서 트리거).
const SLIDES = [
  { emoji: '🌿', title: '운영자가 되신 걸 환영해요!', body: '이제 나만의 건강 프로그램을 직접 운영할 수 있어요.' },
  { emoji: '🎯', title: '미션으로 습관을 만들어요', body: '추천 라이브러리나 직접 만들기로 미션을 추가하고, 사진·기록·소감으로 인증받아요.' },
  { emoji: '🏆', title: '참여를 북돋아요', body: '퀴즈·랭킹·성장 트랙과 공정한 인증 심사로 참여자를 응원해요.' },
  { emoji: '📊', title: '한눈에 관리해요', body: '참여자 통계·가입 승인·초대까지 한 화면에서 관리해요.' },
]

function WelcomeOperatorModal({ isOpen, onClose }) {
  useBodyScrollLock(isOpen)  // iOS 배경 스크롤 방지
  const [i, setI] = useState(0)
  if (!isOpen) return null
  const last = i === SLIDES.length - 1
  const s = SLIDES[i]

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-card-lg shadow-elevated overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end p-2">
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-2 text-center min-h-[180px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
            >
              <div className="text-5xl mb-3">{s.emoji}</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">{s.title}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-center gap-1.5 py-4">
          {SLIDES.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-5 bg-emerald-500' : 'w-1.5 bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="p-4 pt-0">
          {last ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-card-lg bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold transition"
            >
              시작하기
            </button>
          ) : (
            <div className="flex items-center justify-between">
              <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600">
                건너뛰기
              </button>
              <button
                type="button"
                onClick={() => setI(i + 1)}
                className="px-6 py-3 rounded-card-lg bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold transition"
              >
                다음
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WelcomeOperatorModal
