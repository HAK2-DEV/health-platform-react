// 성장 탭 (하단 탭바 「성장」 진입).
//
// ⚠️ 3D 정원은 «로컬에서만» 켠다. import.meta.env.DEV 는 `npm run dev` 에서만 true 이고
//    프로덕션 빌드에선 false 라 배포본에는 준비 중 화면이 그대로 나간다.
//    나중에 특정 배포에서 켜보려면 코드 수정 없이 VITE_GROWTH_3D=1 만 주면 된다.
//
// ⚠️ 정원은 «프로그램마다» 하나다(각자의 정원). 이 페이지는 프로그램에 매이지 않으므로
//    어느 정원을 볼지 골라야 한다 — 하나뿐이면 바로 들어가고, 여럿이면 위에 전환기를 둔다.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { fetchMyPrograms, fetchActivePrograms } from '../lib/queries'

const GROWTH_3D = import.meta.env.DEV || import.meta.env.VITE_GROWTH_3D === '1'
const DevGrowthLab = lazy(() => import('./DevGrowthLab'))
const DevGrowthOperator = lazy(() => import('./DevGrowthOperator'))

// 섬 아이콘 — 그림은 떠 있는 섬이지만 부르는 이름은 「공유 정원」 이다.
// 정원은 «가꾸는 곳» 이라는 뜻을 담고(물 주기·자란다와 이어진다), «공유» 가
// 여럿의 꽃이 한곳에 모인다는 것을 설명한다. 설계 문서의 표현과도 맞는다.
const IslandIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3.5 15.5c2.6-3 5.4-4.5 8.5-4.5s5.9 1.5 8.5 4.5" />
    <path d="M3.5 15.5c2.4 1.6 5.2 2.4 8.5 2.4s6.1-.8 8.5-2.4" />
    <path d="M12 11V7.2" />
    <path d="M12 7.2c-1.3-1.5-2.9-2-4.2-1.4M12 7.2c1.3-1.5 2.9-2 4.2-1.4" />
  </svg>
)

function Placeholder({ note }) {
  return (
    <div className="max-w-md mx-auto px-6 min-h-[72vh] flex flex-col items-center justify-center text-center">
      <img src="/icons/growth/sprout.png" alt="" aria-hidden="true" className="w-28 h-28 object-contain mb-3" />
      <h1 className="text-xl font-extrabold text-gray-900">성장</h1>
      <p className="text-[14px] text-gray-500 mt-2 leading-relaxed break-keep">
        {note || <>준비 중인 기능이에요.<br />곧 나의 성장을 한눈에 볼 수 있어요</>}
      </p>
      <span className="mt-5 inline-flex items-center px-3.5 h-8 rounded-full bg-gray-100 text-gray-500 text-[12px] font-bold">준비중</span>
    </div>
  )
}

export default function GrowthPage() {
  const { session } = useAuth()
  const uid = session?.user?.id
  const [sp, setSp] = useSearchParams()
  const [list, setList] = useState(null)     // null = 아직 읽는 중
  const [open, setOpen] = useState(false)    // 정원 고르기 오버레이
  // ⚠️ app-main 은 pb-24(96px)를 예약하지만 «실제 탭바» 는 그보다 낮다(약 60px + 세이프에어리어).
  //    그 차이만큼 정원 아래에 흰 띠가 남는다. 추정하지 말고 실제 높이를 재서 쓴다.
  const [tabH, setTabH] = useState(96)
  useEffect(() => {
    const el = document.querySelector('[data-tabbar]')
    if (!el) return
    // ⚠️ 여기서 바로 부르면 «이펙트 안 동기 setState» 라 렌더가 연쇄된다.
    //    ResizeObserver 는 observe 시점에 한 번 알려주므로 초기값도 이걸로 받는다.
    const ro = new ResizeObserver(() => setTabH(el.getBoundingClientRect().height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!GROWTH_3D || !uid) return
    let alive = true
    Promise.all([fetchMyPrograms(uid).catch(() => []), fetchActivePrograms(uid).catch(() => [])])
      .then(([owned, joined]) => {
        if (!alive) return
        // ⚠️ 소유 판정은 «행의 owner_id» 로 한다. 목록 두 개를 대조하면
        //    한쪽 조회가 실패했을 때(catch → []) 조용히 전부 «참여 중» 이 된다.
        const own = new Set(owned.map((p) => p.id))
        const seen = new Map()
        ;[...owned, ...joined].forEach((p) => {
          if (!p?.id || seen.has(p.id)) return
          const name = (p.name || p.title || '').trim()
          seen.set(p.id, {
            id: p.id,
            name: name || '이름 없는 프로그램',
            isOwner: p.owner_id ? p.owner_id === uid : own.has(p.id),
            joinedAt: p._joinedAt || null,          // 참여한 시각(운영만 하는 프로그램은 없다)
          })
        })
        // ⚠️ 기본으로 열 정원은 «가장 최근에 참가한» 것이다.
        //    운영만 하는 프로그램(참여 안 함)은 내 꽃이 없으므로 뒤로 보낸다.
        setList([...seen.values()].sort((a, b) => {
          if (!!a.joinedAt !== !!b.joinedAt) return a.joinedAt ? -1 : 1
          if (a.joinedAt && b.joinedAt) return new Date(b.joinedAt) - new Date(a.joinedAt)
          return a.name.localeCompare(b.name)
        }))
      })
    return () => { alive = false }
  }, [uid])

  // 처음 열었을 때 무엇을 보여줄지 —
  //   · 참여 중인 프로그램이 있으면 «가장 최근에 참가한» 것 → 내 꽃 단독 뷰(DevGrowthLab 이 자동 선택)
  //   · 운영만 하고 참여는 안 한다면 그 프로그램 → 정원 전체뷰(DevGrowthOperator 는 선택 없이 시작)
  //   두 규칙은 «정렬(참여한 것 먼저)» 과 «각 뷰의 초기 선택» 이 맞물려 자연히 나온다.
  //   정렬을 바꿀 땐 이 규칙이 깨지지 않는지 확인할 것.
  const picked = useMemo(() => {
    if (!list || !list.length) return null
    const q = sp.get('program')
    return list.find((p) => p.id === q) || list[0]
  }, [list, sp])

  // 전체 뷰 상단 — 「OO의 공유 정원」 + 정원 고르기. 단독 뷰에는 자체 제목과 ✕ 가 있어
  // 각 뷰가 «전체 뷰일 때만» 이 노드를 그린다.
  const header = picked ? (
    <div className="flex items-center gap-2 w-full min-w-0">
      <h1 className="text-[17px] font-extrabold text-gray-800 truncate drop-shadow-sm">
        {picked.name}<span className="text-gray-500/80 font-bold">의 공유 정원</span>
      </h1>
      {list.length > 1 && (
        <button type="button" onClick={() => setOpen(true)} aria-label="정원 고르기"
          className="ml-auto shrink-0 w-9 h-9 rounded-full bg-white/85 shadow flex items-center justify-center text-emerald-700 active:scale-90 transition">
          <IslandIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  ) : null

  if (!GROWTH_3D) return <Placeholder />
  if (list === null) return <Placeholder note="정원을 불러오는 중이에요" />
  if (!list.length) return <Placeholder note={<>참여 중인 프로그램이 없어요.<br />프로그램에 참여하면 정원이 열려요</>} />

  // ⚠️ app-main 이 위(safe-area)·아래(pb-24 = 6rem, 탭바 자리)로 여백을 준다.
  //    위쪽 여백은 음수 마진으로 되물려 정원이 화면 꼭대기까지 올라오게 하고,
  //    아래는 «실제 탭바 높이» 만큼만 남긴다 — 정원이 탭바 바로 위에서 끝난다.
  //    (마진으로 아래까지 되물리면 하단 카드가 탭바 뒤로 들어가 가려진다)
  return (
    <div className="relative overflow-hidden"
      style={{
        height: `calc(100dvh - ${tabH}px)`,
        marginTop: 'calc(-1 * max(env(safe-area-inset-top), 0.75rem))',
        marginBottom: `calc(${tabH}px - 6rem)`,   // 예약된 6rem 과 실제 높이의 차이를 되물린다
      }}>
      <Suspense fallback={<div className="h-full" />}>
        {picked?.isOwner
          ? <DevGrowthOperator key={picked.id} embedProgramId={picked.id} embedHeader={header} />
          : <DevGrowthLab key={picked.id} embedProgramId={picked.id} embedHeader={header} />}
      </Suspense>

      {/* 프로그램 고르기 — 금색 나비처럼 «눌러서» 연다.
          칩을 줄줄이 늘어놓으면 정원을 가리고, 프로그램이 늘어날수록 못 쓴다. */}
      {/* ⚠️ 오버레이는 body 로 빼낸다(portal). 이 페이지는 음수 마진 + overflow-hidden 컨테이너 안이라
          그 안에 두면 위쪽이 잘린다. 화면 한가운데에 떠야 하는 것은 조상 스택에 두지 않는다. */}
      {open && createPortal((
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-sm max-h-[70dvh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="shrink-0 flex items-center gap-2 px-4 pt-4 pb-2">
              <h2 className="text-[15px] font-extrabold text-gray-900 flex-1">
                정원 고르기<span className="text-[12px] font-bold text-gray-400 ml-1.5">{list.length}개</span>
              </h2>
              <button type="button" onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 pt-1">
              {list.map((p) => {
                const on = picked?.id === p.id
                return (
                  <button key={p.id} type="button"
                    onClick={() => { setSp(p.id === list[0].id ? {} : { program: p.id }); setOpen(false) }}
                    className={`w-full flex items-center gap-3 rounded-2xl px-3 py-3 mb-1.5 transition active:scale-[0.99] ${
                      on ? 'bg-emerald-50 ring-2 ring-emerald-400' : 'bg-gray-50'}`}>
                    <IslandIcon className={`w-6 h-6 shrink-0 ${on ? 'text-emerald-600' : 'text-gray-300'}`} />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-[14px] font-extrabold text-gray-900 truncate">{p.name}</span>
                      <span className={`block text-[11px] font-bold mt-0.5 ${p.isOwner ? 'text-amber-600' : 'text-gray-400'}`}>
                        {p.isOwner ? '내가 운영' : '참여 중'}
                      </span>
                    </span>
                    {on && (
                      <span className="shrink-0 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                        보는 중
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  )
}