import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Modal from '../common/Modal'
import { createTeam } from '../../lib/queries'

// 팀 표식용 이모지 (선택) — 없으면 랭킹에서 👥 fallback
const EMOJI_CHOICES = ['🌿', '🔥', '⭐', '🌸', '🏃', '💪', '🥗', '🚀', '🐢', '🦋', '🌊', '🍀']
const NAME_MAX = 20

// 팀 생성 모달 — 생성 폼 → 성공 시 축하 화면(2단계).
// program: team_size_type / team_size_min / team_size_max / team_size_fixed 포함
function TeamCreateModal({ program, isOpen, onClose, onCreated }) {
  const sizeType = program?.team_size_type || 'range'
  const sizeMin = program?.team_size_min || 2
  const sizeMax = program?.team_size_max || 8
  const sizeFixed = program?.team_size_fixed || 2

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [capacity, setCapacity] = useState(sizeType === 'fixed' ? sizeFixed : sizeMax)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null) // 성공 시 { teamId, name, emoji }

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setName('')
      setEmoji('')
      setCapacity(sizeType === 'fixed' ? sizeFixed : sizeMax)
      setIsSaving(false)
      setError(null)
      setCreated(null)
    }
  }, [isOpen, sizeType, sizeFixed, sizeMax])

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('팀 이름을 입력해주세요'); return }
    setIsSaving(true)
    setError(null)
    try {
      const teamId = await createTeam(program.id, trimmed, emoji, capacity)
      setCreated({ teamId, name: trimmed, emoji })
    } catch (e) {
      setError(e?.message || '팀 생성에 실패했어요')
      setIsSaving(false)
    }
  }

  const handleDone = () => {
    onCreated?.(created?.teamId)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {created ? (
        // ─── 축하 화면 ───
        <div className="p-6 pt-2 text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 14, stiffness: 240 }}
            className="mx-auto w-20 h-20 rounded-full bg-violet-100 flex items-center justify-center text-4xl mb-4"
          >
            {created.emoji || '🎉'}
          </motion.div>
          <h2 className="text-xl font-bold text-gray-800">
            '{created.name}' 팀이 만들어졌어요!
          </h2>
          <p className="text-sm text-gray-600 mt-2 break-keep">
            이제 팀원을 초대해 함께 도전해보세요.<br />
            2명부터 팀 랭킹에 반영돼요.
          </p>
          <button
            type="button"
            onClick={handleDone}
            className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white font-bold rounded-xl transition"
          >
            좋아요!
          </button>
        </div>
      ) : (
        // ─── 생성 폼 ───
        <div className="p-6 pt-2">
          <h2 className="text-xl font-bold text-gray-800 mb-1">팀 만들기</h2>
          <p className="text-sm text-gray-500 mb-5 break-keep">
            팀을 만들면 자동으로 팀장이 돼요. 만든 뒤 팀원을 초대할 수 있어요.
          </p>

          {/* 팀 이름 */}
          <label className="block text-sm font-medium text-gray-700 mb-1.5">팀 이름</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={NAME_MAX}
            disabled={isSaving}
            placeholder="예: 아침 산책단"
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 disabled:bg-gray-50"
          />
          <p className="text-[11px] text-gray-400 text-right mt-1">{name.length}/{NAME_MAX}</p>

          {/* 이모지 (선택) */}
          <label className="block text-sm font-medium text-gray-700 mb-2 mt-2">팀 표식 (선택)</label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_CHOICES.map(e => (
              <button
                key={e} type="button" disabled={isSaving}
                onClick={() => setEmoji(emoji === e ? '' : e)}
                className={`w-10 h-10 rounded-xl border-2 text-xl flex items-center justify-center transition ${
                  emoji === e ? 'border-violet-500 bg-violet-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          {/* 정원 */}
          <label className="block text-sm font-medium text-gray-700 mb-1.5 mt-5">팀 정원</label>
          {sizeType === 'range' ? (
            <>
              <select
                value={capacity}
                onChange={e => setCapacity(Number(e.target.value))}
                disabled={isSaving}
                className="px-3 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-sm text-gray-700 focus:border-violet-400 focus:outline-none disabled:opacity-50"
              >
                {Array.from({ length: sizeMax - sizeMin + 1 }, (_, i) => sizeMin + i).map(n => (
                  <option key={n} value={n}>{n}명</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1.5 break-keep">
                {sizeMin}~{sizeMax}명 중에서 골라요. 정한 인원까지 초대할 수 있어요.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-700 px-3 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl">
              {sizeFixed}명 고정 — {sizeFixed}명이 다 모이면 팀이 활성화돼요.
            </p>
          )}

          {error && (
            <p className="mt-4 p-2.5 bg-red-50 text-red-600 rounded-lg text-sm text-center break-keep">{error}</p>
          )}

          <div className="flex gap-2 mt-6">
            <button
              type="button" onClick={onClose} disabled={isSaving}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button" onClick={handleCreate} disabled={isSaving || !name.trim()}
              className="flex-[2] px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white font-bold rounded-xl transition disabled:opacity-50"
            >
              {isSaving ? '만드는 중...' : '팀 만들기'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default TeamCreateModal
