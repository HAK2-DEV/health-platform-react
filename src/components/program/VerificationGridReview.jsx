import { useState, useEffect, useMemo } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Check, ClipboardCheck, ChevronLeft, ChevronRight, Ban, RotateCcw, Circle, PauseCircle } from 'lucide-react'
import { approveVerifications, rejectVerifications, queryKeys } from '../../lib/queries'
import { getSignedUrls, thumbPathOf } from '../../lib/signedUrls'
import { formatRelativeKstDay } from '../../lib/formatters'
import UserAvatar from '../common/UserAvatar'
import RejectReasonModal from './RejectReasonModal'

// 운영자 인증 검토 — 그리드(예외만 골라내기) 방식. 대량(하루 수십~수백 건) 처리에 최적화.
//   흐름: ① 사진을 그리드로 훑기 → ② 문제 있는 것만 ✕로 표시(또는 탭해서 확대 검사)
//          → ③ "나머지 전체 승인" 한 번으로 정상 일괄 처리(거절 표시분은 사유 한 번 입력).
//   승인/거절은 status 변경 → 기존 grant_score / notify 트리거가 행마다 발화(일괄도 동일).
//   미션별로 묶어 보여줘 이질적인 인증이 눈에 잘 띈다.

// 기록 지표 포맷 (VerificationReviewModal 과 동일 규칙)
function formatMetricRows(defsRaw, mvRaw) {
  const defs = Array.isArray(defsRaw) ? defsRaw : []
  const mv = mvRaw || {}
  const minToClock = (min) => { const h = Math.floor(min / 60), m = min % 60; return `${h}시 ${String(m).padStart(2, '0')}분` }
  const fmt = (def, val) => {
    if (def?.inputFormat === 'clock_multi') { const arr = Array.isArray(val) ? val : [val]; return arr.map(v => minToClock(Number(v))).join(', ') }
    if (def?.inputFormat === 'clock') return minToClock(Number(val))
    const n = Number(val)
    if (def?.inputFormat === 'hms') { const sec = Math.round(n * 60), h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h > 0 ? `${h}시간 ${m}분 ${s}초` : `${m}분 ${s}초` }
    return `${n}${def?.unit ? ' ' + def.unit : ''}`
  }
  return defs.filter(d => mv[d.key] != null).map(d => ({ key: d.key, icon: d.icon || '📊', label: d.label || d.key, value: fmt(d, mv[d.key]) }))
}

export default function VerificationGridReview({ isOpen, onClose, programId, reviews = [], reviewerId }) {
  useBodyScrollLock(isOpen)  // iOS 배경 스크롤 방지
  useBackButtonClose(isOpen, onClose)  // 하드웨어 뒤로가기 = 리뷰 닫기
  const qc = useQueryClient()
  const [rejectIds, setRejectIds] = useState(() => new Set())
  const [heldIds, setHeldIds] = useState(() => new Set())   // 보류(선택 취소) — 승인·거절 어디에도 안 들어가고 PENDING 유지
  const [inspectId, setInspectId] = useState(null)     // 확대 검사 중인 v_id
  const [thumbs, setThumbs] = useState({})             // v_id -> 썸네일 signed URL (그리드용, 빠름)
  const [fulls, setFulls] = useState({})               // v_id -> 원본 signed URL (확대 보기 + 썸네일 폴백)
  const [reasonOpen, setReasonOpen] = useState(false)  // 마무리 시 거절 사유 입력

  // 열릴 때 표시 초기화 + 배경 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return
    setRejectIds(new Set())
    setHeldIds(new Set())
    setInspectId(null)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  // 사진 썸네일 일괄 서명
  useEffect(() => {
    if (!isOpen) return
    const withImg = reviews.filter(r => r.v_image_path)
    if (!withImg.length) { setThumbs({}); setFulls({}); return }
    let cancelled = false
    // 그리드는 가벼운 썸네일(_thumb)로 즉시 표시, 확대 보기는 원본. 둘 다 서명(URL 생성은 가벼움).
    getSignedUrls('verification-images', withImg.map(r => thumbPathOf(r.v_image_path))).then(byPath => {
      if (cancelled) return
      const m = {}
      for (const r of withImg) { const u = byPath[thumbPathOf(r.v_image_path)]; if (u) m[r.v_id] = u }
      setThumbs(m)
    })
    getSignedUrls('verification-images', withImg.map(r => r.v_image_path)).then(byPath => {
      if (cancelled) return
      const m = {}
      for (const r of withImg) { const u = byPath[r.v_image_path]; if (u) m[r.v_id] = u }
      setFulls(m)
    })
    return () => { cancelled = true }
  }, [isOpen, reviews])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.pendingReviews(programId) })
    qc.invalidateQueries({ queryKey: ['verifications'] })
    qc.invalidateQueries({ queryKey: ['scores'] })
    qc.invalidateQueries({ queryKey: ['rankings'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
    qc.invalidateQueries({ queryKey: ['metricSummary'] })
    qc.invalidateQueries({ queryKey: ['program-overview'] })
  }

  const finalizeMut = useMutation({
    mutationFn: async (rejectReason) => {
      // 보류(held)는 승인·거절 어디에도 안 넣음 → PENDING 유지
      const rejectList = reviews.filter(r => rejectIds.has(r.v_id)).map(r => r.v_id)
      const approveList = reviews.filter(r => !rejectIds.has(r.v_id) && !heldIds.has(r.v_id)).map(r => r.v_id)
      if (rejectList.length) await rejectVerifications({ ids: rejectList, reason: rejectReason, reviewerId })
      if (approveList.length) await approveVerifications({ ids: approveList, reviewerId })
    },
    onSuccess: () => { invalidate(); setReasonOpen(false); onClose() },
    onError: (e) => alert(`처리 실패: ${e.message}`),
  })

  const groups = useMemo(() => {
    const m = new Map()
    for (const r of reviews) {
      if (!m.has(r.m_id)) m.set(r.m_id, { id: r.m_id, title: r.m_title, items: [] })
      m.get(r.m_id).items.push(r)
    }
    return Array.from(m.values())
  }, [reviews])

  // 거절 토글 — 거절로 잡으면 보류에서 뺀다(상태 상호배타)
  const toggleReject = (vId) => {
    setRejectIds(prev => {
      const next = new Set(prev)
      if (next.has(vId)) next.delete(vId)
      else { next.add(vId); setHeldIds(h => { const n = new Set(h); n.delete(vId); return n }) }
      return next
    })
  }
  // 보류 토글(초록 체크 누르기) — 보류로 잡으면 거절에서 뺀다
  const toggleHold = (vId) => {
    setHeldIds(prev => {
      const next = new Set(prev)
      if (next.has(vId)) next.delete(vId)
      else { next.add(vId); setRejectIds(r => { const n = new Set(r); n.delete(vId); return n }) }
      return next
    })
  }

  const rejectCount = rejectIds.size
  const holdCount = heldIds.size
  const approveCount = reviews.length - rejectCount - holdCount
  const inspect = inspectId ? reviews.find(r => r.v_id === inspectId) : null
  const inspectIndex = inspect ? reviews.findIndex(r => r.v_id === inspectId) : -1
  const gotoInspect = (dir) => {
    const n = inspectIndex + dir
    if (n >= 0 && n < reviews.length) setInspectId(reviews[n].v_id)
  }

  const onFinalize = () => {
    if (rejectCount > 0) setReasonOpen(true)   // 거절 표시분은 사유 한 번 입력
    else finalizeMut.mutate(null)              // 전부 정상 → 바로 일괄 승인
  }

  if (!isOpen) return null
  return (
    <>
      <div className="fixed inset-0 z-[75] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
        <div className="w-full max-w-md max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* 헤더 */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
            <ClipboardCheck className="w-5 h-5 text-emerald-500" />
            <h2 className="text-[16px] font-bold text-gray-800">인증 심사</h2>
            {reviews.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">{reviews.length}</span>
            )}
            <button type="button" onClick={onClose} className="ml-auto p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
          </div>

          {reviews.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                <Check className="w-7 h-7 text-emerald-500" strokeWidth={2.5} />
              </div>
              <p className="text-[15px] font-bold text-gray-800">심사를 모두 마쳤어요!</p>
              <p className="text-[13px] text-gray-500 mt-1">대기 중인 인증이 없어요.</p>
              <button type="button" onClick={onClose} className="mt-5 px-6 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition">닫기</button>
            </div>
          ) : (
            <>
              {/* 안내 */}
              <p className="px-5 pt-3 pb-1 text-[11.5px] text-gray-400 leading-relaxed flex-shrink-0">
                사진을 훑어보고 <b className="text-gray-500">문제 있는 것만 ✕</b>로 표시하세요. 크게 보려면 사진을 탭해요.
                남은 건 <b className="text-gray-500">아래 버튼으로 한 번에 승인</b>됩니다.
              </p>

              {/* 그리드 (미션별) */}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4" style={{ touchAction: 'pan-y' }}>
                {groups.map(g => (
                  <div key={g.id}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <h3 className="text-[13px] font-bold text-gray-700 break-words">{g.title}</h3>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">{g.items.length}건</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {g.items.map(r => {
                        const marked = rejectIds.has(r.v_id)
                        const held = heldIds.has(r.v_id) && !marked
                        const dim = marked ? 'opacity-40' : held ? 'opacity-60' : ''
                        const border = marked ? 'border-red-400' : held ? 'border-gray-300' : 'border-emerald-400 ring-1 ring-emerald-200'
                        const url = thumbs[r.v_id] || fulls[r.v_id]
                        return (
                          <div key={r.v_id} onClick={() => setInspectId(r.v_id)}
                            className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-gray-100 border-2 transition ${border}`}>
                            {r.v_image_path ? (
                              url
                                ? <img src={url} alt="" loading="lazy" decoding="async"
                                    onError={(e) => { const f = fulls[r.v_id]; if (f && e.currentTarget.src !== f) e.currentTarget.src = f }}
                                    className={`w-full h-full object-cover transition ${dim}`} />
                                : <div className="w-full h-full animate-pulse bg-gray-200" />
                            ) : (
                              <div className={`w-full h-full p-2 flex flex-col justify-center text-center ${dim}`}>
                                <span className="text-[10px] text-gray-400 mb-0.5">기록</span>
                                <span className="text-[11px] font-semibold text-gray-600 line-clamp-3 break-words leading-tight">{r.v_note || (r.v_numeric_value != null ? `${r.v_numeric_value}` : '내용 없음')}</span>
                              </div>
                            )}
                            {/* 닉네임 오버레이 */}
                            <span className="absolute left-0 right-0 bottom-0 px-1.5 py-0.5 bg-black/45 text-white text-[10px] font-medium truncate">{r.u_nickname || '익명'}</span>
                            {/* 보류 배지 */}
                            {held && (
                              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] font-bold text-gray-500" aria-hidden="true">보류</span>
                            )}
                            {/* 선택(승인) 토글 — 초록 체크 탭하면 보류(선택 취소), 다시 탭하면 승인. 거절 상태면 숨김 */}
                            {!marked && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); toggleHold(r.v_id) }}
                                aria-label={held ? '승인으로 선택' : '보류로(선택 취소)'}
                                className={`absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center shadow transition ${held ? 'bg-white/85 text-gray-400 hover:bg-white' : 'bg-emerald-500 text-white'}`}>
                                {held ? <Circle className="w-4 h-4" /> : <Check className="w-4 h-4" strokeWidth={3} />}
                              </button>
                            )}
                            {/* 거절 표시 토글 */}
                            <button type="button" onClick={(e) => { e.stopPropagation(); toggleReject(r.v_id) }}
                              aria-label={marked ? '거절 표시 취소' : '거절로 표시'}
                              className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center shadow transition ${marked ? 'bg-red-500 text-white' : 'bg-white/85 text-gray-500 hover:bg-white'}`}>
                              {marked ? <RotateCcw className="w-3.5 h-3.5" /> : <X className="w-4 h-4" strokeWidth={2.5} />}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* 하단 액션 */}
              <div className="p-4 border-t border-gray-100 flex-shrink-0 space-y-2">
                {(rejectCount > 0 || holdCount > 0) && (
                  <div className="flex items-center gap-3 text-[12px] font-bold">
                    <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="w-3.5 h-3.5" strokeWidth={3} /> 승인 {approveCount}</span>
                    {holdCount > 0 && <span className="inline-flex items-center gap-1 text-gray-500"><PauseCircle className="w-3.5 h-3.5" /> 보류 {holdCount}</span>}
                    {rejectCount > 0 && <span className="inline-flex items-center gap-1 text-red-500"><Ban className="w-3.5 h-3.5" /> 거절 {rejectCount}</span>}
                  </div>
                )}
                <button type="button" onClick={onFinalize} disabled={finalizeMut.isPending || (approveCount === 0 && rejectCount === 0)}
                  className="w-full inline-flex items-center justify-center gap-1.5 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition disabled:opacity-50">
                  <Check className="w-4 h-4" strokeWidth={3} />
                  {finalizeMut.isPending ? '처리 중...'
                    : rejectCount > 0 ? `승인 ${approveCount} · 거절 ${rejectCount} 처리`
                    : holdCount > 0 ? `승인 ${approveCount}건 처리 (보류 ${holdCount})`
                    : `전체 ${approveCount}건 승인`}
                </button>
                {holdCount > 0 && <p className="text-[11px] text-gray-400 text-center">보류 {holdCount}건은 그대로 대기 상태로 남아 다음에 다시 볼 수 있어요.</p>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 확대 검사 오버레이 */}
      {inspect && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex flex-col" onClick={() => setInspectId(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-[13px] font-medium truncate">{inspect.m_title}</span>
            <button type="button" onClick={() => setInspectId(null)} className="p-1 -mr-1"><X className="w-6 h-6" /></button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
            {inspectIndex > 0 && (
              <button type="button" onClick={() => gotoInspect(-1)} className="absolute left-2 z-10 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>
            )}
            {inspect.v_image_path && (fulls[inspect.v_id] || thumbs[inspect.v_id])
              ? <img src={fulls[inspect.v_id] || thumbs[inspect.v_id]} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
              : inspect.v_image_path
                ? <div className="w-64 h-64 rounded-lg bg-white/10 animate-pulse" />
                : <div className="text-white/70 text-sm">사진 없는 인증</div>}
            {inspectIndex < reviews.length - 1 && (
              <button type="button" onClick={() => gotoInspect(1)} className="absolute right-2 z-10 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
            )}
          </div>
          {/* 상세 + 조치 */}
          <div className="bg-white rounded-t-2xl p-4 flex-shrink-0 max-h-[42vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <UserAvatar avatarPath={inspect.u_avatar_path} nickname={inspect.u_nickname} size="sm" />
              <span className="text-[13px] font-semibold text-gray-700 truncate">{inspect.u_nickname || '익명'}</span>
              <span className="text-[11px] text-gray-400 ml-auto flex-shrink-0">{formatRelativeKstDay(inspect.v_submitted_at)}</span>
            </div>
            {(() => {
              const rows = formatMetricRows(inspect.m_metrics, inspect.v_metric_values)
              if (rows.length === 0) return null
              return (
                <div className="mb-2 rounded-lg bg-gray-50 border border-gray-100 p-2.5 space-y-1">
                  {rows.map(row => (
                    <div key={row.key} className="flex items-center gap-1.5 text-[13px]">
                      <span className="flex-shrink-0">{row.icon}</span>
                      <span className="text-gray-500 truncate">{row.label}</span>
                      <span className="ml-auto font-semibold text-gray-800 flex-shrink-0">{row.value}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
            {inspect.v_note && <p className="mb-3 text-[13px] text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{inspect.v_note}</p>}
            <button type="button" onClick={() => { toggleReject(inspect.v_id); gotoInspect(1) }}
              className={`w-full h-11 rounded-xl text-sm font-bold transition ${rejectIds.has(inspect.v_id) ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-red-500 text-white hover:bg-red-600'}`}>
              {rejectIds.has(inspect.v_id) ? '✓ 거절로 표시됨 (탭하면 취소)' : '이 인증 거절로 표시'}
            </button>
          </div>
        </div>
      )}

      <RejectReasonModal
        isOpen={reasonOpen}
        onClose={() => setReasonOpen(false)}
        onSubmit={(reason) => finalizeMut.mutate(reason)}
        busy={finalizeMut.isPending}
        title={`거절 ${rejectCount}건의 사유`}
        description="표시한 인증들이 함께 거절돼요. 점수에서 제외되고 제출자에게 사유가 전달됩니다. (기록·사진은 보존)"
        placeholder="예: 미션과 무관한 사진이에요."
        presets={['미션과 무관한 사진이에요', '사진이 흐려 확인이 어려워요', '인증 규칙에 맞지 않아요', '예전 사진을 재사용한 것 같아요']}
      />
    </>
  )
}
