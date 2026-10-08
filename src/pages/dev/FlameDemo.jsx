/**
 * 🔧 dev 전용 — 불꽃·주간 스트릭 데모 (/dev/flame)
 *
 * 목적: 실데이터가 없어도 «주간 스트릭 도장 열기 램프»와 «아바타 뒤 불꽃 아우라»를 눈으로 본다.
 *   import.meta.env.DEV 에서만 라우트 등록 → 프로덕션 번들에 포함되지 않는다.
 *   DB 호출 없음 — 전부 가짜 데이터.
 */
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import WeeklyStreak from '../../components/program/WeeklyStreak'
import FlameIcon from '../../components/common/FlameIcon'
import UserAvatar from '../../components/common/UserAvatar'
import { OperatorProfileBody } from '../../components/program/OperatorProfileModal'
import { FlameWrap } from '../../components/common/FlameAura'
import { Podium } from '../RankingsPage'
import PodiumTop3 from '../../components/program/PodiumTop3'
import FlameAura from '../../components/common/FlameAura'

const LABELS = ['월', '화', '수', '목', '금', '토', '일']
// n일 연속(월요일부터) + 오늘 = n번째 칸. count 가 n 보다 크면 지난주에서 이어진 셈(WeeklyStreak 가 carry 로 더 뜨겁게).
const week = (n, { todayIdx = n - 1, gapAt = null } = {}) =>
  LABELS.map((label, i) => ({ label, done: i < n && i !== gapAt, today: i === todayIdx }))

const STREAKS = [
  { title: '1일 — 초록(시작)', n: 1 },
  { title: '3일 — 노랑까지', n: 3 },
  { title: '5일 — 주황', n: 5 },
  { title: '7일 — 빨강(한 주 완성)', n: 7, todayIdx: 6 },
  { title: '지난주부터 9일째 — 목요일(8일)부터 도장 뒤에 불', n: 5, count: 9 },
  { title: '지난주부터 15일째 — 2단계 불(14일~)', n: 5, count: 15 },
  { title: '4주째 23일 — 3단계 초록 불(21일~)', n: 5, count: 23 },
  { title: '수요일에 끊김 → 목요일부터 다시 초록', n: 6, gapAt: 2, count: 3 },
]

const PEOPLE = [
  { nickname: '민지', level: 1, weeks: 1 },
  { nickname: '준호', level: 2, weeks: 3 },
  { nickname: '서연', level: 3, weeks: 6 },
  { nickname: '없음', level: 0 },
]

// 시상대 복제 — RankingsPage 의 Podium slot 마크업을 그대로 옮긴 것(불꽃 정렬 확인용).
//   실제와 다른 점: 데이터가 가짜. 구조·클래스는 같아야 의미가 있다.
const MEDAL_IMG = { 1: '/icons/ranking/medal-1.png', 2: '/icons/ranking/medal-2.png', 3: '/icons/ranking/medal-3.png' }
const PODIUM_RING = { 1: 'ring-amber-300', 2: 'ring-gray-300', 3: 'ring-orange-300' }
const PODIUM_RING_PX = 8
function PodiumMock({ variant = 'A' }) {
  const rows = { 2: { nick: '세종은물마음', lv: 2 }, 1: { nick: '관리_자', lv: 3 }, 3: { nick: '된장쌀밥', lv: 1 } }
  const cornerMedal = variant === 'B'   // B: 메달을 모서리로 → 불꽃 혀가 쓸 자리를 비운다
  const noInnerRing = variant === 'B'   // B: 불꽃이 곧 링 — 고리 두 겹을 없앤다
  const slot = (place) => {
    const isFirst = place === 1
    const r = rows[place]
    return (
      <div className={`relative flex flex-col items-center rounded-2xl bg-white shadow-elevated px-2 ${isFirst ? 'pt-8 pb-3.5 -mt-4 border border-amber-200' : 'pt-6 pb-3'}`}>
        {isFirst && <img src="/icons/ranking/leaves.png" alt="" aria-hidden="true" className="absolute top-0 left-1/2 -translate-x-1/2 w-[135%] max-w-none z-0 pointer-events-none select-none" />}
        <img src={MEDAL_IMG[place]} alt={`${place}등`}
          className={cornerMedal
            ? 'absolute -top-3 -left-1 z-20 w-9 h-9 drop-shadow-sm pointer-events-none select-none'
            : `absolute left-1/2 -translate-x-1/2 z-20 drop-shadow-sm pointer-events-none select-none ${isFirst ? '-top-7 w-14 h-14' : '-top-5 w-[50px] h-[50px]'}`} />
        <div className="relative z-10">
          {noInnerRing ? (
            <FlameWrap level={r.lv} px={(isFirst ? 64 : 40) + PODIUM_RING_PX} scale={isFirst ? 0.7 : 0.8}>
              <div className={`rounded-full ring-2 ${PODIUM_RING[place]} p-0.5 bg-white`}>
                <UserAvatar nickname={r.nick} size={isFirst ? 'lg' : 'md'} viewable />
              </div>
            </FlameWrap>
          ) : (
            <UserAvatar nickname={r.nick} size={isFirst ? 'lg' : 'md'} viewable flame={{ level: r.lv, weeks: 3 }} />
          )}
        </div>
        <p className="relative z-10 mt-1.5 text-[13px] font-bold truncate w-full text-center text-gray-800">{r.nick}</p>
        <p className={`relative z-10 mt-0.5 font-extrabold text-emerald-600 ${isFirst ? 'text-lg' : 'text-base'}`}>{place === 1 ? 183 : place === 2 ? 53 : 21}P</p>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl shadow-soft p-3">
      <div className="grid grid-cols-3 items-end gap-2.5 pt-[33px]">
        {slot(2)}{slot(1)}{slot(3)}
      </div>
    </div>
  )
}

function Section({ title, desc, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
      {desc && <p className="text-[12px] text-gray-500 mt-0.5 mb-3 break-keep">{desc}</p>}
      {children}
    </section>
  )
}

export default function FlameDemo() {
  const navigate = useNavigate()
  const refs = useRef([])
  const fl = (p) => (p.level ? { level: p.level, weeks: p.weeks } : null)

  return (
    <div className="min-h-screen bg-[#f8fbf9] pb-16">
      <header className="sticky top-0 z-20 bg-[#f8fbf9]/95 backdrop-blur px-4 py-3 flex items-center gap-2 border-b border-gray-100">
        <button type="button" onClick={() => navigate(-1)} aria-label="뒤로" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-gray-600"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-[16px] font-extrabold text-gray-900">🔧 불꽃 · 주간 스트릭 데모</h1>
      </header>

      <main className="px-4 pt-4 max-w-md mx-auto">
        <Section title="① 주간 스트릭 — 연속일수록 뜨겁게" desc="1일 초록 → 앰버 → 주황 → 빨강 → 7일 진빨강, 8일째부터 도장 뒤에 불. 카드를 누르면 도장 연출 다시 보기. 「도장 찍기 테스트」는 다음 빈 칸에 찍는다.">
          <div className="space-y-3">
            {STREAKS.map((s, i) => (
              <div key={i}>
                <p className="text-[11px] font-semibold text-gray-500 mb-1">{s.title}</p>
                <WeeklyStreak
                  ref={(el) => { refs.current[i] = el }}
                  count={s.count ?? s.n}
                  days={week(s.n, { todayIdx: s.todayIdx, gapAt: s.gapAt })}
                  icon={<FlameIcon />}
                  bestStreak={Math.max(s.count ?? s.n, 7)}
                  showTest
                />
              </div>
            ))}
            <p className="text-[11px] font-semibold text-gray-500 mb-1 mt-4">와이드 변형(달리기 홈)</p>
            <WeeklyStreak variant="wide" count={4} days={week(4)} icon={<FlameIcon />} bestStreak={9} />
          </div>
        </Section>

        <Section title="② 아바타 뒤 불꽃 — 단계 × 크기" desc="1단계(1주~) 작은 주황 · 2단계(3주~) 큰 주황 · 3단계(6주~) 브랜드 초록. 꺼진 사람은 평소 아바타.">
          <div className="bg-white rounded-2xl shadow-soft p-4">
            {['sm', 'md', 'lg'].map((size) => (
              <div key={size} className="flex items-end justify-around py-4 border-b border-gray-100 last:border-0">
                {PEOPLE.map((p) => (
                  <div key={p.nickname} className="flex flex-col items-center gap-2">
                    <UserAvatar nickname={p.nickname} size={size} flame={fl(p)} />
                    <span className="text-[11px] text-gray-500">{p.level ? `${p.level}단계` : '없음'}</span>
                  </div>
                ))}
                <span className="text-[10px] text-gray-400 self-center">{size}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="②-00 PodiumTop3 — 실데이터 조회 경로 (탄탄 챌린지)" desc="프로그램 상세 랭킹 탭과 «완전히 같은» 코드·같은 프로그램·같은 사용자. 불꽃도 직접 넣지 않고 조회한다. 여기가 멀쩡한데 실제 화면이 다르면 남은 건 캐시뿐이다.">
          <div className="bg-white rounded-2xl shadow-soft p-3 pt-8">
            <PodiumTop3
              top3={[
                { user_id: '5c33cc7e-b946-4fcb-a837-2d4384917ece', nickname: '관리_자', total_score: 183 },
                { user_id: '22d69397-a0dd-4eac-b8c7-ae3166f9de75', nickname: '세상은말미암아자기혐오로살아간', total_score: 53 },
                { user_id: '468fe1aa-b1fb-46dc-a4a6-3a1df97de082', nickname: '곡동핑크덤벨러', total_score: 160 },
              ]}
              userId={null}
              programId="10f22b33-ac03-4b84-9691-f4110b6433a8"
            />
          </div>
        </Section>

        <Section title="②-0 PodiumTop3 (프로그램 상세 랭킹 탭) — className 여백 함정" desc="UserAvatar 에 className='mb-1.5' 를 넘기면 그 여백이 불꽃 상자 안으로 들어가 중심이 3px 내려갔다. 지금은 바깥 상자에 붙인다.">
          <div className="bg-white rounded-2xl shadow-soft p-3 pt-8">
            <PodiumTop3
                top3={[
                  { user_id: 'u1', nickname: '관리_자', total_score: 183 },
                  { user_id: 'u2', nickname: '세종은물마음', total_score: 53 },
                  { user_id: 'u3', nickname: '된장쌀밥', total_score: 21 },
                ]}
                userId="u1"
              flameOverride={{ u1: { level: 3, weeks: 6 }, u2: { level: 2, weeks: 3 }, u3: { level: 1, weeks: 1 } }}
            />
          </div>
        </Section>

        <Section title="②-a 진짜 Podium 컴포넌트 (RankingsPage 에서 그대로 import)" desc="복제본이 아니라 실제 랭킹이 쓰는 그 컴포넌트. 여기서 멀쩡하면 실제 화면 문제는 코드가 아니라 캐시다.">
          <Podium
            top3={[
              { user_id: 'u1', nickname: '관리_자', total_score: 183 },
              { user_id: 'u2', nickname: '세종은물마음', total_score: 53 },
              { user_id: 'u3', nickname: '된장쌀밥', total_score: 21 },
            ]}
            userId="u1"
            programId={null}
            flamesOverride={{ u1: { level: 3, weeks: 6 }, u2: { level: 2, weeks: 3 }, u3: { level: 1, weeks: 1 } }}
          />
        </Section>

        <Section title="②-b 시상대 복제본 — 수정본 (불꽃이 곧 테두리)" desc="링을 빼고 ②번과 똑같이 그린다. 아바타가 불꽃 가운데에 앉는다.">
          <PodiumMock variant="A" />
        </Section>

        <Section title="②-c 시상대 — 폐기안 (링에 맞추려 불꽃을 8px 키움)" desc="중심은 맞지만(실측 0px) 불꽃만 커져서 아바타가 위로 올라가 보인다. 비교용으로 남김.">
          <PodiumMock variant="B" />
        </Section>

        <Section title="③ 불 모양만 크게 — 디자인 확인용" desc="사진 없이 불만. 밑동이 밝고(금색) 테두리는 얇다. 혀는 키가 제각각이고 끝이 한쪽으로 말린다.">
          <div className="bg-white rounded-2xl shadow-soft p-4 flex items-end justify-around">
            {[1, 2, 3].map((level) => (
              <div key={level} className="flex flex-col items-center gap-2">
                <FlameAura level={level} width={92} />
                <span className="text-[11px] text-gray-500">{level}단계</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="⑤ 운영자 프로필 (281) — 칭호 아닌 «사실만»" desc="히어로의 「운영 OO」를 누르면 뜨는 모달의 본문. 같은 데이터라도 참여자가 볼 때와 운영자 본인이 볼 때가 다르다.">
          <div className="space-y-2">
            {[
              ['곡동핑크덤벨러 — 탄탄 챌린지 실데이터 + 소개', false, { programCount: 1, participantSum: 13, completedSum: 0, replyMedianMin: null, comment90d: 4 }, '필라테스 10년. 천천히, 오래 가는 운동을 함께해요.'],
              ['16비이도윤 — 피지컬 실데이터 (라벨 3개)', false, { programCount: 2, participantSum: 78, completedSum: 1, replyMedianMin: 757, comment90d: 0 }, null],
              ['관리_자 — 라벨 다수 + 빠른 응답', false, { programCount: 3, participantSum: 13, completedSum: 4, replyMedianMin: 42, comment90d: 21 }, null],
              ['꽃지는봄 — 0인 줄은 참여자에게 숨김', false, { programCount: 1, participantSum: 5, completedSum: 0, replyMedianMin: null, comment90d: 3 }, null],
              ['꽃지는봄 — 같은 데이터, 운영자 본인 시점', true, { programCount: 1, participantSum: 5, completedSum: 0, replyMedianMin: null, comment90d: 3 }, null],
              ['느린 응답(3일) — 운영자 본인에겐 보임', true, { programCount: 2, participantSum: 20, completedSum: 6, replyMedianMin: 4320, comment90d: 1 }, null],
              ['첫 기수 운영 중 — 0을 들이밀지 않는다', false, { programCount: 0, participantSum: 0, completedSum: 0, replyMedianMin: null, comment90d: 0 }, null],
            ].map(([label, isOwner, record, bio], i) => (
              <div key={i}>
                <p className="text-[11px] font-semibold text-gray-500 mb-1">{label}</p>
                <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
                  <OperatorProfileBody ownerName={String(label).split(' —')[0]} isOwner={isOwner} rec={record} bio={bio} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="④ 실제 자리에서 — 피드 카드 · 댓글 · 랭킹" desc="카드 위 여백(16px)에서 불꽃 머리가 잘리는지, 댓글 24px 에서 뭉개지는지, 랭킹에서 여러 개가 요란한지.">
          {/* 피드 카드 헤더 — FeedContent 상세 카드와 같은 패딩·구조 */}
          <div className="bg-white rounded-2xl shadow-elevated overflow-hidden mb-3">
            <div className="flex items-start justify-between gap-2 p-4 pb-2">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <UserAvatar nickname="준호" size="md" flame={{ level: 2, weeks: 3 }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">준호</p>
                  <p className="text-[11px] text-gray-500 truncate">도전! 3km · 2주차</p>
                </div>
              </div>
              <span className="text-[11px] text-gray-400">2시간 전</span>
            </div>
            <div className="aspect-[4/3] bg-gradient-to-br from-emerald-100 to-teal-100" />
            <div className="px-4 py-3 space-y-2">
              {[
                ['민지', 1, 1, '오늘도 같이 달렸네요 👏'],
                ['서연', 3, 6, '페이스 좋아요! 저도 내일 나가요'],
                ['태오', 0, 0, '저도 끼워주세요'],
              ].map(([nick, level, weeks, text]) => (
                <div key={nick} className="flex items-start gap-2 text-sm">
                  <UserAvatar nickname={nick} size="sm" className="mt-0.5" flame={level ? { level, weeks } : null} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-gray-800 leading-tight">{nick}</p>
                    <p className="text-gray-700 mt-0.5">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 랭킹 행 — ProgramDetailPage 랭킹 탭과 같은 구조 */}
          <div className="bg-white rounded-2xl shadow-elevated divide-y divide-gray-100 overflow-hidden">
            {[
              ['서연', 3, 6, 128], ['준호', 2, 3, 115], ['민지', 1, 1, 97], ['태오', 0, 0, 88], ['하늘', 1, 2, 80], ['지우', 2, 4, 72],
            ].map(([nick, level, weeks, score], i) => (
              <div key={nick} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 text-center text-base font-bold text-gray-500 flex-shrink-0">{i + 1}</span>
                <UserAvatar nickname={nick} size="md" flame={level ? { level, weeks } : null} />
                <span className="flex-1 min-w-0 font-bold truncate text-gray-800">{nick}</span>
                <span className="flex-shrink-0 text-emerald-600 font-extrabold">{score}<span className="text-xs font-bold text-emerald-500 ml-0.5">P</span></span>
              </div>
            ))}
          </div>
        </Section>
      </main>
    </div>
  )
}
