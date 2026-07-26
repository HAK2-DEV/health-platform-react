import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Check, Heart, Sprout, Hand, MessageCircle, Settings, Bell, FileText, Ban, Flag, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import { formatRelativeKstDay, getTodayKST, toKSTDateString } from '../lib/formatters'
import { queryKeys, fetchNotifications } from '../lib/queries'
import EmptyState from '../components/common/EmptyState'
import LoadingState from '../components/common/LoadingState'
import PillTabs from '../components/common/PillTabs'
import IconBox from '../components/common/IconBox'
import BackButton from '../components/common/BackButton'

// Day 65 Phase 4 — 알림 페이지 (참고 사진):
//   - 풀너비 그라데이션 헤더 + 잎사귀 일러스트 + 설정 아이콘
//   - 필터 칩 (전체/좋아요/인증/요청/댓글) — 각 type 별 컬러 아이콘 박스
//   - 시간 그루핑 (오늘 / 이번 주 / 이전 알림)
//   - 카드: 컬러 아이콘 박스 + 제목 + body + 시간 + 삭제 + 안 읽음 도트

// 알림 type → 카테고리 매핑
const TYPE_META = {
  POST_LIKE:              { cat: 'like',    tone: 'pink',    icon: Heart,         iconCls: 'fill-current' },
  POST_COMMENT:           { cat: 'comment', tone: 'violet',  icon: MessageCircle, iconCls: '' },
  REVIEW_APPROVED:        { cat: 'verify',  tone: 'emerald', icon: Sprout,        iconCls: '' },
  REVIEW_REJECTED:        { cat: 'verify',  tone: 'emerald', icon: Sprout,        iconCls: '' },
  VERIFICATION_SUBMITTED: { cat: 'verify',  tone: 'emerald', icon: Sprout,        iconCls: '' },
  PARTICIPANT_JOINED:     { cat: 'request', tone: 'amber',   icon: Hand,          iconCls: '' },
  POST_PENDING:           { cat: 'request', tone: 'amber',   icon: FileText,      iconCls: '' },
  REPORT_RECEIVED:        { cat: 'request', tone: 'red',     icon: Flag,          iconCls: '' },
  POST_APPROVED:          { cat: 'verify',  tone: 'emerald', icon: Check,         iconCls: '' },
  POST_REJECTED:          { cat: 'verify',  tone: 'red',     icon: Ban,           iconCls: '' },
  TEAM_INVITE:            { cat: 'request', tone: 'violet',  icon: Users,         iconCls: '' },
  TEAM_JOINED:            { cat: 'request', tone: 'violet',  icon: Users,         iconCls: '' },
  TEAM_REMOVED:           { cat: 'request', tone: 'slate',   icon: Users,         iconCls: '' },
  TEAM_LEADER_CHANGED:    { cat: 'request', tone: 'violet',  icon: Users,         iconCls: '' },
  INQUIRY_RECEIVED:       { cat: 'request', tone: 'sky',     icon: MessageCircle, iconCls: '' },
  INQUIRY_ANSWERED:       { cat: 'comment', tone: 'sky',     icon: MessageCircle, iconCls: '' },
  OPERATOR_CHEER:         { cat: 'like',    tone: 'pink',    icon: Heart,         iconCls: 'fill-current' },
}
const DEFAULT_META = { cat: 'verify', tone: 'slate', icon: Bell, iconCls: '' }

const FILTER_OPTIONS = [
  { value: 'all',     label: '전체' },
  { value: 'like',    label: '좋아요', icon: <Heart className="w-3.5 h-3.5 fill-current text-pink-500" /> },
  { value: 'verify',  label: '인증',   icon: <Sprout className="w-3.5 h-3.5 text-emerald-500" /> },
  { value: 'request', label: '요청',   icon: <Hand className="w-3.5 h-3.5 text-amber-500" /> },
  { value: 'comment', label: '댓글',   icon: <MessageCircle className="w-3.5 h-3.5 text-violet-500" /> },
]

// 알림 1개 → 카테고리 키
function categoryOf(n) {
  return (TYPE_META[n.type] || DEFAULT_META).cat
}

// 알림 시간 그룹 — 오늘 / 이번 주 / 이전 알림
function timeGroupOf(createdAt) {
  const today = getTodayKST()
  const target = toKSTDateString(createdAt)
  if (target === today) return 'today'
  const todayD = new Date(`${today}T00:00:00+09:00`)
  const targetD = new Date(`${target}T00:00:00+09:00`)
  const diffDays = Math.round((todayD - targetD) / 86400000)
  if (diffDays < 7) return 'week'
  return 'older'
}

function NotificationsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const [filter, setFilter] = useState('all')
  const [detailNotif, setDetailNotif] = useState(null)   // 이동 경로 없는 알림(거절 등) 상세 펼침

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: queryKeys.notifications(userId),
    queryFn: fetchNotifications,
    enabled: !!userId,
  })

  // 필터 + 시간 그루핑
  const grouped = useMemo(() => {
    const filtered = filter === 'all'
      ? notifications
      : notifications.filter(n => categoryOf(n) === filter)
    const groups = { today: [], week: [], older: [] }
    for (const n of filtered) {
      groups[timeGroupOf(n.created_at)].push(n)
    }
    return groups
  }, [notifications, filter])

  const markReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (notificationId) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // 사유성 알림(점수 제외·게시글 거절)은 이동 대신 사유 전체를 상세로 펼침. 그 외는 link_path 이동.
  const REASON_TYPES = new Set(['REVIEW_REJECTED', 'POST_REJECTED', 'OPERATOR_CHEER'])
  const handleClick = (n) => {
    if (!n.is_read) markReadMutation.mutate(n.id)
    if (REASON_TYPES.has(n.type) || !n.link_path) setDetailNotif(n)
    else navigate(n.link_path)
  }

  const handleDelete = (e, n) => {
    e.stopPropagation()
    deleteMutation.mutate(n.id)
  }

  const unreadCount = notifications.filter(n => !n.is_read).length
  const totalCount = grouped.today.length + grouped.week.length + grouped.older.length

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 + 우상단 설정 + 풍경 이미지 */}
      <div className="relative h-44 overflow-hidden bg-gradient-to-b from-emerald-100 via-emerald-50/80 to-teal-50/40">
        <img
          src="/header-rankings.jpg"
          alt=""
          aria-hidden="true"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
          className="absolute inset-0 w-full h-full object-cover object-[center_30%]"
        />
        <div className="max-w-4xl mx-auto px-4 relative pt-6 flex items-start justify-between gap-3">
          <div className="flex items-start gap-1.5">
            <BackButton />
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800 drop-shadow-sm">
                알림 <span className="text-xl">🔔</span>
              </h1>
              <p className="text-sm font-medium text-gray-700 mt-1.5 drop-shadow-sm">최근 업데이트를 확인해보세요</p>
            </div>
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1 px-3 py-2 text-xs text-gray-700 bg-white rounded-pill shadow-soft hover:shadow-elevated transition disabled:opacity-50 flex-shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              모두 읽음 ({unreadCount})
            </button>
          ) : (
            <button
              type="button"
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-soft hover:shadow-elevated transition flex-shrink-0"
              title="알림 설정"
              onClick={() => navigate('/profile')}
            >
              <Settings className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 -mt-[76px] relative space-y-4 pt-5 pb-6 bg-white rounded-t-3xl min-h-screen">
        {/* 필터 칩 */}
        <PillTabs
          options={FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
          variant="pill"
        />

        {isLoading ? (
          <LoadingState />
        ) : notifications.length === 0 ? (
          <EmptyState icon="📭" title="아직 알림이 없어요" />
        ) : totalCount === 0 ? (
          <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-6 text-center">
            <p className="text-sm text-gray-500">선택한 필터의 알림이 없어요</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={filter}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0.75, 0.25, 1] }}
              className="space-y-4"
            >
              {grouped.today.length > 0 && (
                <TimeGroup label="오늘" items={grouped.today} onClick={handleClick} onDelete={handleDelete} deletePending={deleteMutation.isPending} />
              )}
              {grouped.week.length > 0 && (
                <TimeGroup label="이번 주" items={grouped.week} onClick={handleClick} onDelete={handleDelete} deletePending={deleteMutation.isPending} />
              )}
              {grouped.older.length > 0 && (
                <TimeGroup label="이전 알림" items={grouped.older} onClick={handleClick} onDelete={handleDelete} deletePending={deleteMutation.isPending} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* 상세 펼침 — 이동 경로 없는 알림(거절 사유 등) 전체 보기 */}
      {detailNotif && (() => {
        const meta = TYPE_META[detailNotif.type] || DEFAULT_META
        const Icon = meta.icon
        return (
          <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-5" onClick={() => setDetailNotif(null)}>
            <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2.5 mb-3">
                <IconBox tone={meta.tone} size="lg" shape="circle"><Icon className={`w-5 h-5 ${meta.iconCls}`} /></IconBox>
                <h3 className="flex-1 text-[15px] font-bold text-gray-800 break-keep">{detailNotif.title}</h3>
              </div>
              {detailNotif.body && (() => {
                // "...\n사유: ..." 형식이면 사유 부분을 볼드 처리 (여러 줄 사유 포함)
                const body = detailNotif.body
                const at = body.indexOf('사유:')
                if (at < 0) {
                  return <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line break-words">{body}</p>
                }
                const head = body.slice(0, at).replace(/\s+$/, '')
                const reason = body.slice(at).replace(/^사유:\s*/, '')
                return (
                  <div className="text-[13px] text-gray-600 leading-relaxed break-words">
                    {head && <p className="whitespace-pre-line">{head}</p>}
                    <p className={head ? 'mt-2' : ''}>사유: <span className="font-bold text-gray-800 whitespace-pre-line">{reason}</span></p>
                  </div>
                )
              })()}
              <p className="text-[11px] text-gray-400 mt-3">{formatRelativeKstDay(detailNotif.created_at)}</p>
              <button type="button" onClick={() => setDetailNotif(null)}
                className="mt-4 w-full h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition">닫기</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// 시간 그룹 (오늘/이번 주/이전) — 헤더 + 알림 카드 리스트
function TimeGroup({ label, items, onClick, onDelete, deletePending }) {
  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2 ml-1">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
        {label}
      </h3>
      <div className="space-y-2">
        {items.map(n => (
          <NotificationCard
            key={n.id}
            n={n}
            onClick={onClick}
            onDelete={onDelete}
            deletePending={deletePending}
          />
        ))}
      </div>
    </div>
  )
}

// 알림 카드 1개
function NotificationCard({ n, onClick, onDelete, deletePending }) {
  const meta = TYPE_META[n.type] || DEFAULT_META
  const Icon = meta.icon
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(n)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(n)
        }
      }}
      className={`
        relative flex items-center gap-3 p-3 rounded-card border shadow-soft text-left transition cursor-pointer
        ${n.is_read
          ? 'bg-white border-gray-100 hover:bg-gray-50'
          : 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50/70'}
      `}
    >
      {/* 안 읽음 도트 — 좌측 외부 */}
      {!n.is_read && (
        <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 bg-emerald-500 rounded-full" />
      )}
      <IconBox tone={meta.tone} size="lg" shape="circle">
        <Icon className={`w-5 h-5 ${meta.iconCls}`} />
      </IconBox>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${n.is_read ? 'font-medium text-gray-800' : 'font-semibold text-gray-900'}`}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
            {n.body}
          </p>
        )}
        <p className="text-[11px] text-gray-400 mt-1">
          {formatRelativeKstDay(n.created_at)}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => onDelete(e, n)}
        disabled={deletePending}
        className="p-1 text-gray-300 hover:text-red-500 transition flex-shrink-0 disabled:opacity-40"
        title="삭제"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

export default NotificationsPage
