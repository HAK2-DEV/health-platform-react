import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

// iOS Safari 설치 방법 — 화면 중앙 카드 UI(모달 아님).
//   온보딩(step 2)과 동일한 실제 스크린샷 + 스포트라이트 테두리(초록 halo) + 3D 손가락 탭 애니.
//   무스크롤: 한 번에 한 단계씩 좌우로 넘겨봄. spot/fin 좌표는 온보딩 IOS 배열과 동일.
const STEPS = [
  {
    src: '/onboarding/ios/2-share.png',
    cap: 'Safari 하단 가운데 <b>공유</b> 버튼을 눌러요',
    spot: { left: '30%', top: '49.8%', width: '66%', height: '5.4%' },
    fin: { left: '31%', top: '41%' },
  },
  {
    src: '/onboarding/ios/3-add-2.png',
    cap: '조금 내려서 <b>홈 화면에 추가</b>를 눌러요',
    spot: { left: '4%', top: '61.4%', width: '92%', height: '6.2%' },
    fin: { left: '52%', top: '55%' },
  },
  {
    src: '/onboarding/ios/4-confirm.png',
    cap: '오른쪽 위 <b>추가</b>를 누르면 완료! 🎉',
    spot: { left: '78%', top: '10.3%', width: '18%', height: '4.4%' },
    fin: { left: '73%', top: '1%' },
  },
]

const CSS = `
#iig-root{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.5);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);--g:#10b981;--gbr:#34d399}
#iig-root *{box-sizing:border-box}
#iig-root .iig-card{position:relative;background:#fff;border-radius:24px;box-shadow:0 24px 60px -20px rgba(0,0,0,.45);padding:22px 20px 18px;width:100%;max-width:360px;display:flex;flex-direction:column;align-items:center}
#iig-root .iig-x{position:absolute;top:12px;right:12px;color:#9aa79e;background:none;border:none;cursor:pointer;padding:4px;line-height:0}
#iig-root .iig-x:hover{color:#4b5563}
#iig-root .iig-title{font-size:18px;font-weight:800;color:#14261e;margin:0 0 12px}
#iig-root .iig-cap{display:flex;align-items:center;gap:8px;font-size:14px;color:#374151;line-height:1.4;margin:0 0 14px;min-height:24px;padding:0 6px}
#iig-root .iig-cap b{color:var(--g);font-weight:800;white-space:nowrap}
#iig-root .iig-num{flex-shrink:0;width:24px;height:24px;border-radius:99px;background:#d1fae5;color:#047857;font-weight:800;font-size:12px;display:grid;place-items:center}
#iig-root .iig-row{display:flex;align-items:center;gap:4px}
#iig-root .iig-frame{position:relative;aspect-ratio:640/1387;height:min(50vh,520px);max-width:74vw;width:auto;border-radius:30px;overflow:hidden;border:5px solid #111;box-shadow:0 10px 30px -12px rgba(16,185,129,.3);background:#fff;flex-shrink:0;animation:iigadv .4s cubic-bezier(.22,.75,.28,1) both}
@keyframes iigadv{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}
#iig-root .iig-shot{width:100%;height:100%;object-fit:cover;display:block;-webkit-user-drag:none;user-select:none;pointer-events:none}
#iig-root .iig-spot{position:absolute;border-radius:10px;box-shadow:0 0 0 3px var(--gbr);z-index:3}
#iig-root .iig-spot::after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:0 0 0 3px var(--gbr);animation:iighalo 1.5s ease-out infinite;will-change:transform,opacity}
@keyframes iighalo{0%{transform:scale(1);opacity:.6}70%,100%{transform:scale(1.3);opacity:0}}
#iig-root .iig-finger{position:absolute;z-index:4;width:42px;height:42px;object-fit:contain;filter:drop-shadow(0 5px 6px rgba(0,0,0,.35));animation:iigtap 1.5s ease-in-out infinite;pointer-events:none}
@keyframes iigtap{0%,100%{transform:translateY(4px)}50%{transform:translateY(-5px)}}
#iig-root .iig-nav{width:38px;height:38px;border-radius:99px;border:1px solid #e8ece9;background:#fff;color:#374151;display:grid;place-items:center;cursor:pointer;flex-shrink:0;box-shadow:0 3px 12px -6px rgba(16,185,129,.18);transition:.15s}
#iig-root .iig-nav.prim{background:var(--g);color:#fff;border-color:var(--g)}
#iig-root .iig-nav:disabled{opacity:0;pointer-events:none}
#iig-root .iig-dots{display:flex;gap:6px;margin-top:16px}
#iig-root .iig-dots button{height:6px;width:6px;border-radius:99px;background:#d1d5db;border:none;padding:0;cursor:pointer;transition:.2s}
#iig-root .iig-dots button.on{width:20px;background:var(--g)}
#iig-root .iig-note{margin-top:14px;font-size:11px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:7px 10px;text-align:center;line-height:1.5}
#iig-root .iig-note b{font-weight:800}
`

function InstallIOSSheet({ isOpen, onClose }) {
  const [i, setI] = useState(0)
  useBodyScrollLock(isOpen)

  useEffect(() => {
    if (isOpen) setI(0) // 열 때마다 처음부터
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const last = STEPS.length - 1
  const s = STEPS[i]
  const prev = () => setI((v) => Math.max(0, v - 1))
  const next = () => setI((v) => Math.min(last, v + 1))

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="iig-root"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <style>{CSS}</style>
          <motion.div
            className="iig-card"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300, mass: 0.8 }}
          >
            <button className="iig-x" onClick={onClose} aria-label="닫기">
              <X className="w-5 h-5" />
            </button>

            <h2 className="iig-title">iPhone에 설치하기</h2>

            <p className="iig-cap">
              <span className="iig-num">{i + 1}</span>
              <span dangerouslySetInnerHTML={{ __html: s.cap }} />
            </p>

            <div className="iig-row">
              <button className="iig-nav" onClick={prev} disabled={i === 0} aria-label="이전">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="iig-frame" key={i}>
                <img className="iig-shot" src={s.src} alt="" />
                <div className="iig-spot" style={s.spot} />
                <img className="iig-finger" src="/icons/onboarding/tap.png" style={s.fin} alt="" />
              </div>
              <button className="iig-nav prim" onClick={next} disabled={i === last} aria-label="다음">
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            <div className="iig-dots">
              {STEPS.map((_, idx) => (
                <button
                  key={idx}
                  className={idx === i ? 'on' : ''}
                  onClick={() => setI(idx)}
                  aria-label={`${idx + 1}단계`}
                />
              ))}
            </div>

            <p className="iig-note">
              ⚠️ 꼭 <b>Safari</b>로 열어주세요 (Chrome엔 이 메뉴가 없어요)
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default InstallIOSSheet
