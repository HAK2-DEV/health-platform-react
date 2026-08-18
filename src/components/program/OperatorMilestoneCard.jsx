import { useMemo, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { playSuccessChime } from '../../lib/sound'

// 운영자 성취 축하 — 실제 마일스톤을 넘으면 격려. X로 닫기 전까지 계속 표시(방문마다 유지).
//   컨페티·사운드는 "새로 넘은 마일스톤"일 때만 1회 재생(연출 재생 기록), 이후엔 조용히 유지.
//   여러 지표(참여자·인증)가 동시에 넘으면 한 카드에 묶어서 축하. 「할 일」(노동)과 별개 보상.
const PARTICIPANT_MILES = [1, 5, 10, 20, 50, 100, 200, 500]
const VERIF_MILES = [1, 10, 50, 100, 300, 1000, 3000]

const dkey = (metric, id) => `dodam_opmile3_dis_${metric}_${id}`   // X로 닫은 레벨(영구)
const ckey = (metric, id) => `dodam_opmile3_cel_${metric}_${id}`   // 축하 연출 재생한 레벨
const getNum = (k) => { try { return Number(localStorage.getItem(k)) || 0 } catch { return 0 } }
const setNum = (k, v) => { try { localStorage.setItem(k, String(v)) } catch { /* 무시 */ } }
const highest = (miles, val) => { let m = 0; for (const x of miles) if (x <= val) m = x; return m }

const participantMsg = (n) => n === 1
  ? { icon: '/icons/cheer/people.png', emoji: '🎉', title: '첫 참여자가 함께해요!', body: '프로그램의 첫 동행자예요. 잘 이끌어봐요!' }
  : { icon: '/icons/cheer/people.png', emoji: '🙌', title: `참여자 ${n}명 돌파!`, body: '프로그램이 점점 커지고 있어요.' }
const verifMsg = (n) => n === 1
  ? { icon: '/icons/growth/sprout.png', emoji: '🌱', title: '첫 인증이 올라왔어요!', body: '프로그램이 살아났어요 — 첫 물꼬를 텄어요.' }
  : { icon: '/icons/running/flame.png', emoji: '🔥', title: `누적 인증 ${n}건!`, body: '참여자들이 열심히 하고 있어요.' }

// 컨페티 — 아이콘 주변에서 사방으로 터지는 3D 파티클. index 기반 결정적 궤적.
const CONFETTI = Array.from({ length: 16 }, (_, i) => {
  const ang = (-90 + (i / 16) * 360) * (Math.PI / 180)
  const dist = 46 + (i % 4) * 15
  return {
    x: Math.round(Math.cos(ang) * dist),
    y: Math.round(Math.sin(ang) * dist * 0.82) - 6,
    src: `/icons/reward/particle-${(i % 3) + 1}.png`,
    rot: (i % 2 ? 1 : -1) * (140 + (i % 5) * 45),
    delay: (i % 6) * 0.018,
  }
})

function Icon3D({ src, emoji, cls, emojiCls }) {
  const [err, setErr] = useState(false)
  if (err) return <span className={emojiCls}>{emoji}</span>
  return <img src={src} alt="" aria-hidden="true" onError={() => setErr(true)} className={cls} />
}

export default function OperatorMilestoneCard({ programId, participantCount = 0, verificationCount = 0, onClick }) {
  const [dismissed, setDismissed] = useState(false)

  // 표시할 마일스톤 — 지표별 가장 높은 것 중, X로 닫지 않은 레벨. 여러 지표면 묶음.
  const items = useMemo(() => {
    if (!programId) return []
    const out = []
    const vMile = highest(VERIF_MILES, verificationCount)
    if (vMile > 0 && vMile > getNum(dkey('v', programId))) out.push({ metric: 'v', mile: vMile, ...verifMsg(vMile) })
    const pMile = highest(PARTICIPANT_MILES, participantCount)
    if (pMile > 0 && pMile > getNum(dkey('p', programId))) out.push({ metric: 'p', mile: pMile, ...participantMsg(pMile) })
    return out
  }, [programId, participantCount, verificationCount])

  // 새로 넘은 마일스톤(연출 미재생)일 때만 컨페티·사운드·글로우. 이후 방문은 조용히 유지.
  const celebrate = useMemo(
    () => items.some((it) => it.mile > getNum(ckey(it.metric, programId))),
    [items, programId],
  )

  useEffect(() => {
    if (!items.length) return
    items.forEach((it) => setNum(ckey(it.metric, programId), it.mile))   // 연출 재생 기록
    if (celebrate) { try { playSuccessChime() } catch { /* 무시 */ } }
  }, [items, celebrate, programId])

  if (!items.length || dismissed) return null
  const multi = items.length > 1
  const head = multi
    ? { icon: '/icons/cheer/trophy.png', emoji: '🏆', title: '큰 진전이에요!', body: '오늘 이만큼 나아갔어요.' }
    : items[0]

  const handleDismiss = (e) => {
    e.stopPropagation()
    items.forEach((it) => setNum(dkey(it.metric, programId), it.mile))   // X = 이 레벨 영구 닫기
    setDismissed(true)
  }

  return (
    <motion.div
      key={items.map((it) => `${it.metric}${it.mile}`).join('_')}   // 마일스톤 바뀌면 remount → 연출 재생(실시간)
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={celebrate
        ? { opacity: 1, scale: 1, y: 0, boxShadow: ['0 0 0 0 rgba(16,185,129,0)', '0 0 28px 5px rgba(16,185,129,0.5)', '0 0 0 0 rgba(16,185,129,0)'] }
        : { opacity: 1, scale: 1, y: 0 }}
      transition={celebrate
        ? { default: { type: 'spring', stiffness: 320, damping: 20 }, boxShadow: { duration: 1.5, repeat: 2, ease: 'easeInOut' } }
        : { type: 'spring', stiffness: 340, damping: 26 }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`relative rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 p-4 overflow-visible ${onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''}`}
    >
      <button type="button" onClick={handleDismiss} aria-label="닫기"
        className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full text-emerald-500/70 hover:bg-white/60 flex items-center justify-center">
        <X className="w-4 h-4" />
      </button>

      <div className={`flex ${multi ? 'items-start' : 'items-center'} gap-3.5`}>
        {/* 대표 아이콘 + (새 마일스톤이면) 컨페티 버스트 */}
        <div className="relative flex-shrink-0 w-14 h-14">
          {celebrate && CONFETTI.map((c, i) => (
            <motion.img
              key={i} src={c.src} alt="" aria-hidden="true"
              className="absolute left-1/2 top-1/2 w-3 h-3 -ml-1.5 -mt-1.5"
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.3, rotate: 0 }}
              animate={{ x: c.x, y: c.y, opacity: [0, 1, 1, 0], scale: [0.3, 1, 1, 0.85], rotate: c.rot }}
              transition={{ duration: 1.15, delay: 0.12 + c.delay, ease: 'easeOut' }}
            />
          ))}
          <motion.div
            className="relative w-14 h-14 flex items-center justify-center"
            initial={{ scale: celebrate ? 0 : 0.85, rotate: celebrate ? -28 : 0 }}
            animate={celebrate ? { scale: [0, 1.28, 0.96, 1], rotate: [-28, 10, -4, 0] } : { scale: 1, rotate: 0 }}
            transition={{ duration: celebrate ? 0.66 : 0.3, delay: 0.06, ease: 'easeOut' }}
          >
            <Icon3D src={head.icon} emoji={head.emoji} cls="w-14 h-14 object-contain drop-shadow" emojiCls="text-[34px] leading-none" />
          </motion.div>
        </div>

        <div className="flex-1 min-w-0">
          <motion.p className="text-[15.5px] font-extrabold text-emerald-900 break-keep"
            initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            {head.title}
          </motion.p>

          {multi ? (
            <div className="mt-1.5 space-y-1">
              {items.map((it, i) => (
                <motion.div key={it.metric} className="flex items-center gap-1.5"
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 + i * 0.08 }}>
                  <Icon3D src={it.icon} emoji={it.emoji} cls="w-5 h-5 object-contain flex-shrink-0" emojiCls="text-[15px] leading-none" />
                  <span className="text-[13px] font-bold text-emerald-800 break-keep">{it.title}</span>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.p className="text-[12.5px] text-emerald-700/80 mt-0.5 leading-snug break-keep"
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 }}>
              {head.body}
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
