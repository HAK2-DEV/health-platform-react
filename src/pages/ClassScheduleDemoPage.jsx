import { Calendar, Clock, MapPin, Users, ChevronRight, ChevronLeft, Bell, Check } from 'lucide-react'
import { CLASS_CATEGORIES as CATS } from '../lib/classCategories'

// 데모 — 강사 클래스 「개요 진입 카드 · 전체 일정 · 클래스 상세」. /class-schedule-demo
//   참가자 화면 기준. 종목 색/아이콘은 공용 classCategories 사용(실화면과 동일).
const WD = ['일', '월', '화', '수', '목', '금', '토']
const today = new Date()
const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d }
const dLabel = (d) => `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`
const catBadge = (c) => c.icon ? <img src={c.icon} alt="" aria-hidden="true" className="w-4 h-4 object-contain" /> : c.emoji

const SESSIONS = [
  { id: 1, cat: 'yoga', title: '하타 요가 · 코어 안정화', instr: '김서연', spec: '요가 지도자 · 8년', date: addDays(2), time: '19:00~20:00', place: '스튜디오 A (2층)', cap: 12, joined: 8, signup: 'rsvp', mine: true, week: '이번 주' },
  { id: 2, cat: 'crossfit', title: '크로스핏 입문 WOD', instr: '박준호', spec: '크로스핏 L2 코치', date: addDays(4), time: '20:00~21:00', place: '짐 B', cap: 10, joined: 6, signup: 'rsvp', mine: false, week: '이번 주' },
  { id: 3, cat: 'pilates', title: '필라테스 · 자세 교정', instr: '이민지', spec: '필라테스 전문', date: addDays(8), time: '10:00~11:00', place: '스튜디오 A (2층)', cap: null, joined: 5, signup: 'open', mine: false, week: '다음 주' },
]

// ── 개요 진입 카드 ─────────────────────────────
function OverviewCard() {
  const upcoming = SESSIONS.slice(0, 2)
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4">
      <div className="flex items-center gap-2 mb-3">
        <img src="/icons/feature/attendance.png" alt="" aria-hidden="true" className="w-6 h-6 object-contain" />
        <h3 className="text-sm font-bold text-gray-800">클래스 일정</h3>
        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">이번 주 2</span>
        <span className="ml-auto inline-flex items-center text-[12px] text-gray-400">전체 보기 <ChevronRight className="w-4 h-4" /></span>
      </div>
      <div className="space-y-2">
        {upcoming.map(s => {
          const c = CATS[s.cat]
          return (
            <div key={s.id} className="flex items-center gap-3 rounded-xl bg-gray-50 p-2.5">
              <span className={`inline-flex items-center gap-1 px-2 h-6 rounded-lg text-[11px] font-bold flex-shrink-0 ${c.pill}`}>{catBadge(c)} {c.label}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-gray-800 truncate">{s.title}</p>
                <p className="text-[11px] text-gray-500 truncate">{dLabel(s.date)} · {s.time.split('~')[0]} · {s.instr} 강사</p>
              </div>
              {s.mine
                ? <span className="text-[11px] font-bold text-emerald-600 flex-shrink-0">신청됨</span>
                : <span className="text-[11px] text-gray-400 flex-shrink-0">{s.joined}/{s.cap}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 전체 일정 리스트 ───────────────────────────
function ClassCard({ s }) {
  const c = CATS[s.cat]
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 px-2 h-6 rounded-lg text-[11px] font-bold ${c.pill}`}>{catBadge(c)} {c.label}</span>
        <span className="text-[11px] text-gray-400 ml-auto">{s.signup === 'rsvp' ? '사전 신청' : '자유 참여'}</span>
      </div>
      <p className="text-[15px] font-bold text-gray-900 mb-1.5">{s.title}</p>
      <div className="space-y-1 text-[12px] text-gray-500">
        <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" />{dLabel(s.date)} {s.time}</p>
        <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" />{s.place}</p>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
        <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-[12px] font-bold flex items-center justify-center flex-shrink-0">{s.instr[0]}</span>
        <span className="text-[12px] text-gray-600 min-w-0 truncate">{s.instr} 강사</span>
        {s.signup === 'rsvp' && (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 ml-auto flex-shrink-0"><Users className="w-3.5 h-3.5" />{s.joined}/{s.cap}</span>
        )}
        <button type="button" className={`${s.signup === 'rsvp' ? '' : 'ml-auto'} flex-shrink-0 h-8 px-3.5 rounded-lg text-[12px] font-bold transition ${s.mine ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500 text-white'}`}>
          {s.mine ? '신청됨 ✓' : s.signup === 'rsvp' ? '신청하기' : '참여 예정'}
        </button>
      </div>
    </div>
  )
}

function ScheduleList() {
  const weeks = ['이번 주', '다음 주']
  return (
    <div className="space-y-3">
      {weeks.map(w => (
        <div key={w}>
          <p className="text-[12px] font-bold text-gray-400 mb-2 px-0.5">{w}</p>
          <div className="space-y-2.5">
            {SESSIONS.filter(s => s.week === w).map(s => <ClassCard key={s.id} s={s} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 클래스 상세 ────────────────────────────────
function ClassDetail() {
  const s = SESSIONS[0]
  const c = CATS[s.cat]
  return (
    <div className="space-y-[9px]">
      {/* 히어로 — 고정 높이. 기본 흰 배경 + 좌상단 제목 (실화면은 사진 있으면 그 위에 오버레이) */}
      <div className="relative h-[132px] rounded-2xl overflow-hidden shadow-elevated bg-white border border-gray-100">
        <h2 className="absolute top-4 left-4 right-14 text-xl font-extrabold text-gray-900 leading-tight line-clamp-2">{s.title}</h2>
      </div>
      {/* 강사 카드 */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4 flex items-center gap-3">
        <span className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 text-lg font-bold flex items-center justify-center flex-shrink-0">{s.instr[0]}</span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-gray-900">{s.instr} 강사</p>
          <p className="text-[12px] text-gray-500">{s.spec}</p>
          <p className="text-[12px] text-gray-500 mt-0.5 break-keep">몸의 균형과 호흡에 집중하는 수업을 진행해요. 초보자도 환영!</p>
        </div>
      </div>
      {/* 정보 — 종목 뱃지 + 일시·장소·정원 */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4 space-y-2.5">
        <span className={`inline-flex w-fit items-center gap-1 pl-1 pr-2 h-6 rounded-lg text-[11px] font-bold ${c.pill}`}>{catBadge(c)} {c.label}</span>
        <p className="flex items-center gap-2 text-[13px] text-gray-700"><Calendar className="w-4 h-4 text-emerald-500" />{dLabel(s.date)} {s.time}</p>
        <p className="flex items-center gap-2 text-[13px] text-gray-700"><MapPin className="w-4 h-4 text-emerald-500" />{s.place} · 서울 강남구 …</p>
        <p className="flex items-center gap-2 text-[13px] text-gray-700"><Users className="w-4 h-4 text-emerald-500" />정원 {s.joined}/{s.cap}명 · 사전 신청</p>
      </div>
      {/* 참가자 명단 */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4">
        <p className="text-[13px] font-bold text-gray-800 mb-2">신청한 참가자 {s.joined}명</p>
        <div className="flex -space-x-2">
          {['김', '이', '박', '최', '정', '+3'].map((t, i) => (
            <span key={i} className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[11px] font-bold ${t.startsWith('+') ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>{t}</span>
          ))}
        </div>
      </div>
      {/* 준비물 */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4">
        <p className="text-[13px] font-bold text-gray-800 mb-1">안내</p>
        <p className="text-[12px] text-gray-500 leading-relaxed break-keep">개인 매트와 편한 복장을 준비해주세요. 수업 10분 전까지 입장 부탁드려요.</p>
      </div>
      {/* CTA */}
      <button type="button" className="w-full h-12 rounded-2xl bg-emerald-50 text-emerald-600 font-bold border border-emerald-200">신청 취소 (신청됨 ✓)</button>
    </div>
  )
}

// 데모 섹션 래퍼
function Screen({ label, sub, children }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span className="inline-flex items-center px-2.5 h-6 rounded-full bg-emerald-500 text-white text-[12px] font-bold">{label}</span>
        <span className="text-[11px] text-gray-400">{sub}</span>
      </div>
      <div className="h-[44px] flex items-center justify-center relative mb-2 bg-white rounded-t-2xl border-b border-gray-100">
        <ChevronLeft className="absolute left-3 w-5 h-5 text-gray-600" />
        <span className="text-[15px] font-bold text-gray-800">클래스 일정</span>
        <div className="absolute right-3 flex items-center gap-1.5">
          <Bell className="w-[18px] h-[18px] text-gray-600" />
          <div className="w-7 h-7 rounded-full bg-gray-200" />
        </div>
      </div>
      {children}
    </div>
  )
}

export default function ClassScheduleDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-4">
      <div className="max-w-[430px] mx-auto px-[11px]">
        <h1 className="text-lg font-extrabold text-gray-900 mb-4 px-0.5">「강사 클래스」 참가자 화면 데모</h1>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2 px-0.5">
            <span className="inline-flex items-center px-2.5 h-6 rounded-full bg-emerald-500 text-white text-[12px] font-bold">① 개요 진입 카드</span>
            <span className="text-[11px] text-gray-400">개요 화면에 삽입</span>
          </div>
          <OverviewCard />
        </div>

        <Screen label="② 전체 일정" sub="카드 탭 → 이동"><ScheduleList /></Screen>
        <Screen label="③ 클래스 상세" sub="일정 카드 탭 → 이동"><ClassDetail /></Screen>
      </div>
    </div>
  )
}
