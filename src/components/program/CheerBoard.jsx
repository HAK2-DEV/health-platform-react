import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, Pencil, Check, X, Megaphone, Mail, Star, MessageSquare } from 'lucide-react'
import { fetchBestCheers, fetchRecentCheers, updateCheerNotice, queryKeys } from '../../lib/queries'
import { todayLetter } from '../../lib/cheerLetters'
import UserAvatar from '../common/UserAvatar'

// 응원 보드 — 금연 「응원」 탭 최상단. 위→아래로 쌓는 깔끔한 카드형(스크랩북 콜라주 폐기 2026-08-02).
//   운영자 한마디(편집) / 오늘의 응원 레터 / 베스트 응원 / 최근 응원글. props: program, isOwner, userId
const NOTICE_DEFAULT = '당신의 응원이 누군가의 내일이 돼요 💚\n작은 응원 한마디가 모여 큰 변화를 만들어요.'

// 상대 시간(방금/N분 전/N시간 전/N일 전)
function relTime(ts) {
  if (!ts) return ''
  const diff = (new Date() - new Date(ts)) / 1000
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

function CheerBoard({ program, isOwner }) {
  const programId = program.id
  const qc = useQueryClient()
  const letter = todayLetter()

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
    <div className="space-y-3 mb-3">
      {/* ── 운영자 한마디 (편집 가능) ── */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Megaphone className="w-4 h-4 text-emerald-500" />
          <h4 className="text-[13px] font-bold text-gray-800">운영자 한마디</h4>
          {isOwner && !editing && (
            <button type="button" onClick={startEdit} className="ml-auto p-0.5 text-gray-300 hover:text-emerald-500 transition" title="수정">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {editing ? (
          <div>
            <textarea
              value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} maxLength={200} autoFocus
              placeholder="참여자에게 전할 응원 한마디"
              className="w-full text-[13px] text-gray-700 leading-relaxed bg-emerald-50/50 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-emerald-300 resize-none"
            />
            <div className="flex items-center gap-2 mt-1.5">
              <button type="button" onClick={() => saveMut.mutate(draft)} disabled={saveMut.isPending}
                className="flex items-center gap-0.5 text-[12px] font-bold text-emerald-600 hover:text-emerald-700 disabled:opacity-40">
                <Check className="w-4 h-4" /> 저장
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="flex items-center gap-0.5 text-[12px] text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" /> 취소
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[14px] text-gray-700 leading-relaxed whitespace-pre-line break-words">{notice}</p>
        )}
      </div>

      {/* ── 오늘의 응원 레터 (자동 문구) ── */}
      {letter && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Mail className="w-4 h-4 text-emerald-600" />
            <h4 className="text-[13px] font-bold text-emerald-800">오늘의 응원 레터</h4>
          </div>
          <p className="text-[14px] font-bold text-emerald-800 leading-snug whitespace-pre-line">{letter.title}</p>
          {letter.body && <p className="text-[12px] text-emerald-700/80 mt-1 leading-relaxed">{letter.body}</p>}
        </div>
      )}

      {/* ── 베스트 응원 (좋아요 최다) ── */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Star className="w-4 h-4 text-amber-400 fill-current" />
          <h4 className="text-[13px] font-bold text-gray-800">베스트 응원</h4>
        </div>
        {top ? (
          <>
            <p className="text-[14px] text-gray-800 leading-snug break-words">{top.content}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <UserAvatar avatarPath={top.user?.avatar_path} nickname={top.user?.nickname} size="sm" viewable />
              <span className="text-[12px] font-semibold text-gray-600 truncate">{top.user?.nickname || '익명'}</span>
              <span className="ml-auto flex items-center gap-0.5 text-[12px] font-bold text-rose-500">
                <Heart className="w-3.5 h-3.5 fill-current" /> {top.likeCount}
              </span>
            </div>
          </>
        ) : (
          <p className="text-[12.5px] text-gray-400 leading-snug">서로 응원하는 한마디가 모이면 여기 소개돼요 💚</p>
        )}
      </div>

      {/* ── 최근 응원글 ── */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <MessageSquare className="w-4 h-4 text-sky-500" />
          <h4 className="text-[13px] font-bold text-gray-800">최근 응원글</h4>
        </div>
        {recent.length === 0 ? (
          <p className="text-[12px] text-gray-400 py-1">아직 응원글이 없어요</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recent.map(c => (
              <li key={c.id} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                <UserAvatar avatarPath={c.user?.avatar_path} nickname={c.user?.nickname} size="sm" viewable />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[12.5px] font-bold text-gray-700 truncate">{c.user?.nickname || '익명'}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{relTime(c.created_at)}</span>
                  </div>
                  <p className="text-[12.5px] text-gray-600 truncate">{c.content}</p>
                </div>
                <span className="flex items-center gap-0.5 text-[11px] font-bold text-rose-500 flex-shrink-0">
                  <Heart className="w-3 h-3 fill-current" /> {c.likeCount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default CheerBoard
