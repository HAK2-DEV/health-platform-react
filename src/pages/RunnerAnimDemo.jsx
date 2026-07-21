import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'

// 데모 — 달리기 러너 프레임 애니메이션 (/runner-anim-demo).
//   8프레임(1~8) 순환 = 한 러닝 사이클(팔·다리 실제 움직임). 탭할수록 speed↑ → ① 프레임 가속 ② 상체 앞으로 숙임(스프린트).
//   안 누르면 서서히 감속 → 정지(1번 프레임). + 먼지 퍼프·속도선.
const FRAMES = Array.from({ length: 18 }, (_, i) => `/icons/running/run/${i + 1}.png`)
const MAX = 6

function RunnerAnimDemo() {
  const [speed, setSpeed] = useState(0)
  const [frame, setFrame] = useState(0)
  const [puffs, setPuffs] = useState([])
  const decayRef = useRef(null)
  const frameRef = useRef(null)
  const puffIdRef = useRef(0)

  // 프레임 순환 — speed 에 따라 간격 조절(빠를수록 짧게). speed=0 이면 멈춤(선 자세=frame0).
  useEffect(() => {
    clearInterval(frameRef.current)
    if (speed <= 0) { setFrame(0); return }
    const interval = Math.max(26, 80 - speed * 9)      // speed 높을수록 프레임 전환 빠름(18프레임)
    frameRef.current = setInterval(() => setFrame(f => (f + 1) % FRAMES.length), interval)
    return () => clearInterval(frameRef.current)
  }, [speed])

  useEffect(() => () => { clearInterval(frameRef.current); clearInterval(decayRef.current) }, [])

  const tap = () => {
    setSpeed(s => Math.min(s + 1, MAX))
    const id = ++puffIdRef.current
    setPuffs(p => [...p.slice(-4), { id }])
    setTimeout(() => setPuffs(p => p.filter(x => x.id !== id)), 620)
    clearInterval(decayRef.current)
    decayRef.current = setInterval(() => {
      setSpeed(s => { if (s <= 1) { clearInterval(decayRef.current); return 0 } return s - 1 })
    }, 750)
  }

  const running = speed > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-[460px] mx-auto h-[52px] px-2 flex items-center">
          <button type="button" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
          <h1 className="flex-1 text-center text-[16px] font-extrabold text-gray-900">달리기 아이콘 데모</h1>
          <span className="w-9 h-9" />
        </div>
      </div>

      <div className="max-w-[460px] mx-auto px-4 py-8">
        <p className="text-center text-[13px] text-gray-500 mb-6">러너를 <b className="text-emerald-600">탭</b>할수록 더 빨리 달려요 (프레임 전환 가속). 멈추면 서서히 느려지다 정지합니다.</p>

        {/* 트랙 */}
        <div className="relative h-48 rounded-2xl bg-gradient-to-b from-sky-50 to-emerald-50 border border-gray-100 overflow-hidden flex items-end justify-center">
          {/* 속도선 */}
          {running && [0, 1, 2].map(i => (
            <motion.div key={i}
              className="absolute h-[3px] rounded-full bg-emerald-400/50"
              style={{ top: `${40 + i * 13}%`, right: '40%', width: 18 + speed * 5 }}
              animate={{ x: [-4, -70], opacity: [0.55, 0] }}
              transition={{ duration: Math.max(0.18, 0.5 - speed * 0.05), repeat: Infinity, delay: i * 0.05, ease: 'easeIn' }}
            />
          ))}

          {/* 바닥 */}
          <div className="absolute bottom-7 left-5 right-5 h-[2px] bg-emerald-200 rounded-full" />

          {/* 먼지 퍼프 */}
          <AnimatePresence>
            {puffs.map(p => (
              <motion.span key={p.id}
                className="absolute bottom-7 rounded-full bg-gray-300/70"
                style={{ left: '47%', width: 11, height: 11 }}
                initial={{ scale: 0.4, opacity: 0.7, x: 0, y: 0 }}
                animate={{ scale: 1.7, opacity: 0, x: -22, y: -6 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            ))}
          </AnimatePresence>

          {/* 러너 — 프레임 순환(실제 팔·다리) + 상하 반동 + 속도↑ 시 상체 앞으로 숙임(스프린트) */}
          <motion.button type="button" onClick={tap}
            className="relative mb-3 outline-none"
            style={{ transformOrigin: '50% 82%' }}
            animate={running ? { y: [0, -5, 0], rotate: 2 + speed * 2.9 } : { y: 0, rotate: 0 }}
            transition={running
              ? { y: { duration: Math.max(0.16, 0.42 - speed * 0.045), repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 0.4, ease: 'easeOut' } }
              : { duration: 0.3 }}
          >
            {/* 모든 프레임을 겹쳐두고 현재 프레임만 표시 → 프리로드 + 깜빡임 없음 */}
            <div className="relative w-28 h-28">
              {FRAMES.map((src, i) => (
                <img key={i} src={src} alt="" aria-hidden="true" draggable="false"
                  className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
                  style={{ opacity: (running ? i === frame : i === 0) ? 1 : 0 }} />
              ))}
            </div>
          </motion.button>
        </div>

        {/* 속도 게이지 */}
        <div className="mt-6 flex items-center justify-center gap-2.5">
          <span className="text-[13px] font-bold text-gray-500">속도</span>
          <div className="flex gap-1">
            {Array.from({ length: MAX }, (_, i) => (
              <span key={i} className={`w-2.5 h-2.5 rounded-full transition ${i < speed ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            ))}
          </div>
          <span className="text-[14px] font-extrabold text-emerald-600 w-9 text-right">x{speed}</span>
        </div>

        <button type="button" onClick={tap}
          className="mt-8 w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-bold transition">
          🏃 더 빨리! (탭)
        </button>
      </div>
    </div>
  )
}

export default RunnerAnimDemo
