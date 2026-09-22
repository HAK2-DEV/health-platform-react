import { Link } from 'react-router-dom'
import { useState } from 'react'

// 공개 소개 페이지 (/intro) — 로그인 전에 «도담이 뭘 해주는지» 보여주는 유일한 화면.
//   왜 만들었나: 그동안 링크를 보내면 곧바로 로그인 창이 떠서, 관심 있는 운영자도 거기서 멈췄다.
//   대상: «이미 사람을 데리고 있는» 운영자(강사·담당자·팀장). 도담은 모객 도구가 아니라 운영 도구다.
//   주요 행동은 하나 — 「무료로 시작하기」. 나머지는 텍스트 링크로 둔다 (DESIGN_SYSTEM §13-13).

// 3D 아이콘 — 깨지면 숨긴다(이모지 폴백을 쓰지 않는 자리라 조용히 비운다).
function Icon({ src, className = 'w-10 h-10' }) {
  const [err, setErr] = useState(false)
  if (err) return <span className={`${className} inline-block flex-shrink-0`} aria-hidden="true" />
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={() => setErr(true)}
      className={`${className} object-contain flex-shrink-0`}
    />
  )
}

// 「도담이 대신 합니다」 — 같은 크기 카드를 나열하지 않는다(§13-2).
//   가장 중요한 하나(인증 모으기)만 카드로 크게, 나머지는 목록 행.
const SUPPORTING = [
  { icon: '/icons/feature/stats.png', title: '누가 얼마나 했는지 한눈에', desc: '참여율·연속 기록·순위가 자동으로 정리됩니다.' },
  { icon: '/icons/reward/report.png', title: '끝나면 결과 보고서', desc: '완주 인원과 기간별 변화를 문서로 내보낼 수 있어요.' },
  { icon: '/icons/feature/community.png', title: '서로 응원하는 자리', desc: '인증에 댓글과 좋아요가 달려 중간에 덜 빠집니다.' },
  { icon: '/icons/feature/bell.png', title: '잊지 않게 알림', desc: '오늘 인증하지 않은 사람에게만 조용히 알립니다.' },
]

const FOR_WHOM = [
  '필라테스·요가·PT 처럼 매주 같은 사람들을 만나는 강사',
  '보건소·기업·학교에서 건강 프로그램을 맡은 담당자',
  '동호회·팀을 이끌며 함께 운동하는 리더',
]

export default function IntroPage() {
  return (
    <div>
      {/* 상단 — 로고 락업 + 로그인 (주요 행동이 아니므로 텍스트) */}
      <header className="max-w-4xl mx-auto py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="/app-icon.png"
            onError={(e) => { e.currentTarget.src = '/favicon.svg' }}
            alt="도담"
            className="w-8 h-8 rounded-lg flex-shrink-0"
          />
          <span className="text-base font-bold text-gray-800 tracking-tight truncate">도담</span>
          <span className="text-[12px] text-gray-500 truncate hidden sm:inline">건강증진 플랫폼</span>
        </div>
        <Link
          to="/login"
          className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex-shrink-0"
        >
          로그인
        </Link>
      </header>

      <div className="max-w-4xl mx-auto pb-12">
        {/* 히어로 — 짧은 두 줄만 가운데 정렬 (§12 규칙 14) */}
        <section className="pt-6 pb-10 text-center">
          <h1 className="text-[26px] sm:text-3xl font-bold text-gray-800 tracking-tight leading-[1.3] break-keep">
            운영은 쉽게,<br />건강은 단단하게.
          </h1>
          <p className="mt-3 text-sm text-gray-600 leading-relaxed break-keep">
            건강 프로그램을 만들고, 매일 인증을 받고,
            <br className="hidden sm:block" /> 끝나면 결과를 보고서로 남깁니다.
          </p>

          <Link
            to="/signup"
            className="mt-6 inline-flex items-center justify-center h-12 px-8 rounded-full
                       bg-gradient-to-r from-emerald-400 to-teal-500
                       hover:from-emerald-500 hover:to-teal-600
                       text-white text-[15px] font-bold shadow-soft transition"
          >
            무료로 시작하기
          </Link>
          <p className="mt-3 text-[12px] text-gray-500">
            이미 계정이 있나요?{' '}
            <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">로그인</Link>
          </p>
        </section>

        {/* 이런 분들이 씁니다 — 도담은 «모객» 도구가 아니라는 걸 먼저 분명히 한다 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-800 mb-4">이런 분들이 씁니다</h2>
          <ul className="space-y-2">
            {FOR_WHOM.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-gray-600 leading-relaxed break-keep">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" aria-hidden="true" />
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-gray-500 leading-relaxed break-keep">
            도담은 사람을 모아 주지는 않습니다. 이미 함께하는 분들이 있을 때 가장 잘 맞습니다.
          </p>
        </section>

        {/* 핵심 하나를 크게 */}
        <section className="mb-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">도담이 대신 합니다</h2>
          <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
            <div className="flex items-start gap-3">
              <Icon src="/icons/feature/mission.png" className="w-12 h-12" />
              <div className="min-w-0">
                <h3 className="text-base font-bold text-gray-800 break-keep">매일 인증을 모아 드립니다</h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed break-keep">
                  사진·기록·체크로 인증을 받고, 누가 했는지 자동으로 모입니다.
                  단톡방에서 사진을 세거나 엑셀에 옮겨 적지 않아도 됩니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 나머지는 목록 — 같은 무게의 카드를 나열하지 않는다 */}
        <section className="mb-10">
          <ul className="space-y-3">
            {SUPPORTING.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <Icon src={f.icon} className="w-9 h-9" />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800 break-keep">{f.title}</h3>
                  <p className="mt-0.5 text-[13px] text-gray-600 leading-relaxed break-keep">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 마지막 권유 */}
        <section className="bg-surface-mint border border-emerald-100 rounded-card-lg p-5 text-center">
          <p className="text-sm text-gray-700 leading-relaxed break-keep">
            프로그램 하나를 만드는 데 몇 분이면 됩니다.
            <br className="hidden sm:block" /> 참여자는 링크로 초대하면 바로 시작합니다.
          </p>
          <Link
            to="/signup"
            className="mt-4 inline-flex items-center justify-center h-12 px-8 rounded-full
                       bg-gradient-to-r from-emerald-400 to-teal-500
                       hover:from-emerald-500 hover:to-teal-600
                       text-white text-[15px] font-bold shadow-soft transition"
          >
            무료로 시작하기
          </Link>
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] text-gray-500">
          <Link to="/terms" className="hover:text-gray-700">이용약관</Link>
          <Link to="/privacy" className="hover:text-gray-700">개인정보처리방침</Link>
          <span className="text-gray-400">도담 · 건강증진 플랫폼</span>
        </footer>
      </div>
    </div>
  )
}
