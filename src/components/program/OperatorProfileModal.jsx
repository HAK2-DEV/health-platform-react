import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '../common/Modal'
import Badge from '../common/Badge'
import UserAvatar from '../common/UserAvatar'
import { queryKeys, fetchOperatorRecord, updateOperatorBio } from '../../lib/queries'

// 운영자 프로필 (281·282) — 히어로의 「운영 OO」를 누르면 열린다.
//   본인 결정(2026-10-05): 홈 최상단 고정 카드는 «별로다» → 평소엔 숨기고 이름을 누를 때만.
//   프로그램을 고르는 사람이 「이 사람 믿을 만한가」를 확인하는 자리.
//
// ⭐ 칭호(세로 등급)는 만들지 않는다 — 실측 운영자 12명 중 종료 기수가 있는 사람이 5명뿐이라
//    등급을 매기면 거의 전원이 바닥에 모인다. 대신 **가로형 라벨**: 위아래가 아니라 «어떤
//    운영자인가». 모수가 적어도 성립하고 누구도 «밑»이 되지 않는다.
//
// 표시 규칙 — **참여자에겐 「있는 것만」, 운영자 본인에겐 0도 그대로.**
//   한 기수를 마쳤는데 끝까지 함께한 사람이 0인 운영자가 실제로 여럿이다. 0을 공개로 박으면
//   운영자를 깎는다(도담은 운영자 뒤에서 돕는다). 고칠 사람(본인)에게는 정확한 숫자가 간다.
//
// 비율(완주율)은 서버가 아예 돌려주지 않는다 — 운영자끼리 비교·압박을 만든다.

const HOUR = 60, DAY = 1440
const BIO_MAX = 80

// 분 단위를 사람이 읽는 구간으로. 분 단위로 찍으면 운영자를 초 단위로 압박한다.
function replyLabel(min) {
  if (min == null) return null
  if (min <= 10) return '10분 안에'
  if (min <= 30) return '30분 안에'
  if (min <= HOUR) return '1시간 안에'
  if (min <= 3 * HOUR) return '3시간 안에'
  if (min <= 6 * HOUR) return '6시간 안에'
  if (min <= DAY) return '하루 안에'
  return `${Math.round(min / DAY)}일 안에`
}

// 가로형 라벨 — 문턱은 «지금 운영자 분포»에 맞췄다(2026-10-05 실측: 댓글 21·10·4·3·3,
//   누적 참여자 78·13·13·5, 완주 4·1, 기수 3·2). 운영자가 늘면 여기 숫자만 올리면 된다.
//   서버가 아니라 여기서 판정하는 이유 — 문턱은 계속 바뀔 값이라 마이그레이션에 묶으면 못 고친다.
//   드문 것부터 보여 준다. 너무 많으면 의미가 흐려지므로 3개까지.
const LABELS = [
  { key: 'fast', text: '빠르게 답하는', ok: (r) => r.replyMedianMin != null && r.replyMedianMin <= 6 * HOUR },
  { key: 'finish', text: '끝까지 함께하는', ok: (r) => r.completedSum >= 1 },
  { key: 'rounds', text: '여러 기수를 운영', ok: (r) => r.programCount >= 2 },
  { key: 'many', text: '많은 사람과 함께한', ok: (r) => r.participantSum >= 10 },
  { key: 'talk', text: '자주 소통하는', ok: (r) => r.comment90d >= 3 },
]
const pickLabels = (rec) => LABELS.filter((l) => l.ok(rec)).slice(0, 3)

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="text-[13px] text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-[14px] font-bold text-gray-800 text-right break-keep">{value}</span>
    </div>
  )
}

// 모달 본문 — 데모(/dev/flame)에서 rec 을 직접 넣어 모양만 볼 수 있게 분리.
export function OperatorProfileBody({ ownerName, ownerAvatarPath = null, isOwner = false, rec, bio = null, onEditBio = null }) {
  if (!rec) return null

  const rows = []
  if (rec.programCount > 0 || isOwner) rows.push(['운영한 기수', `${rec.programCount}기`])
  if (rec.participantSum > 0 || isOwner) rows.push(['함께한 참여자', `${rec.participantSum}명`])
  // 「완주」가 딱딱해서 본인이 이름을 바꿨다(2026-10-05). 숫자 정의는 그대로 —
  //   종료된 기수에서 활동일이 기간의 50% 이상인 사람. 종료 리포트의 완주 숫자와 같다.
  if (rec.completedSum > 0 || isOwner) rows.push(['끝까지 함께한 참여자', `${rec.completedSum}명`])

  const reply = replyLabel(rec.replyMedianMin)
  // 참여자에겐 하루 안쪽일 때만. 「3일 안에」를 공개로 박지 않는다.
  if (reply && (isOwner || rec.replyMedianMin <= DAY)) rows.push(['보통 응답', reply])

  const labels = pickLabels(rec)

  return (
    <div className="p-6">
      <div className="flex flex-col items-center text-center">
        <UserAvatar avatarPath={ownerAvatarPath} nickname={ownerName} size="lg" />
        <p className="mt-2.5 text-[17px] font-extrabold text-gray-900 break-keep">{ownerName}</p>
        <p className="text-[12px] text-gray-500 mt-0.5">운영자</p>

        {labels.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-2.5">
            {labels.map((l) => <Badge key={l.key} variant="point" size="md">{l.text}</Badge>)}
          </div>
        )}

        {bio ? (
          <p className="mt-3 text-[13px] text-gray-700 leading-relaxed break-keep">{bio}</p>
        ) : isOwner && onEditBio ? (
          <button type="button" onClick={onEditBio}
            className="mt-3 text-[12.5px] font-semibold text-emerald-600 hover:text-emerald-700 transition">
            + 한 줄 소개 쓰기
          </button>
        ) : null}
        {bio && isOwner && onEditBio && (
          <button type="button" onClick={onEditBio}
            className="mt-1.5 text-[12px] text-gray-400 hover:text-gray-600 transition">소개 수정</button>
        )}
      </div>

      {rows.length === 0 ? (
        // 첫 기수를 아직 안 끝낸 운영자 — 0을 들이밀지 않고 사실만 서술한다.
        <p className="mt-5 text-[13px] text-gray-500 text-center break-keep">첫 기수를 운영하고 있어요</p>
      ) : (
        <div className="mt-5">
          {rows.map(([label, value]) => <Row key={label} label={label} value={value} />)}
        </div>
      )}

      {isOwner && (
        <p className="mt-4 text-[11.5px] text-gray-400 leading-relaxed break-keep">
          참여자에게는 숫자가 있는 항목만 보여요.
          {rec.replyMedianMin > DAY ? ' 응답 시간은 하루 안쪽일 때만 보여요.' : ''}
        </p>
      )}
    </div>
  )
}

// 한 줄 소개 작성 — 모달 안에서 바로 고친다(설정 화면까지 가게 하지 않는다).
function BioEditor({ initial, onCancel, onSaved }) {
  const [text, setText] = useState(initial || '')
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: () => updateOperatorBio(text),
    onSuccess: (saved) => { qc.invalidateQueries({ queryKey: ['programs', 'detail'] }); onSaved(saved) },
  })
  return (
    <div className="p-6">
      <h2 className="text-[16px] font-bold text-gray-900">한 줄 소개</h2>
      <p className="text-[12px] text-gray-500 mt-1 break-keep">참여자가 운영자 이름을 누르면 보여요. 어떤 사람인지, 무엇을 함께하는지 적어 주세요.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, BIO_MAX))}
        rows={3}
        autoFocus
        placeholder="예) 필라테스 10년. 천천히, 오래 가는 운동을 함께해요."
        className="mt-3 w-full min-w-0 px-3 py-2.5 text-[14px] bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
      />
      <p className="text-[11px] text-gray-400 text-right mt-1">{text.length} / {BIO_MAX}</p>
      {mut.isError && <p className="mt-2 p-2 bg-red-50 text-red-700 rounded-lg text-[12px] text-center">저장하지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
      <div className="flex gap-2 mt-3">
        <button type="button" onClick={onCancel} disabled={mut.isPending}
          className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-[14px] font-bold hover:bg-gray-50 transition disabled:opacity-50">취소</button>
        <button type="button" onClick={() => mut.mutate()} disabled={mut.isPending}
          className="flex-[1.4] h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition disabled:opacity-50">
          {mut.isPending ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}

function OperatorProfileModal({ isOpen, onClose, ownerId, ownerName, ownerAvatarPath = null, ownerBio = null, isOwner = false }) {
  const [editing, setEditing] = useState(false)
  // 방금 저장한 값은 프로그램 조회가 갱신되기 전까지 이걸 쓴다(effect 로 동기화하지 않는다).
  const [savedBio, setSavedBio] = useState(null)
  const bio = savedBio ?? ownerBio
  const close = () => { setEditing(false); onClose() }

  const { data: rec, isLoading } = useQuery({
    queryKey: queryKeys.operatorRecord(ownerId),
    queryFn: () => fetchOperatorRecord(ownerId),
    enabled: !!ownerId && isOpen,
    staleTime: 30 * 60_000,   // 기수가 끝나야 바뀌는 값 — 자주 물을 이유가 없다
  })

  return (
    <Modal isOpen={isOpen} onClose={close}>
      {editing ? (
        <BioEditor initial={bio} onCancel={() => setEditing(false)} onSaved={(v) => { setSavedBio(v); setEditing(false) }} />
      ) : (
        <>
          {isLoading ? (
            // 로딩 중엔 「기록 없음」을 먼저 보여주지 않는다(§13-9) — 자리만 잡아 둔다
            <div className="p-6 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 animate-pulse" />
              <div className="mt-3 w-28 h-4 rounded bg-gray-100 animate-pulse" />
              <div className="mt-5 w-full h-24 rounded-xl bg-gray-50 animate-pulse" />
            </div>
          ) : (
            <OperatorProfileBody
              ownerName={ownerName}
              ownerAvatarPath={ownerAvatarPath}
              isOwner={isOwner}
              bio={bio}
              onEditBio={isOwner ? () => setEditing(true) : null}
              rec={rec || { programCount: 0, participantSum: 0, completedSum: 0, replyMedianMin: null, comment90d: 0 }}
            />
          )}
          <div className="px-6 pb-6">
            <button type="button" onClick={close}
              className="w-full h-11 rounded-xl bg-gray-50 text-gray-700 text-[14px] font-bold hover:bg-gray-100 transition">닫기</button>
          </div>
        </>
      )}
    </Modal>
  )
}

export default OperatorProfileModal
