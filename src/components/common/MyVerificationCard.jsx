import { useState, useEffect } from 'react'
import { Check, Clock, X, Pencil } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatKoreanDateTime } from '../../lib/formatters'
import { updateVerificationNote } from '../../lib/queries'
import { getCachedSignedUrls, getSignedUrls } from '../../lib/signedUrls'

// 본인 인증 카드 — 이미지(verification-images signed URL) + 기록값 + 소감 + 상태 배지
// MyActivityVerificationsPage / MyActivityVerificationsBundlePage 공유
//
// 소감 수정 (본인 글만):
//   소감 미션(requires_note)인 경우 ✏️ 버튼으로 인라인 편집.
//   update_verification_note RPC 가 note 만 변경 — status/point 불변이라 랭킹 영향 없음.
function MyVerificationCard({ v }) {
  // 공유 캐시에 이미 있으면 즉시 표시(빈칸·재요청 방지)
  const [imgUrl, setImgUrl] = useState(() =>
    v.image_path ? (getCachedSignedUrls('verification-images', [v.image_path])[v.image_path] || null) : null
  )
  const queryClient = useQueryClient()

  // 인라인 소감 편집 상태
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(v.note || '')
  const [editError, setEditError] = useState(null)

  const canEditNote = !!v.missions?.requires_note

  useEffect(() => {
    if (!v.image_path) return
    let cancelled = false
    getSignedUrls('verification-images', [v.image_path]).then(byPath => {
      if (!cancelled && byPath[v.image_path]) setImgUrl(byPath[v.image_path])
    })
    return () => { cancelled = true }
  }, [v.image_path])

  const saveMutation = useMutation({
    mutationFn: () => updateVerificationNote(v.id, draft),
    onSuccess: () => {
      // 본인 활동 화면 전체 갱신 (묶음 카드 목록 등)
      queryClient.invalidateQueries({ queryKey: ['my-activity'] })
      queryClient.invalidateQueries({ queryKey: ['program-overview'] })
      setEditing(false)
      setEditError(null)
    },
    onError: (err) => {
      setEditError(err.message || '수정에 실패했어요')
    },
  })

  const startEdit = () => {
    setDraft(v.note || '')
    setEditError(null)
    setEditing(true)
  }
  const cancelEdit = () => {
    setEditing(false)
    setEditError(null)
  }

  const badge = (() => {
    if (v.status === 'APPROVED') return { cls: 'bg-emerald-100 text-emerald-700', icon: <Check className="w-3 h-3" />, label: '승인' }
    if (v.status === 'PENDING_REVIEW') return { cls: 'bg-amber-100 text-amber-700', icon: <Clock className="w-3 h-3" />, label: '심사 대기' }
    if (v.status === 'REJECTED') return { cls: 'bg-red-100 text-red-700', icon: <X className="w-3 h-3" />, label: '반려' }
    return null
  })()

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-medium text-gray-800 text-sm flex-1 min-w-0 truncate">
          {v.missions?.title || '(삭제된 미션)'}
        </p>
        {badge && (
          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs flex-shrink-0 ${badge.cls}`}>
            {badge.icon}
            {badge.label}
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mb-2">
        {formatKoreanDateTime(v.submitted_at)}
      </p>

      {v.image_path && imgUrl && (
        <img src={imgUrl} alt="인증" className="w-full max-h-64 object-cover rounded-lg mb-2" />
      )}

      {v.numeric_value !== null && v.numeric_value !== undefined && (
        <p className="text-sm text-gray-700 mb-1">
          기록: <span className="font-medium">{v.numeric_value}</span>
        </p>
      )}

      {/* 다중 기록 지표 (거리/시간/칼로리 등) */}
      {v.metric_values && (() => {
        const defs = Array.isArray(v.missions?.metrics) ? v.missions.metrics : []
        const fmt = (def, val) => {
          const n = Number(val)
          if (def?.inputFormat === 'hms') {  // 저장값(분) → 시:분:초 (0시간이면 생략)
            const sec = Math.round(n * 60)
            const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
            return h > 0 ? `${h}시간 ${m}분 ${s}초` : `${m}분 ${s}초`
          }
          return `${n}${def?.unit ? ' ' + def.unit : ''}`
        }
        const rows = defs.filter(d => v.metric_values[d.key] != null)
        return rows.map(d => (
          <p key={d.key} className="text-sm text-gray-700 mb-1">
            {d.icon && <span className="mr-1">{d.icon}</span>}{d.label}: <span className="font-medium">{fmt(d, v.metric_values[d.key])}</span>
          </p>
        ))
      })()}

      {/* ─── 소감 ─── */}
      {editing ? (
        <div className="mt-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={300}
            autoFocus
            disabled={saveMutation.isPending}
            placeholder="소감을 입력해주세요"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 disabled:bg-gray-50 resize-none text-sm"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-gray-400">{draft.length}/300</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saveMutation.isPending}
                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 rounded-lg transition disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="px-3 py-1 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition disabled:opacity-50"
              >
                {saveMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
          {editError && (
            <p className="mt-1 text-[11px] text-red-600">{editError}</p>
          )}
        </div>
      ) : (
        <div className="flex items-start gap-2 mt-1">
          {v.note && v.note.trim() ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed flex-1 min-w-0">
              {v.note}
            </p>
          ) : (
            canEditNote && <p className="text-sm text-gray-300 flex-1">소감 없음</p>
          )}
          {canEditNote && (
            <button
              type="button"
              onClick={startEdit}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-emerald-600 hover:bg-emerald-50 rounded-lg transition flex-shrink-0"
              title="소감 수정"
            >
              <Pencil className="w-3 h-3" />
              수정
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default MyVerificationCard
