import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, Pencil, Check, X } from 'lucide-react'
import { fetchBestCheers, fetchRecentCheers, updateCheerNotice, queryKeys } from '../../lib/queries'
import { todayLetter, todayBubble } from '../../lib/cheerLetters'
import UserAvatar from '../common/UserAvatar'

// 응원 콜라주 일러스트 (Figma 목업 56:183 에서 추출) — public/illustrations/themes/cheer
const ART = '/illustrations/themes/cheer'

// 응원 콜라주 — 금연 응원 탭 최상단. Figma 템플릿(355×497) 배치를 절대 위치로 재현:
//   운영자 한마디(좌상,세로 긴 노트) / 베스트 응원(우상,트로피) / 응원 말풍선(우중,체크무늬)
//   핑크 하트(좌중) / 최근 응원글(좌하) / 오늘의 응원 레터(우하,봉투)
//   props: program, isOwner, userId
const NOTICE_DEFAULT = '당신의 응원이\n누군가의 내일이 돼요 💚\n\n작은 응원 한마디가 모여\n큰 변화를 만들어요 😊'

// 체크무늬(모눈) 배경 — 말풍선 카드용
const CHECK_BG = {
  backgroundColor: '#eaf5ec',
  backgroundImage: 'linear-gradient(#d6ecdb 1px, transparent 1px), linear-gradient(90deg, #d6ecdb 1px, transparent 1px)',
  backgroundSize: '13px 13px',
}

// 상대 시간(방금/N분 전/N시간 전/N일 전) — 목업의 "2시간 전" 표기.
function relTime(ts) {
  if (!ts) return ''
  const diff = (new Date() - new Date(ts)) / 1000
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

function CheerBoard({ program, isOwner, userId }) {
  const programId = program.id
  const qc = useQueryClient()
  const letter = todayLetter()
  const bubble = todayBubble()

  const { data: best = [] } = useQuery({
    queryKey: ['best-cheers', programId],
    queryFn: () => fetchBestCheers(programId, { limit: 1 }),
    enabled: !!programId,
  })
  const { data: recent = [] } = useQuery({
    queryKey: ['recent-cheers', programId],
    queryFn: () => fetchRecentCheers(programId, { limit: 4 }),
    enabled: !!programId,
  })
  const top = best[0] || null

  // 운영자 한마디 — community_settings.cheerNotice (없으면 기본 문구)
  const notice = program.community_settings?.cheerNotice || NOTICE_DEFAULT
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const saveMut = useMutation({
    mutationFn: (text) => updateCheerNotice(programId, program.community_settings, text),
    onSuccess: () => { setEditing(false); qc.invalidateQueries({ queryKey: queryKeys.program(programId) }) },
    onError: (e) => alert(`저장 실패: ${e.message}`),
  })
  const startEdit = () => { setDraft(program.community_settings?.cheerNotice || ''); setEditing(true) }

  return (
    <div className="font-hand relative rounded-2xl overflow-hidden mb-3 bg-[#f3f2ec] border border-black/5">
      {/* 무대(stage) — Figma 템플릿 비율 355:497. 각 박스를 절대 위치로 배치 */}
      <div className="relative w-full aspect-[355/497]">
        {/* 잎사귀 장식 (Figma 잎 그래픽, 템플릿 위치) */}
        <img src={`${ART}/cheer-leaf.png`} alt="" className="pointer-events-none absolute object-contain opacity-90 rotate-[20deg] select-none" style={{ right: '0%', top: '25%', width: '12%' }} />
        <img src={`${ART}/cheer-leaf.png`} alt="" className="pointer-events-none absolute object-contain opacity-90 -rotate-[100deg] select-none" style={{ left: '19%', top: '55%', width: '9%' }} />
        {/* 핑크 하트 (좌측 중앙) */}
        <img src={`${ART}/cheer-heart.png`} alt="" className="pointer-events-none absolute z-10 -rotate-12 object-contain opacity-95 select-none" style={{ left: '4%', top: '47%', width: '12%' }} />

        {/* ── 운영자 한마디 (좌상단, 세로 긴 흰 노트) ── */}
        <div className="absolute bg-white rounded-2xl p-3 shadow-md border border-black/5 overflow-hidden -rotate-2" style={{ left: '4%', top: '8.5%', width: '42%', height: '40%' }}>
          {/* 워시테이프 */}
          <span className="absolute left-1/2 -translate-x-1/2 top-1.5 w-12 h-3.5 rounded-sm bg-emerald-200/70 -rotate-2" />
          <div className="relative flex items-center gap-1 mb-1 mt-2">
            <img src={`${ART}/cheer-people.png`} alt="" className="w-4 h-4 object-contain" />
            <span className="font-sans text-[12px] font-extrabold text-[#2E5D3B]">운영자 한마디</span>
            {isOwner && !editing && (
              <button type="button" onClick={startEdit} className="ml-auto p-0.5 text-gray-300 hover:text-emerald-500 transition" title="수정">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {editing ? (
            <div>
              <textarea
                value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} maxLength={200} autoFocus
                placeholder="참여자에게 전할 응원 한마디"
                className="w-full text-[12px] text-gray-700 leading-snug bg-emerald-50/40 rounded-lg p-2 outline-none focus:ring-1 focus:ring-emerald-300 resize-none"
              />
              <div className="flex items-center gap-1 mt-1">
                <button type="button" onClick={() => saveMut.mutate(draft)} disabled={saveMut.isPending}
                  className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 disabled:opacity-40">
                  <Check className="w-3.5 h-3.5" /> 저장
                </button>
                <button type="button" onClick={() => setEditing(false)}
                  className="flex items-center gap-0.5 text-[11px] text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" /> 취소
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[14px] font-bold text-gray-800 leading-snug whitespace-pre-line break-words">{notice}</p>
          )}
          {/* 새싹 낙서 (Figma 그래픽) */}
          <img src={`${ART}/cheer-sprout.png`} alt="" className="pointer-events-none absolute bottom-2 right-3 w-16 object-contain opacity-80 select-none" />
        </div>

        {/* ── 베스트 응원 (우상단, 크림 노트 + 트로피) ── */}
        <div className="absolute bg-[#fdf6e9] rounded-2xl p-2.5 shadow-md border border-amber-100/70 -rotate-3" style={{ left: '52%', top: '9.5%', width: '40%', height: '22%' }}>
          <img src={`${ART}/cheer-trophy.png`} alt="" className="absolute -top-6 -right-3 w-12 h-12 object-contain drop-shadow-sm rotate-6" />
          <div className="flex items-center gap-1 mb-1">
            <img src={`${ART}/cheer-star.png`} alt="" className="w-4 h-4 object-contain" />
            <span className="font-sans text-[11.5px] font-extrabold text-[#7B5C44]">베스트 응원</span>
          </div>
          {top ? (
            <>
              <p className="text-[13px] font-bold text-gray-800 leading-snug break-words line-clamp-2">{top.content}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <UserAvatar avatarPath={top.user?.avatar_path} nickname={top.user?.nickname} size="sm" />
                <span className="text-[11px] font-semibold text-gray-600 truncate">{top.user?.nickname || '익명'}</span>
                <span className="ml-auto flex items-center gap-0.5 text-[12px] font-bold text-rose-500">
                  <Heart className="w-3 h-3 fill-current" /> {top.likeCount}
                </span>
              </div>
            </>
          ) : (
            <p className="text-[11.5px] text-gray-500 leading-snug line-clamp-2">서로 응원하는 한마디가 모이는 곳이에요 💚</p>
          )}
        </div>

        {/* ── 응원 말풍선 (우측 중앙, 체크무늬) ── */}
        {bubble && (
          <div className="absolute rounded-2xl border border-emerald-100 px-3 py-2.5 shadow-sm -rotate-3 overflow-hidden" style={{ left: '52%', top: '39%', width: '41%', height: '21%', ...CHECK_BG }}>
            <p className="text-[13.5px] font-bold text-emerald-800 leading-snug whitespace-pre-line pr-2">{bubble.text}</p>
            <p className="text-[11.5px] text-emerald-500 mt-0.5">— {bubble.sign}</p>
            {/* 초록 하트 + 말풍선 그래픽 — 우하단 모서리 */}
            <img src={`${ART}/cheer-greenheart.png`} alt="" className="absolute bottom-2.5 right-9 w-5 h-5 object-contain" />
            <img src={`${ART}/cheer-bubble.png`} alt="" className="absolute bottom-1 right-1 w-9 h-9 object-contain drop-shadow-sm" />
          </div>
        )}

        {/* ── 최근 응원글 (좌하단, 흰 카드) ── */}
        <div className="absolute bg-white rounded-2xl p-3 shadow-sm border border-black/5 overflow-hidden" style={{ left: '4%', top: '60.5%', width: '52%', height: '37%' }}>
          <div className="flex items-center gap-1 mb-1.5">
            <img src={`${ART}/cheer-dots.png`} alt="" className="w-4 h-4 object-contain" />
            <span className="font-sans text-[12px] font-extrabold text-gray-700">최근 응원글</span>
          </div>
          {recent.length === 0 ? (
            <p className="text-[11px] text-gray-400 py-1">아직 응원글이 없어요</p>
          ) : (
            <ul className="space-y-1">
              {recent.map(c => (
                <li key={c.id} className="flex items-center gap-1.5">
                  <UserAvatar avatarPath={c.user?.avatar_path} nickname={c.user?.nickname} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] font-bold text-gray-700 truncate">{c.user?.nickname || '익명'}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{relTime(c.created_at)}</span>
                    </div>
                    <p className="text-[12px] text-gray-600 truncate">{c.content}</p>
                  </div>
                  <span className="flex items-center gap-0.5 text-[11px] font-bold text-rose-500 flex-shrink-0">
                    <Heart className="w-3 h-3 fill-current" /> {c.likeCount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── 오늘의 응원 레터 (우하단, 초록 카드 + 봉투) ── */}
        <div className="absolute bg-gradient-to-b from-emerald-50 to-white rounded-2xl p-3 shadow-sm border border-emerald-100 overflow-hidden" style={{ left: '60%', top: '68.5%', width: '36%', height: '29%' }}>
          <div className="flex items-center gap-1 mb-1">
            <img src={`${ART}/cheer-envelope.png`} alt="" className="w-4 h-4 object-contain" />
            <span className="font-sans text-[10.5px] font-extrabold text-gray-700">오늘의 응원 레터</span>
          </div>
          {letter && (
            <>
              <p className="text-[13.5px] font-extrabold text-emerald-800 leading-snug whitespace-pre-line">{letter.title}</p>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug line-clamp-2">{letter.body}</p>
            </>
          )}
          {/* 큰 봉투 일러스트 + 잎사귀 (우하단, 봉투를 감싸듯) */}
          <img src={`${ART}/cheer-leaf.png`} alt="" className="pointer-events-none absolute bottom-1.5 right-[3.4rem] w-7 object-contain opacity-90 -scale-x-100 -rotate-[35deg] select-none" />
          <img src={`${ART}/cheer-leaf.png`} alt="" className="pointer-events-none absolute bottom-9 right-0 w-7 object-contain opacity-90 rotate-[55deg] select-none" />
          <img src={`${ART}/cheer-envelope.png`} alt="" className="absolute -bottom-1 right-1 w-14 h-14 object-contain opacity-95" />
        </div>
      </div>
    </div>
  )
}

export default CheerBoard
