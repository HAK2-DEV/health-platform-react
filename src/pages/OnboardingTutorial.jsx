import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

// 회원가입 직후 온보딩 튜토리얼 (마이페이지 「사용법 다시보기」로도 진입).
//   흐름: 환영 → 앱 소개 → 홈 화면 설치(실제 스샷+스포트라이트) → 알림 → 설명 선택 → 역할별 여정 → 마무리
//   설치 안내 스샷: public/onboarding/ios/*.png (원본 그대로, 그 위에 스포트라이트+손가락).
//   데모(artifact)로 설계 후 포팅. Android 스샷은 추후 — 지금은 CSS 목업.

const IOS = [
  { src: '/onboarding/ios/1-inapp.png', cap: '카톡·인스타 등에서 열었다면, 먼저 <b>브라우저에서 열기</b>를 눌러 Safari로 나가요',
    spot: { left: '52%', top: '11.5%', width: '44%', height: '5%' }, fin: { left: '72%', top: '17%' } },
  { src: '/onboarding/ios/2-share.png', cap: '메뉴에서 <b>공유</b>를 눌러요',
    spot: { left: '25%', top: '55.5%', width: '64%', height: '5.5%' }, fin: { left: '30%', top: '61%' } },
  { src: '/onboarding/ios/3-add-2.png', cap: '조금 내려서 <b>홈 화면에 추가</b>를 눌러요',
    spot: { left: '4%', top: '47.5%', width: '92%', height: '6%' }, fin: { left: '20%', top: '54%' } },
  { src: '/onboarding/ios/4-confirm.png', cap: '오른쪽 위 <b>추가</b>를 누르면 완료! 🎉 홈 화면에 도담 아이콘이 생겨요',
    spot: { left: '76%', top: '7%', width: '20%', height: '4.5%' }, fin: { left: '78%', top: '12.5%' } },
]

const JOURNEY = {
  p: { badge: '참여자', cls: 'p', title: '건강 습관, 이렇게 만들어요',
    steps: [
      { st: 'STEP 1', pv: 'p_find', h: '프로그램 찾기', p: '하단 <b>프로그램</b> 탭 →「둘러보기」에서 관심 카테고리로 찾아요. 초대 코드가 있으면 코드로 바로 참여!' },
      { st: 'STEP 2', pv: 'p_join', h: '참여하기', p: '카드를 눌러 상세를 보고「참여하기」. 공개 프로그램은 참여 전 <b>둘러보기</b>도 돼요.' },
      { st: 'STEP 3', pv: 'p_verify', h: '미션 인증', p: '오늘의 미션을 골라 <b>사진·기록</b>으로 인증. 자동 승인 또는 운영자 심사로 포인트!' },
      { st: 'STEP 4', pv: 'p_cheer', h: '응원 주고받기', p: '응원 탭에서 서로의 인증에 <b>응원·좋아요</b>를 남겨요.' },
      { st: 'STEP 5', pv: 'p_grow', h: '성장 확인', p: '성장 탭에서 <b>연속 인증·포인트·랭킹</b>과 내 변화를 한눈에.' },
    ], tab: '화면 맨 아래 <b>탭바</b> — 🏠 대시보드 · 🚩 프로그램 · ＋ 기록 · 🌿 성장 · 👤 마이', mini: '🏠🚩🌿👤' },
  o: { badge: '운영자', cls: 'o', title: '프로그램, 이렇게 운영해요',
    steps: [
      { st: 'STEP 1', pv: 'o_create', h: '프로그램 만들기', p: '하단 가운데 <b>＋</b> → 마법사로 이름·기간·카테고리 설정. <b>프리셋</b>이면 4분 완성!' },
      { st: 'STEP 2', pv: 'o_mission', h: '미션·퀴즈 구성', p: '매일 인증할 <b>미션</b>과 <b>퀴즈</b>를 추가. 점수·인증 방식(자동/심사)을 정해요.' },
      { st: 'STEP 3', pv: 'o_invite', h: '참여자 초대', p: '<b>코드·링크·카카오톡</b>으로 초대. 공개로 두면 둘러보기에 노출돼요.' },
      { st: 'STEP 4', pv: 'o_manage', h: '운영하기', p: '인증 <b>승인</b>·공지·신고 처리를 한 화면에서. 실시간 참여 현황 확인.' },
      { st: 'STEP 5', pv: 'o_report', h: '통계·종료 리포트', p: '참여율·미션 성과·랭킹을 <b>통계</b>로. 종료 시 완주율·<b>여정 퍼널</b> 리포트까지!' },
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

const LOGO = <svg viewBox="0 0 48 48" fill="none" width="60" height="60"><path d="M24 42V22" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" /><path d="M24 27C24 19 30 12 40 11C40 20 34 27 24 27Z" fill="#fff" /><path d="M24 31C24 24 18 18 9 18C9 26 15 31 24 31Z" fill="#DFF3E7" /></svg>

export default function OnboardingTutorial() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const replay = sp.get('replay') === '1'
  const TOTAL = 7
  const [step, setStep] = useState(0)
  const [role, setRole] = useState(null)
  const [scene, setScene] = useState(0)
  const [seen, setSeen] = useState({ p: false, o: false })
  const [notifOn, setNotifOn] = useState(false)
  const [ringing, setRinging] = useState(false)

  const go = (n) => { setStep(Math.max(0, Math.min(TOTAL - 1, n))); setScene(0); window.scrollTo(0, 0) }
  const finish = (dest) => { try { localStorage.setItem('onboarding-done', '1') } catch { /* 무시 */ } navigate(dest) }

  const allowNotif = () => {
    setRinging(true)
    setTimeout(() => setNotifOn(true), 620)
    setTimeout(() => go(4), 1500)
  }
  const pickRole = (r) => { setRole(r); setSeen(s => ({ ...s, [r]: true })); go(5) }

  const j = role ? JOURNEY[role] : null

  return (
    <div id="ob-root">
      <style>{STYLE}</style>
      <div className="ob-app">
        <div className="ob-top">
          <button className="ob-back" hidden={step === 0} onClick={() => go(step === 5 ? 4 : step - 1)} aria-label="뒤로">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="ob-bar"><i style={{ width: `${(step + 1) / TOTAL * 100}%` }} /></div>
          {step <= 3
            ? <button className="ob-skip" onClick={() => go(4)}>건너뛰기</button>
            : <button className="ob-skip" onClick={() => finish('/dashboard')}>{replay ? '닫기' : '건너뛰기'}</button>}
        </div>

        <div className="ob-stage">
          {/* 0 welcome */}
          {step === 0 && (
            <section className="ob-screen">
              <div className="ob-center">
                <div className="ob-hero">{LOGO}</div>
                <h1 className="ob-h1">건강, <span className="hl">함께</span> 시작해요</h1>
                <div className="ob-tag">🌱 운영은 쉽게, 건강은 단단하게</div>
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
                {[['/icons/cta/create.png', '✨', '직접 만들기', '직접 원하는 프로그램과 미션을 만들어 사람들과 함께해요.'],
                  ['/icons/feature/mission.png', '✅', '매일 미션 인증', '작은 미션을 인증하며 건강 습관을 단단하게 쌓아요.'],
                  ['/icons/feature/community.png', '💬', '함께 응원하고 성장', '서로 응원을 주고받고, 내 기록과 성장을 한눈에 확인해요.']].map(([src, emo, h, p], i) => (
                  <div className="ob-feat" key={h} style={{ animationDelay: `${0.05 + i * 0.1}s` }}>
                    <span className="ob-ic"><Ic3D src={src} emo={emo} /></span>
                    <div><h3>{h}</h3><p>{p}</p></div>
                  </div>
                ))}
              </div>
              <div className="ob-foot"><button className="ob-cta" onClick={() => go(2)}>다음</button></div>
            </section>
          )}

          {/* 2 install */}
          {step === 2 && (
            <section className="ob-screen">
              <div className="ob-eyebrow">홈 화면에 설치 <span style={{ color: 'var(--ob-faint)', fontWeight: 600 }}>· 1분이면 끝</span></div>
              <h1 className="ob-h1">도담을 <span className="hl">앱처럼</span> 열어요</h1>
              <div className="ob-scene">
                <div className="ob-rsframe">
                  <img className="ob-rs" src={IOS[scene].src} alt="" />
                  <div className="ob-spot" style={IOS[scene].spot} />
                  <span className="ob-finger" style={IOS[scene].fin}>👆</span>
                </div>
                <div className="ob-caption" dangerouslySetInnerHTML={{ __html: IOS[scene].cap }} />
                <div className="ob-dots">{IOS.map((_, i) => <i key={i} className={i === scene ? 'on' : ''} onClick={() => setScene(i)} />)}</div>
              </div>
              <div className="ob-foot">
                <div className="ob-scenenav">
                  <button disabled={scene === 0} onClick={() => setScene(Math.max(0, scene - 1))}>‹ 이전</button>
                  <button className="prim" onClick={() => scene === IOS.length - 1 ? go(3) : setScene(scene + 1)}>{scene === IOS.length - 1 ? '설치 끝! 다음 →' : '다음 단계 ›'}</button>
                </div>
                <button className="ob-cta ghost" style={{ marginTop: 9 }} onClick={() => go(3)}>설치했어요 · 건너뛰기</button>
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
                    <div className={`ob-bell${ringing ? ' ring' : ''}`}><span className="ob-wave" /><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg></div>
                    <div className="ob-perklist">
                      <div className="ob-perk"><span className="k">🌱</span> 새로운 미션·퀴즈·클래스 소식을 바로</div>
                      <div className="ob-perk"><span className="k">⏰</span> 오늘의 미션 리마인드</div>
                      <div className="ob-perk"><span className="k">❤️</span> 내 인증에 달린 응원·좋아요</div>
                      <div className="ob-perk"><span className="k">📢</span> 운영자의 새 공지</div>
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
                <button className="ob-cta" onClick={allowNotif}>🔔 알림 켜기</button>
                <button className="ob-cta ghost" onClick={() => go(4)}>나중에 할게요</button>
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
                {[['p', '🙋', '참여자 사용법', '프로그램 찾기 · 미션 인증 · 응원 · 성장까지'],
                  ['o', '🧑‍🏫', '운영자 사용법', '프로그램 만들기 · 초대 · 운영 · 리포트까지']].map(([r, emo, h, p]) => (
                  <button className={`ob-role ${r}`} key={r} onClick={() => pickRole(r)}>
                    <span className="emo">{emo}</span>
                    <div><h3>{h}</h3><p>{p}</p></div>
                    {seen[r]
                      ? <span className="seen">✓ 봤어요</span>
                      : <span className="arw"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></span>}
                  </button>
                ))}
              </div>
              <div className="ob-foot"><button className="ob-cta ghost" onClick={() => go(6)}>이제 시작할게요 →</button></div>
            </section>
          )}

          {/* 5 journey */}
          {step === 5 && j && (
            <section className="ob-screen">
              <div className="ob-jhead"><span className={`ob-badge ${j.cls}`}>{j.badge}</span><div className="ob-eyebrow" style={{ margin: 0 }}>사용법 · 실제 화면</div></div>
              <h1 className="ob-h1" style={{ fontSize: 21 }}>{j.title}</h1>
              <div style={{ flex: 1 }}>
                <div className="ob-jsteps">
                  {j.steps.map((s) => (
                    <div className={`ob-jc ${j.cls}`} key={s.st}>
                      <div className="ob-prev" dangerouslySetInnerHTML={{ __html: PREV[s.pv] }} />
                      <div className="txt"><div className="st">{s.st}</div><h3>{s.h}</h3><p dangerouslySetInnerHTML={{ __html: s.p }} /></div>
                    </div>
                  ))}
                </div>
                <div className="ob-tabhint"><span className="mini">{j.mini}</span><p dangerouslySetInnerHTML={{ __html: j.tab }} /></div>
              </div>
              <div className="ob-foot">
                <button className="ob-cta" onClick={() => go(4)}>다른 설명도 볼래요</button>
                <button className="ob-cta ghost" onClick={() => go(6)}>이제 시작할게요 →</button>
              </div>
            </section>
          )}

          {/* 6 finish */}
          {step === 6 && (
            <section className="ob-screen">
              <div className="ob-center">
                <div className="ob-hero">{LOGO}</div>
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

// 3D 아이콘 + 이모지 폴백
function Ic3D({ src, emo }) {
  const [err, setErr] = useState(false)
  if (err) return <span style={{ fontSize: 24 }}>{emo}</span>
  return <img src={src} alt="" onError={() => setErr(true)} style={{ width: 32, height: 32, objectFit: 'contain' }} />
}

const STYLE = `
#ob-root{--ob-bg:#F7F5EF;--ob-surface:#fff;--ob-surface2:#F3F7F3;--ob-ink:#182420;--ob-muted:#66756B;--ob-faint:#9AA79E;--ob-green:#1F7A4D;--ob-green-br:#25A465;--ob-green-dp:#134E33;--ob-soft:#E7F3EB;--ob-tint:#F1F8F2;--ob-line:#E6EDE6;--ob-amber:#D98829;--ob-amber-soft:#FBF0DE;--ob-shadow:0 10px 30px -12px rgba(19,78,51,.28);--ob-shadow-sm:0 3px 12px -6px rgba(19,78,51,.22);--ob-ff:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR','Segoe UI',sans-serif}
#ob-root{position:fixed;inset:0;z-index:2000;background:var(--ob-bg);font-family:var(--ob-ff);color:var(--ob-ink)}
#ob-root *{box-sizing:border-box}
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
#ob-root .ob-hero{width:110px;height:110px;border-radius:34px;background:radial-gradient(120% 120% at 30% 20%,var(--ob-green-br),var(--ob-green-dp));display:grid;place-items:center;box-shadow:0 18px 40px -14px color-mix(in srgb,var(--ob-green) 60%,transparent);animation:obpop .6s cubic-bezier(.2,1.3,.5,1) both}
@keyframes obpop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:none}}
#ob-root .ob-center .ob-h1{margin-top:20px}
#ob-root .ob-tag{margin-top:14px;display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:99px;background:var(--ob-soft);color:var(--ob-green-dp);font-size:13px;font-weight:700}
#ob-root .ob-feat{display:flex;align-items:flex-start;gap:14px;padding:15px;border-radius:20px;background:var(--ob-surface);border:1px solid var(--ob-line);box-shadow:var(--ob-shadow-sm);opacity:0;transform:translateY(12px);animation:obrise .5s cubic-bezier(.2,.8,.3,1) forwards}
#ob-root .ob-feat+.ob-feat{margin-top:10px}
@keyframes obrise{to{opacity:1;transform:none}}
#ob-root .ob-feat .ob-ic{width:46px;height:46px;border-radius:14px;background:var(--ob-soft);display:grid;place-items:center;font-size:24px;flex-shrink:0}
#ob-root .ob-feat h3{font-size:15.5px;font-weight:800}#ob-root .ob-feat p{font-size:13px;line-height:1.5;color:var(--ob-muted);margin-top:3px}
#ob-root .ob-scene{margin-top:14px;flex:1;display:flex;flex-direction:column;align-items:center}
#ob-root .ob-rsframe{position:relative;width:202px;aspect-ratio:640/1387;border-radius:26px;overflow:hidden;border:5px solid #111;box-shadow:var(--ob-shadow);flex-shrink:0;background:#fff}
#ob-root .ob-rs{width:100%;height:100%;object-fit:cover;display:block}
#ob-root .ob-spot{position:absolute;border-radius:10px;box-shadow:0 0 0 3px var(--ob-green-br),0 0 0 8px color-mix(in srgb,var(--ob-green-br) 30%,transparent);animation:obhalo 1.5s ease-in-out infinite;z-index:3}
@keyframes obhalo{0%,100%{box-shadow:0 0 0 3px var(--ob-green-br),0 0 0 8px color-mix(in srgb,var(--ob-green-br) 35%,transparent)}50%{box-shadow:0 0 0 3px var(--ob-green-br),0 0 0 13px color-mix(in srgb,var(--ob-green-br) 8%,transparent)}}
#ob-root .ob-finger{position:absolute;z-index:4;font-size:28px;filter:drop-shadow(0 4px 5px rgba(0,0,0,.4));animation:obtap 1.5s ease-in-out infinite;pointer-events:none}
@keyframes obtap{0%,100%{transform:translateY(3px) rotate(-8deg)}50%{transform:translateY(-5px) rotate(-8deg)}}
#ob-root .ob-caption{margin-top:15px;text-align:center;font-size:15px;line-height:1.55;font-weight:600;min-height:42px}
#ob-root .ob-caption b{color:var(--ob-green);font-weight:800}
#ob-root .ob-dots{display:flex;gap:7px;justify-content:center;margin-top:8px}
#ob-root .ob-dots i{width:7px;height:7px;border-radius:99px;background:var(--ob-line);cursor:pointer;transition:.2s}
#ob-root .ob-dots i.on{width:22px;background:var(--ob-green)}
#ob-root .ob-scenenav{display:flex;gap:9px}
#ob-root .ob-scenenav button{flex:1;height:44px;border-radius:13px;border:1px solid var(--ob-line);background:var(--ob-surface);color:var(--ob-ink);font-family:var(--ob-ff);font-size:14px;font-weight:700;cursor:pointer}
#ob-root .ob-scenenav button.prim{background:var(--ob-green);color:#fff;border-color:var(--ob-green)}
#ob-root .ob-scenenav button:disabled{opacity:.4}
#ob-root .ob-bell{width:100px;height:100px;border-radius:30px;background:var(--ob-soft);display:grid;place-items:center;position:relative;margin:0 auto}
#ob-root .ob-bell svg{width:50px;height:50px;color:var(--ob-green);transform-origin:50% 12%}
#ob-root .ob-bell.ring svg{animation:obring .8s ease}
@keyframes obring{0%,100%{transform:rotate(0)}20%{transform:rotate(16deg)}40%{transform:rotate(-13deg)}60%{transform:rotate(9deg)}80%{transform:rotate(-5deg)}}
#ob-root .ob-wave{position:absolute;inset:-6px;border-radius:36px;border:2px solid var(--ob-green);opacity:0}
#ob-root .ob-bell.ring .ob-wave{animation:obwv 1s ease-out}
@keyframes obwv{0%{opacity:.5;transform:scale(.9)}100%{opacity:0;transform:scale(1.35)}}
#ob-root .ob-perklist{margin-top:22px;display:flex;flex-direction:column;gap:11px}
#ob-root .ob-perk{display:flex;align-items:center;gap:11px;font-size:14px;color:var(--ob-muted)}
#ob-root .ob-perk .k{width:28px;height:28px;border-radius:9px;background:var(--ob-soft);display:grid;place-items:center;font-size:16px;flex-shrink:0}
#ob-root .ob-granted{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
#ob-root .ob-granted .ok{width:64px;height:64px;border-radius:99px;background:var(--ob-green);display:grid;place-items:center;color:#fff;animation:obpop .5s cubic-bezier(.2,1.3,.5,1) both}
#ob-root .ob-granted .ok svg{width:34px;height:34px}
#ob-root .ob-role{width:100%;text-align:left;padding:19px;border-radius:20px;background:var(--ob-surface);border:1.5px solid var(--ob-line);cursor:pointer;transition:.2s;display:flex;align-items:center;gap:15px;font-family:var(--ob-ff);color:var(--ob-ink)}
#ob-root .ob-role+.ob-role{margin-top:11px}
#ob-root .ob-role:hover{border-color:var(--ob-green)}
#ob-root .ob-role .emo{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;font-size:28px;flex-shrink:0}
#ob-root .ob-role.p .emo{background:var(--ob-soft)}#ob-root .ob-role.o .emo{background:var(--ob-amber-soft)}
#ob-root .ob-role h3{font-size:16.5px;font-weight:800}#ob-root .ob-role p{font-size:12.5px;color:var(--ob-muted);margin-top:3px;line-height:1.45}
#ob-root .ob-role .arw{margin-left:auto;color:var(--ob-faint)}
#ob-root .ob-role .seen{margin-left:auto;font-size:11px;font-weight:700;color:var(--ob-green);background:var(--ob-soft);padding:4px 9px;border-radius:99px}
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
