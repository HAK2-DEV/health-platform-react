import { useState } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, Users, Loader2, Check, Pencil, X } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { fetchSession, fetchMyRegistrations, registerSession, cancelSessionRegistration, fetchMyAttendance, requestSelfAttendance, checkInWithCode, updateSession, formatKstDate } from '../../lib/queries'
import { catOf } from '../../lib/classCategories'
import { useAvatarViewer } from '../../contexts/AvatarViewerContext'
import AttendanceRosterModal from './AttendanceRosterModal'
import CoverImageUploader from '../common/CoverImageUploader'
import { signupOpenAt } from '../../lib/classSignup'

const CODE_ERR = {
  wrong_code: '코드가 일치하지 않아요.',
  no_code: '아직 출석 코드가 등록되지 않았어요.',
  not_participant: '참여자만 출석할 수 있어요.',
  not_registered: '신청한 참가자만 출석할 수 있어요.',
  too_early: '아직 출석 시간이 아니에요.',
  too_late: '출석 가능 시간이 지났어요.',
  mode: '출석할 수 없는 클래스예요.',
  not_found: '클래스를 찾을 수 없어요.',
}

// 참가자 클래스 상세 — 히어로·강사·정보·안내 + 신청/취소(RSVP).
//   참가자는 정원·본인 상태만(명단은 RLS 로 비공개). 운영자는 「클래스 관리」에서 명단 확인.
const WD = ['일', '월', '화', '수', '목', '금', '토']
const dLabel = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})` }
const tLabel = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

// 정원 충족도 → 색·문구. 찰수록 여유(초록)→모집중(주황)→곧 마감(빨강) 으로 긴박감을 준다.
//   임계: 10% 미만 아주 여유 / 50%~ 모집중 / 80%~ 곧 마감 / 가득 마감.
function capacityTier(joined, capacity) {
  const pct = capacity > 0 ? joined / capacity : 0
  if (capacity > 0 && joined >= capacity) return { pct: 1, color: '#ef4444', label: '마감됐어요', cls: 'text-red-600' }
  if (pct >= 0.8) return { pct, color: '#ef4444', label: '곧 마감돼요', cls: 'text-red-600' }
  if (pct >= 0.5) return { pct, color: '#f59e0b', label: '모집 중', cls: 'text-amber-600' }
  if (pct >= 0.1) return { pct, color: '#10b981', label: '여유 있어요', cls: 'text-emerald-600' }
  return { pct, color: '#34d399', label: '여유 있어요', cls: 'text-emerald-600' }  // 10% 미만 (연한 초록)
}

// 정원 링 — 미션/퀴즈 제출 링(대시보드 RankRing)과 동일한 SVG 원주 기법.
function CapacityBlock({ joined, capacity, points }) {
  const R = 26, C = 2 * Math.PI * R
  const t = capacityTier(joined, capacity)
  const shown = Math.max(t.pct, joined > 0 ? 0.04 : 0)   // 1명이라도 있으면 최소 호(arc) 보이게
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-16 flex-shrink-0">
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r={R} fill="none" stroke="#eef1ee" strokeWidth="6" />
          <circle cx="32" cy="32" r={R} fill="none" stroke={t.color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - shown)}
            style={{ transition: 'stroke-dashoffset .6s ease, stroke .3s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center leading-none">
          <span className="text-[14px] font-extrabold text-gray-900">{joined}<span className="text-[10px] text-gray-400 font-bold">/{capacity}</span></span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-gray-800">정원 {joined}/{capacity}명</p>
        <p className={`text-[12.5px] font-bold ${t.cls}`}>{t.label}</p>
        <p className="text-[11px] text-gray-400">사전 신청{points ? ` · 출석 +${points}P` : ''}</p>
      </div>
    </div>
  )
}

export default function ClassDetail({ sessionId, programId, userId, isOwner = false, attendanceMode = 'operator_roll', checkinBeforeMin = 30, signupLeadDays = null, signupOpenTime = null, programEnded = false }) {
  const qc = useQueryClient()
  const { open: openAvatar } = useAvatarViewer()
  const { data: s, isLoading } = useQuery({ queryKey: ['session', sessionId], queryFn: () => fetchSession(sessionId), enabled: !!sessionId })
  const { data: myRegs = {} } = useQuery({
    queryKey: ['my-registrations', programId, userId], queryFn: () => fetchMyRegistrations({ programId, userId }), enabled: !!programId && !!userId,
  })
  const { data: myAtt = null } = useQuery({
    queryKey: ['my-attendance', sessionId, userId], queryFn: () => fetchMyAttendance({ sessionId, userId }), enabled: !!sessionId && !!userId && !isOwner,
  })
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['session', sessionId] })
    qc.invalidateQueries({ queryKey: ['sessions', programId] })
    qc.invalidateQueries({ queryKey: ['my-registrations', programId, userId] })
  }
  const mReg = useMutation({
    mutationFn: () => registerSession({ sessionId, userId }),
    onSuccess: () => { setRegErr(null); invalidate() },
    // 서버 정원 강제(마이그 170) — 방금 정원이 찬 경우(레이스) 안내 + 목록 새로고침
    onError: (e) => { setRegErr(/SESSION_FULL|capacity/.test(e?.message || '') ? '방금 정원이 다 찼어요. 다른 참가자가 먼저 신청했습니다.' : '신청에 실패했어요. 잠시 후 다시 시도해주세요.'); invalidate() },
  })
  const mCancel = useMutation({ mutationFn: () => cancelSessionRegistration({ sessionId, userId }), onSuccess: invalidate })
  const mSelfAtt = useMutation({
    mutationFn: () => requestSelfAttendance({ sessionId, userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-attendance', sessionId, userId] }),
  })
  const [code, setCode] = useState('')
  const [codeErr, setCodeErr] = useState(null)
  const [regErr, setRegErr] = useState(null)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [heroEditOpen, setHeroEditOpen] = useState(false)
  useBodyScrollLock(heroEditOpen)  // 히어로 편집 오버레이 — iOS 배경 스크롤 방지
  useBackButtonClose(heroEditOpen, () => setHeroEditOpen(false))  // 하드웨어 뒤로가기 = 닫기
  const mCover = useMutation({
    mutationFn: (coverPath) => updateSession(sessionId, { cover_path: coverPath }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['session', sessionId] }); qc.invalidateQueries({ queryKey: ['sessions', programId] }) },
  })
  const mCheckIn = useMutation({
    mutationFn: () => checkInWithCode({ sessionId, code: code.trim() }),
    onSuccess: (result) => {
      if (result === 'ok') { setCodeErr(null); setCode(''); qc.invalidateQueries({ queryKey: ['my-attendance', sessionId, userId] }) }
      else setCodeErr(CODE_ERR[result] || '출석에 실패했어요.')
    },
    onError: () => setCodeErr('출석에 실패했어요.'),
  })
  const busy = mReg.isPending || mCancel.isPending

  if (isLoading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
  if (!s) return <p className="text-[13px] text-gray-500 py-16 text-center">클래스를 찾을 수 없어요.</p>

  const c = catOf(s.category)
  const coverUrl = s.cover_path ? supabase.storage.from('program-covers').getPublicUrl(s.cover_path).data?.publicUrl : null
  const mine = myRegs[s.id] === 'registered'
  const full = s.capacity != null && (s.joined ?? 0) >= s.capacity && !mine
  const isRsvp = s.signup_mode === 'rsvp'
  const isClassDay = formatKstDate(new Date(s.starts_at)) === formatKstDate(new Date())
  // 자가출석 게이팅 — 신청자(rsvp) + 시작 N분 전 ~ 종료 후 3시간
  const startMs = new Date(s.starts_at).getTime()
  const endMs = s.ends_at ? new Date(s.ends_at).getTime() : startMs
  const nowMs = Date.now()
  const openMs = startMs - (checkinBeforeMin || 30) * 60000
  const closeMs = endMs + 3 * 3600000
  // 신청 개방 — 이 클래스 설정 우선(세션), 없으면 프로그램 기본. 0/미설정 = 항상 열림.
  const effLeadDays = s.signup_lead_days ?? signupLeadDays
  // 개방 시각도 같은 2단 구조 — 이 클래스 설정 우선, 없으면 프로그램 기본. 둘 다 없으면 시작 시각.
  const effOpenTime = s.signup_open_time ?? signupOpenTime
  const signupOpensMs = effLeadDays > 0 ? signupOpenAt(startMs, effLeadDays, effOpenTime) : null
  const signupNotYet = signupOpensMs != null && nowMs < signupOpensMs
  const attended = myAtt === 'confirmed'                       // 출석 확정 후 → 취소 불가
  const signupClosed = nowMs > endMs || programEnded           // 세션 종료·프로그램 종료 후 → 취소 불가
  const registered = !isRsvp || mine        // open 클래스는 신청 불필요
  const attMsg = !registered ? '신청한 참가자만 출석할 수 있어요'
    : nowMs < openMs ? `출석은 시작 ${checkinBeforeMin || 30}분 전부터 가능해요`
    : nowMs > closeMs ? '출석 가능 시간이 지났어요'
    : null                                   // null = 출석 가능
  const grayBox = 'w-full h-11 rounded-xl bg-gray-100 text-gray-500 font-bold flex items-center justify-center text-[13px] break-keep px-3 text-center'
  // 히어로 배지 — "지금 이 클래스는 어떤 상태인가" 를 한 단어로. 아래 CTA 와 같은 순서로 판단한다.
  const heroStatus =
    signupClosed ? { label: '종료', cls: 'bg-gray-100 text-gray-500' }
    : !isRsvp ? { label: '자유 참여', cls: 'bg-emerald-50 text-emerald-700' }
    : mine ? { label: '신청됨', cls: 'bg-emerald-50 text-emerald-700' }
    : signupNotYet ? { label: '신청 예정', cls: 'bg-amber-50 text-amber-700' }
    : full ? { label: '마감', cls: 'bg-red-50 text-red-600' }
    : { label: '신청 가능', cls: 'bg-emerald-50 text-emerald-700' }

  return (
    <div className="space-y-[9px]">
      {/* 히어로 — 프로그램 카드홈(ProgramHomeHero)과 같은 구조:
          전체폭 커버 → 하단을 흰색으로 녹이는 페이드 → 그 위에 어두운 글씨의 타이틀 블록.
          이전엔 사진 없는 흰 박스에 제목만 있어 화면 위쪽이 텅 비어 보였다.
          사진이 없으면 종목 그라데이션 + 아이콘이 커버를 채우므로 항상 꽉 찬다. */}
      {/* 테두리 없음 — 제목 블록을 페이드 위로 끌어올리다 보니 하단 테두리가 제목에 바짝 붙어
          「제목만 담긴 흰 띠」처럼 보였다. 사진이 배경으로 녹아드는 결을 살린다.
          그림자도 shadow-soft — shadow-elevated 는 초록빛(16 185 129)이 3px 아래로 깔려
          흰 배경에서 카드 하단이 «연한 초록 선»으로 보였다. 아래 카드들과 같은 그림자로 맞춘다. */}
      <div className="relative rounded-2xl overflow-hidden shadow-soft bg-white">
        <div className="relative h-[178px]">
          {coverUrl ? (
            /* 히어로는 첫 화면이라 lazy 는 부적절(늦게 뜬다). decoding=async 로 디코딩만 메인스레드에서 뺀다. */
            <img src={coverUrl} alt="" aria-hidden="true" decoding="async"
              className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            /* 사진 없을 때 — 흰 바탕에 종목 아이콘만. (종목 그라데이션은 본인 결정으로 뺐다) */
            <div className="absolute inset-0 bg-white flex items-center justify-center">
              {c.icon
                ? <img src={c.icon} alt="" aria-hidden="true" className="w-16 h-16 object-contain opacity-90" />
                : <span className="text-5xl" aria-hidden="true">{c.emoji}</span>}
            </div>
          )}
          {/* 하단 밝은 페이드 — 사진을 카드 배경(흰색)으로 녹여 아래 타이틀이 어두운 글씨로 읽히게.
              ⚠️ 시작색은 반드시 rgba(255,255,255,0) — `#ffffff00`(8자리 hex)을 못 읽는 브라우저는
                 이를 `transparent`= «투명한 검정»으로 폴백해, 흰색으로 보간되는 구간에 회색 띠가 생긴다.
                 (사진 아래에 경계선이 보이던 원인)
              끝색을 -1px 넘겨 이미지 하단을 확실히 덮는다(서브픽셀 반올림으로 1px 남는 것 방지). */}
          <div className="absolute inset-x-0 bottom-[-1px] h-[119px] pointer-events-none"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 72%)' }} />

          {isOwner && !programEnded && (
            <button type="button" onClick={() => setHeroEditOpen(true)}
              className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-600 hover:bg-white hover:text-emerald-600 transition" aria-label="대표 사진 편집">
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 타이틀 블록 — 페이드 위로 끌어올려 겹친다 */}
        <div className="relative -mt-[74px] px-4 pb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full ${heroStatus.cls}`}>
              <span className="text-[7px]">●</span>{heroStatus.label}
            </span>
            <span className="text-[11.5px] font-semibold text-gray-600">
              {dLabel(s.starts_at)} {tLabel(s.starts_at)}{s.ends_at ? `~${tLabel(s.ends_at)}` : ''}
            </span>
          </div>
          <h2 className="text-[22px] font-extrabold text-gray-900 leading-[1.18] tracking-[-.02em] break-keep">{s.title}</h2>
          <p className="text-[12.5px] font-semibold text-gray-600 mt-1.5">
            {isRsvp
              ? `신청 ${s.joined ?? 0}${s.capacity ? `/${s.capacity}` : ''}명`
              : '자유 참여'}
            {s.instructor?.name ? ` · ${s.instructor.name} 강사` : ''}
          </p>
        </div>
      </div>

      {/* 강사 카드 */}
      {s.instructor && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4 flex items-center gap-3">
          {s.instructor.photo_path
            ? (() => {
                const photoUrl = supabase.storage.from('program-covers').getPublicUrl(s.instructor.photo_path).data?.publicUrl
                return (
                  <button type="button" onClick={() => openAvatar({ url: photoUrl, nickname: `${s.instructor.name || ''} 강사`.trim() })}
                    className="flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-300" aria-label="강사 사진 크게 보기">
                    <img src={photoUrl} alt="" loading="lazy" decoding="async" className="w-12 h-12 rounded-full object-cover" />
                  </button>
                )
              })()
            : <span className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 text-lg font-bold flex items-center justify-center flex-shrink-0">{(s.instructor.name || '?')[0]}</span>}
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-gray-900">{s.instructor.name} 강사</p>
            {s.instructor.specialty && <p className="text-[12px] text-gray-500">{s.instructor.specialty}</p>}
            {s.instructor.bio && <p className="text-[12px] text-gray-500 mt-0.5 break-keep leading-snug">{s.instructor.bio}</p>}
          </div>
        </div>
      )}

      {/* 정보 — 장소·정원. (종목 뱃지·일시는 히어로로 올라가 여기선 뺐다 — 같은 걸 두 번 읽히지 않게) */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4 space-y-2.5">
        {(s.place_name || s.place_address) && (
          <p className="flex items-center gap-2 text-[13px] text-gray-700"><MapPin className="w-4 h-4 text-emerald-500 flex-shrink-0" />{[s.place_name, s.place_address].filter(Boolean).join(' · ')}</p>
        )}
        {isRsvp && s.capacity ? (
          <CapacityBlock joined={s.joined ?? 0} capacity={s.capacity} points={s.points} />
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-gray-700"><Users className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            {isRsvp ? '정원 무제한 · 사전 신청' : '자유 참여'}{s.points ? ` · 출석 +${s.points}P` : ''}
          </p>
        )}
      </div>

      {/* 안내 */}
      {s.description && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4">
          <p className="text-[13px] font-bold text-gray-800 mb-1">안내 · 준비물</p>
          <p className="text-[12px] text-gray-500 leading-relaxed break-keep">{s.description}</p>
        </div>
      )}

      {/* CTA — 운영자는 출석부 바로 관리, 참가자는 신청 */}
      {isOwner ? (
        <button type="button" onClick={() => setRosterOpen(true)}
          className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition">
          출석부 관리
        </button>
      ) : !isRsvp ? (
        <div className="w-full h-12 rounded-2xl bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center">자유 참여 · 신청 없이 참석하세요</div>
      ) : mine ? (
        attended ? (
          <div className="w-full h-12 rounded-2xl bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center gap-1.5"><Check className="w-4 h-4" />출석 완료</div>
        ) : signupClosed ? (
          <div className="w-full h-12 rounded-2xl bg-gray-100 text-gray-500 font-bold flex items-center justify-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" />신청됨 · {programEnded ? '종료된 프로그램' : '종료된 클래스'}</div>
        ) : (
          <button type="button" onClick={() => mCancel.mutate()} disabled={busy}
            className="w-full h-12 rounded-2xl bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}신청 취소 (신청됨 ✓)
          </button>
        )
      ) : signupNotYet ? (
        <div className="w-full h-12 rounded-2xl bg-gray-100 text-gray-500 font-bold flex flex-col items-center justify-center leading-tight text-center px-3 break-keep">
          <span className="text-[13px]">{dLabel(new Date(signupOpensMs).toISOString())} {tLabel(new Date(signupOpensMs).toISOString())}부터 신청 가능</span>
          <span className="text-[11px] text-gray-400 font-semibold">아직 신청 기간이 아니에요</span>
        </div>
      ) : full ? (
        <div className="w-full h-12 rounded-2xl bg-gray-100 text-gray-400 font-bold flex items-center justify-center">정원 마감</div>
      ) : (
        <button type="button" onClick={() => mReg.mutate()} disabled={busy}
          className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}신청하기
        </button>
      )}
      {regErr && <p className="text-[12px] text-red-500 font-semibold text-center mt-1.5 break-keep">{regErr}</p>}

      {/* 자가출석(self_approve) — 당일 참가자, 신청·시간창 게이팅 */}
      {!isOwner && attendanceMode === 'self_approve' && isClassDay && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4">
          <p className="text-[13px] font-bold text-gray-800 mb-2">오늘 출석</p>
          {myAtt === 'confirmed' ? (
            <div className="w-full h-11 rounded-xl bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center gap-1"><Check className="w-4 h-4" /> 출석 완료</div>
          ) : myAtt === 'pending' ? (
            <div className="w-full h-11 rounded-xl bg-amber-50 text-amber-600 font-bold flex items-center justify-center">출석 요청됨 · 승인 대기</div>
          ) : myAtt === 'rejected' ? (
            <div className="w-full h-11 rounded-xl bg-gray-100 text-gray-400 font-bold flex items-center justify-center">출석 미인정</div>
          ) : attMsg ? (
            <div className={grayBox}>{attMsg}</div>
          ) : (
            <button type="button" onClick={() => mSelfAtt.mutate()} disabled={mSelfAtt.isPending}
              className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition disabled:opacity-50 flex items-center justify-center gap-2">
              {mSelfAtt.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}출석 요청
            </button>
          )}
          <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">운영자가 승인하면 출석 포인트가 부여돼요.</p>
        </div>
      )}

      {/* venue_code — 당일 참가자, 신청·시간창 게이팅 후 현장 코드 입력 */}
      {!isOwner && attendanceMode === 'venue_code' && isClassDay && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4">
          <p className="text-[13px] font-bold text-gray-800 mb-2">오늘 출석</p>
          {myAtt === 'confirmed' ? (
            <div className="w-full h-11 rounded-xl bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center gap-1"><Check className="w-4 h-4" /> 출석 완료</div>
          ) : attMsg ? (
            <div className={grayBox}>{attMsg}</div>
          ) : (
            <>
              <div className="flex gap-2">
                <input value={code} onChange={e => { setCode(e.target.value); setCodeErr(null) }} placeholder="현장 코드 입력" maxLength={12}
                  className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-gray-200 text-[15px] font-bold tracking-widest text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                <button type="button" onClick={() => mCheckIn.mutate()} disabled={mCheckIn.isPending || !code.trim()}
                  className="h-11 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 flex-shrink-0 whitespace-nowrap">
                  {mCheckIn.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}출석
                </button>
              </div>
              {codeErr && <p className="text-[12px] text-red-500 mt-2">{codeErr}</p>}
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">강사가 현장에서 알려준 코드를 입력하면 출석돼요.</p>
            </>
          )}
        </div>
      )}

      {/* operator_roll — 참가자 안내(당일) */}
      {!isOwner && attendanceMode === 'operator_roll' && isClassDay && (
        <p className="text-[12px] text-gray-400 text-center">출석은 현장에서 운영자가 확인해요.</p>
      )}

      {/* 운영자 출석부 — 이 화면에서 바로 */}
      {isOwner && rosterOpen && (
        <AttendanceRosterModal session={s} confirmedBy={userId} attendanceMode={attendanceMode} onClose={() => setRosterOpen(false)} />
      )}

      {/* 운영자 대표 사진 편집 (개요 프로필과 동일 업로더) */}
      {isOwner && heroEditOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45" onClick={() => setHeroEditOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[16px] font-bold text-gray-900">클래스 대표 사진</h3>
              <button type="button" onClick={() => setHeroEditOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <CoverImageUploader
              ownerId={userId}
              imagePath={s.cover_path}
              onChange={(newPath) => mCover.mutate(newPath)}
              categories={[]}
              name={s.title}
              disabled={mCover.isPending}
            />
          </div>
        </div>
      )}
    </div>
  )
}
