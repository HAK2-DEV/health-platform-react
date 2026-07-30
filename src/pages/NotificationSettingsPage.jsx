import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, MessageCircle, Sprout, Hand, Loader2, Check, Bell, Megaphone, ChevronDown } from 'lucide-react'
import { pushSupported, getPushState, subscribeToPush, unsubscribeFromPush } from '../lib/push'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../supabaseClient'
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
    description: '내 인증·게시글에 다른 참여자가 좋아요를 누르면 알림',
    tone: 'pink',
    icon: <Heart className="w-5 h-5 fill-current" />,
  },
  {
    key: 'comment_enabled',
    label: '댓글 알림',
    description: '내 인증·게시글에 댓글이 달리면 알림',
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

// 새 소식 알림 — 마스터 + 유형별(미션/퀴즈/클래스/공지) 펼침 서브토글
const CONTENT_SUBS = [
  { key: 'content_mission_enabled', label: '새 미션' },
  { key: 'content_quiz_enabled', label: '새 퀴즈' },
  { key: 'content_class_enabled', label: '새 클래스' },
  { key: 'content_notice_enabled', label: '새 공지' },
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

        {/* 폰 푸시 (Web Push) — 앱을 닫아도 폰으로 알림 */}
        <PushToggleCard />

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
            <ContentNotifSection local={local} onToggle={handleToggle} disabled={updateMutation.isPending} />
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
          ⓘ 위 항목별 설정은 앱 안 🔔 알림에 적용돼요. 「폰 푸시」를 켜면 앱을 닫아도 폰으로 알림이 옵니다.
        </p>
      </div>
    </div>
  )
}

// 공용 스위치 (일반/작은)
function Switch({ on, disabled, onClick, small }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} disabled={disabled}
      className={`relative inline-flex flex-shrink-0 rounded-full transition disabled:opacity-40 ${small ? 'h-5 w-9' : 'h-6 w-11'} ${on ? 'bg-emerald-500' : 'bg-gray-200'}`}>
      <span className={`inline-block transform rounded-full bg-white shadow-sm transition mt-0.5 ${small ? 'h-4 w-4' : 'h-5 w-5'} ${on ? (small ? 'translate-x-[18px]' : 'translate-x-[22px]') : 'translate-x-0.5'}`} />
    </button>
  )
}

// 새 소식 알림 — 마스터 토글 + 눌러서 유형별(미션/퀴즈/클래스/공지) 펼침 조절
function ContentNotifSection({ local, onToggle, disabled }) {
  const [open, setOpen] = useState(false)
  const master = !!local.content_enabled
  return (
    <div>
      <div className="flex items-center gap-3 p-4">
        <IconBox tone="sky"><Megaphone className="w-5 h-5" /></IconBox>
        <button type="button" onClick={() => setOpen(v => !v)} className="flex-1 min-w-0 text-left">
          <p className="font-bold text-gray-800 flex items-center gap-1">
            새 소식 알림 <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </p>
          <p className="text-[12px] text-gray-500 mt-0.5">새 미션·퀴즈·클래스·공지 알림 · 눌러서 유형별 설정</p>
        </button>
        <Switch on={master} disabled={disabled} onClick={() => onToggle('content_enabled')} />
      </div>
      <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <div className="pl-[68px] pr-4 pb-3.5 space-y-3">
            {CONTENT_SUBS.map(s => (
              <div key={s.key} className="flex items-center gap-2">
                <span className={`flex-1 text-[13px] ${master ? 'text-gray-700' : 'text-gray-300'}`}>{s.label}</span>
                <Switch on={master && !!local[s.key]} disabled={disabled || !master} onClick={() => onToggle(s.key)} small />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// 폰 푸시(Web Push) 토글 — 권한 요청 + 구독 저장/해제. 브라우저·기기 지원 여부에 따라 안내.
function PushToggleCard() {
  const toast = useToast()
  const [state, setState] = useState('loading')  // loading|unsupported|denied|nokey|subscribed|unsubscribed
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  useEffect(() => {
    if (!pushSupported()) { setState('unsupported'); return }
    getPushState().then(setState).catch(() => setState('unsupported'))
  }, [])
  const on = state === 'subscribed'
  const disabled = busy || ['loading', 'unsupported', 'denied', 'nokey'].includes(state)
  const toggle = async () => {
    if (disabled) return
    setBusy(true)
    try {
      if (on) { await unsubscribeFromPush(); setState('unsubscribed'); toast.show('폰 푸시를 껐어요') }
      else { await subscribeToPush(); setState('subscribed'); toast.show('폰 푸시를 켰어요 · 앱을 닫아도 알림이 와요') }
    } catch (e) {
      toast.show(e.message || '설정에 실패했어요')
      getPushState().then(setState).catch(() => {})
    } finally { setBusy(false) }
  }
  const sendTest = async () => {
    if (testing) return
    setTesting(true)
    try {
      const { error } = await supabase.rpc('send_test_push')
      if (error) throw error
      toast.show('테스트 푸시를 보냈어요 · 잠시 후 폰을 확인해 보세요')
    } catch (e) {
      toast.show(e.message || '테스트 발송에 실패했어요')
    } finally { setTesting(false) }
  }
  const hint = state === 'unsupported' ? '이 브라우저·기기는 푸시를 지원하지 않아요. (iPhone은 홈 화면에 앱을 추가하면 가능해요)'
    : state === 'denied' ? '차단됨 — 브라우저 설정에서 이 사이트의 알림을 허용해 주세요.'
    : state === 'nokey' ? '푸시 기능을 준비 중이에요. 곧 켤 수 있어요.'
    : on ? '앱을 닫아도 폰으로 알림이 와요.' : '켜면 앱을 닫아도 폰으로 알림을 받아요.'
  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-4 mb-4">
      <div className="flex items-center gap-3">
        <IconBox tone="emerald"><Bell className="w-5 h-5" /></IconBox>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800">폰 푸시 알림</p>
          <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed break-keep">{hint}</p>
        </div>
        <button type="button" role="switch" aria-checked={on} onClick={toggle} disabled={disabled}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition disabled:opacity-40 ${on ? 'bg-emerald-500' : 'bg-gray-200'}`}>
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition mt-0.5 ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {on && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
          <button type="button" onClick={sendTest} disabled={testing}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 disabled:opacity-50">
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
            테스트 푸시 보내기
          </button>
        </div>
      )}
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
