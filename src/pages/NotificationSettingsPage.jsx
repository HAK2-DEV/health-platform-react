import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, MessageCircle, Sprout, Hand, Loader2, Check } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import {
  queryKeys,
  fetchMyNotificationPreferences,
  updateMyNotificationPreferences,
} from '../lib/queries'
import StickyBackBar from '../components/common/StickyBackBar'
import LoadingState from '../components/common/LoadingState'
import IconBox from '../components/common/IconBox'

// Day 65 — 알림 환경설정 페이지.
// type 별 ON/OFF 토글 → DB notification_preferences. 트리거가 INSERT 전 확인.
// /profile/notifications-settings

const TOGGLES = [
  {
    key: 'like_enabled',
    label: '좋아요 알림',
    description: '내 인증에 다른 참여자가 좋아요를 누르면 알림',
    tone: 'pink',
    icon: <Heart className="w-5 h-5 fill-current" />,
  },
  {
    key: 'comment_enabled',
    label: '댓글 알림',
    description: '내 인증에 댓글이 달리면 알림',
    tone: 'violet',
    icon: <MessageCircle className="w-5 h-5" />,
  },
  {
    key: 'verify_enabled',
    label: '인증 알림',
    description: '내 인증이 승인/반려되거나 (운영자) 새 인증이 제출되면 알림',
    tone: 'emerald',
    icon: <Sprout className="w-5 h-5" />,
  },
  {
    key: 'request_enabled',
    label: '가입 요청 알림',
    description: '(운영자만) 승인 필요한 프로그램에 가입 요청이 오면 알림',
    tone: 'amber',
    icon: <Hand className="w-5 h-5" />,
  },
]

function NotificationSettingsPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const { data: prefs, isLoading } = useQuery({
    queryKey: queryKeys.myNotificationPreferences(userId),
    queryFn: fetchMyNotificationPreferences,
    enabled: !!userId,
  })

  // 로컬 상태 — 토글 즉시 반응 + debounced 저장
  const [local, setLocal] = useState(null)
  useEffect(() => {
    if (prefs) setLocal(prefs)
  }, [prefs])

  // 저장 상태 표시 (3초 후 자동 사라짐)
  const [savedAt, setSavedAt] = useState(null)

  const updateMutation = useMutation({
    mutationFn: updateMyNotificationPreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.myNotificationPreferences(userId), data)
      // 설정 즉시 반영 — 끈 type 이 목록·배지에서 바로 사라지도록 재조회
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(prev => (prev && Date.now() - prev >= 2900 ? null : prev)), 3000)
    },
    onError: (err) => {
      console.error('알림 환경설정 저장 실패:', err)
      alert(`저장 실패: ${err.message}`)
      // 실패 시 서버값으로 복원
      if (prefs) setLocal(prefs)
    },
  })

  const handleToggle = (key) => {
    if (!local) return
    const newVal = !local[key]
    const next = { ...local, [key]: newVal }
    setLocal(next)
    updateMutation.mutate({ [key]: newVal })
  }

  return (
    <div className="min-h-screen bg-surface-app">
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-6">
        <StickyBackBar fallbackPath="/profile" title="뒤로" />

        <div className="mt-2 mb-5">
          <h1 className="text-2xl font-bold text-gray-800">🔔 알림 설정</h1>
          <p className="text-sm text-gray-500 mt-1.5">받고 싶지 않은 알림은 끌 수 있어요</p>
        </div>

        {isLoading || !local ? (
          <LoadingState />
        ) : (
          <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft divide-y divide-gray-100">
            {TOGGLES.map(t => (
              <ToggleRow
                key={t.key}
                tone={t.tone}
                icon={t.icon}
                label={t.label}
                description={t.description}
                value={local[t.key]}
                disabled={updateMutation.isPending}
                onChange={() => handleToggle(t.key)}
              />
            ))}
          </div>
        )}

        {/* 저장 상태 인디케이터 */}
        <div className="mt-4 text-center h-5">
          {updateMutation.isPending ? (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" /> 저장 중...
            </span>
          ) : savedAt ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <Check className="w-3 h-3" /> 저장됨
            </span>
          ) : null}
        </div>

        <p className="mt-6 text-[11px] text-gray-400 leading-relaxed text-center px-4">
          ⓘ 알림은 앱 안의 🔔 알림 탭에서만 전달돼요. 푸시/이메일 알림은 추후 추가 예정.
        </p>
      </div>
    </div>
  )
}

function ToggleRow({ tone, icon, label, description, value, disabled, onChange }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <IconBox tone={tone} size="md" shape="circle">
        {icon}
      </IconBox>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{description}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        disabled={disabled}
        role="switch"
        aria-checked={value}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition disabled:opacity-50
          ${value ? 'bg-brand-primary' : 'bg-gray-300'}
        `}
      >
        <span
          className={`
            inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition
            ${value ? 'translate-x-5' : 'translate-x-0.5'}
            absolute top-0.5
          `}
        />
      </button>
    </div>
  )
}

export default NotificationSettingsPage
