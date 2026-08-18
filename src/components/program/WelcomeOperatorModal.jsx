import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../supabaseClient'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Check, Bell } from 'lucide-react'
import { getPushState, subscribeToPush } from '../../lib/push'
import Confetti from '../common/Confetti'
import { playSuccessChime } from '../../lib/sound'

// 첫 프로그램 발행 직후 1회 표시되는 운영자 환영 투어 (전체화면 A안).
//   구조: 감정 환영(코드) → 전체화면 코치마크 이미지들 → 행동 CTA(코드).
//   이미지: 흐림+하이라이트+말풍선이 baked 된 완성 이미지를 full-bleed 로 표시(실제 화면 100% 크기감).
//   flag 필드 있으면 해당 기능을 켠 프로그램만 노출(적응형). 없으면 항상.
const TOUR = [
  // A. 프로그램 홈 (항상)
  { src: '/onboarding/operator-tour/01-settings.png' },
  { src: '/onboarding/operator-tour/02-invite.png' },
  { src: '/onboarding/operator-tour/03-goal.png' },
  { src: '/onboarding/operator-tour/04-notice.png' },
  { src: '/onboarding/operator-tour/05-overview-edit.png' },
  // B. 운영자 관리 ⚙️ (항상)
  { src: '/onboarding/operator-tour/06-program-settings.png' },
  { src: '/onboarding/operator-tour/07-notification.png', action: 'push' },
  { src: '/onboarding/operator-tour/08-stats.png' },
  { src: '/onboarding/operator-tour/09-report.png' },
  { src: '/onboarding/operator-tour/10-approve.png' },
  // C. 메뉴바 설정 — 미션·메뉴바는 항상, 나머지는 켠 기능만(적응형)
  { src: '/onboarding/operator-tour/11-menubar.png' },
  { src: '/onboarding/operator-tour/12-mission.png' },
  { src: '/onboarding/operator-tour/13-quiz.png', flag: 'quiz_enabled' },
  { src: '/onboarding/operator-tour/14-community.png', flag: 'community_enabled' },
  { src: '/onboarding/operator-tour/15-ranking.png', flag: 'ranking_enabled' },
  { src: '/onboarding/operator-tour/16-class.png', flag: 'class_feature_enabled' },
]

function WelcomeOperatorModal({ isOpen, onClose, programId, initialStep = 0 }) {
  useBodyScrollLock(isOpen)
  const navigate = useNavigate()
  const [step, setStep] = useState(initialStep)
  const [dir, setDir] = useState(1)
  const startX = useRef(null)

  // 적응형 — 방금 만든 프로그램의 기능 플래그(켠 기능만 코치마크 노출)
  const { data: flags } = useQuery({
    queryKey: ['welcome-flags', programId],
    queryFn: async () => {
      const { data } = await supabase.from('programs')
        .select('quiz_enabled, community_enabled, feed_enabled, ranking_enabled, class_feature_enabled')
        .eq('id', programId).maybeSingle()
      return data || {}
    },
    enabled: isOpen && !!programId,
  })

  // 알림 슬라이드 — 실제 폰 푸시 켜기(권한 요청 + 구독). 설명만 하던 슬라이드에 CTA 추가.
  const [pushState, setPushState] = useState(null)   // 'subscribed' | 'unsubscribed' | 'denied' | 'unsupported' | 'nokey'
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  useEffect(() => {
    if (!isOpen) return
    getPushState().then(setPushState).catch(() => {})
  }, [isOpen])

  // 인트로 진입 시 빵빠레 합성음 1회 — 팝인/컨페티와 싱크되게 살짝 지연
  useEffect(() => {
    if (!isOpen || initialStep !== 0) return
    const t = setTimeout(() => playSuccessChime(), 350)
    return () => clearTimeout(t)
  }, [isOpen, initialStep])
  const enablePush = async () => {
    setPushMsg(''); setPushBusy(true)
    try {
      await subscribeToPush()
      setPushState('subscribed')
    } catch (e) {
      setPushMsg(e?.message || '알림을 켜지 못했어요')
      getPushState().then(setPushState).catch(() => {})
    } finally {
      setPushBusy(false)
    }
  }

  if (!isOpen) return null

  // flag 있는 스텝은 켠 기능만. flags 로딩 전(또는 programId 없음=미리보기)엔 일단 다 표시.
  const flagOn = (flag) => {
    const f = flags
    if (!f) return true
    if (flag === 'quiz_enabled') return f.quiz_enabled !== false
    if (flag === 'community_enabled') return Object.prototype.hasOwnProperty.call(f, 'community_enabled') ? f.community_enabled !== false : !!f.feed_enabled
    if (flag === 'ranking_enabled') return f.ranking_enabled !== false
    if (flag === 'class_feature_enabled') return f.class_feature_enabled === true
    return true
  }
  const steps = TOUR.filter(t => !t.flag || flagOn(t.flag))

  const TOTAL = steps.length + 2          // intro + 코치마크 + outro
  const isIntro = step === 0
  const isOutro = step === TOTAL - 1
  const tourIdx = step - 1                // 1..steps.length 일 때 유효

  const go = (n) => { setDir(n > step ? 1 : -1); setStep(Math.max(0, Math.min(TOTAL - 1, n))) }
  const finish = (dest) => { onClose(); if (dest) navigate(dest) }

  const onDown = (e) => { startX.current = e.clientX }
  const onUp = (e) => {
    if (startX.current == null) return
    const dx = e.clientX - startX.current
    startX.current = null
    if (Math.abs(dx) > 40) { if (dx < 0 && step < TOTAL - 1) go(step + 1); else if (dx > 0 && step > 0) go(step - 1) }
  }

  const slide = {
    initial: (d) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
    animate: { opacity: 1, x: 0 },
    exit: (d) => ({ opacity: 0, x: d > 0 ? -40 : 40 }),
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/70">
      <div className="relative w-full max-w-md mx-auto h-full bg-white overflow-hidden flex flex-col select-none">

        {/* 상단 — 진행바 + 건너뛰기 */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2" style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}>
          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${((step + 1) / TOTAL) * 100}%` }} />
          </div>
          <button type="button" onClick={() => finish()} className="text-[13px] font-semibold text-gray-400 hover:text-gray-600 flex-shrink-0">건너뛰기</button>
        </div>

        {/* 본문 */}
        <div className="flex-1 relative overflow-hidden bg-white" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { startX.current = null }}>
          {/* 코치마크 이미지 — 전부 미리 마운트(디코딩)해 두고 현재 것만 표시 → 넘길 때 재로딩·흰 깜빡임 없음 */}
          {steps.map((s, i) => (
            <img key={s.src} src={s.src} alt="" draggable="false"
              className={`absolute inset-0 w-full h-full object-contain pointer-events-none ${(!isIntro && !isOutro && i === tourIdx) ? 'opacity-100' : 'opacity-0'}`} />
          ))}
          <AnimatePresence mode="wait" custom={dir}>
            {isIntro ? (
              <motion.div key="intro" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.28 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
                <motion.img src="/icons/operator/celebrate1.png" alt="" draggable="false"
                  className="w-44 h-44 object-contain mb-5"
                  initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 14, delay: 0.1 }}
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/icons/growth/sprout.png' }} />
                <h1 className="text-[30px] font-extrabold text-gray-900 leading-tight">첫 프로그램을 만드셨어요</h1>
                <p className="mt-4 text-[17px] leading-relaxed text-gray-500 max-w-[320px]">
                  이제 당신은 누군가의 <b className="text-emerald-600 font-bold">건강 동행자</b>예요.<br />
                  운영은 어렵지 않아요 <br />
                  주요 기능만 30초 안에 짚어드릴게요.
                </p>
                <button type="button" onClick={() => go(1)}
                  className="mt-9 w-full max-w-[320px] py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[16px] transition">
                  둘러보기 시작 →
                </button>
                {/* 빵빠레 — 인트로에서만, 5초간 흩날림(위로 겹쳐도 클릭 통과) */}
                <Confetti count={26} fall={700} durationMs={5000} />
              </motion.div>
            ) : isOutro ? (
              <motion.div key="outro" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.28 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
                <motion.img src="/icons/operator/celebrate2.png" alt="" draggable="false"
                  className="w-36 h-36 object-contain mb-4"
                  initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.05 }}
                  onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('div'), { textContent: '🎉', className: 'text-6xl mb-4' })) }} />
                <h1 className="text-[26px] font-extrabold text-gray-900 leading-tight">준비 완료!</h1>
                <p className="mt-3 text-[19px] font-extrabold leading-snug text-gray-900 max-w-[300px] break-keep">
                  미션을 만들어야<br />참여자가 인증할 수 있어요.
                </p>
                <p className="mt-2.5 text-[14px] leading-relaxed text-gray-500 max-w-[300px]">
                  먼저 첫 미션을 추가하고 초대해볼까요?
                </p>
                <button type="button" onClick={() => finish(programId ? `/programs/${programId}?addmission=1` : '/programs')}
                  className="mt-8 w-full max-w-[300px] py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition">
                  첫 미션 만들러 가기 →
                </button>
                <button type="button" onClick={() => finish()}
                  className="mt-2 w-full max-w-[300px] py-3 rounded-2xl bg-emerald-50 text-emerald-700 font-bold transition">
                  나중에 할게요
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* 좌우 화살표 — 코치마크 단계에서만 */}
          {!isIntro && (
            <button type="button" onClick={() => go(step - 1)} aria-label="이전"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 shadow-md flex items-center justify-center text-gray-600 hover:bg-white">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {!isOutro && !isIntro && (
            <button type="button" onClick={() => go(step + 1)} aria-label="다음"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-emerald-500 shadow-md flex items-center justify-center text-white hover:bg-emerald-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* 알림 슬라이드 — 실제 폰 푸시 켜기 CTA (설명만 하던 화면에서 그 자리에서 켬) */}
          {!isIntro && !isOutro && steps[tourIdx]?.action === 'push' && (
            <div className="absolute left-0 right-0 bottom-5 flex flex-col items-center gap-2 px-10 z-20">
              {pushState === 'subscribed' ? (
                <div className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold shadow-lg">
                  <Check className="w-4 h-4" /> 폰 알림이 켜졌어요
                </div>
              ) : pushState === 'denied' ? (
                <p className="text-[12px] text-gray-600 bg-white/95 rounded-xl px-3.5 py-2 shadow text-center leading-relaxed max-w-[300px]">
                  알림이 차단돼 있어요. <b>브라우저·기기 설정</b>에서 이 앱의 알림을 허용해주세요.
                </p>
              ) : (pushState === 'unsupported' || pushState === 'nokey') ? (
                <p className="text-[12px] text-gray-500 bg-white/95 rounded-xl px-3.5 py-2 shadow text-center leading-relaxed max-w-[300px]">
                  이 환경에선 폰 푸시를 켤 수 없어요. <b>홈 화면에 추가한 앱</b>에서 다시 시도해보세요.
                </p>
              ) : (
                <button type="button" onClick={enablePush} disabled={pushBusy}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-[15px] font-bold shadow-xl transition disabled:opacity-60">
                  <Bell className="w-4 h-4" /> {pushBusy ? '켜는 중…' : '지금 폰 알림 켜기'}
                </button>
              )}
              {pushMsg && pushState !== 'denied' && (
                <p className="text-[12px] text-rose-600 bg-white/95 rounded-xl px-3.5 py-2 shadow text-center max-w-[300px]">{pushMsg}</p>
              )}
            </div>
          )}
        </div>

        {/* 하단 — 점 */}
        <div className="flex items-center justify-center gap-1.5 py-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <button key={i} type="button" onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-emerald-500' : 'w-1.5 bg-gray-200'}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default WelcomeOperatorModal
