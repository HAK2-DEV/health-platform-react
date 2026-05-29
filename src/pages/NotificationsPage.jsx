import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Check } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import { formatRelativeKstDay } from '../lib/formatters'
import { queryKeys, fetchNotifications } from '../lib/queries'
import EmptyState from '../components/common/EmptyState'
import LoadingState from '../components/common/LoadingState'
import PageHeader from '../components/common/PageHeader'

// 알림 센터 — Bottom Tab Bar 🔔 진입점
// MVP 1차: polling — Bell 클릭 또는 페이지 진입/포커스 시 fetch
function NotificationsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: queryKeys.notifications(userId),
    queryFn: fetchNotifications,
    enabled: !!userId,
  })

  // 한 알림 읽음 처리 + link_path 이동
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

  // 일괄 읽음 처리
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // 알림 삭제
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

  const handleClick = (n) => {
    // 읽음 처리 후 link 이동
    if (!n.is_read) markReadMutation.mutate(n.id)
    if (n.link_path) navigate(n.link_path)
  }

  const handleDelete = (e, n) => {
    e.stopPropagation()
    deleteMutation.mutate(n.id)
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        action={unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 bg-white/70 hover:bg-white rounded-full transition disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            모두 읽음 ({unreadCount})
          </button>
        )}
      >
        🔔 알림
      </PageHeader>

      {isLoading ? (
        <LoadingState />
      ) : notifications.length === 0 ? (
        <EmptyState icon="📭" title="아직 알림이 없어요" />
      ) : (
        <motion.div layout className="grid gap-2">
          <AnimatePresence initial={false}>
            {notifications.map(n => (
              <motion.div
                key={n.id}
                role="button"
                tabIndex={0}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                onClick={() => handleClick(n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleClick(n)
                  }
                }}
                className={`
                  w-full p-3 rounded-lg border text-left transition cursor-pointer
                  ${n.is_read
                    ? 'bg-white border-gray-200 hover:bg-gray-50'
                    : 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50'}
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {!n.is_read && (
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0" />
                      )}
                      <p className={`text-sm truncate ${n.is_read ? 'text-gray-700' : 'font-medium text-gray-900'}`}>
                        {n.title}
                      </p>
                    </div>
                    {n.body && (
                      <p className="text-xs text-gray-500 line-clamp-2 ml-3.5">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1 ml-3.5">
                      {formatRelativeKstDay(n.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, n)}
                    disabled={deleteMutation.isPending}
                    className="p-1 text-gray-300 hover:text-red-500 transition flex-shrink-0 disabled:opacity-40"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}

export default NotificationsPage
