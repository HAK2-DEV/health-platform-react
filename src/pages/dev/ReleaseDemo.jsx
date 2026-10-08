/**
 * 🔧 dev 전용 — 배포 변경사항 알림 비교 (/dev/release)
 *   본인이 「배너와 팝업 차이를 보고 결정」하기로 한 그 화면(2026-10-06).
 *   import.meta.env.DEV 에서만 라우트 등록 → 프로덕션 번들에 없음. DB 호출 없음.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import ReleaseNotes from '../../components/common/ReleaseNotes'
import { RELEASE_NOTES } from '../../lib/releaseNotes'
import ProgramEditModal from '../../components/program/ProgramEditModal'
import PodiumTop3 from '../../components/program/PodiumTop3'
import { OperatorProfileBody } from '../../components/program/OperatorProfileModal'
import JoinFaq from '../../components/program/JoinFaq'
import WeeklyStreak from '../../components/program/WeeklyStreak'
import FlameIcon from '../../components/common/FlameIcon'
import CommunityPostList from '../../components/program/CommunityPostList'
import MakeupBanner from '../../components/program/MakeupBanner'
import TodayRedoCard from '../../components/program/TodayRedoCard'

// 공지에 넣을 «운영자 설정» 사진을 찍기 위한 자리(?shot=settings).
//   화면이 바뀌면 사진도 다시 찍어야 하므로, 찍는 방법 자체를 코드에 남겨 둔다.
// 「오늘」로 보이게 하려고 렌더 중에 Date.now() 를 부르면 렌더가 불순해진다(react-hooks/purity).
//   모듈이 한 번 읽힐 때만 계산한다 — 사진 찍는 자리라 이걸로 충분하다.
const MOCK_POSTS = [
  { id: 'p1', author_id: 'u1', author: { nickname: '민지' }, status: 'visible',
    created_at: new Date(Date.now() - 3600e3).toISOString(),
    body: '오늘로 3주째! 비 와서 못 나갈 뻔했는데 우산 쓰고 다녀왔어요 ☔' },
  { id: 'p2', author_id: 'u2', author: { nickname: '준호' }, status: 'visible',
    created_at: new Date(Date.now() - 7200e3).toISOString(),
    body: '다들 저녁에 걸으시나요? 저는 아침이 더 잘 맞더라고요.' },
]

const MOCK_PROGRAM = {
  id: 'demo', name: '봄철 걷기 챌린지', description: '', categories: ['EXERCISE'],
  start_date: '2026-09-15', end_date: '2027-09-15', is_public: true, preview_enabled: false,
  join_type: 'FREE', quiz_enabled: true, community_enabled: true, feed_enabled: true,
  ranking_enabled: true, class_feature_enabled: false, team_enabled: false,
  flame_enabled: true, flame_week_days: 3, overview_progress_enabled: true,
}

export default function ReleaseDemo() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(null)   // 'popup' | 'banner' | null
  const note = RELEASE_NOTES[0]
  const shot = new URLSearchParams(location.search).get('shot')

  // 공지에 넣을 사진을 «깔끔하게» 찍기 위한 화면 — 제목·설명 없이 대상만.
  //   화면이 바뀌면 사진도 다시 찍어야 하므로 찍는 방법을 코드에 남겨 둔다.
  if (shot === 'join') {
    return (
      <div className="min-h-screen bg-white pt-6 px-4">
        <style>{'.tsqd-open-btn-container{display:none!important}'}</style>
        <div className="max-w-[340px] mx-auto">
          <JoinFaq
            program={{
              feed_enabled: true, ranking_enabled: true,
              community_settings: { boards: [{ id: 'cert', feedVisibility: 'public' }] },
            }}
            missions={[
              { id: 'm1', title: '30분 걷기', requiresImage: true, manual: true },
              { id: 'm2', title: '오늘의 물 마시기', requiresImage: false, manual: false },
              { id: 'm3', title: '스트레칭 인증', requiresImage: true, manual: true },
            ]}
          />
        </div>
      </div>
    )
  }

  // 주간 스트릭 — 도장 색 램프(초록→진빨강)가 «이어질수록 뜨거워진다»를 한 장으로 보여 준다.
  //   7일 모두 찍힌 주 + 연속 7일 = 넘어온 연속(carry) 0 → HEAT 7단계가 그대로 한 줄에 다 나온다.
  if (shot === 'streak') {
    return (
      <div className="min-h-screen bg-white pt-6 px-4">
        <style>{'.tsqd-open-btn-container{display:none!important}'}</style>
        <div className="max-w-[340px] mx-auto">
          <WeeklyStreak
            count={7}
            bestStreak={7}
            icon={<FlameIcon />}
            clickReplay={false}
            days={['월', '화', '수', '목', '금', '토', '일'].map((label, i) => ({ label, done: true, today: i === 6 }))}
          />
        </div>
      </div>
    )
  }

  // 커뮤니티 — «진짜» CommunityPostList 로 찍는다(흉내 내면 화면이 바뀔 때 사진만 옛것으로 남는다).
  //   로그인이 없어 불꽃 조회를 못 하므로 flameOverride 로 넣는다(PodiumTop3 와 같은 통로).
  //   ⚠️ 이름은 전부 가상 인물 — 공지는 모두가 보는 화면이다.
  // 다시 인증 줄 — 프로그램 홈 맨 위에서 «처음 마주치는» 자리. 진짜 TodayRedoCard 로 찍는다.
  if (shot === 'redo') {
    return (
      <div className="min-h-screen bg-white pt-6 px-4">
        <style>{'.tsqd-open-btn-container{display:none!important}'}</style>
        <div className="max-w-[340px] mx-auto">
          <TodayRedoCard
            ownerName="김도담"
            onGo={() => {}}
            item={{
              id: 'demo', missionId: 'm1', title: '물 마시기 사진 인증', dayWord: '어제',
              left: '18시간', lastChance: false,
              reason: '물병이 보이게 다시 찍어 주세요. 컵만 나와 있어요.',
            }}
          />
        </div>
      </div>
    )
  }

  // 만회 인증(283) — 반려된 인증을 다시 올리는 화면의 안내 배너. 진짜 MakeupBanner 로 찍는다.
  if (shot === 'makeup') {
    return (
      <div className="min-h-screen bg-white pt-6 px-4">
        <style>{'.tsqd-open-btn-container{display:none!important}'}</style>
        <div className="max-w-[340px] mx-auto">
          <MakeupBanner
            dayLabel="10월 4일"
            left="18시간"
            reason="사진에 날짜가 안 보여요. 오늘 날짜가 나오게 다시 찍어 주세요."
            needsImage
          />
        </div>
      </div>
    )
  }

  if (shot === 'community') {
    return (
      <div className="min-h-screen bg-[#f8fbf9] pt-6 px-4">
        <style>{'.tsqd-open-btn-container{display:none!important}'}</style>
        <div className="max-w-[340px] mx-auto">
          <CommunityPostList
            programId="demo" boardId="free" posts={MOCK_POSTS} myUserId="me" isOwner={false}
            flameOverride={{ u1: { level: 3, weeks: 6 }, u2: { level: 1, weeks: 1 } }}
          />
        </div>
      </div>
    )
  }

  if (shot === 'flame' || shot === 'profile') {
    return (
      <div className="min-h-screen bg-white flex items-start justify-center pt-6 px-4">
        {/* 사진에 개발 도구(React Query devtools)가 같이 찍혔다 — 찍는 동안만 숨긴다 */}
        <style>{'.tsqd-open-btn-container{display:none!important}'}</style>
        <div className="w-full max-w-[340px]">
          {shot === 'flame' ? (
            <PodiumTop3
              top3={[
                { user_id: 'u1', nickname: '민지', total_score: 183 },
                { user_id: 'u2', nickname: '준호', total_score: 120 },
                { user_id: 'u3', nickname: '서연', total_score: 90 },
              ]}
              userId={null}
              flameOverride={{ u1: { level: 3, weeks: 6 }, u2: { level: 2, weeks: 3 }, u3: { level: 1, weeks: 1 } }}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* ⚠️ 실제 사용자 이름을 쓰지 않는다(본인 2026-10-06) — 공지는 모두가 보는 화면이다. 가상 인물로. */}
              {/* ⚠️ 이름뿐 아니라 «숫자 조합»도 가상이어야 한다 — 2기·78명 은 실제 상위 운영자의 실측값과
                  겹쳐서, 아는 참여자는 누구인지 짚을 수 있었다(2026-10-08 점검). 한 줄 소개도 특정 종목을 뺐다. */}
              <OperatorProfileBody
                ownerName="김도담"
                bio="천천히, 오래 가는 습관을 함께 만들어요."
                rec={{ programCount: 3, participantSum: 42, completedSum: 9, replyMedianMin: 55, comment90d: 14 }}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fbf9] pb-24">
      <header className="sticky top-0 z-20 bg-[#f8fbf9]/95 backdrop-blur px-4 py-3 flex items-center gap-2 border-b border-gray-100">
        <button type="button" onClick={() => navigate(-1)} aria-label="뒤로" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-gray-600"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-[16px] font-extrabold text-gray-900">🔧 배포 알림 — 배너 vs 팝업</h1>
      </header>

      <main className="px-4 pt-4 max-w-md mx-auto">
        <p className="text-[13px] text-gray-600 leading-relaxed break-keep mb-4">
          어느 날 갑자기 화면이 달라졌을 때 「왜 바뀌었지? 내 기록은 괜찮나?」를 푸는 창이에요.
          두 방식을 직접 띄워 보고 고르세요.
        </p>

        <div className="space-y-2">
          <button type="button" onClick={() => setOpen('popup')}
            className="w-full text-left bg-white rounded-2xl shadow-soft p-4 hover:shadow-elevated transition">
            <p className="text-[14px] font-bold text-gray-900">① 화면 중앙 팝업</p>
            <p className="text-[12px] text-gray-500 mt-1 break-keep">확실히 읽힌다. 대신 들어오자마자 화면을 막아서 「일단 닫고 보자」가 될 수 있다.</p>
          </button>

          <button type="button" onClick={() => setOpen('banner')}
            className="w-full text-left bg-white rounded-2xl shadow-soft p-4 hover:shadow-elevated transition">
            <p className="text-[14px] font-bold text-gray-900">② 하단 배너</p>
            <p className="text-[12px] text-gray-500 mt-1 break-keep">막지 않는다. 대신 그냥 지나칠 수 있어 「바뀐 걸 몰랐다」가 남을 수 있다.</p>
          </button>
        </div>

        {/* 뒤에 깔릴 화면이 있어야 «막는다/안 막는다»가 느껴진다 */}
        <div className="mt-5 space-y-2 opacity-90">
          <p className="text-[11px] font-semibold text-gray-400">↓ 아래는 뒤에 깔린 화면 흉내</p>
          {['오늘의 미션', '주간 스트릭', '커뮤니티', '랭킹'].map((t) => (
            <div key={t} className="bg-white rounded-2xl shadow-soft p-4">
              <p className="text-[14px] font-bold text-gray-800">{t}</p>
              <p className="text-[12px] text-gray-500 mt-1">내용이 들어가는 자리</p>
            </div>
          ))}
        </div>
      </main>

      <ReleaseNotes note={note} variant={open === 'banner' ? 'banner' : 'popup'} isOpen={!!open} onClose={() => setOpen(null)} />

      {/* 사진 찍기용 — /dev/release?shot=settings 로 열면 설정 화면이 그대로 뜬다 */}
      {new URLSearchParams(location.search).get('shot') === 'settings' && (
        <ProgramEditModal program={MOCK_PROGRAM} isOpen onClose={() => {}} onSuccess={() => {}} />
      )}
    </div>
  )
}
