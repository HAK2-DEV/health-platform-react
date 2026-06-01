import { useState, useEffect } from 'react'
import { Check, Clock, X } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { formatKoreanDateTime } from '../../lib/formatters'

// 본인 인증 카드 — 이미지(verification-images signed URL) + 기록값 + 소감 + 상태 배지
// MyActivityVerificationsPage / MyActivityVerificationsBundlePage 공유
function MyVerificationCard({ v }) {
  const [imgUrl, setImgUrl] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!v.image_path) return
      const { data, error } = await supabase.storage
        .from('verification-images')
        .createSignedUrl(v.image_path, 60 * 60)
      if (!cancelled && !error && data?.signedUrl) setImgUrl(data.signedUrl)
    }
    load()
    return () => { cancelled = true }
  }, [v.image_path])

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
          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] flex-shrink-0 ${badge.cls}`}>
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

      {v.note && v.note.trim() && (
        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed mt-1">
          {v.note}
        </p>
      )}
    </div>
  )
}

export default MyVerificationCard
