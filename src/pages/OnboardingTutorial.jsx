import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { subscribeToPush } from '../lib/push'
import { isStandalone, isNativeApp } from '../lib/installPrompt'

// 회원가입 직후 온보딩 튜토리얼 (마이페이지 「사용법 다시보기」로도 진입).
//   흐름: 환영 → 앱 소개 → 홈 화면 설치(실제 스샷+스포트라이트) → 알림 → 설명 선택 → 역할별 여정 → 마무리
//   설치 안내 스샷: public/onboarding/ios/*.png (원본 그대로, 그 위에 스포트라이트+손가락).
//   데모(artifact)로 설계 후 포팅. Android 스샷은 추후 — 지금은 CSS 목업.

// bub — 화면 위 말풍선. top(프레임 세로%), tail('up'=아래에 두고 위로 / 'down'=위에 두고 아래로), tx(꼬리 가로 %, 손가락 X에 맞춤)
const IOS = [
  { src: '/onboarding/ios/1-inapp.png', cap: '카톡, 인스타 등에서 링크로 열었다면, 먼저 <b>브라우저에서 열기</b>를 눌러 Safari로 나가요',
    spot: { left: '55%', top: '14.2%', width: '37%', height: '4.2%' }, fin: { left: '55%', top: '9%' }, bub: { top: '1%', left: '60%', tail: 'down', tx: '46%' } },
  { src: '/onboarding/ios/2-share.png', cap: '메뉴에서 <b>공유</b>를 눌러요',
    spot: { left: '30%', top: '49.8%', width: '66%', height: '5.4%' }, fin: { left: '31%', top: '45%' }, bub: { top: '41%', tail: 'down', tx: '30%' } },
  { src: '/onboarding/ios/3-add-2.png', cap: '조금 내려서 <b>홈 화면에 추가</b>를 눌러요',
    spot: { left: '4%', top: '61.4%', width: '92%', height: '6.2%' }, fin: { left: '52%', top: '59%' }, bub: { top: '53%', tail: 'down', tx: '22%' } },
  { src: '/onboarding/ios/4-confirm.png', cap: '오른쪽 위 <b>추가</b>를 누르면 완료! 🎉 홈 화면에 도담 아이콘이 생겨요',
    spot: { left: '78%', top: '10.3%', width: '18%', height: '4.4%' }, fin: { left: '73%', top: '5%' }, bub: { top: '-4%', left: '40%', tail: 'down', tx: '90%' } },
]

const JOURNEY = {
  p: { badge: '참여자', cls: 'p', title: '건강 습관, 이렇게 만들어요',
    steps: [
      { st: 'STEP 1', pv: 'p_find', imgs: ['/onboarding/journey/p-browse1.png', '/onboarding/journey/p-browse2.png'], h: '프로그램 찾기', p: '하단 <b>프로그램</b> 탭 →「둘러보기」에서 관심 카테고리로 찾아요. 초대 코드가 있으면 코드로 바로 참여!' },
      { st: 'STEP 2', pv: 'p_join', imgs: ['/onboarding/journey/p2-detail.png'], h: '참여하기', p: '카드를 눌러 상세를 보고「참여하기」. 공개 프로그램은 참여 전 <b>둘러보기</b>도 돼요.' },
      { st: 'STEP 3', pv: 'p_verify', video: '/onboarding/journey/p3-verify.mp4', h: '미션 인증', p: '오늘의 미션을 골라 <b>사진·기록</b>으로 인증. 자동 승인 또는 운영자 심사로 포인트!' },
      { st: 'STEP 4', pv: 'p_cheer', imgs: ['/onboarding/journey/p4-cheer.png'], h: '응원 주고받기', p: '응원 탭에서 서로의 인증에 <b>응원·좋아요</b>를 남겨요.' },
      { st: 'STEP 5', pv: 'p_grow', imgs: ['/onboarding/journey/p5-growth.png'], crop: 0.72, h: '성장 확인', p: '성장 탭에서 <b>연속 인증·포인트·랭킹</b>과 내 변화를 한눈에.' },
    ], tab: '화면 맨 아래 <b>탭바</b> — 🏠 대시보드 · 🚩 프로그램 · ＋ 기록 · 🌿 성장 · 👤 마이', mini: '🏠🚩🌿👤' },
  o: { badge: '운영자', cls: 'o', title: '프로그램, 이렇게 운영해요',
    steps: [
      { st: 'STEP 1', pv: 'o_create', imgs: ['/onboarding/journey/o1-create1.png', '/onboarding/journey/o1-create2.png', '/onboarding/journey/o1-create3.png'], h: '프로그램 만들기', p: '하단 가운데 <b>＋</b> → 마법사로 이름·기간·카테고리 설정. <b>프리셋</b>이면 4분 완성!' },
      { st: 'STEP 2', pv: 'o_mission', imgs: ['/onboarding/journey/o2-mission.png'], h: '미션·퀴즈 구성', p: '매일 인증할 <b>미션</b>과 <b>퀴즈</b>를 추가. 점수·인증 방식(자동/심사)을 정해요.' },
      { st: 'STEP 3', pv: 'o_invite', imgs: ['/onboarding/journey/o3-invite1.png', '/onboarding/journey/o3-invite2.png'], h: '참여자 초대', p: '<b>코드·링크·카카오톡</b>으로 초대. 공개로 두면 둘러보기에 노출돼요.' },
      { st: 'STEP 4', pv: 'o_manage', imgs: ['/onboarding/journey/o4-manage.png'], fit: 'contain', h: '운영하기', p: '인증 <b>승인</b>·공지·신고 처리를 한 화면에서. 실시간 참여 현황 확인.' },
      { st: 'STEP 5', pv: 'o_report', imgs: ['/onboarding/journey/o5-report1.png', '/onboarding/journey/o5-report2.png'], h: '통계·종료 리포트', p: '참여율·미션 성과·랭킹을 <b>통계</b>로. 종료 시 완주율·<b>여정 퍼널</b> 리포트까지!' },
    ], tab: '상단 <b>⚙️ 운영자 메뉴</b>에서 미션·퀴즈·공지·통계·초대에 바로 접근', mini: '⚙️' },
}

const SB = `<div class="pvsb"><span>9:41</span><span style="display:flex;gap:2px;align-items:center">📶<span class="pvbt"></span></span></div>`
const PREV = {
  p_find: `<div class="pv">${SB}<div class="pvh">🔍 둘러보기</div><div class="pvbd"><div><span class="pvchip on">전체</span><span class="pvchip">운동</span><span class="pvchip">식단</span><span class="pvchip">금연</span></div><div class="pvcard"><div class="pvrow"><div class="pvth">🏃</div><div style="flex:1"><div style="font-weight:800;font-size:6px">3km 달리기 챌린지</div><div class="pvmeta">👥 12명 · 21일</div></div></div><div class="pvln d" style="width:100%"></div></div><div class="pvcard"><div class="pvrow"><div class="pvth">🚭</div><div style="flex:1"><div style="font-weight:800;font-size:6px">28일 금연 도전</div><div class="pvmeta">👥 8명 · 공개</div></div></div></div></div><div class="pvtab"><span>🏠</span><span class="on">🚩</span><span class="plus">＋</span><span>🌿</span><span>👤</span></div></div>`,
  p_join: `<div class="pv">${SB}<div class="pvh"><span class="bk">‹</span> 3km 달리기 챌린지</div><div style="height:44px;background:linear-gradient(125deg,#3CB578,#134E33);display:flex;align-items:flex-end;padding:5px"><span style="color:#fff;font-weight:800;font-size:7px">🏃 3km 달리기 챌린지</span></div><div class="pvbd"><div class="pvrow"><span class="pvchip on">진행중 D-14</span></div><div class="pvln w"></div><div class="pvln" style="width:80%"></div><div class="pvcard"><div class="pvrow"><span style="font-size:8px">👥</span><div class="pvmeta">참여자 11명</div></div></div><div class="pvbtn">참여하기</div></div></div>`,
  p_verify: `<div class="pv">${SB}<div class="pvh"><span class="bk">‹</span> 오늘 미션 인증</div><div class="pvbd"><div class="pvcard" style="background:#F1F8F2"><div class="pvmeta" style="font-weight:800;color:#3a4a40">📋 안내</div><div class="pvln g" style="width:90%"></div><div class="pvln g" style="width:60%"></div></div><div class="pvlbl">🚬 오늘 핀 담배 개수</div><div class="pvcard" style="display:flex;justify-content:space-between;color:#9AA79E">예: 5.2 <span>개비</span></div><div class="pvlbl">📷 인증 사진</div><div class="pvcard" style="height:26px;display:grid;place-items:center;border-style:dashed;font-size:11px;color:#bbb">＋</div><div class="pvbtn">인증 제출</div></div></div>`,
  p_cheer: `<div class="pv">${SB}<div class="pvh">💬 응원</div><div class="pvbd"><div class="pvcard"><div class="pvrow" style="margin-bottom:3px"><div class="pvav">🙂</div><div><div style="font-weight:800;font-size:6px">민수</div><div class="pvmeta">방금</div></div></div><div class="pvln w"></div><div class="pvln" style="width:70%"></div><div style="display:flex;gap:6px;margin-top:4px"><span class="pvheart">❤️ 3</span><span class="pvmeta">💬 응원 2</span></div></div><div class="pvcard" style="display:flex;align-items:center;gap:4px;padding:4px 6px"><div class="pvav" style="background:#eef2ec"></div><span style="color:#9AA79E">응원 한마디…</span></div></div><div class="pvtab"><span>🏠</span><span>🚩</span><span class="plus">＋</span><span class="on">🌿</span><span>👤</span></div></div>`,
  p_grow: `<div class="pv">${SB}<div class="pvh">🌿 성장</div><div class="pvbd"><div class="pvcard"><div class="pvrow" style="margin:0"><span style="font-size:13px">🔥</span><div><div style="font-weight:800;font-size:8px;color:#e0862b">7일</div><div class="pvmeta">연속 인증</div></div><div style="margin-left:auto;text-align:right"><div style="font-weight:800;font-size:8px;color:#134E33">320P</div><div class="pvmeta">누적</div></div></div></div><div class="pvlbl">🏆 랭킹 Top 5</div><div class="pvbars"><i style="height:100%"></i><i style="height:78%"></i><i style="height:60%"></i><i style="height:45%"></i><i style="height:30%"></i></div></div><div class="pvtab"><span>🏠</span><span>🚩</span><span class="plus">＋</span><span class="on">🌿</span><span>👤</span></div></div>`,
  o_create: `<div class="pv">${SB}<div class="pvh amber">✨ 새 프로그램 · 1/4</div><div class="pvbd"><div class="pvlbl" style="color:#8a6d1b">프로그램 이름</div><div class="pvcard" style="color:#334">아침 러닝 클럽</div><div class="pvlbl" style="color:#8a6d1b">카테고리</div><div><span class="pvchip on" style="background:#D98829">🏃 운동</span><span class="pvchip">🥗 식단</span><span class="pvchip">🚭 금연</span></div><div class="pvlbl" style="color:#8a6d1b">기간</div><div class="pvcard" style="color:#334">21일</div><div class="pvbtn amber">다음 →</div></div></div>`,
  o_mission: `<div class="pv">${SB}<div class="pvh amber">미션 · 퀴즈 관리</div><div class="pvbd"><div class="pvcard"><div class="pvrow" style="margin:0"><div class="pvth" style="width:15px;height:15px;background:linear-gradient(125deg,#E7A94A,#B9741E)">✅</div><div style="flex:1"><div style="font-weight:800;font-size:6px">3km 달리기</div><div class="pvmeta">+10P · 자동 승인</div></div></div></div><div class="pvcard"><div class="pvrow" style="margin:0"><div class="pvth" style="width:15px;height:15px;background:linear-gradient(125deg,#E7A94A,#B9741E)">❓</div><div style="flex:1"><div style="font-weight:800;font-size:6px">건강 퀴즈</div><div class="pvmeta">3문항</div></div></div></div><div class="pvbtn amber">＋ 미션 추가</div></div></div>`,
  o_invite: `<div class="pv">${SB}<div class="pvh amber">🤝 초대하기</div><div class="pvbd"><div class="pvcard" style="text-align:center;background:#FBF6EE"><div class="pvmeta" style="color:#8a6d1b;font-weight:700">초대 코드</div><div style="font-size:13px;font-weight:800;letter-spacing:2px;color:#B9741E;margin-top:2px">WB26TJ</div></div><div class="pvbtn kakao">💬 카카오톡으로 보내기</div><div class="pvbtn line" style="margin-top:4px">🔗 링크 복사하기</div></div></div>`,
  o_manage: `<div class="pv">${SB}<div class="pvh amber">⚙️ 운영 · 인증 심사</div><div class="pvbd"><div class="pvlbl" style="color:#8a6d1b">대기 3건</div><div class="pvcard"><div class="pvrow" style="margin:0"><div class="pvth" style="width:16px;height:16px;border-radius:4px">📷</div><div style="flex:1"><div style="font-weight:800;font-size:6px">민수 · 3km</div><div class="pvmeta">2분 전</div></div><span style="font-size:6px;font-weight:800;color:#25A465">승인</span></div></div><div class="pvcard"><div class="pvrow" style="margin:0"><div class="pvth" style="width:16px;height:16px;border-radius:4px">📷</div><div style="flex:1"><div style="font-weight:800;font-size:6px">지은 · 3km</div><div class="pvmeta">5분 전</div></div><span style="font-size:6px;font-weight:800;color:#25A465">승인</span></div></div></div></div>`,
  o_report: `<div class="pv">${SB}<div class="pvh amber">📊 종료 리포트</div><div class="pvbd"><div class="pvrow" style="gap:4px"><div class="pvstat a"><b>60%</b><span>금연 성공률</span></div><div class="pvstat"><b>30</b><span>도전자</span></div></div><div class="pvlbl" style="color:#8a6d1b">참여 여정</div><div class="pvcard"><div class="pvrow" style="margin-bottom:3px"><span class="pvmeta" style="width:24px">가입</span><div class="pvln g" style="flex:1;height:6px;width:100%"></div><span class="pvmeta">30</span></div><div class="pvrow" style="margin-bottom:3px"><span class="pvmeta" style="width:24px">첫인증</span><div class="pvln g" style="flex:1;height:6px;width:70%"></div><span class="pvmeta">21</span></div><div class="pvrow" style="margin:0"><span class="pvmeta" style="width:24px">성공</span><div class="pvln g" style="flex:1;height:6px;width:50%"></div><span class="pvmeta">18</span></div></div></div></div>`,
}


export default function OnboardingTutorial() {
  const navigate = useNavigate()
  const TOTAL = 7
  const [step, setStep] = useState(0)
  const [role, setRole] = useState(null)
  const [scene, setScene] = useState(0)
  const [jStep, setJStep] = useState(0)
  const [seen, setSeen] = useState({ p: false, o: false })
  const [notifOn, setNotifOn] = useState(false)
  const [ringing, setRinging] = useState(false)
  const [notifBusy, setNotifBusy] = useState(false)
  const [notifErr, setNotifErr] = useState('')

  // 이미 홈 화면에 설치됨(standalone)이거나 네이티브 앱이면 온보딩의 "홈 화면 설치"(step 2)를 건너뛴다.
  const installed = isStandalone() || isNativeApp()
  const go = (n) => { setStep(Math.max(0, Math.min(TOTAL - 1, n))); setScene(0); setJStep(0); window.scrollTo(0, 0) }
  const finish = (dest) => { try { localStorage.setItem('onboarding-done', '1') } catch { /* 무시 */ } navigate(dest) }

  // 실제 폰 푸시 켜기 — 권한 요청 + 구독 + push_subscriptions 저장. 성공해야 성공화면 노출.
  //   requestPermission 은 클릭 제스처 안에서 첫 await 로 호출돼야 브라우저가 허용(패턴: WelcomeOperatorModal).
  const allowNotif = async () => {
    setNotifErr(''); setRinging(true); setNotifBusy(true)
    try {
      await subscribeToPush()
      setNotifOn(true)
      setTimeout(() => go(4), 1200)
    } catch (e) {
      setRinging(false)
      setNotifErr(e?.message || '알림을 켜지 못했어요. 나중에 마이페이지 > 알림 설정에서 켤 수 있어요.')
    } finally {
      setNotifBusy(false)
    }
  }
  const pickRole = (r) => { setRole(r); setSeen(s => ({ ...s, [r]: true })); go(5) }

  // 완주 기준 — 마지막 화면(step 6)에 도달하면 "끝까지 봄"으로 1회 완료 처리.
  // (진입 즉시가 아니라 완주 시에만 마킹 → 중간에 나가면 다음 접속에 다시 노출)
  useEffect(() => {
    if (step === 6) { try { localStorage.setItem('onboarding-done', '1') } catch { /* 무시 */ } }
  }, [step])

  // 설치 안내 이미지 프리로드 — 진입 시 초록 화살표만 먼저 뜨고 사진이 늦게 뜨는 문제 방지.
  useEffect(() => {
    IOS.forEach(({ src }) => { const im = new Image(); im.src = src })
    const tap = new Image(); tap.src = '/icons/onboarding/tap.png'
    // 여정(참여자/운영자) 스샷도 프리로드 — 5·6단계 진입 시 흰 깜빡임 방지 (앞 슬라이드 읽는 동안 미리 받음)
    Object.values(JOURNEY).forEach(r => r.steps.forEach(s => (s.imgs || []).forEach(src => { const im = new Image(); im.src = src })))
  }, [])

  const j = role ? JOURNEY[role] : null

  return (
    <div id="ob-root">
      <style>{STYLE}</style>
      <div className="ob-app">
        <div className="ob-top">
          <button className="ob-back" hidden={step === 0} onClick={() => { if (step === 5 && jStep > 0) setJStep((x) => x - 1); else go(step === 5 ? 4 : (installed && step === 3 ? 1 : step - 1)) }} aria-label="뒤로">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          {/* 상단 진행바 — 여정(step5)에선 5개 서브스텝만큼도 전진(하단 점 대체). */}
          <div className="ob-bar"><i style={{ width: `${(step === 5 && j ? 5 + (jStep + 1) / j.steps.length : step + 1) / TOTAL * 100}%` }} /></div>
        </div>

        <div className="ob-stage">
          {/* 0 welcome */}
          {step === 0 && (
            <section className="ob-screen">
              <div className="ob-center">
                <div className="ob-hero"><img className="ob-heroimg" src="/app-icon.png" alt="도담" /></div>
                <h1 className="ob-h1">건강, <span className="hl">함께</span> 시작해요</h1>
                <div className="ob-tag">운영은 쉽게, 건강은 단단하게</div>
                <p className="ob-lead" style={{ maxWidth: 300 }}>건강 프로그램을 함께 만들고 참여하는 곳.<br />2분이면 준비가 끝나요.</p>
              </div>
              <div className="ob-foot"><button className="ob-cta" onClick={() => go(1)}>시작하기 →</button></div>
            </section>
          )}

          {/* 1 features */}
          {step === 1 && (
            <section className="ob-screen">
              <div className="ob-eyebrow">앱 소개</div>
              <h1 className="ob-h1">이런 걸 할 수 있어요</h1>
              <div style={{ marginTop: 22, flex: 1 }}>
                {[['/icons/cta/create.png', '✨', '프로그램 운영하기', '직접 원하는 프로그램과 미션을 만들어 사람들과 함께해요.'],
                  ['/icons/feature/mission.png', '✅', '매일 미션 인증', '작은 미션을 인증하며 건강 습관을 단단하게 쌓아요.'],
                  ['/icons/feature/community.png', '💬', '함께 응원하고 성장', '서로 응원을 주고받고, 내 기록과 성장을 한눈에 확인해요.']].map(([src, emo, h, p], i) => (
                  <div className="ob-feat" key={h} style={{ animationDelay: `${0.05 + i * 0.1}s` }}>
                    <span className="ob-ic"><Ic3D src={src} emo={emo} /></span>
                    <div><h3>{h}</h3><p>{p}</p></div>
                  </div>
                ))}
              </div>
              <div className="ob-foot"><button className="ob-cta" onClick={() => go(installed ? 3 : 2)}>다음</button></div>
            </section>
          )}

          {/* 2 install */}
          {step === 2 && (
            <section className="ob-screen">
              <div className="ob-eyebrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span>홈 화면에 설치 <span style={{ color: 'var(--ob-faint)', fontWeight: 600 }}>· 1분이면 끝</span></span>
                <button className="ob-skip" style={{ textTransform: 'none', letterSpacing: 0 }} onClick={() => go(3)}>{scene === IOS.length - 1 ? '설치 완료 · 다음' : '설치했어요 · 건너뛰기'}</button>
              </div>
              <div className="ob-scene">
                <div className="ob-phonerow tight">
                  <button className="ob-arrow" disabled={scene === 0} onClick={() => setScene(Math.max(0, scene - 1))} aria-label="이전">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <div className="ob-rsframe" key={`rs${scene}`}>
                    <img className="ob-rs" src={IOS[scene].src} alt="" />
                    <div className="ob-spot" style={IOS[scene].spot} />
                    <img className="ob-finger" src="/icons/onboarding/tap.png" style={IOS[scene].fin} alt="" />
                  </div>
                  <button className="ob-arrow prim" onClick={() => scene === IOS.length - 1 ? go(3) : setScene(scene + 1)} aria-label="다음">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                  <div className={`ob-obubble ${IOS[scene].bub.tail}`} key={`bub${scene}`} style={{ top: IOS[scene].bub.top, left: IOS[scene].bub.left || '50%', '--tx': IOS[scene].bub.tx }} dangerouslySetInnerHTML={{ __html: IOS[scene].cap }} />
                </div>
                <div className="ob-dots">{IOS.map((_, i) => <i key={i} className={i === scene ? 'on' : ''} onClick={() => setScene(i)} />)}</div>
              </div>
            </section>
          )}

          {/* 3 notifications */}
          {step === 3 && (
            <section className="ob-screen">
              <div className="ob-eyebrow">알림</div>
              <h1 className="ob-h1">놓치지 않게 <span className="hl">알림</span>을 켜요</h1>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {!notifOn ? (
                  <div>
                    <div className={`ob-bell${ringing ? ' ring' : ''}`}><span className="ob-wave" /><Ic3D src="/icons/feature/bell.png" emo="🔔" size={54} /></div>
                    <div className="ob-perklist">
                      {[['/icons/growth/sprout.png', '🌱', '새로운 미션·퀴즈·클래스 소식을 바로'],
                        ['/icons/running/stopwatch.png', '⏰', '오늘의 미션 리마인드'],
                        ['/icons/cheer/heart-red.png', '❤️', '내 인증에 달린 응원·좋아요'],
                        ['/icons/feature/notice.png', '📢', '운영자의 새 공지']].map(([src, emo, t]) => (
                        <div className="ob-perk" key={t}><span className="k"><Ic3D src={src} emo={emo} size={30} /></span> {t}</div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="ob-granted">
                    <div className="ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg></div>
                    <h1 className="ob-h1" style={{ fontSize: 20, marginTop: 6 }}>알림이 켜졌어요!</h1>
                    <p className="ob-lead" style={{ marginTop: 6 }}>중요한 순간을 놓치지 않을게요.</p>
                  </div>
                )}
              </div>
              <div className="ob-foot">
                {notifErr && <p style={{ color: '#dc2626', fontSize: 13, textAlign: 'left', marginBottom: 8, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{notifErr}</p>}
                {!notifOn && <button className="ob-cta" onClick={allowNotif} disabled={notifBusy}>{notifBusy ? '켜는 중…' : '🔔 알림 켜기'}</button>}
                <button className="ob-cta ghost" onClick={() => go(4)}>{notifOn ? '다음' : '나중에 할게요'}</button>
              </div>
            </section>
          )}

          {/* 4 role */}
          {step === 4 && (
            <section className="ob-screen">
              <div className="ob-eyebrow">설명 선택</div>
              <h1 className="ob-h1">어떤 설명을 <span className="hl">들어볼까요?</span></h1>
              <p className="ob-lead">듣고 싶은 설명을 골라주세요. <b style={{ color: 'var(--ob-ink)' }}>둘 다 볼 수 있어요.</b></p>
              <div style={{ flex: 1, marginTop: 20 }}>
                {[['p', '/icons/onboarding/join.png', '🙋', '참여자 사용법', '프로그램 찾기 · 미션 인증 · 응원 · 성장까지'],
                  ['o', '/icons/onboarding/invite.png', '🧑‍🏫', '운영자 사용법', '프로그램 만들기 · 초대 · 운영 · 리포트까지']].map(([r, ic, emo, h, p]) => (
                  <button className={`ob-role ${r}`} key={r} onClick={() => pickRole(r)}>
                    <span className="emo"><Ic3D src={ic} emo={emo} size={40} /></span>
                    <div className="rt"><h3>{h}</h3><p>{p}</p></div>
                    {seen[r]
                      ? <span className="seen">✓ 봤어요</span>
                      : <span className="arw"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></span>}
                  </button>
                ))}
              </div>
              <div className="ob-foot"><button className="ob-cta ghost" onClick={() => go(6)}>이제 시작할게요 →</button></div>
            </section>
          )}

          {/* 5 journey — 좌/우 슬라이드 카루셀 */}
          {step === 5 && j && (() => {
            const s = j.steps[jStep]
            const last = jStep === j.steps.length - 1
            return (
              <section className="ob-screen">
                <div className="ob-jcar">
                  <div className={`ob-jtitle ${j.cls}`} key={`t${s.st}`}>
                    <div className="st">{s.st}</div>
                    <h3>{s.h}</h3>
                  </div>
                  <div className="ob-phonerow tight">
                    <button className="ob-arrow" disabled={jStep === 0} onClick={() => setJStep((x) => Math.max(0, x - 1))} aria-label="이전">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                    <div className={`ob-jcar-phone ${j.cls}`} key={jStep}>
                      {s.video
                        ? <JourneyVideo src={s.video} key={s.st} />
                        : s.imgs
                          ? <JourneyShot imgs={s.imgs} crop={s.crop} aspect={s.aspect} fit={s.fit} key={s.st} />
                          : <div className="ob-prev" dangerouslySetInnerHTML={{ __html: PREV[s.pv] }} />}
                    </div>
                    <button className={`ob-arrow ${last ? '' : 'prim'}`} disabled={last} onClick={() => setJStep((x) => Math.min(j.steps.length - 1, x + 1))} aria-label="다음">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                  </div>
                  <p className={`ob-jdesc ${j.cls}`} key={`p${s.st}`} dangerouslySetInnerHTML={{ __html: s.p }} />
                </div>
                {last && (
                  <div className="ob-foot">
                    <button className="ob-cta" onClick={() => go(6)}>이제 시작할게요 →</button>
                    <button className="ob-cta ghost" onClick={() => go(4)}>다른 설명도 볼래요</button>
                  </div>
                )}
              </section>
            )
          })()}

          {/* 6 finish */}
          {step === 6 && (
            <section className="ob-screen">
              <div className="ob-center">
                <div className="ob-hero"><img className="ob-heroimg" src="/app-icon.png" alt="도담" /></div>
                <h1 className="ob-h1" style={{ marginTop: 20 }}>준비 완료!</h1>
                <p className="ob-lead" style={{ maxWidth: 290 }}>이제 마음에 드는 프로그램을 둘러보거나, 직접 만들어볼까요?</p>
              </div>
              <div className="ob-foot">
                <button className="ob-cta" onClick={() => finish('/programs?tab=browse')}>🔍 프로그램 둘러보기</button>
                <button className="ob-cta ghost" onClick={() => finish('/programs/new')}>✨ 프로그램 만들기</button>
                <button className="ob-cta ghost" style={{ color: 'var(--ob-faint)' }} onClick={() => finish('/dashboard')}>대시보드로 가기</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

// 여정 실제 스샷 썸네일 — 여러 장이면 자동 슬라이드 + 손가락 스와이프(스와이프하면 자동재생 정지) + 점(탭 이동)
function JourneyShot({ imgs, crop, aspect, fit }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [loaded, setLoaded] = useState({})   // src → true. 로드 완료 시 페이드인 (프리로드 캐시면 즉시)
  const markLoaded = (src) => setLoaded((m) => (m[src] ? m : { ...m, [src]: true }))
  const startX = useRef(null)
  useEffect(() => {
    if (imgs.length < 2 || paused) return
    const t = setInterval(() => setI((x) => (x + 1) % imgs.length), 2600)
    return () => clearInterval(t)
  }, [imgs.length, paused])
  const shift = (dir) => setI((x) => (x + dir + imgs.length) % imgs.length)
  const onDown = (e) => { startX.current = e.clientX }
  const onUp = (e) => {
    if (startX.current == null) return
    const dx = e.clientX - startX.current
    startX.current = null
    if (imgs.length > 1 && Math.abs(dx) > 28) { setPaused(true); shift(dx < 0 ? 1 : -1) }
  }
  return (
    <div className="ob-jshot">
      <div className="ob-jframe" style={{ backgroundColor: '#eef2f0', ...(aspect ? { aspectRatio: aspect } : crop ? { aspectRatio: `440 / ${Math.round(954 * crop)}` } : {}) }} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { startX.current = null }}>
        <div className="ob-jtrack" style={{ width: `${imgs.length * 100}%`, transform: `translateX(-${i * (100 / imgs.length)}%)` }}>
          {imgs.map((src) => <img key={src} src={src} alt=""
            ref={(el) => { if (el && el.complete) markLoaded(src) }}
            onLoad={() => markLoaded(src)}
            style={{ width: `${100 / imgs.length}%`, objectFit: fit || undefined, objectPosition: crop ? 'top' : undefined, opacity: loaded[src] ? 1 : 0, transition: 'opacity .25s ease' }} draggable="false" />)}
        </div>
        {imgs.length > 1 && <span className="ob-jcount">{i + 1} / {imgs.length}</span>}
      </div>
    </div>
  )
}

// 화면 녹화 영상 (iOS 자동재생: muted + playsInline 필수)
function JourneyVideo({ src, poster }) {
  return (
    <div className="ob-jshot">
      <div className="ob-jframe">
        <video className="ob-jvid" src={src} poster={poster} autoPlay muted loop playsInline preload="auto" />
        <div className="ob-jvid-mask" />
      </div>
    </div>
  )
}

// 3D 아이콘 + 이모지 폴백
function Ic3D({ src, emo, size = 32 }) {
  const [err, setErr] = useState(false)
  if (err) return <span style={{ fontSize: Math.round(size * 0.72) }}>{emo}</span>
  return <img src={src} alt="" onError={() => setErr(true)} style={{ width: size, height: size, objectFit: 'contain' }} />
}

const STYLE = `
#ob-root{--ob-bg:#ffffff;--ob-surface:#ffffff;--ob-surface2:#f0fdf4;--ob-ink:#14261e;--ob-muted:#5f6b64;--ob-faint:#9aa79e;--ob-green:#10b981;--ob-green-br:#34d399;--ob-green-dp:#047857;--ob-soft:#ecfdf5;--ob-tint:#f0fdf4;--ob-line:#e8ece9;--ob-amber:#d97706;--ob-amber-soft:#fef3c7;--ob-shadow:0 10px 30px -12px rgba(16,185,129,.24);--ob-shadow-sm:0 3px 12px -6px rgba(16,185,129,.18);--ob-ff:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Segoe UI','Apple SD Gothic Neo','Noto Sans KR',sans-serif}
#ob-root{position:fixed;inset:0;z-index:2000;background:var(--ob-bg);font-family:var(--ob-ff);color:var(--ob-ink)}
#ob-root *{box-sizing:border-box}
/* 모바일 길게눌러 '이미지 저장/다운로드' 콜아웃·드래그·선택 방지 (모든 스샷·아이콘·영상) */
#ob-root img,#ob-root video{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;-webkit-user-drag:none;user-drag:none;pointer-events:none}
#ob-root .ob-app{width:min(440px,100%);height:100dvh;margin:0 auto;display:flex;flex-direction:column;background:var(--ob-bg)}
#ob-root .ob-top{display:flex;align-items:center;gap:12px;padding:14px 18px 6px;flex-shrink:0}
#ob-root .ob-back{width:34px;height:34px;border-radius:11px;border:none;background:var(--ob-surface2);color:var(--ob-ink);display:grid;place-items:center;cursor:pointer;flex-shrink:0}
#ob-root .ob-back[hidden]{visibility:hidden}#ob-root .ob-back svg{width:18px;height:18px}
#ob-root .ob-bar{flex:1;height:6px;border-radius:99px;background:var(--ob-line);overflow:hidden}
#ob-root .ob-bar>i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--ob-green),var(--ob-green-br));transition:width .5s cubic-bezier(.3,.8,.3,1)}
#ob-root .ob-skip{border:none;background:none;color:var(--ob-faint);font-family:var(--ob-ff);font-size:13px;font-weight:600;cursor:pointer;padding:6px 4px;flex-shrink:0}
#ob-root .ob-stage{flex:1;overflow-y:auto;overflow-x:hidden}
#ob-root .ob-screen{display:flex;flex-direction:column;min-height:100%;padding:12px 24px 0;animation:obenter .42s cubic-bezier(.22,.75,.28,1) both}
@keyframes obenter{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
/* 다음/이전으로 넘길 때 폰(틀)도 함께 슬라이드+페이드 */
@keyframes obadv{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:none}}
/* 말풍선은 translateX(-50%) 가운데정렬 유지 위해 페이드만 */
@keyframes obfade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){#ob-root .ob-screen,#ob-root *{animation:none!important}}
#ob-root .ob-eyebrow{font-size:12.5px;font-weight:800;letter-spacing:.06em;color:var(--ob-green);text-transform:uppercase;margin-bottom:10px}
#ob-root .ob-h1{font-size:26px;line-height:1.3;font-weight:800;letter-spacing:-.01em}
#ob-root .ob-h1 .hl{color:var(--ob-green)}
#ob-root .ob-lead{margin-top:11px;font-size:14.5px;line-height:1.6;color:var(--ob-muted)}
#ob-root .ob-cta{width:100%;height:54px;border:none;border-radius:16px;background:var(--ob-green);color:#fff;font-family:var(--ob-ff);font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 8px 20px -8px color-mix(in srgb,var(--ob-green) 70%,transparent);display:flex;align-items:center;justify-content:center;gap:8px}
#ob-root .ob-cta.ghost{background:var(--ob-surface2);color:var(--ob-ink);box-shadow:none;height:48px;font-size:14.5px}
#ob-root .ob-foot{position:sticky;bottom:0;background:var(--ob-bg);padding:14px 0 22px;flex-shrink:0;margin-top:auto}
#ob-root .ob-foot .ob-cta+.ob-cta{margin-top:9px}
#ob-root .ob-center{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
#ob-root .ob-hero{width:104px;height:104px;border-radius:26px;overflow:hidden;box-shadow:0 18px 40px -14px color-mix(in srgb,var(--ob-green) 55%,transparent);animation:obpop .6s cubic-bezier(.2,1.3,.5,1) both}
#ob-root .ob-heroimg{width:100%;height:100%;object-fit:cover;display:block}
@keyframes obpop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:none}}
#ob-root .ob-center .ob-h1{margin-top:20px}
#ob-root .ob-tag{margin-top:14px;color:var(--ob-green-dp);font-size:17px;font-weight:800;letter-spacing:-.01em}
#ob-root .ob-feat{display:flex;align-items:flex-start;gap:14px;padding:15px;border-radius:20px;background:var(--ob-surface);border:1px solid var(--ob-line);box-shadow:var(--ob-shadow-sm);opacity:0;transform:translateY(12px);animation:obrise .5s cubic-bezier(.2,.8,.3,1) forwards}
#ob-root .ob-feat+.ob-feat{margin-top:10px}
@keyframes obrise{to{opacity:1;transform:none}}
#ob-root .ob-feat .ob-ic{width:46px;height:46px;border-radius:14px;background:var(--ob-soft);display:grid;place-items:center;font-size:24px;flex-shrink:0}
#ob-root .ob-feat h3{font-size:15.5px;font-weight:800}#ob-root .ob-feat p{font-size:13px;line-height:1.5;color:var(--ob-muted);margin-top:3px}
#ob-root .ob-scene{margin-top:22px;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start}
#ob-root .ob-rsframe{position:relative;width:min(300px,60vw);aspect-ratio:640/1387;border-radius:34px;overflow:hidden;border:5px solid #111;box-shadow:var(--ob-shadow);flex-shrink:0;background:#fff;animation:obadv .4s cubic-bezier(.22,.75,.28,1) both}
#ob-root .ob-phonerow.tight{gap:8px}
#ob-root .ob-phonerow.tight .ob-arrow{width:38px;height:38px}
#ob-root .ob-rs{width:100%;height:100%;object-fit:cover;display:block}
#ob-root .ob-spot{position:absolute;border-radius:10px;box-shadow:0 0 0 3px var(--ob-green-br);z-index:3}
/* 펄스 링 — box-shadow 애니(매프레임 repaint) 대신 pseudo-el 의 transform+opacity(합성) 로 렉 제거 */
#ob-root .ob-spot::after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:0 0 0 3px var(--ob-green-br);animation:obhalo 1.5s ease-out infinite;will-change:transform,opacity}
@keyframes obhalo{0%{transform:scale(1);opacity:.6}70%,100%{transform:scale(1.3);opacity:0}}
#ob-root .ob-finger{position:absolute;z-index:4;width:44px;height:44px;object-fit:contain;filter:drop-shadow(0 5px 6px rgba(0,0,0,.35));animation:obtap 1.5s ease-in-out infinite;pointer-events:none;will-change:transform}
@keyframes obtap{0%,100%{transform:translateY(4px)}50%{transform:translateY(-5px)}}
/* 화면 오버레이 말풍선 — 폰 스샷 위에 얹힘. 꼬리(up/down)가 강조 손가락을 가리킴. tx=꼬리 가로. */
#ob-root .ob-obubble{position:absolute;left:50%;transform:translateX(-50%);width:min(230px,62vw);background:#fff;border-radius:13px;padding:8px 11px;text-align:center;font-size:11.5px;line-height:1.38;font-weight:600;color:var(--ob-ink);word-break:keep-all;box-shadow:0 7px 20px -4px rgba(20,38,30,.32),0 1px 4px rgba(20,38,30,.14);z-index:6;animation:obfade .35s ease both}
#ob-root .ob-obubble b{color:var(--ob-green);font-weight:800;white-space:nowrap}
#ob-root .ob-obubble::after{content:'';position:absolute;left:var(--tx,50%);transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent}
#ob-root .ob-obubble.down::after{bottom:-7px;border-top:8px solid #fff}
#ob-root .ob-obubble.up::after{top:-7px;border-bottom:8px solid #fff}
#ob-root .ob-dots{display:flex;gap:7px;justify-content:center;margin-top:10px}
#ob-root .ob-dots i{width:7px;height:7px;border-radius:99px;background:var(--ob-line);cursor:pointer;transition:.2s}
#ob-root .ob-dots i.on{width:22px;background:var(--ob-green)}
#ob-root .ob-phonerow{position:relative;display:flex;align-items:center;justify-content:center;gap:12px}
#ob-root .ob-arrow{width:42px;height:42px;border-radius:99px;border:1px solid var(--ob-line);background:var(--ob-surface);color:var(--ob-ink);display:grid;place-items:center;cursor:pointer;flex-shrink:0;box-shadow:var(--ob-shadow-sm);transition:.15s}
#ob-root .ob-arrow svg{width:20px;height:20px}
#ob-root .ob-arrow:hover{background:var(--ob-soft);border-color:var(--ob-green);color:var(--ob-green)}
#ob-root .ob-arrow.prim{background:var(--ob-green);color:#fff;border-color:var(--ob-green);box-shadow:0 6px 16px -6px color-mix(in srgb,var(--ob-green) 65%,transparent)}
#ob-root .ob-arrow.prim:hover{background:var(--ob-green-br)}
#ob-root .ob-arrow:disabled{opacity:.3;cursor:default;box-shadow:none}
#ob-root .ob-arrow:disabled:hover{background:var(--ob-surface);border-color:var(--ob-line);color:var(--ob-ink)}
#ob-root .ob-bell{width:100px;height:100px;border-radius:30px;background:var(--ob-soft);display:grid;place-items:center;position:relative;margin:0 auto}
#ob-root .ob-bell img{transform-origin:50% 12%}
#ob-root .ob-bell.ring img{animation:obring .8s ease}
@keyframes obring{0%,100%{transform:rotate(0)}20%{transform:rotate(16deg)}40%{transform:rotate(-13deg)}60%{transform:rotate(9deg)}80%{transform:rotate(-5deg)}}
#ob-root .ob-wave{position:absolute;inset:-6px;border-radius:36px;border:2px solid var(--ob-green);opacity:0}
#ob-root .ob-bell.ring .ob-wave{animation:obwv 1s ease-out}
@keyframes obwv{0%{opacity:.5;transform:scale(.9)}100%{opacity:0;transform:scale(1.35)}}
#ob-root .ob-perklist{margin-top:22px;display:flex;flex-direction:column;gap:13px}
#ob-root .ob-perk{display:flex;align-items:center;gap:13px;font-size:14.5px;color:var(--ob-ink);font-weight:500}
#ob-root .ob-perk .k{width:40px;height:40px;border-radius:12px;background:var(--ob-soft);display:grid;place-items:center;font-size:20px;flex-shrink:0}
#ob-root .ob-granted{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
#ob-root .ob-granted .ok{width:64px;height:64px;border-radius:99px;background:var(--ob-green);display:grid;place-items:center;color:#fff;animation:obpop .5s cubic-bezier(.2,1.3,.5,1) both}
#ob-root .ob-granted .ok svg{width:34px;height:34px}
#ob-root .ob-role{width:100%;text-align:left;padding:19px;border-radius:20px;background:var(--ob-surface);border:1.5px solid var(--ob-line);cursor:pointer;transition:.2s;display:flex;align-items:center;gap:15px;font-family:var(--ob-ff);color:var(--ob-ink)}
#ob-root .ob-role+.ob-role{margin-top:11px}
#ob-root .ob-role:hover{border-color:var(--ob-green)}
#ob-root .ob-role .emo{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;font-size:28px;flex-shrink:0}
#ob-root .ob-role.p .emo{background:var(--ob-soft)}#ob-root .ob-role.o .emo{background:var(--ob-amber-soft)}
#ob-root .ob-role .rt{flex:1;min-width:0}
#ob-root .ob-role h3{font-size:16.5px;font-weight:800}#ob-root .ob-role p{font-size:12.5px;color:var(--ob-muted);margin-top:3px;line-height:1.45}
#ob-root .ob-role .arw{flex-shrink:0;color:var(--ob-faint)}
#ob-root .ob-role .seen{flex-shrink:0;font-size:11px;font-weight:700;color:var(--ob-green);background:var(--ob-soft);padding:4px 9px;border-radius:99px;white-space:nowrap}
#ob-root .ob-jhead{display:flex;align-items:center;gap:10px;margin-bottom:2px}
#ob-root .ob-badge{padding:6px 12px;border-radius:99px;font-size:12.5px;font-weight:800}
#ob-root .ob-badge.p{background:var(--ob-soft);color:var(--ob-green-dp)}#ob-root .ob-badge.o{background:var(--ob-amber-soft);color:var(--ob-amber)}
#ob-root .ob-jsteps{margin-top:16px;display:flex;flex-direction:column;gap:13px}
#ob-root .ob-jc{display:flex;gap:14px;align-items:center;padding:12px;border-radius:18px;background:var(--ob-surface);border:1px solid var(--ob-line);box-shadow:var(--ob-shadow-sm);opacity:0;transform:translateY(10px);animation:obrise .5s cubic-bezier(.2,.8,.3,1) forwards}
#ob-root .ob-jc .txt h3{font-size:14.5px;font-weight:800}#ob-root .ob-jc .txt p{font-size:12px;color:var(--ob-muted);margin-top:3px;line-height:1.5}
#ob-root .ob-jc .txt .st{font-size:10.5px;font-weight:800;color:var(--ob-green)}
#ob-root .ob-jc.o .txt .st{color:var(--ob-amber)}
#ob-root .ob-tabhint{margin-top:14px;display:flex;align-items:center;gap:11px;padding:12px 14px;border-radius:15px;background:var(--ob-tint);border:1px dashed color-mix(in srgb,var(--ob-green) 40%,var(--ob-line))}
#ob-root .ob-tabhint .mini{font-size:17px}#ob-root .ob-tabhint p{font-size:12px;color:var(--ob-muted);line-height:1.45}
#ob-root .ob-jshot{display:flex;flex-direction:column;align-items:center;gap:7px;flex-shrink:0}
#ob-root .ob-jframe{position:relative;width:112px;aspect-ratio:440/954;border-radius:16px;overflow:hidden;border:4px solid #111;box-shadow:var(--ob-shadow-sm);background:#fff;touch-action:pan-y;cursor:grab}
#ob-root .ob-jtrack{display:flex;height:100%;transition:transform .55s cubic-bezier(.45,.05,.2,1)}
#ob-root .ob-jtrack img{height:100%;object-fit:cover;flex-shrink:0;display:block}
#ob-root .ob-jvid{width:100%;height:100%;object-fit:cover;display:block;background:#fff}
#ob-root .ob-jvid-mask{position:absolute;top:0;left:0;right:0;height:6.8%;background:#fff;z-index:2}
#ob-root .ob-jcount{position:absolute;top:7px;left:50%;transform:translateX(-50%);z-index:4;background:rgba(17,17,17,.6);color:#fff;font-size:10.5px;font-weight:700;line-height:1;padding:3px 8px;border-radius:99px;letter-spacing:.02em;font-variant-numeric:tabular-nums;pointer-events:none}
#ob-root .ob-jcar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:11px;padding:6px 0}
#ob-root .ob-jcar-phone{flex-shrink:0;animation:obadv .4s cubic-bezier(.22,.75,.28,1) both}
#ob-root .ob-jcar-phone .ob-jframe{width:min(300px,60vw)}
#ob-root .ob-jcar-phone .ob-prev{width:min(280px,56vw);height:auto;aspect-ratio:106/196}
/* STEP+제목 — 폰 위 헤더 / 설명 — 폰 아래 */
#ob-root .ob-jtitle{text-align:center;animation:obenter .3s ease both}
#ob-root .ob-jtitle .st{font-size:11px;font-weight:800;letter-spacing:.4px;color:var(--ob-green)}
#ob-root .ob-jtitle.o .st{color:var(--ob-amber)}
#ob-root .ob-jtitle h3{font-size:18px;font-weight:800;margin-top:3px}
#ob-root .ob-jdesc{text-align:center;max-width:310px;font-size:15px;color:var(--ob-muted);line-height:1.55;word-break:keep-all;animation:obenter .3s ease both}
#ob-root .ob-prev{width:106px;height:196px;border-radius:17px;background:#0c0c0c;padding:3px;flex-shrink:0;box-shadow:var(--ob-shadow-sm)}
#ob-root .ob-prev .pv{position:relative;width:100%;height:100%;border-radius:14px;overflow:hidden;background:#fbfbf8;font-size:6.5px;color:#243}
#ob-root .pv .pvsb{height:9px;display:flex;align-items:center;justify-content:space-between;padding:0 6px;font-size:5px;font-weight:800;color:#333;background:#fff}
#ob-root .pv .pvbt{width:8px;height:4px;border:.5px solid #333;border-radius:1px}
#ob-root .pv .pvh{min-height:16px;background:linear-gradient(100deg,#2FA968,#134E33);color:#fff;display:flex;align-items:center;padding:3px 7px;font-size:7px;font-weight:800;gap:3px}
#ob-root .pv .pvh.amber{background:linear-gradient(100deg,#E7A94A,#B9741E)}
#ob-root .pv .bk{opacity:.85}
#ob-root .pv .pvbd{padding:6px}
#ob-root .pv .pvchip{display:inline-flex;align-items:center;height:11px;border-radius:99px;background:#eef2ec;color:#5a6b60;padding:0 5px;margin:0 3px 4px 0;font-size:5.5px;font-weight:700}
#ob-root .pv .pvchip.on{background:#25A465;color:#fff}
#ob-root .pv .pvcard{background:#fff;border:1px solid #E6EDE6;border-radius:7px;padding:6px;margin-bottom:5px;box-shadow:0 1px 5px -3px rgba(0,0,0,.18)}
#ob-root .pv .pvln{height:5px;border-radius:99px;background:#EDF2EC;margin:3px 0}
#ob-root .pv .pvln.w{width:62%}#ob-root .pv .pvln.g{background:#CDE9D6}#ob-root .pv .pvln.d{background:#e2e6e1;height:4px}
#ob-root .pv .pvlbl{font-size:5.5px;font-weight:800;color:#3a4a40;margin:4px 0 2px}
#ob-root .pv .pvbtn{height:15px;border-radius:6px;background:#25A465;color:#fff;display:grid;place-items:center;font-size:6.5px;font-weight:800;margin-top:5px}
#ob-root .pv .pvbtn.amber{background:#D98829}#ob-root .pv .pvbtn.kakao{background:#FEE500;color:#3a2d00}#ob-root .pv .pvbtn.line{background:#fff;border:1px solid #D98829;color:#B9741E}
#ob-root .pv .pvth{width:22px;height:22px;border-radius:6px;background:linear-gradient(125deg,#3CB578,#134E33);flex-shrink:0;display:grid;place-items:center;font-size:10px}
#ob-root .pv .pvav{width:12px;height:12px;border-radius:99px;background:#CDE9D6;flex-shrink:0;display:grid;place-items:center;font-size:7px}
#ob-root .pv .pvtab{position:absolute;bottom:0;left:0;right:0;height:16px;background:#fff;border-top:1px solid #E6EDE6;display:flex;align-items:center;justify-content:space-around;font-size:8px;color:#b7c1ba}
#ob-root .pv .pvtab .on{color:#25A465}
#ob-root .pv .pvtab .plus{width:17px;height:17px;border-radius:99px;background:#25A465;color:#fff;display:grid;place-items:center;font-size:10px;margin-top:-8px}
#ob-root .pv .pvbars{display:flex;align-items:flex-end;gap:3px;height:32px;margin-top:3px;padding:0 2px}
#ob-root .pv .pvbars i{flex:1;background:linear-gradient(#7ED0A0,#25A465);border-radius:2px 2px 0 0}
#ob-root .pv .pvrow{display:flex;align-items:center;gap:5px;margin-bottom:5px}
#ob-root .pv .pvstat{flex:1;text-align:center;background:#fff;border:1px solid #E6EDE6;border-radius:6px;padding:5px 2px}
#ob-root .pv .pvstat b{font-size:10px;font-weight:800;color:#134E33;display:block}#ob-root .pv .pvstat.a b{color:#B9741E}#ob-root .pv .pvstat span{font-size:5px;color:#8a978d}
#ob-root .pv .pvheart{font-size:6px;color:#e05a6b}#ob-root .pv .pvmeta{font-size:5.5px;color:#9AA79E}
`
