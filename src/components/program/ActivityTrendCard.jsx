import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchMyActivitySeries, fetchMyWeeklyReport, fetchMyActivityBreakdown } from '../../lib/queries'
import ActivityRadarChart from './ActivityRadarChart'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import ParticipationTrendChart from './ParticipationTrendChart'
import { Icon3D } from './ProgramHome'

// 「내 활동」 — 개요 얇은 바 → 중앙 팝업. 궤적(누적/주간) + 지난 주 회고(리포트 통합) + 오늘 인증 상태.
//   지난 주 리포트를 흡수(개요 배너 통합). 새 리포트 미열람이면 바에 「리포트 도착 ✨」 배지.
const DEV = import.meta.env.DEV
const md = (ds) => { const p = String(ds).split('-'); return `${+p[1]}/${+p[2]}` }
function weekKey() { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10) }
function encourage(r) {
  const acted = r.missionCount + r.quizCount + r.postCount + r.commentCount + r.classCount
  if (acted === 0) return '지난 주는 잠깐 쉬어갔네요. 이번 주 가볍게 다시 시작해봐요 🌱'
  if (r.activeDays >= 5) return `지난 주 ${r.activeDays}일이나 함께했어요 🔥 이번 주도 화이팅!`
  if (r.missionCount > 0) return `지난 주 ${r.missionCount}번 인증했어요 👍 이번 주도 힘내요!`
  return '지난 주도 함께해줘서 고마워요. 이번 주도 응원해요 💪'
}

function CenterPopup({ open, onClose, children }) {
  useBodyScrollLock(open)
  useBackButtonClose(open, onClose)
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/45" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl max-h-[86vh] overflow-y-auto"
            initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function WeeklyBars({ data }) {
  const max = Math.max(5, ...data.map((d) => d.count))
  const n = data.length
  const dip = n > 1 && data[n - 1].count < data[n - 2].count
  const BAR_AREA = 104
  return (
    <div className="h-[150px] flex items-end gap-1.5 pt-2">
      {data.map((d, i) => {
        const isLast = i === n - 1
        const active = d.count > 0
        const color = isLast && dip ? '#f43f5e' : '#10b981'
        const barPx = Math.max(3, Math.round((d.count / max) * BAR_AREA))
        return (
          <div key={i} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end">
            <span className="text-[9.5px] font-extrabold mb-1 tabular-nums" style={{ color: active ? color : '#cbd5cb' }}>{d.count}</span>
            <div className="w-full max-w-[20px] rounded-t-[5px]" style={{ height: `${barPx}px`, background: active ? color : '#e6ece8', opacity: isLast ? 1 : 0.82 }} />
            <span className="text-[9px] text-gray-400 mt-1.5 truncate w-full text-center">{isLast ? '이번' : i === n - 2 ? '지난' : md(d.date)}</span>
          </div>
        )
      })}
    </div>
  )
}

function RecapRow({ src, emoji, label, n, unit }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <Icon3D src={src} emoji={emoji} className="w-5 h-5 flex-shrink-0" />
      <span className="flex-1 text-[12.5px] text-gray-600">{label}</span>
      <span className={`text-[13px] font-extrabold tabular-nums ${n > 0 ? 'text-gray-800' : 'text-gray-300'}`}>{n}<span className="text-[10px] font-bold text-gray-400 ml-0.5">{unit}</span></span>
    </div>
  )
}

function WeeklyRecap({ r }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 mb-3 items-stretch">
        <div className="rounded-xl bg-orange-50 px-3 py-2.5">
          <div className="flex items-center gap-1"><Icon3D src="/icons/feature/streak.png" emoji="🔥" className="w-5 h-5" /><span className="text-[11px] font-semibold text-orange-700/80">지난 주 활동</span></div>
          <p className="text-[17px] font-extrabold text-orange-600 leading-tight mt-0.5">{r.activeDays}<span className="text-[11px] font-bold">일</span><span className="text-[10px] font-bold text-orange-400 ml-0.5">/7</span></p>
          <div className="flex items-center justify-between gap-0.5 mt-1.5">
            {r.weekDays.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center ${d.done ? 'bg-emerald-500 text-white' : 'bg-white text-gray-300 ring-1 ring-gray-200'}`}><Check className="w-2.5 h-2.5" /></span>
                <span className="text-[8px] text-gray-400 leading-none">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-emerald-50 px-3 py-2.5 flex flex-col">
          <div className="flex items-center gap-1.5"><Icon3D src="/icons/feature/point.png" emoji="⭐" className="w-6 h-6" /><span className="text-[11px] font-semibold text-emerald-700/80">지난 주 포인트</span></div>
          <div className="flex-1 flex items-center"><p className="text-[24px] font-extrabold text-emerald-700 leading-none">+{r.weekPoints}<span className="text-[13px] font-bold">P</span></p></div>
        </div>
      </div>
      <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
        <RecapRow src="/icons/feature/mission.png" emoji="🌱" label="미션 인증" n={r.missionCount} unit="건" />
        <RecapRow src="/icons/feature/quiz.png" emoji="❓" label="퀴즈 참여" n={r.quizCount} unit="개" />
        <RecapRow src="/icons/feature/community.png" emoji="💬" label="커뮤니티 글" n={r.postCount} unit="개" />
        <RecapRow src="/icons/mypage/comments.png" emoji="✍️" label="댓글" n={r.commentCount} unit="개" />
        {r.classCount > 0 && <RecapRow src="/icons/feature/attendance.png" emoji="📅" label="클래스 출석" n={r.classCount} unit="회" />}
      </div>
      <p className="text-[12px] text-gray-600 leading-relaxed bg-gray-50 rounded-lg px-3 py-2.5 mt-3 break-keep">{encourage(r)}</p>
    </div>
  )
}

export default function ActivityTrendCard({ programId, userId, onCertify, todayState = 'open', quizEnabled = false, communityEnabled = true }) {
  const [mode, setMode] = useState('cumulative')
  const [open, setOpen] = useState(false)
  const [chartPage, setChartPage] = useState(0)   // 0=누적 추이, 1=활동 구성 레이더 (좌우 슬라이드)
  // 등장 애니메이션 — 처음엔 아이콘만 감싼 작은 박스 → 옆으로 펼쳐지며 칩이 채워짐.
  //   다른 오버레이(모달 등)가 먼저 떠 있으면(=body 스크롤 잠금 position:fixed) 닫힐 때까지
  //   대기했다가, 정리된 뒤에 등장 애니메이션을 재생한다.
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    let cancelled = false
    let timer
    const tick = () => {
      if (cancelled) return
      if (document.body.style.position === 'fixed') { timer = setTimeout(tick, 160); return }  // 오버레이 열림 → 대기
      timer = setTimeout(() => { if (!cancelled) setExpanded(true) }, 320)                       // 정리됨 → 등장
    }
    tick()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])
  const seenK = `atc-report-seen:${programId}`
  const [reportSeen, setReportSeen] = useState(() => { try { return localStorage.getItem(seenK) === weekKey() } catch { return true } })
  // 지난 주 리포트를 실제로 보면(배지 클릭 or 토글) 배지 해제.
  useEffect(() => {
    if (open && mode === 'lastweek' && !reportSeen) {
      try { localStorage.setItem(seenK, weekKey()) } catch { /* noop */ }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReportSeen(true)
    }
  }, [open, mode, reportSeen, seenK])

  const { data, isLoading } = useQuery({
    queryKey: ['my-activity-series', programId, userId],
    queryFn: () => fetchMyActivitySeries(programId, userId),
    enabled: !!programId && !!userId,
  })
  const { data: report } = useQuery({
    queryKey: ['my-weekly-report', programId, userId],
    queryFn: () => fetchMyWeeklyReport(programId, userId),
    enabled: !!programId && !!userId,
  })
  // 활동 구성(레이더) — 누적 뷰를 열 때만 조회(지연 로드).
  const { data: breakdown } = useQuery({
    queryKey: ['my-activity-breakdown', programId, userId],
    queryFn: () => fetchMyActivityBreakdown(programId, userId),
    enabled: !!programId && !!userId && open && mode === 'cumulative',
  })

  if (isLoading) return <div className="h-[54px] rounded-xl bg-white border border-gray-100 animate-pulse" />
  if (!data) return null

  const { cumulative, weekly, totalCount, activeDays, streak, thisWeek, lastWeek } = data
  const hasReport = !!report && (report.activeDays > 0 || report.weekPoints > 0 || report.missionCount > 0 || report.quizCount > 0 || report.postCount > 0 || report.commentCount > 0 || report.classCount > 0)
  const reportBadge = hasReport && (DEV || !reportSeen)
  // 활동 구성 레이더 슬라이드 표시 여부 — 축(가능한 활동)이 3개 이상일 때만.
  const radarAxisCount = 1 + (quizEnabled ? 1 : 0) + (communityEnabled ? 3 : 0)
  const showRadar = !!breakdown && radarAxisCount >= 3
  const lowData = totalCount < 4
  const up = thisWeek >= lastWeek
  const stalled = thisWeek === 0
  const note = lowData
    ? { tone: 'good', icon: '🌱', text: <>좋은 시작이에요! <b>오늘도</b> 이어가볼까요?</> }
    : stalled
      ? { tone: 'slow', icon: '🌱', text: <>이번 주 아직이에요. <b>오늘 하나만</b> 다시 시작해볼까요?</> }
      : up
        ? { tone: 'good', icon: '🔥', text: <>이번 주도 꾸준해요. 이대로면 <b>완주까지 순항</b>이에요!</> }
        : { tone: 'slow', icon: '🌱', text: <>이번 주 페이스가 조금 느려졌어요. <b>오늘 하나만</b> 다시 시작해볼까요?</> }

  // 바 클릭 = 누적으로 열림. 「리포트 ✨」 배지만 지난 주 리포트로.
  const openPopup = (targetMode = 'cumulative') => { setMode(targetMode); setOpen(true) }

  const cta = todayState === 'open' ? (
    <button type="button" onClick={onCertify}
      className={`w-full h-11 rounded-xl text-white text-[14px] font-extrabold active:scale-[0.99] transition flex items-center justify-center gap-1 ${note.tone === 'good' ? 'bg-gradient-to-br from-emerald-400 to-emerald-500' : 'bg-gradient-to-br from-rose-300 to-rose-400'}`}>
      {totalCount === 0 ? '오늘 첫 인증하기' : note.tone === 'good' ? '오늘도 인증하기' : '오늘 하나만 인증하기'}<ChevronRight className="w-4 h-4" />
    </button>
  ) : todayState === 'pending' ? (
    <div className="w-full h-11 rounded-xl bg-amber-50 text-amber-700 text-[14px] font-extrabold flex items-center justify-center gap-1">⏳ 인증 심사 대기 중</div>
  ) : todayState === 'done' ? (
    <div className="w-full h-11 rounded-xl bg-emerald-50 text-emerald-700 text-[14px] font-extrabold flex items-center justify-center gap-1">오늘 인증 완료! 🎉</div>
  ) : (
    <div className="w-full h-11 rounded-xl bg-gray-50 text-gray-400 text-[13px] font-bold flex items-center justify-center">오늘은 인증할 미션이 없어요</div>
  )

  const showToggle = totalCount > 0 || hasReport

  return (
    <>
      {/* 얇은 한 줄 바 — 클릭 시 중앙 팝업. 등장 시 아이콘만 감싼 상태 → 옆으로 펼쳐짐 */}
      <motion.button type="button" onClick={() => openPopup('cumulative')}
        initial={false}
        animate={{ width: expanded ? '100%' : 44 }}
        transition={{ type: 'spring', stiffness: 140, damping: 26 }}
        style={{ willChange: 'width' }}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white border border-gray-100 shadow-soft text-left hover:bg-gray-50 overflow-hidden whitespace-nowrap">
        <Icon3D src="/icons/mypage/status.png" emoji="📈" className="w-7 h-7 flex-shrink-0" />
        <motion.div className="flex-1 flex items-center gap-2 min-w-0"
          animate={{ opacity: expanded ? 1 : 0 }}
          transition={{ duration: 0.3, delay: expanded ? 0.28 : 0 }}>
          <span className="flex-1 min-w-0 text-[13px] font-bold text-gray-800">내 활동</span>
          {todayState === 'pending' && <span className="text-[10.5px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">⏳ 심사 대기</span>}
          {todayState === 'done' && <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"><Check className="w-3 h-3" />인증 완료</span>}
          {reportBadge && (
            <span role="button" tabIndex={0}
              onClick={(e) => { e.stopPropagation(); openPopup('lastweek') }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); openPopup('lastweek') } }}
              className="text-[10.5px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap cursor-pointer hover:bg-violet-100 transition">
              리포트 ✨
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
        </motion.div>
      </motion.button>

      <CenterPopup open={open} onClose={() => setOpen(false)}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-3 gap-2">
            <p className="text-[15px] font-extrabold text-gray-800 flex items-center gap-1.5 flex-shrink-0"><span className="w-[7px] h-[7px] rounded-full bg-emerald-500 inline-block" />내 활동</p>
            {showToggle && (
              <div className="inline-flex bg-gray-50 border border-gray-100 rounded-full p-0.5">
                {[['cumulative', '누적'], ['weekly', '주간'], ['lastweek', '지난 주']].map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setMode(k)}
                    className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold transition ${mode === k ? 'bg-emerald-500 text-white' : 'text-gray-400'}`}>{label}</button>
                ))}
              </div>
            )}
          </div>

          {mode === 'lastweek' ? (
            hasReport ? <WeeklyRecap r={report} />
              : <p className="text-[13px] text-gray-400 py-10 text-center">지난 주 기록이 없어요.</p>
          ) : totalCount === 0 ? (
            <p className="text-[13px] text-gray-500 mb-4 leading-relaxed">첫 인증을 하면 여기에 <b className="text-emerald-600">활동 추이</b>가 쌓여요.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-xl bg-gray-50 px-2.5 py-2">
                  <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><span className="w-4 h-4 rounded bg-sky-50 inline-flex items-center justify-center text-[9px]">💧</span>누적 인증</p>
                  <p className="text-[19px] font-extrabold text-gray-800 tabular-nums leading-none mt-1">{totalCount}<span className="text-[11px] text-gray-400 ml-0.5">건</span></p>
                </div>
                <div className="rounded-xl bg-gray-50 px-2.5 py-2">
                  <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><span className="w-4 h-4 rounded bg-amber-50 inline-flex items-center justify-center text-[9px]">☀️</span>활동</p>
                  <p className="text-[19px] font-extrabold text-gray-800 tabular-nums leading-none mt-1">{activeDays}<span className="text-[11px] text-gray-400 ml-0.5">일</span></p>
                  <p className="text-[10px] text-gray-400 mt-1">{streak > 0 ? `🔥 연속 ${streak}일` : '연속 끊김'}</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-2.5 py-2">
                  <p className="text-[10px] font-bold text-gray-400">이번 주</p>
                  <p className={`text-[19px] font-extrabold tabular-nums leading-none mt-1 ${up ? 'text-emerald-600' : 'text-rose-500'}`}>{thisWeek}<span className="text-[11px] text-gray-400 ml-0.5">건</span></p>
                  <p className="text-[10px] text-gray-400 mt-1 tabular-nums">{up ? '▲' : '▼'} 지난주 {lastWeek}</p>
                </div>
              </div>
              {mode !== 'cumulative' ? (
                <div className="text-gray-300"><WeeklyBars data={weekly} /></div>
              ) : showRadar ? (
                // 누적 추이 ↔ 활동 구성 레이더 좌우 슬라이드 — 그래프 영역만 슬라이드(높이 유지 → CTA 안 밀림)
                <>
                  {/* 추이 ↔ 구성 슬라이드 탭 — 차트 바로 위 오른쪽. (라인 차트 좌우 스크럽과 충돌해 스와이프 대신 탭) */}
                  <div className="flex justify-end items-center gap-1 mb-1 -mt-1">
                    {['인증', '활동'].map((label, i) => (
                      <button key={i} type="button" onClick={() => setChartPage(i)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${chartPage === i ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:text-gray-500'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="overflow-hidden">
                    <motion.div className="flex items-stretch" animate={{ x: `-${chartPage * 100}%` }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
                      <div className="w-full flex-shrink-0 h-[196px] grid content-center text-gray-300">
                        <ParticipationTrendChart data={cumulative} field="count" unit="건" maxCap={Infinity} height={150} interaction="pan" fitAll />
                      </div>
                      <div className="w-full flex-shrink-0 h-[196px] grid place-items-center">
                        <ActivityRadarChart data={breakdown} quizEnabled={quizEnabled} communityEnabled={communityEnabled} />
                      </div>
                    </motion.div>
                  </div>
                </>
              ) : (
                <div className="text-gray-300"><ParticipationTrendChart data={cumulative} field="count" unit="건" maxCap={Infinity} height={150} interaction="pan" fitAll /></div>
              )}
              <div className={`flex gap-2 items-start rounded-xl px-3 py-2.5 mt-3 text-[12.5px] font-semibold leading-snug ${note.tone === 'good' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                <span className="text-[15px] leading-none flex-shrink-0">{note.icon}</span>
                <span className="break-keep">{note.text}</span>
              </div>
            </>
          )}

          <div className="mt-4">{cta}</div>
        </div>
      </CenterPopup>
    </>
  )
}
