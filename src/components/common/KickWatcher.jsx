import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { queryKeys, fetchActivePrograms } from '../../lib/queries'
import { useAuth } from '../../hooks/useAuth'
import { getSelfLeft, consumeSelfLeft } from '../../lib/kickState'

// 전역 강퇴 감지 — 어느 화면(대시보드 포함)에 있어도 운영자가 내보내면 안내 팝업.
//   원리: 본인 ACTIVE 참여 프로그램 목록(fetchActivePrograms)을 localStorage 스냅샷과 비교.
//     이전엔 ACTIVE 였는데 지금 목록에서 사라졌고 + 본인이 스스로 나간 것도 아니면 = 강퇴.
//   Realtime(program_participants) 이 이 쿼리를 무효화 → 재요청 시 ≤0.5초 감지.
//   Realtime 이 누락돼도 창 포커스/주기적 재요청(폴백)으로 뒤늦게라도 잡는다.
//   앱을 꺼둔 사이 강퇴돼도 다음 실행 때 스냅샷 비교로 1회 안내한다.
const SNAP_KEY = (userId) => `kick-snap-${userId}`

export default function KickWatcher() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id
  const [kicked, setKicked] = useState(null)   // { id, name } | null

  const { data: activePrograms, isSuccess } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
    refetchOnWindowFocus: true,          // Realtime 누락 대비 — 다시 볼 때 확인
    refetchInterval: 60000,              // 폴백 — 최대 60초 안에는 감지
  })

  useEffect(() => {
    if (!userId || !isSuccess || !Array.isArray(activePrograms)) return

    const currentIds = new Set(activePrograms.map((p) => p.id))
    let prev
    try { prev = JSON.parse(localStorage.getItem(SNAP_KEY(userId)) || '{}') } catch { prev = {} }
    const selfLeft = getSelfLeft(userId)

    // 이전 ACTIVE 중 지금 사라진 프로그램 = 강퇴 후보. 자진 이탈은 소비하고 건너뜀.
    if (!kicked) {
      for (const [pid, name] of Object.entries(prev)) {
        if (currentIds.has(pid)) continue
        if (selfLeft.has(pid)) { consumeSelfLeft(userId, pid); continue }
        // 외부(운영자) 변경에 반응하는 감지 — 의도된 effect 내 setState.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setKicked({ id: pid, name: name || '프로그램' })
        break
      }
    }

    // 스냅샷을 현재 ACTIVE 로 갱신(이름 포함). 다음 비교의 기준.
    const snap = {}
    for (const p of activePrograms) snap[p.id] = p.name
    try { localStorage.setItem(SNAP_KEY(userId), JSON.stringify(snap)) } catch { /* 미지원 */ }
  }, [activePrograms, isSuccess, userId, kicked])

  const close = () => setKicked(null)

  return (
    <AnimatePresence>
      {kicked && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50" onClick={close} />
          <motion.div
            className="relative w-full max-w-sm bg-white rounded-3xl p-6 text-center shadow-2xl"
            initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            <div className="text-4xl mb-2 leading-none">👋</div>
            <h3 className="text-lg font-extrabold text-gray-900">프로그램에서 나가게 됐어요</h3>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              <b className="text-gray-800">{kicked.name}</b> 운영자가 회원님을<br />이 프로그램에서 <b>내보냈어요.</b><br />그동안 함께해줘서 고마워요.
            </p>
            <button
              type="button"
              onClick={() => { close(); navigate('/dashboard') }}
              className="mt-5 w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition"
            >
              확인
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
