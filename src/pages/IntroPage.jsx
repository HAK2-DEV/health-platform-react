import { Link } from 'react-router-dom'
import { useState } from 'react'

// 공개 소개 페이지 (/intro) — 로그인 전에 «도담이 뭘 해주는지» 보여주는 유일한 화면.
//   왜 만들었나: 그동안 링크를 보내면 곧바로 로그인 창이 떠서, 관심 있는 운영자도 거기서 멈췄다.
//   대상: «이미 사람을 데리고 있는» 운영자(강사·담당자·팀장). 도담은 모객 도구가 아니라 운영 도구다.
//
//   구조는 Circle(circle.so) — 히어로 아래 «제품 화면 한 장»을 크게. 기능 나열은 그다음.
//   톤과 레이아웃은 챌린저스 비즈 — 밝은 색 면 + 한국어 타이포.
//   (경쟁사 실사 2026-09-22 결과. 셋 다 히어로에서 제품 화면을 팔고, 기능은 화면 + 한 줄로 설명한다.)
//
//   폰 화면은 «실제 앱 화면 캡처»다(2026-09-23, 안드로이드 에뮬레이터 + 프로덕션).
//      실계정 오염을 피하려고 test 계정 두 개로 비공개 프로그램을 만들고, 인증 한 건을 올려
//      승인까지 거친 뒤 찍었다. 캡처가 끝난 계정·프로그램은 지웠다.
//      다시 찍어야 하면 public/intro/screen-*.webp 를 교체하면 된다(폭 540 WebP).

// 3D 아이콘 — 깨지면 조용히 비운다(이모지 폴백을 쓰지 않는 자리).
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

// 폰 프레임 — 실제 앱 화면 캡처를 담는다.
function PhoneMock({ src, alt, height = 1073, className = '' }) {
  return (
    <div
      className={`relative w-full max-w-[268px] rounded-[2.25rem] bg-white p-2 shadow-elevated ring-1 ring-gray-200/70 ${className}`}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        width={540}
        height={height}
        className="block w-full h-auto rounded-[1.75rem] bg-surface-app"
      />
    </div>
  )
}

const FOR_WHOM = [
  '필라테스·요가·PT 처럼 매주 같은 사람들을 만나는 강사',
  '보건소·기업·학교에서 건강 프로그램을 맡은 담당자',
  '동호회·팀을 이끌며 함께 운동하는 리더',
]

const SUPPORTING = [
  { icon: '/icons/feature/community.png', title: '서로 응원하는 자리', desc: '인증에 댓글과 좋아요가 달립니다. 누군가 봐 준다는 것이 다음 인증으로 이어집니다.' },
  { icon: '/icons/feature/bell.png', title: '잊지 않게 알림', desc: '오늘 인증하지 않은 사람에게만 조용히 알립니다.' },
  { icon: '/icons/feature/mission.png', title: '무엇을 인증받을지 직접 정합니다', desc: '사진·기록·체크·걸음·퀴즈. 걷기만 세는 도구가 아닙니다.' },
]

export default function IntroPage() {
  return (
    <div className="pb-4">
      {/* 상단 — 로고 락업 + 로그인 (주요 행동이 아니므로 텍스트) */}
      <header className="max-w-5xl mx-auto py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="/app-icon.png"
            onError={(e) => { e.currentTarget.src = '/favicon.svg' }}
            alt="도담"
            className="w-8 h-8 rounded-lg flex-shrink-0"
          />
          <span className="text-base font-bold text-gray-800 tracking-tight">도담</span>
          <span className="text-[12px] text-gray-500 truncate hidden sm:inline">건강증진 플랫폼</span>
        </div>
        <Link to="/login" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex-shrink-0">
          로그인
        </Link>
      </header>

      <main className="max-w-5xl mx-auto">
        {/* ── 히어로 ── 밝은 민트 면 위에 문구, 바로 아래 제품 화면 한 장 (Circle 구조) */}
        <section className="mt-2 rounded-card-lg bg-gradient-to-b from-surface-mint to-white border border-emerald-100/70 overflow-hidden">
          <div className="px-5 pt-8 pb-0 text-center">
            <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 bg-white/80 border border-emerald-100 rounded-full px-3 py-1">
              운영자를 위한 건강 프로그램 도구
            </p>
            <h1 className="mt-4 text-[27px] sm:text-4xl font-bold text-gray-800 tracking-tight leading-[1.3] break-keep">
              운영은 쉽게,<br />건강은 단단하게.
            </h1>
            <p className="mt-3.5 text-[15px] text-gray-600 leading-relaxed break-keep max-w-md mx-auto">
              매일 인증을 모으고, 처지는 사람을 붙잡고, 끝나면 결과를 남깁니다.
            </p>
            <p className="mt-1.5 text-[15px] text-gray-600 leading-relaxed break-keep max-w-md mx-auto">
              <strong className="font-semibold text-gray-700">당신 이름으로 운영하는</strong> 건강 프로그램.
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
            <p className="mt-2.5 text-[12px] text-gray-500">
              카드 등록 없이 바로 · 참여자는 무료
            </p>
          </div>

          {/* 제품 화면 한 장 — 아래를 살짝 잘라 「계속 있다」는 느낌 */}
          <div className="mt-8 flex justify-center px-5">
            <PhoneMock
              src="/intro/screen-home.webp"
              alt="도담 프로그램 화면 — 주간 스트릭과 누적 기록, 미션·퀴즈·커뮤니티·랭킹 바로가기"
              className="-mb-6 sm:-mb-10"
            />
          </div>
        </section>

        {/* ── 이런 분들이 씁니다 ── 모객 도구가 아니라는 걸 먼저 분명히 */}
        <section className="mt-14">
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

        {/* ── 핵심 ①: 인증 모으기 ── 문구 + 화면 (챌린저스식 좌우 배치) */}
        <section className="mt-14 rounded-card-lg bg-white border border-gray-100 shadow-soft overflow-hidden">
          <div className="p-6 sm:p-8 sm:flex sm:items-center sm:gap-10">
            <div className="min-w-0 sm:flex-1">
              <p className="text-[12px] font-bold text-emerald-600">매일</p>
              <h2 className="mt-1.5 text-[20px] sm:text-2xl font-bold text-gray-800 break-keep leading-snug">
                인증을 대신 모아 드립니다
              </h2>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed break-keep">
                참여자는 사진 한 장이면 끝입니다. 누가 했는지, 며칠째인지, 몇 점인지 자동으로 쌓입니다.
                단톡방에서 사진을 세거나 엑셀에 옮겨 적지 않아도 됩니다.
              </p>
            </div>
            <div className="mt-7 sm:mt-0 flex justify-center sm:flex-shrink-0">
              <PhoneMock
                src="/intro/screen-mission.webp"
                alt="미션 화면 — 오늘 인증 완료 표시와 1일 연속 기록"
                className="max-w-[228px]"
              />
            </div>
          </div>
        </section>

        {/* ── 핵심 ②: 운영자 화면 ── */}
        <section className="mt-6 rounded-card-lg bg-white border border-gray-100 shadow-soft overflow-hidden">
          <div className="p-6 sm:p-8 sm:flex sm:items-center sm:gap-10 sm:flex-row-reverse">
            <div className="min-w-0 sm:flex-1">
              <p className="text-[12px] font-bold text-emerald-600">한 화면에</p>
              <h2 className="mt-1.5 text-[20px] sm:text-2xl font-bold text-gray-800 break-keep leading-snug">
                올라온 인증을 모아서 확인합니다
              </h2>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed break-keep">
                하루치 인증이 한 장에 모입니다. 훑어보고 문제 있는 것만 빼면
                <strong className="font-semibold text-gray-700"> 나머지는 버튼 하나로 한 번에 승인</strong>됩니다.
                승인하면 점수와 연속 기록에 바로 반영돼요.
              </p>
            </div>
            <div className="mt-7 sm:mt-0 flex justify-center sm:flex-shrink-0">
              <PhoneMock
                src="/intro/screen-review.webp"
                height={1171}
                alt="운영자 화면 — 참여자가 올린 인증을 승인하거나 반려하는 심사 목록"
                className="max-w-[228px]"
              />
            </div>
          </div>
        </section>

        {/* ── 핵심 ③: 종료 리포트 ── 결과만이 아니라 «왜 그랬는지»까지 */}
        <section className="mt-6 rounded-card-lg bg-white border border-gray-100 shadow-soft overflow-hidden">
          <div className="p-6 sm:p-8 sm:flex sm:items-center sm:gap-10">
            <div className="min-w-0 sm:flex-1">
              <p className="text-[12px] font-bold text-emerald-600">끝나면</p>
              <h2 className="mt-1.5 text-[20px] sm:text-2xl font-bold text-gray-800 break-keep leading-snug">
                결과를 문서로 남깁니다
              </h2>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed break-keep">
                몇 명이 어디서 멈췄는지, 무엇이 병목이었는지까지 짚어 줍니다.
                보고해야 하는 자리에 그대로 내고, 다음 기수는 설정을 그대로 복제해 엽니다.
              </p>
            </div>
            <div className="mt-7 sm:mt-0 flex justify-center sm:flex-shrink-0">
              <PhoneMock
                src="/intro/screen-report.webp"
                height={1171}
                alt="종료 리포트 — 핵심 진단과 참여자·인증 건수, 참여 여정 퍼널"
                className="max-w-[228px]"
              />
            </div>
          </div>
        </section>

        {/* ── 나머지는 목록 ── 같은 무게 카드를 나열하지 않는다 */}
        <section className="mt-14">
          <h2 className="text-lg font-bold text-gray-800 mb-4">그 밖에</h2>
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

        {/* ── 마지막 권유 ── */}
        <section className="mt-14 rounded-card-lg bg-surface-mint border border-emerald-100 p-7 text-center">
          <p className="text-[15px] font-semibold text-gray-800 leading-relaxed break-keep">
            프로그램 하나를 만드는 데 몇 분이면 됩니다.
          </p>
          <p className="mt-1.5 text-sm text-gray-600 leading-relaxed break-keep">
            참여자는 링크로 초대하면 바로 시작합니다. 앱을 따로 깔지 않아도 됩니다.
          </p>
          <Link
            to="/signup"
            className="mt-5 inline-flex items-center justify-center h-12 px-8 rounded-full
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

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] text-gray-500">
          <Link to="/terms" className="hover:text-gray-700">이용약관</Link>
          <Link to="/privacy" className="hover:text-gray-700">개인정보처리방침</Link>
          <span className="text-gray-400">도담 · 건강증진 플랫폼</span>
        </footer>
      </main>
    </div>
  )
}
