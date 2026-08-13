import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'
import { supabase } from '../../supabaseClient'
import { CATEGORY, CATEGORY_LIST, PROGRAM, PROGRAM_THEME } from '../../lib/constants'
import { isUpcomingByStartDate } from '../../lib/formatters'
import CoverImageUploader from '../common/CoverImageUploader'
import { ChevronDown, Calendar } from 'lucide-react'

// 'YYYY-MM-DD' → 'YYYY.MM.DD' (4자리 연도)
const ymd = (d) => (d ? d.replaceAll('-', '.') : '미정')

// 개요 관리자 — 운영자 패널(개요) 클릭 시 개요 탭 자리에 인라인 표시되는 편집 폼.
//   섹션: 1)기본 정보 2)운영 현황 3)공개 설정 4)소개·목표
//   저장 바·미리보기는 부모(ProgramDetailPage)가 관리 → ref.save() 로 호출.
//   props: program, participantCount, progress, onSaved(저장 후 캐시 무효화)
const OverviewManagePanel = forwardRef(function OverviewManagePanel({ program, participantCount = 0, progress = 0, onCoverChange, onSaved }, ref) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('ETC')
  const [endDate, setEndDate] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [previewEnabled, setPreviewEnabled] = useState(false)
  const [savingSubtract, setSavingSubtract] = useState(true) // 금연 「오늘 절약」 흡연 차감 (마이그 139)
  const [progressEnabled, setProgressEnabled] = useState(true) // 「나의 진행 현황」 카드 표시 (마이그 145)
  const [coverImagePath, setCoverImagePath] = useState(null)  // 배너/썸네일 표지
  const [descModalOpen, setDescModalOpen] = useState(false)  // 한줄 설명 — 넓게 입력 모달
  useBodyScrollLock(descModalOpen)  // 설명 입력 오버레이 — iOS 배경 스크롤 방지
  useBackButtonClose(descModalOpen, () => setDescModalOpen(false))  // 하드웨어 뒤로가기 = 닫기(스택 최상단)
  const kbInset = useKeyboardInset()   // iOS 키보드 높이 — 설명 입력 시 카드 위로

  useEffect(() => {
    if (!program) return
    setCoverImagePath(program.cover_image_path || null)
    setName(program.name || '')
    setDescription(program.description || '')
    setCategory(program.categories?.[0] || 'ETC')
    setEndDate(program.end_date || '')
    setMaxParticipants(program.max_participants ?? '')
    setIsPublic(!!program.is_public)
    setPreviewEnabled(!!program.preview_enabled)
    setSavingSubtract(program.saving_subtract_smoking !== false)
    setProgressEnabled(program.overview_progress_enabled !== false)
  }, [program])

  const statusLabel = (() => {
    if (program.status === 'DRAFT') return '임시저장'
    if (program.status !== 'PUBLISHED') return program.status
    return isUpcomingByStartDate(program.start_date) ? '예정' : '진행중'
  })()
  const totalDays = (program.start_date && endDate)
    ? Math.max(1, Math.round((new Date(endDate) - new Date(program.start_date)) / 86400000) + 1)
    : null

  // 부모 저장 바에서 호출 — 성공 시 null, 실패 시 에러 메시지 반환
  useImperativeHandle(ref, () => ({
    save: async () => {
      if (!name.trim()) return '프로그램명을 입력해주세요'
      if (name.length > PROGRAM.NAME_MAX_LENGTH) return `프로그램명은 ${PROGRAM.NAME_MAX_LENGTH}자 이하`
      if (program.start_date && endDate && endDate < program.start_date) return '종료일이 시작일보다 빠를 수 없어요'
      const payload = {
        name: name.trim(),
        description: description.trim(),
        categories: [category],
        end_date: endDate || null,
        max_participants: maxParticipants === '' ? null : parseInt(maxParticipants),
        is_public: isPublic,
        preview_enabled: previewEnabled,
        cover_image_path: coverImagePath,
      }
      // 안내(overview_content/title/notice_enabled)는 편집 UI 제거 → 저장에서 제외(기존 값 보존).
      // saving_subtract_smoking 컬럼(마이그 139)이 적용된 경우에만 포함
      if (program && 'saving_subtract_smoking' in program) payload.saving_subtract_smoking = savingSubtract
      // overview_progress_enabled 컬럼(마이그 145)이 적용된 경우에만 포함
      if (program && 'overview_progress_enabled' in program) payload.overview_progress_enabled = progressEnabled
      const { error } = await supabase
        .from('programs')
        .update(payload)
        .eq('id', program.id)
      if (error) return error.message
      onSaved?.()
      return null
    },
  }), [name, description, category, endDate, maxParticipants, isPublic, previewEnabled, coverImagePath, savingSubtract, progressEnabled, program, onSaved])

  const numBadge = (n) => <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">{n}</span>
  const headCls = 'flex items-center gap-1.5 text-[15px] font-bold text-gray-800 mb-3'
  const labelCls = 'flex items-center gap-1.5 w-[88px] flex-shrink-0 text-[13px] font-medium text-gray-600'
  const fieldCls = 'flex-1 min-w-0 px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400'
  const fieldStyle = { fontSize: '13px' }  // 입력 글자 크기를 라벨(13px)과 일치 (UA 기본 폰트 방지)
  const Toggle = ({ on, onClick }) => (
    <button type="button" onClick={onClick} className={`relative w-11 h-6 rounded-full transition flex-shrink-0 ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )

  return (
    <div className="-mx-[11px]">
    <div className="om-panel w-[366px] max-w-full mx-auto space-y-[9px] pb-2">
      {/* 1) 기본 정보 */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <h3 className={headCls}>{numBadge(1)} 기본 정보</h3>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className={labelCls}>📋 프로그램명</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={PROGRAM.NAME_MAX_LENGTH} className={fieldCls} style={fieldStyle} />
          </div>
          {/* 기간 — 한 줄: 시작(고정·2자리) ~ 종료(편집·2자리 표시) */}
          <div className="flex items-center gap-2">
            <span className={labelCls}><Calendar className="w-3.5 h-3.5 text-gray-500" />기간</span>
            <div className="flex-1 min-w-0 flex items-center gap-1.5 text-[13px]">
              <span className="text-gray-500 whitespace-nowrap">{ymd(program.start_date)}<span className="text-[10px] text-gray-400 ml-0.5">🔒</span></span>
              <span className="text-gray-300">~</span>
              <div className="relative inline-flex">
                <span className="px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-800 flex items-center gap-1 whitespace-nowrap">
                  {ymd(endDate)} <span className="text-gray-400 text-[11px]">✎</span>
                </span>
                <input type="date" value={endDate} min={program.start_date || undefined} onChange={(e) => setEndDate(e.target.value)} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
              </div>
              {totalDays && <span className="text-gray-400 whitespace-nowrap">· {totalDays}일</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={labelCls}>🏷️ 카테고리</span>
            {/* 생성 후 변경 불가 — 카테고리가 테마·메뉴를 결정하므로 */}
            <div className="flex-1 min-w-0 flex items-center gap-1.5 px-3 py-2 text-[13px] bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
              {(() => {
                const c = CATEGORY_LIST.find(x => x.key === category)
                return c ? <><span>{c.emoji}</span><span>{c.label}</span></> : <span className="text-gray-400">미설정</span>
              })()}
              <span className="ml-auto text-[11px] text-gray-400">🔒 변경 불가</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={labelCls}>🚦 상태</span>
            <div className="flex-1 px-3 py-2 text-[13px] text-gray-700 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {statusLabel}
              <span className="text-[11px] text-gray-400 ml-auto">자동 관리</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className={`${labelCls} pt-2`}>📝 한줄 설명</span>
            <div className="flex-1 min-w-0">
              {/* 클릭하면 넓은 모달로 입력 — 입력칸이 좁아 길게 못 보던 문제 해결 */}
              <input value={description} readOnly onClick={() => setDescModalOpen(true)} placeholder="탭하여 입력" className={`${fieldCls} w-full cursor-pointer truncate`} style={fieldStyle} />
              <p className="text-[11px] text-gray-400 text-right mt-0.5">{description.length}/{PROGRAM.DESCRIPTION_MAX_LENGTH}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2) 운영 현황 */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <h3 className={headCls}>{numBadge(2)} 운영 현황</h3>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className={labelCls}>👥 참여자 수</span>
            <div className="flex-1 px-3 py-2 text-[13px] text-gray-700 bg-gray-50 border border-gray-200 rounded-lg">{participantCount}명 <span className="text-[11px] text-gray-400 ml-1">자동</span></div>
          </div>
          <div className="flex items-center gap-2">
            <span className={labelCls}>📈 완료율</span>
            <div className="flex-1 px-3 py-2 text-[13px] text-gray-700 bg-gray-50 border border-gray-200 rounded-lg">{progress}% <span className="text-[11px] text-gray-400 ml-1">자동</span></div>
          </div>
          <div className="flex items-center gap-2">
            <span className={labelCls}>🔢 최대 인원</span>
            <input type="number" min="1" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} placeholder="제한 없음" className={fieldCls} style={fieldStyle} />
          </div>
          {/* 「나의 진행 현황」 카드 표시 토글 (마이그 145) — 금연 테마엔 카드가 없어 숨김 */}
          {program.theme !== PROGRAM_THEME.QUIT_SMOKING && (
            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-800">📈 「나의 진행 현황」 카드 표시</p>
                <p className="text-[11px] text-gray-500">끄면 개요의 진행 현황 카드(활동일·참여율·연속·진행률)가 안 보여요.</p>
              </div>
              <Toggle on={progressEnabled} onClick={() => setProgressEnabled(v => !v)} />
            </div>
          )}
        </div>
      </section>

      {/* 3) 공개 설정 */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <h3 className={headCls}>{numBadge(3)} 공개 설정</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-800">🔎 공개 검색 허용</p>
              <p className="text-[11px] text-gray-500">둘러보기에서 검색·노출됩니다.</p>
            </div>
            <Toggle on={isPublic} onClick={() => setIsPublic(v => !v)} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-800">👀 참여 전 둘러보기 허용</p>
              <p className="text-[11px] text-gray-500">비참여자도 내부를 열람할 수 있어요.</p>
            </div>
            <Toggle on={previewEnabled} onClick={() => setPreviewEnabled(v => !v)} />
          </div>
        </div>
      </section>

      {/* 금연 설정 — 「오늘 절약」 계산 방식 (금연 테마 전용, 마이그 139) */}
      {program.theme === PROGRAM_THEME.QUIT_SMOKING && (
        <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
          <h3 className={headCls}>🚭 금연 설정</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-800">흡연 시 절약액 차감</p>
                <p className="text-[11px] text-gray-500">
                  {savingSubtract
                    ? '핀 만큼 「오늘 절약」이 마이너스로 표시돼요.'
                    : '안 핀 만큼만 절약으로 표시돼요 (마이너스 없음).'}
                </p>
              </div>
              <Toggle on={savingSubtract} onClick={() => setSavingSubtract(v => !v)} />
            </div>
          </div>
        </section>
      )}

      {/* 안내(개요 공지) 섹션 제거 — 공지·소개는 커뮤니티 공지 기능으로 일원화 (본인 결정 2026-07-30).
          overview_content/overview_title/overview_notice_enabled 컬럼은 유지(기존 데이터 보존), 편집 UI만 삭제. */}

      {/* 4) 배너 / 썸네일 (대표 사진) — 변경/삭제. 저장 시 cover_image_path 반영 */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <h3 className={headCls}>{numBadge(4)} 🖼️ 배너 / 썸네일</h3>
        <CoverImageUploader
          ownerId={program.owner_id}
          imagePath={coverImagePath}
          onChange={(path) => { setCoverImagePath(path); onCoverChange?.(path) }}
          categories={program.categories}
          name={program.name}
        />
      </section>

      {/* 한줄 설명 — 넓게 입력 모달 */}
      {descModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-5" style={{ paddingBottom: kbInset ? kbInset + 20 : undefined, transition: 'padding-bottom .2s ease' }} onClick={() => setDescModalOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-[15px] font-bold text-gray-800 mb-2">📝 한줄 설명</h4>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={PROGRAM.DESCRIPTION_MAX_LENGTH}
              rows={4}
              autoFocus
              placeholder="프로그램을 한 줄로 소개해보세요."
              style={fieldStyle}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400 resize-none leading-relaxed"
            />
            <p className="text-[11px] text-gray-400 text-right mt-0.5">{description.length}/{PROGRAM.DESCRIPTION_MAX_LENGTH}</p>
            <button type="button" onClick={() => setDescModalOpen(false)} className="w-full h-11 mt-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition">확인</button>
          </div>
        </div>
      )}
    </div>
    </div>
  )
})

export default OverviewManagePanel
