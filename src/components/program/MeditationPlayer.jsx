import { useState, useRef, useEffect, useCallback } from 'react'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import { X, Play, Check } from 'lucide-react'

// 참여자 명상 플레이어 — 마음관리 「명상 타이머」 인증.
//   준비 → 시작(음악·시각 호흡 가이드·카운트다운) → 시간 종료 → 완료(제출).
//   무결성: 화면 이탈/백그라운드 시 일시정지(rAF·오디오 정지) → 돌아오면 「이어서」 탭.
//   Wake Lock 로 화면 유지 시도(미지원이면 사용자가 화면 켜두면 됨).
const DEFAULT_PATTERN = { inhale: 4, hold1: 4, exhale: 4, hold2: 4 }

const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

function MeditationPlayer({ mission, onComplete, onClose, submitting = false }) {
  const totalSec = Math.max(30, mission?.meditation_seconds || 180)
  const pattern = mission?.meditation_pattern || DEFAULT_PATTERN
  const musicSrc = mission?.meditation_music || '/audio/meditation/calm.mp3'

  const [phase, setPhase] = useState('ready')     // ready | running | done
  const [paused, setPaused] = useState(false)
  const [remaining, setRemaining] = useState(totalSec)
  const [breath, setBreath] = useState({ label: '', scale: 0.55 })
  useBackButtonClose(true, onClose)  // 하드웨어 뒤로가기 = 닫기

  const elapsedRef = useRef(0)   // ms
  const lastRef = useRef(0)
  const rafRef = useRef(null)
  const audioRef = useRef(null)
  const wakeRef = useRef(null)
  const pausedRef = useRef(false)
  const phaseRef = useRef('ready')

  // 호흡 사이클(초) — 들숨→멈춤→날숨→멈춤. 멈춤 0이면 들숨↔날숨만.
  const cycle = Math.max(1, pattern.inhale + pattern.hold1 + pattern.exhale + pattern.hold2)
  const breathAt = (elapsedSec) => {
    let t = elapsedSec % cycle
    const { inhale, hold1, exhale, hold2 } = pattern
    if (t < inhale) return { label: '들이쉬기', scale: 0.55 + 0.45 * (inhale ? t / inhale : 1) }
    t -= inhale
    if (t < hold1) return { label: '잠시 멈추기', scale: 1 }
    t -= hold1
    if (t < exhale) return { label: '내쉬기', scale: 1 - 0.45 * (exhale ? t / exhale : 1) }
    t -= exhale
    return { label: '잠시 멈추기', scale: 0.55 }
  }

  const stopAudio = () => { const a = audioRef.current; if (a) { try { a.pause() } catch { /* noop */ } } }
  const releaseWake = () => { try { wakeRef.current?.release?.() } catch { /* noop */ } wakeRef.current = null }
  const acquireWake = async () => {
    try { if ('wakeLock' in navigator) wakeRef.current = await navigator.wakeLock.request('screen') } catch { /* 미지원/거부 */ }
  }

  const finish = () => {
    cancelAnimationFrame(rafRef.current)
    stopAudio(); releaseWake()
    phaseRef.current = 'done'
    setPhase('done'); setRemaining(0)
  }

  const tick = useCallback((now) => {
    if (!pausedRef.current) {
      const dt = Math.min(now - lastRef.current, 1000)   // 백그라운드 복귀 시 점프 방지
      elapsedRef.current += dt
    }
    lastRef.current = now
    const elapsedSec = elapsedRef.current / 1000
    setRemaining(Math.max(0, Math.ceil(totalSec - elapsedSec)))
    setBreath(breathAt(elapsedSec))
    if (elapsedSec >= totalSec) { finish(); return }
    rafRef.current = requestAnimationFrame(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = async () => {
    elapsedRef.current = 0
    lastRef.current = performance.now()
    pausedRef.current = false; setPaused(false)
    phaseRef.current = 'running'
    setPhase('running')
    try {
      const a = new Audio(musicSrc); a.loop = true; a.volume = 0.7
      audioRef.current = a
      a.play().catch(() => { /* 음악 없어도 진행(시각 가이드만) */ })
    } catch { /* noop */ }
    acquireWake()
    rafRef.current = requestAnimationFrame(tick)
  }

  const resume = () => {
    pausedRef.current = false; setPaused(false)
    lastRef.current = performance.now()
    try { audioRef.current?.play?.() } catch { /* noop */ }
    acquireWake()   // 백그라운드에서 wake lock 해제됐을 수 있음
  }

  // 이탈/백그라운드 → 일시정지 (오디오·wake 정지, 돌아오면 「이어서」)
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && phaseRef.current === 'running' && !pausedRef.current) {
        pausedRef.current = true; setPaused(true)
        stopAudio(); releaseWake()
      }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onHide)
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('blur', onHide) }
  }, [])

  // 언마운트 정리
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); stopAudio(); releaseWake() }, [])

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-gradient-to-b from-[#0e3a2e] via-[#124a3a] to-[#0b2f26] text-white select-none">
      {/* 상단 — 닫기 + 제목 */}
      <div className="flex items-center gap-2 px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)', paddingBottom: '0.5rem' }}>
        <button type="button" onClick={onClose} aria-label="닫기"
          className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-white/80 hover:bg-white/10 transition">
          <X className="w-5 h-5" />
        </button>
        <span className="text-[15px] font-bold text-white/90 truncate">{mission?.title || '명상'}</span>
        {phase === 'running' && <span className="ml-auto text-[15px] font-bold tabular-nums text-white/90">{fmtClock(remaining)}</span>}
      </div>

      {/* 본문 */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        {phase === 'ready' && (
          <>
            <img src="/icons/meditation/meditate.png" alt="" draggable="false"
              className="w-40 h-40 object-contain mb-8 drop-shadow-lg" />
            <h1 className="text-[22px] font-extrabold leading-snug mb-2">자리를 잡고 앉아<br />준비하세요</h1>
            <p className="text-[14px] text-white/70 leading-relaxed max-w-[300px] mb-1">
              {mission?.instruction || '편안한 자세로 어깨의 힘을 빼고, 준비되면 시작하세요.'}
            </p>
            <p className="text-[13px] text-white/50 mb-9">{Math.round(totalSec / 60 * 10) / 10}분 · 화면을 켜둔 채 진행해요</p>
            <button type="button" onClick={start}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-emerald-800 font-bold text-[16px] shadow-lg hover:bg-white/90 transition">
              <Play className="w-5 h-5" /> 시작하기
            </button>
          </>
        )}

        {phase === 'running' && (
          <>
            {/* 시각 호흡 가이드 — 원 확장/수축 */}
            <div className="relative w-64 h-64 flex items-center justify-center mb-6">
              <span className="absolute inset-0 rounded-full bg-white/5" />
              <span className="rounded-full bg-emerald-400/25 border border-emerald-300/40"
                style={{ width: 256, height: 256, transform: `scale(${breath.scale})`, willChange: 'transform' }} />
              <span className="absolute text-[17px] font-bold text-white/90">{paused ? '일시정지' : breath.label}</span>
            </div>
            <p className="text-[13px] text-white/50">{paused ? '화면을 벗어나 잠시 멈췄어요' : '안내에 따라 천천히 호흡하세요'}</p>

            {/* 일시정지 오버레이 — 이어서 */}
            {paused && (
              <div className="mt-6">
                <button type="button" onClick={resume}
                  className="px-6 py-3 rounded-2xl bg-white text-emerald-800 font-bold text-[15px] shadow-lg hover:bg-white/90 transition">
                  이어서 하기
                </button>
              </div>
            )}
          </>
        )}

        {phase === 'done' && (
          <>
            <div className="w-40 h-40 rounded-full bg-emerald-400/20 flex items-center justify-center mb-8">
              <Check className="w-16 h-16 text-emerald-300" strokeWidth={2.5} />
            </div>
            <h1 className="text-[22px] font-extrabold leading-snug mb-2">명상을 마쳤어요</h1>
            <p className="text-[14px] text-white/70 leading-relaxed max-w-[300px] mb-9">
              {Math.round(totalSec / 60 * 10) / 10}분 동안 수고했어요.<br />완료를 눌러 인증할게요.
            </p>
            <button type="button" onClick={onComplete} disabled={submitting}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-emerald-800 font-bold text-[16px] shadow-lg hover:bg-white/90 transition disabled:opacity-60">
              <Check className="w-5 h-5" /> {submitting ? '제출 중…' : '완료하고 인증하기'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default MeditationPlayer
