import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronDown, LayoutDashboard, HardDrive, Database,
  AlertTriangle, Users, BarChart3, Activity, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import {
  fetchMyRole, fetchAdminCapacity, fetchAdminTotals,
  fetchAdminActivity, fetchAdminOperators, fetchAdminAlerts, fetchAdminDbTables,
} from '../lib/queries'

// 관리자 전용 콘솔 — 시스템 상태(용량) · 살펴볼 것 · 서비스 현황 · 운영자별 현황.
//   데이터 소스: RPC 256(admin_*), 임계 밴드는 255(capacity_alert_state)가 매일 09:00 갱신.
//   서버에서 is_admin() 가드를 하므로 비관리자에겐 빈 값이 온다 — 화면에서도 한 번 더 막는다.

const BUCKET_LABELS = {
  'verification-images': '인증 사진',
  'community-posts': '커뮤니티 사진',
  'program-covers': '프로그램 표지',
  'profile-avatars': '프로필 사진',
  'todo-images': '할 일 사진',
}

function fmtBytes(n) {
  const b = Number(n) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`
  return `${(b / 1024 ** 3).toFixed(2)} GB`
}

// 사용률 → 색. 70% 미만 정상(초록) / 70~89 주의(주황) / 90 이상 위험(빨강).
//   255 의 알림 밴드와 같은 기준이라 화면과 푸시가 어긋나지 않는다.
function usageTone(pct) {
  if (pct >= 90) return { bar: 'bg-red-500', text: 'text-red-600', label: '위험' }
  if (pct >= 70) return { bar: 'bg-amber-500', text: 'text-amber-600', label: '주의' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-600', label: '정상' }
}

function relDay(iso) {
  if (!iso) return '기록 없음'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return '오늘'
  if (days === 1) return '어제'
  return `${days}일 전`
}

// 용량 게이지 한 줄 — 라벨 / 사용량 / 막대.
function UsageBar({ icon, label, bytes, limit, prev }) {
  const pct = limit > 0 ? (Number(bytes) / Number(limit)) * 100 : 0
  const tone = usageTone(pct)
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-gray-400">{icon}</span>
        <span className="text-[13px] font-bold text-gray-700">{label}</span>
        <span className={`ml-auto text-[13px] font-extrabold ${tone.text}`}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(1.5, pct))}%` }} />
      </div>
      <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5">
        <span>{fmtBytes(bytes)} / {fmtBytes(limit)} · {tone.label}</span>
        <DeltaBytes bytes={bytes} prev={prev} className="text-[11px]" />
      </p>
    </div>
  )
}

// 전일 대비 증감 — 주식 시세 관용(상승=빨강 ▲ / 하락=파랑 ▼). 색만이 아니라
//   «모양 + 부호» 로도 방향이 드러나게 한다(색각이상 대비, DESIGN_SYSTEM §12-8).
function DeltaLine({ value, prev }) {
  if (prev == null || value == null) return null
  const d = Number(value) - Number(prev)
  // 변화 없음은 «–» 만 — 8개 타일 대부분이 0인 날이 많아 숫자까지 쓰면 지저분해진다.
  if (d === 0) {
    return <p className="text-[11px] leading-tight text-gray-300 mt-0.5">–</p>
  }
  const up = d > 0
  return (
    <p className={`text-[11px] font-bold leading-tight tabular-nums mt-0.5 ${up ? 'text-red-600' : 'text-blue-600'}`}>
      {up ? '▲' : '▼'} {Math.abs(d).toLocaleString()}
    </p>
  )
}

// 용량 증감 — 같은 규칙(상승=빨강 ▲ / 하락=파랑 ▼). 값이 아주 작으면(1KB 미만) 변화 없음으로 본다.
function DeltaBytes({ bytes, prev, className = '' }) {
  if (prev == null || bytes == null) return null
  const d = Number(bytes) - Number(prev)
  if (Math.abs(d) < 1024) return <span className={`text-gray-300 ${className}`}>–</span>
  const up = d > 0
  return (
    <span className={`font-bold tabular-nums ${up ? 'text-red-600' : 'text-blue-600'} ${className}`}>
      {up ? '▲' : '▼'} {fmtBytes(Math.abs(d))}
    </span>
  )
}

// 개수 증감 (버킷 파일 수 등)
function DeltaCount({ value, prev, className = '' }) {
  if (prev == null || value == null) return null
  const d = Number(value) - Number(prev)
  if (d === 0) return null
  const up = d > 0
  return (
    <span className={`font-bold tabular-nums ${up ? 'text-red-600' : 'text-blue-600'} ${className}`}>
      {up ? '▲' : '▼'}{Math.abs(d).toLocaleString()}
    </span>
  )
}

function StatTile({ label, value, prev }) {
  return (
    <div className="@container bg-gray-50 rounded-xl px-3 py-2.5">
      <p className="text-[11px] text-gray-500 leading-normal">{label}</p>
      {/* 좁은 폰(타일 78px)에서 6자리 숫자가 옆 타일로 삐져나왔다 → 틀은 그대로 두고
          글자를 컨테이너 폭에 맞춰 줄인다 (DESIGN_SYSTEM §14 배너 레시피와 같은 처방). */}
      <p className="text-[clamp(11px,18cqi,17px)] font-extrabold text-gray-800 leading-tight mt-0.5 tabular-nums">
        {Number(value ?? 0).toLocaleString()}
      </p>
      <DeltaLine value={value} prev={prev} />
    </div>
  )
}

function Section({ icon, title, desc, children }) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-emerald-600">{icon}</span>
        <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
      </div>
      {desc && <p className="text-[12px] text-gray-500 leading-relaxed mb-2.5">{desc}</p>}
      {children}
    </section>
  )
}

function AdminConsolePage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id
  const [bucketsOpen, setBucketsOpen] = useState(false)
  const [dbOpen, setDbOpen] = useState(false)

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ['my-role', userId],
    queryFn: () => fetchMyRole(userId),
    enabled: !!userId,
  })
  const isAdmin = role === 'ADMIN'
  const on = { enabled: isAdmin }

  const { data: cap, isLoading: capLoading } = useQuery({ queryKey: ['admin-capacity'], queryFn: fetchAdminCapacity, ...on })
  const { data: totals, isLoading: totalsLoading } = useQuery({ queryKey: ['admin-totals'], queryFn: fetchAdminTotals, ...on })
  const { data: activity = [], isLoading: actLoading } = useQuery({ queryKey: ['admin-activity', 14], queryFn: () => fetchAdminActivity(14), ...on })
  const { data: operators = [], isLoading: opLoading } = useQuery({ queryKey: ['admin-operators'], queryFn: fetchAdminOperators, ...on })
  const { data: alerts = [], isLoading: alertLoading } = useQuery({ queryKey: ['admin-alerts'], queryFn: fetchAdminAlerts, ...on })
  // DB 상세는 펼칠 때만 조회 — 매번 pg_class 를 스캔할 이유가 없다.
  const { data: dbTables = [], isLoading: dbLoading } = useQuery({
    queryKey: ['admin-db-tables', 20],
    queryFn: () => fetchAdminDbTables(20),
    enabled: isAdmin && dbOpen,
  })

  // 비관리자 차단 (서버도 막지만 화면에서 먼저 안내)
  if (userId && !roleLoading && !isAdmin) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <p className="text-2xl mb-2">🔒</p>
        <p className="text-gray-700 font-bold">관리자 전용 화면이에요</p>
        <button type="button" onClick={() => navigate('/dashboard')} className="mt-4 px-4 h-10 rounded-xl bg-emerald-500 text-white text-sm font-bold">대시보드로</button>
      </div>
    )
  }

  const maxAct = Math.max(1, ...activity.map(a => Number(a.verify_count) + Number(a.post_count)))
  const buckets = cap?.buckets || []
  // 전일 스냅샷의 버킷별 값 (271 적용 다음 날부터 채워진다 — 없으면 증감을 숨긴다)
  const prevBucket = Object.fromEntries((cap?.prev?.buckets || []).map(b => [b.bucket, b]))

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto px-4 pt-3 pb-10">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100" aria-label="뒤로">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <LayoutDashboard className="w-5 h-5 text-emerald-600" />
        <h1 className="text-lg font-bold text-gray-900">관리자 콘솔</h1>
      </div>
      <p className="text-[12px] text-gray-500 leading-relaxed mb-5 pl-1">
        서비스 전체 상태를 한눈에 봐요. 용량이 70%를 넘으면 푸시로도 알려드려요.
      </p>

      {/* ── 시스템 상태 ─────────────────────────── */}
      <Section icon={<HardDrive className="w-4 h-4" />} title="시스템 상태">
        {capLoading ? (
          <p className="text-sm text-gray-400 py-6 text-center">불러오는 중...</p>
        ) : !cap ? (
          <p className="text-[13px] text-gray-400 py-6 text-center">용량 정보를 불러오지 못했어요.</p>
        ) : (
          <div className="border border-gray-100 rounded-xl shadow-soft p-3.5 space-y-4">
            <UsageBar icon={<HardDrive className="w-4 h-4" />} label="저장 용량" bytes={cap.storage_bytes} limit={cap.storage_limit} prev={cap.prev?.storage_bytes} />
            <UsageBar icon={<Database className="w-4 h-4" />} label="DB 크기" bytes={cap.db_bytes} limit={cap.db_limit} prev={cap.prev?.db_bytes} />

            {/* 버킷별 — 접어둠 */}
            <div className="pt-1 border-t border-gray-100">
              <button type="button" onClick={() => setBucketsOpen(v => !v)} className="w-full flex items-center gap-1.5 text-[12px] font-bold text-gray-500 py-1">
                저장소 상세 ({buckets.length}개)
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${bucketsOpen ? 'rotate-180' : ''}`} />
              </button>
              {bucketsOpen && (
                <ul className="mt-1.5 space-y-1.5">
                  {buckets.map(b => (
                    <li key={b.bucket} className="flex items-center gap-1.5 text-[12px]">
                      <span className="text-gray-600 truncate">{BUCKET_LABELS[b.bucket] || b.bucket}</span>
                      <span className="ml-auto text-gray-400 flex-shrink-0 tabular-nums">{Number(b.objects).toLocaleString()}개</span>
                      <DeltaCount value={b.objects} prev={prevBucket[b.bucket]?.objects} className="text-[11px] flex-shrink-0" />
                      <span className="font-bold text-gray-700 text-right flex-shrink-0 tabular-nums">{fmtBytes(b.bytes)}</span>
                      <DeltaBytes bytes={b.bytes} prev={prevBucket[b.bucket]?.bytes} className="text-[11px] flex-shrink-0" />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* DB 상세 — 확장 테이블(net/cron 등)이 대부분을 차지하는 경우가 많다 */}
            <div className="pt-1 border-t border-gray-100">
              <button type="button" onClick={() => setDbOpen(v => !v)} className="w-full flex items-center gap-1.5 text-[12px] font-bold text-gray-500 py-1">
                DB 상세 (큰 테이블 순)
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dbOpen ? 'rotate-180' : ''}`} />
              </button>
              {dbOpen && (
                dbLoading ? (
                  <p className="text-[12px] text-gray-400 py-3 text-center">불러오는 중...</p>
                ) : dbTables.length === 0 ? (
                  <p className="text-[12px] text-gray-400 py-3 text-center">테이블 정보를 불러오지 못했어요.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1.5">
                    {dbTables.map(t => (
                      <li key={`${t.schema_name}.${t.table_name}`} className="flex items-center gap-2 text-[12px]">
                        <span className="text-gray-400 flex-shrink-0">{t.schema_name}</span>
                        <span className="text-gray-700 font-medium truncate">{t.table_name}</span>
                        <span className="ml-auto text-gray-400 flex-shrink-0">{Number(t.approx_rows).toLocaleString()}행</span>
                        <span className="font-bold text-gray-700 w-20 text-right flex-shrink-0">{fmtBytes(t.bytes)}</span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>

            <p className="text-[11px] text-gray-400">
              마지막 검사 {cap.last_checked_at ? relDay(cap.last_checked_at) : '아직 없음'} · 매일 오전 9시 자동 검사
            </p>
          </div>
        )}
      </Section>

      {/* ── 살펴볼 것 ───────────────────────────── */}
      <Section icon={<AlertTriangle className="w-4 h-4" />} title="살펴볼 것"
        desc="손이 필요한 프로그램을 자동으로 골라내요.">
        {alertLoading ? (
          <p className="text-sm text-gray-400 py-6 text-center">불러오는 중...</p>
        ) : alerts.length === 0 ? (
          <div className="py-6 text-center border border-gray-100 rounded-xl">
            <p className="text-[13px] text-gray-500">지금은 살펴볼 게 없어요 👍</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a, i) => {
              const danger = a.severity === 'danger'
              const warn = a.severity === 'warn'
              const tone = danger ? 'border-red-100 bg-red-50' : warn ? 'border-amber-100 bg-amber-50' : 'border-gray-100 bg-gray-50'
              const dot = danger ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-gray-300'
              return (
                <li key={`${a.kind}-${a.target_id || i}`}>
                  <button
                    type="button"
                    disabled={!a.target_id}
                    onClick={() => a.target_id && navigate(`/programs/${a.target_id}`)}
                    className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl border ${tone} ${a.target_id ? 'hover:brightness-98 transition' : ''}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-bold text-gray-800 leading-snug">{a.headline}</span>
                      <span className="block text-[11px] text-gray-500 mt-0.5 leading-normal">{a.detail}</span>
                    </span>
                    {a.target_id && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      {/* ── 서비스 현황 ─────────────────────────── */}
      <Section icon={<Activity className="w-4 h-4" />} title="서비스 현황">
        {totalsLoading ? (
          <p className="text-sm text-gray-400 py-6 text-center">불러오는 중...</p>
        ) : !totals ? (
          <p className="text-[13px] text-gray-400 py-6 text-center">집계를 불러오지 못했어요.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 mb-3">
            <StatTile label="사용자" value={totals.users} prev={totals.prev?.users} />
            <StatTile label="프로그램" value={totals.published} prev={totals.prev?.published} />
            <StatTile label="참여" value={totals.participants} prev={totals.prev?.participants} />
            <StatTile label="인증" value={totals.verifications} prev={totals.prev?.verifications} />
            <StatTile label="게시글" value={totals.posts} prev={totals.prev?.posts} />
            <StatTile label="수업" value={totals.sessions} prev={totals.prev?.sessions} />
            <StatTile label="푸시구독" value={totals.push_subs} prev={totals.prev?.push_subs} />
            <StatTile label="전체프로그램" value={totals.programs} prev={totals.prev?.programs} />
          </div>
        )}
        {totals?.prev && (
          <p className="text-[11px] text-gray-400 mb-3 leading-normal">
            {totals.prev_source === 'snapshot'
              ? '어제 자정(KST) 집계와 비교한 증감이에요.'
              : '어제 값은 기록 시각으로 되짚은 추정치예요 — 내일부터 자정 집계와 비교합니다(줄어든 것도 잡혀요).'}
          </p>
        )}

        {/* 14일 활동 추이 */}
        {actLoading ? (
          <p className="text-sm text-gray-400 py-4 text-center">불러오는 중...</p>
        ) : activity.length > 0 && (
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="text-[12px] font-bold text-gray-600 mb-2">최근 14일 활동</p>
            <div className="flex items-end gap-1 h-16">
              {activity.map(a => {
                const v = Number(a.verify_count) + Number(a.post_count)
                return (
                  <div key={a.day} className="flex-1 flex flex-col justify-end h-full" title={`${a.day} · 인증 ${a.verify_count} · 글 ${a.post_count} · 가입 ${a.join_count}`}>
                    <div className="bg-emerald-400 rounded-t-sm" style={{ height: `${Math.max(3, (v / maxAct) * 100)}%` }} />
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>{String(activity[0]?.day || '').slice(5)}</span>
              <span>{String(activity[activity.length - 1]?.day || '').slice(5)}</span>
            </div>
          </div>
        )}
      </Section>

      {/* ── 운영자별 현황 ───────────────────────── */}
      <Section icon={<Users className="w-4 h-4" />} title="운영자별 현황"
        desc="프로그램을 만든 사람 기준. 최근 활동이 있는 순이에요.">
        {opLoading ? (
          <p className="text-sm text-gray-400 py-6 text-center">불러오는 중...</p>
        ) : operators.length === 0 ? (
          <div className="py-6 text-center border border-gray-100 rounded-xl">
            <p className="text-[13px] text-gray-500">아직 운영자가 없어요.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {operators.map(o => (
              <li key={o.operator_id} className="border border-gray-100 rounded-xl shadow-soft px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-gray-800 truncate">{o.operator_name || '(닉네임 없음)'}</span>
                  <span className="ml-auto text-[11px] text-gray-400 flex-shrink-0">{relDay(o.last_activity)}</span>
                </div>
                <p className="text-[11px] text-gray-400 truncate mt-0.5">{o.operator_email}</p>
                <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1.5">
                  <span>프로그램 <b className="text-gray-700">{Number(o.program_count).toLocaleString()}</b></span>
                  <span>참여 <b className="text-gray-700">{Number(o.participant_count).toLocaleString()}</b></span>
                  <span>인증 <b className="text-gray-700">{Number(o.verify_count).toLocaleString()}</b></span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── 바로가기 ────────────────────────────── */}
      <button
        type="button"
        onClick={() => navigate('/admin/screen-stats')}
        className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-gray-100 shadow-soft hover:bg-gray-50 transition"
      >
        <BarChart3 className="w-4 h-4 text-violet-500" />
        <span className="text-[13px] font-bold text-gray-800">화면 체류 분석</span>
        <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
      </button>
    </div>
  )
}

export default AdminConsolePage
