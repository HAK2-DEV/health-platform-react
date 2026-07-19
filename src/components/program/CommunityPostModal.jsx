import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Image as ImageIcon, X, Crop, Clock } from 'lucide-react'
import Modal from '../common/Modal'
import ImageCropModal from '../common/ImageCropModal'
import { supabase } from '../../supabaseClient'
import { createCommunityPost, updateCommunityPost, queryKeys } from '../../lib/queries'
import { compressImage, compressThumbnail } from '../../lib/imageCompression'
import { thumbPathOf } from '../../lib/signedUrls'

// 커뮤니티 게시판 글쓰기/수정 모달.
//   props: isOpen, onClose, program, boards(작성 가능 게시판), defaultBoardId, editPost(있으면 수정 모드)
function CommunityPostModal({ isOpen, onClose, program, boards = [], defaultBoardId, editPost = null }) {
  const queryClient = useQueryClient()
  const isEdit = !!editPost
  const [boardId, setBoardId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)        // 새로 고른 이미지
  const [existingUrl, setExistingUrl] = useState(null) // 수정 모드 기존 이미지 signed URL
  const [imageRemoved, setImageRemoved] = useState(false)
  const [error, setError] = useState(null)
  const [cropSrc, setCropSrc] = useState(null)   // 편집 중인 원본 objectURL
  const [isCropOpen, setIsCropOpen] = useState(false)
  const [pendingDone, setPendingDone] = useState(false)  // 승인 필요 게시판 제출 완료 안내 카드

  useEffect(() => {
    if (!isOpen) return
    setError(null); setFile(null); setImageRemoved(false); setIsCropOpen(false); setPendingDone(false)
    setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    setCropSrc(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    if (isEdit) {
      setBoardId(editPost.board_id)
      setTitle(editPost.title || '')
      setBody(editPost.body || '')
      if (editPost.image_path) {
        supabase.storage.from('community-posts').createSignedUrl(editPost.image_path, 3600)
          .then(r => setExistingUrl(r.data?.signedUrl || null)).catch(() => setExistingUrl(null))
      } else setExistingUrl(null)
    } else {
      setBoardId(defaultBoardId || boards[0]?.id || '')
      setTitle(''); setBody(''); setExistingUrl(null)
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const shownImage = preview || (!imageRemoved ? existingUrl : null)

  const mutation = useMutation({
    mutationFn: async () => {
      let imagePath
      if (file) {
        const { data: { session } } = await supabase.auth.getSession()
        const uid = session?.user?.id
        // 원본 압축(1280px·0.6MB) + 목록용 썸네일(400px) 동반 저장 — 항상 jpeg
        const compressed = await compressImage(file, { maxWidthOrHeight: 1280, maxSizeMB: 0.6 })
        const path = `${uid}/${Date.now()}.jpg`
        const { error: upErr } = await supabase.storage.from('community-posts').upload(path, compressed, { contentType: 'image/jpeg' })
        if (upErr) throw upErr
        imagePath = path
        try {
          const thumb = await compressThumbnail(file)
          if (thumb) await supabase.storage.from('community-posts')
            .upload(thumbPathOf(path), thumb, { contentType: 'image/jpeg' })
        } catch (e) { console.warn('[썸네일 업로드 생략]', e?.message) }
      } else if (isEdit) {
        imagePath = imageRemoved ? null : (editPost.image_path || null)
      } else {
        imagePath = null
      }
      return isEdit
        ? updateCommunityPost({ id: editPost.id, boardId, title: title.trim(), body: body.trim(), imagePath })
        : createCommunityPost({ programId: program.id, boardId, title: title.trim(), body: body.trim(), imagePath })
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communityPosts(program.id, boardId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.communityPosts(program.id, 'all') })
      if (isEdit && editPost.board_id !== boardId) queryClient.invalidateQueries({ queryKey: queryKeys.communityPosts(program.id, editPost.board_id) })
      if (!isEdit) queryClient.invalidateQueries({ queryKey: ['home-stats'] })  // 대시보드 「오늘의 활동」 게시물 작성 즉시 갱신
      onClose()
      // 승인 필요 게시판 → 폼 닫고 「검토 요청 완료」 중앙 카드 안내
      if (!isEdit && post?.status === 'pending') setPendingDone(true)
    },
    onError: (e) => setError(e.message || '저장에 실패했어요'),
  })

  const onPick = (e) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (f.size > 10 * 1024 * 1024) { setError('이미지는 최대 10MB예요'); return }
    if (!f.type.startsWith('image/')) { setError('이미지 파일만 가능해요'); return }
    setError(null)
    setCropSrc(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f) })
    setIsCropOpen(true)
  }
  const handleCropComplete = (blob) => {
    const cropped = new File([blob], 'post.jpg', { type: 'image/jpeg' })
    setFile(cropped); setImageRemoved(false)
    setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
    setIsCropOpen(false)
  }
  const removeImage = () => {
    if (file) {
      setFile(null)
      setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null })
      setCropSrc(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    } else { setImageRemoved(true); setExistingUrl(null) }
  }

  const submit = () => {
    if (!boardId) { setError('게시판을 선택해주세요'); return }
    if (!body.trim()) { setError('내용을 입력해주세요'); return }
    setError(null)
    mutation.mutate()
  }

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-5 space-y-3">
        <h2 className="text-lg font-bold text-gray-800">{isEdit ? '✏️ 글 수정' : '✏️ 글쓰기'}</h2>

        <div>
          <label className="block text-[12px] font-medium text-gray-500 mb-1">게시판</label>
          <select value={boardId} onChange={(e) => setBoardId(e.target.value)}
            className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500">
            {boards.length === 0 && <option value="">작성 가능한 게시판이 없어요</option>}
            {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={30} placeholder="제목 (선택)"
            className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500" />
          <p className="text-[11px] text-gray-400 text-right mt-0.5">{title.length}/30</p>
        </div>

        <div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={500} placeholder="내용을 입력하세요 (최대 500자)"
            className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 resize-none leading-relaxed" />
          <p className="text-[11px] text-gray-400 text-right mt-0.5">{body.length}/500</p>
        </div>

        {shownImage ? (
          <div className="relative">
            <img src={shownImage} alt="" className="w-full max-h-60 object-contain rounded-lg bg-gray-50" />
            <div className="absolute top-2 right-2 flex gap-1.5">
              {cropSrc && (
                <button type="button" onClick={() => setIsCropOpen(true)}
                  className="h-7 px-2.5 rounded-full bg-black/60 text-white text-xs font-medium flex items-center gap-1"><Crop className="w-3 h-3" /> 편집</button>
              )}
              <button type="button" onClick={removeImage}
                className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-1.5 h-11 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 text-sm font-medium cursor-pointer hover:border-emerald-400 hover:text-emerald-600 transition">
            <ImageIcon className="w-4 h-4" /> 사진 추가 (선택)
            <input type="file" accept="image/*" onChange={onPick} className="hidden" />
          </label>
        )}

        {error && <p className="p-2 bg-red-50 text-red-600 text-xs rounded text-center">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition">취소</button>
          <button type="button" onClick={submit} disabled={mutation.isPending || boards.length === 0}
            className="flex-[1.6] h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition disabled:opacity-50">
            {mutation.isPending ? '저장 중...' : (isEdit ? '수정' : '게시')}
          </button>
        </div>
      </div>
    </Modal>
    <ImageCropModal
      isOpen={isCropOpen}
      imageSrc={cropSrc}
      onClose={() => setIsCropOpen(false)}
      onComplete={handleCropComplete}
      aspect={4 / 3}
      aspectOptions={[{ label: '정사각 1:1', value: 1 }, { label: '가로 4:3', value: 4 / 3 }, { label: '세로 3:4', value: 3 / 4 }]}
      cropShape="rect"
      title="사진 편집"
      description="비율을 고르고, 드래그·확대축소로 맞춰주세요"
    />
    {/* 승인 필요 게시판 — 검토 요청 완료 안내 (네이티브 alert 대체) */}
    {pendingDone && (
      <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-5" onClick={() => setPendingDone(false)}>
        <div className="w-full max-w-xs bg-white rounded-2xl p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 flex items-center justify-center mb-3">
            <Clock className="w-7 h-7 text-amber-500" />
          </div>
          <h2 className="text-[16px] font-bold text-gray-800 mb-1.5">검토 요청이 접수됐어요</h2>
          <p className="text-[13px] text-gray-600 leading-relaxed break-keep">
            이 게시판은 운영자 검토 후 게시돼요.<br />승인되면 다른 참여자에게 노출됩니다.
          </p>
          <button type="button" onClick={() => setPendingDone(false)}
            className="mt-5 w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition">확인</button>
        </div>
      </div>
    )}
    </>
  )
}

export default CommunityPostModal
