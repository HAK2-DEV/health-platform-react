// 간단한 효과음 — Web Audio 로 합성 (음원 파일 없이, 오프라인 OK).
//   모바일은 사용자 제스처 안에서 AudioContext 가 unlock 돼야 소리가 남 →
//   버튼 클릭 시 primeAudio() 로 미리 resume, 성공 시 playSuccessChime() 재생.

let _ctx = null
const getCtx = () => {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!_ctx) {
    try { _ctx = new AC() } catch { return null }
  }
  return _ctx
}

// 사용자 제스처(버튼 클릭 등)에서 호출 — 모바일 오디오 잠금 해제
export const primeAudio = () => {
  const ctx = getCtx()
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
}

// 성공 차임 — C5·E5·G5 짧은 상승 아르페지오
export const playSuccessChime = () => {
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const now = ctx.currentTime
  const notes = [523.25, 659.25, 783.99]   // C5 E5 G5
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t0 = now + i * 0.085
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(0.2, t0 + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + 0.32)
  })
}
