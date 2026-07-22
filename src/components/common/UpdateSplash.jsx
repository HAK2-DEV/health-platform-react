import { useState } from 'react'
import { motion } from 'framer-motion'

// 업데이트 적용 스플래시 — 「새로고침」 탭 후 reload 직전 잠깐 노출되는 도담 브랜드 화면.
//   PwaUpdatePrompt(실제 흐름) + UpdateDemoPage(로컬 데모) 공용.
//
// A안(영상 렌더): 사전 렌더된 3D 새싹 클립을 <video>(MP4+WebM, ~20KB)로 재생.
//   흰 배경 렌더(화이트닝) → 화이트 테마 스플래시. 하드웨어 디코딩이라 렉 없음, SW precache 로 즉시.
//   배경: 영상 흰 배경과 맞춘 라이트 그라데이션 + 영상 가장자리 원형 마스크 → 사각 경계 숨김.
//   재생 실패 시 정적 3D 아이콘 + CSS 부유로 폴백.
const POSTER = '/icons/growth/sprout-grow-poster.jpg'
const STATIC_SRC = '/icons/growth/sprout.png'
// 영상의 회색 스튜디오 배경을 채도 키로 제거하고 순백에 합성해둠(새싹은 원본색 유지).
//   → 스플래시도 순백 → 영상 사각 경계가 완전히 사라짐(마스크 불필요).
const BG = '#ffffff'

function UpdateSplash({ label = '새 버전으로 업데이트 중', sub = '잠시만 기다려 주세요' }) {
  const [videoFailed, setVideoFailed] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[999] flex items-center justify-center"
      style={{ background: BG }}
      role="status"
      aria-live="polite"
    >
      <div className="text-center px-8">
        {!videoFailed ? (
          <video
            className="w-44 h-44 object-contain mx-auto"
            poster={POSTER}
            autoPlay
            muted
            playsInline
            preload="auto"
            onError={() => setVideoFailed(true)}
          >
            <source src="/icons/growth/sprout-grow.webm" type="video/webm" />
            <source src="/icons/growth/sprout-grow.mp4" type="video/mp4" />
          </video>
        ) : (
          <motion.img
            src={STATIC_SRC}
            alt=""
            aria-hidden="true"
            className="w-24 h-24 object-contain mx-auto"
            animate={{ y: [0, -10, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <p className="mt-1 text-lg font-extrabold text-gray-800">{label}</p>
        <p className="mt-1 text-xs font-semibold text-gray-600">{sub}</p>
        <div className="mt-6 mx-auto w-40 h-1.5 rounded-full bg-black/10 overflow-hidden">
          <motion.div
            className="h-full bg-teal-600 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.2, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </motion.div>
  )
}

export default UpdateSplash
