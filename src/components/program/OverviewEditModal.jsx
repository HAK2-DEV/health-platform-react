import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import MarkdownView from '../common/MarkdownView'
import { supabase } from '../../supabaseClient'

// 운영자 전용 — ProgramDetailPage 「개요」 탭에 표시할 자유 글 작성/수정.
// 데이터: programs.overview_content TEXT NULL (마이그레이션 069)
// Day 65 본인 결정: 마크다운 파싱 제거. textarea 친 그대로 (줄바꿈/공백/빈 줄) 표시.
//
// UI: 편집 ↔ 미리보기 토글. textarea + 단순 텍스트 미리보기.
// 길이 제한: 5000자 (블로그 글 수준).
const MAX_LENGTH = 5000

function OverviewEditModal({ program, isOpen, onClose, onSuccess }) {
  const [content, setContent] = useState('')
  const [mode, setMode] = useState('edit')  // 'edit' | 'preview'
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (program && isOpen) {
      setContent(program.overview_content || '')
      setMode('edit')
      setError(null)
      setIsSaving(false)
    }
  }, [program, isOpen])

  const handleSave = async () => {
    if (content.length > MAX_LENGTH) {
      setError(`최대 ${MAX_LENGTH}자까지 가능합니다`)
      return
    }

    setIsSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('programs')
      .update({ overview_content: content.trim() || null })
      .eq('id', program.id)

    if (updateError) {
      console.error('개요 글 저장 실패:', updateError)
      setError(updateError.message)
      setIsSaving(false)
      return
    }

    onSuccess?.()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {program && (
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-1 pr-8">
            📝 개요 글 수정
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {program.name}
          </p>

          {/* 편집/미리보기 토글 */}
          <div className="flex gap-1 mb-3 p-1 bg-gray-100 rounded-full">
            <button
              type="button"
              onClick={() => setMode('edit')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-full transition ${
                mode === 'edit'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ✏️ 편집
            </button>
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-full transition ${
                mode === 'preview'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              👁️ 미리보기
            </button>
          </div>

          {mode === 'edit' ? (
            <>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`프로그램 소개·공지·안내 등을 자유롭게 작성하세요.

여기 친 그대로 (줄바꿈·공백·빈 줄) 모든 참여자에게 표시됩니다.`}
                rows={14}
                maxLength={MAX_LENGTH}
                disabled={isSaving}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 disabled:bg-gray-50 resize-y text-sm font-mono leading-relaxed"
              />
              <p className="text-[11px] text-gray-400 mt-1 text-right">
                {content.length} / {MAX_LENGTH}자
              </p>
            </>
          ) : (
            <div className="min-h-[320px] max-h-[60vh] overflow-y-auto p-4 bg-gray-50 rounded-xl border border-gray-200">
              {content.trim() ? (
                <MarkdownView content={content} />
              ) : (
                <p className="text-sm text-gray-400 text-center py-12">
                  편집 탭에서 글을 작성하면 여기에 미리보기가 표시됩니다
                </p>
              )}
            </div>
          )}

          {/* 에러 */}
          {error && (
            <p className="mt-3 p-2 bg-red-100 text-red-700 rounded-xl text-sm text-center">
              {error}
            </p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-[2] px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition disabled:bg-gray-400"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default OverviewEditModal
