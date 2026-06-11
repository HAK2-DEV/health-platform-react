import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { EyeOff, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { fetchHiddenVerifications } from '../../lib/queries'
import { formatRelativeKstDay } from '../../lib/formatters'
import UserAvatar from '../common/UserAvatar'
import OperatorVerificationActions from './OperatorVerificationActions'
import LoadingState from '../common/LoadingState'

// 게시물 관리 — 「가려진 게시물 모아보기」 (운영자 전용).
//   피드에서 가린(feed_visible=false) 인증을 한 화면에 모아 보고, 「피드 표시」로 복구.
//   피드 비활성 프로그램은 가릴 피드가 없으므로 렌더 안 함.
function HiddenPostsSection({ programId, feedEnabled }) {
  const { data: hidden = [], isLoading } = useQuery({
    queryKey: ['feed', 'hidden', programId],
    queryFn: () => fetchHiddenVerifications(programId),
    enabled: !!programId && !!feedEnabled,
  })

  // 이미지 signed URL
  const [imageUrls, setImageUrls] = useState({})
  useEffect(() => {
    const targets = hidden.filter(v => v.image_path)
    if (targets.length === 0) return
    let cancelled = false
    Promise.all(
      targets.map(v =>
        supabase.storage
          .from('verification-images')
          .createSignedUrl(v.image_path, 3600)
          .then(({ data }) => ({ id: v.id, url: data?.signedUrl || null }))
          .catch(() => ({ id: v.id, url: null }))
      )
    ).then(results => {
      if (cancelled) return
      const map = {}
      for (const r of results) if (r.url) map[r.id] = r.url
      setImageUrls(map)
    })
    return () => { cancelled = true }
  }, [hidden])

  if (!feedEnabled) return null

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
        <EyeOff className="w-5 h-5 text-gray-400" />
        가려진 게시물 <span className="text-sm text-gray-500">({hidden.length})</span>
      </h2>
      <p className="text-xs text-gray-400 mb-3">
        피드에서 가린 인증이에요. 「피드 표시」를 누르면 다시 커뮤니티에 노출됩니다.
      </p>

      {isLoading ? (
        <LoadingState />
      ) : hidden.length === 0 ? (
        <p className="text-sm text-gray-400 bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
          가려진 게시물이 없어요
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {hidden.map(v => (
            <div key={v.id} className="bg-white border border-gray-200 rounded-2xl p-4">
              {/* 작성자 + 미션 + 시각 */}
              <div className="flex items-center gap-2.5 mb-2">
                <UserAvatar avatarPath={v.user?.avatar_path} nickname={v.user?.nickname} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {v.user?.nickname || '(알 수 없음)'}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {v.missions?.title}
                    {v.missions?.bundle_title && <span className="text-gray-400"> · {v.missions.bundle_title}</span>}
                    {' · '}{formatRelativeKstDay(v.submitted_at)}
                  </p>
                </div>
              </div>

              {/* 사진 썸네일 */}
              {v.image_path && (
                imageUrls[v.id] ? (
                  <img
                    src={imageUrls[v.id]}
                    alt="가려진 인증"
                    className="w-full max-h-48 object-cover rounded-lg mb-2"
                  />
                ) : (
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                    <ImageIcon className="w-3.5 h-3.5" /> 사진 불러오는 중...
                  </div>
                )
              )}

              {/* 기록 / 소감 */}
              {v.numeric_value !== null && v.numeric_value !== undefined && (
                <p className="text-sm text-gray-700 mb-1">기록: <span className="font-medium">{v.numeric_value}</span></p>
              )}
              {v.note && v.note.trim() && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{v.note}</p>
              )}

              {/* 복구 / 점수 제외 */}
              <OperatorVerificationActions
                verification={{ id: v.id, status: 'APPROVED', feed_visible: false, nickname: v.user?.nickname }}
                programId={programId}
                feedEnabled
                layout="block"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default HiddenPostsSection
