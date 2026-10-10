// 종료 리포트 「목표 대비」 — AI 초안(「AI와 함께 만들기」)이 저장한 성과 지표를 실제 숫자와 나란히(마이그 287 programs.kpis·target_headcount).
//   초안에서 운영자에게 「지표마다 도담이 어떻게 재는지」를 보여 줬으니, 끝났을 때 그 약속대로 보여 준다(본인 2026-10-09).
//   재지 못한 지표(설문 문항 없음·도담 밖 기록)는 숨기지 않고 왜 못 쟀는지 적는다 — 끝나고 「이 숫자가 없네」가 가장 아프다.
//   색은 달성 여부가 아니라 «읽는 순서»를 위해 최소로(§13-6). 왼쪽 정렬(§13-5).
import { Icon3D } from './ProgramHome'

const STATUS_TEXT = {
  achieved: '달성',
  missed: '미달',
  measured: '쟀어요',
  setup: '못 쟀어요',
  outside: '도담 밖',
}

export default function GoalReportCard({ results, targetHeadcount = null, ended = true }) {
  if (!Array.isArray(results) || results.length === 0) return null
  const achieved = results.filter((r) => r.achieved === true).length
  const withTarget = results.filter((r) => r.target && r.status === 'auto' && r.value != null).length
  return (
    <div className="rounded-card-lg bg-white border border-[#e6e9e6] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon3D src="/icons/feature/target.png" emoji="🎯" className="w-8 h-8" />
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-extrabold text-gray-900 leading-tight">목표 대비</h2>
          <p className="text-[12px] text-gray-500 leading-snug break-keep">
            {withTarget > 0 ? `목표가 있는 지표 ${withTarget}개 중 ${achieved}개 달성` : '만들 때 정한 성과 지표예요'}
            {targetHeadcount ? ` · 대상 ${targetHeadcount}명 기준` : ''}
            {!ended ? ' · 진행 중' : ''}
          </p>
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-gray-100">
        {results.map((r) => {
          const key = r.status === 'outside' ? 'outside' : r.status === 'setup' ? 'setup' : r.achieved === true ? 'achieved' : r.achieved === false ? 'missed' : 'measured'
          const strong = key === 'achieved'
          return (
            <li key={r.label} className="py-2.5 flex items-start gap-3">
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <p className="text-[14px] font-semibold text-gray-800 leading-snug break-keep">{r.label}</p>
                <p className="text-[12px] text-gray-500 leading-snug break-keep">{r.note || r.base}</p>
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                <span className={`text-[18px] font-extrabold leading-none tabular-nums ${r.status === 'auto' && r.value != null ? 'text-gray-900' : 'text-gray-300'}`}>{r.status === 'auto' ? r.display : '-'}</span>
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${strong ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{STATUS_TEXT[key]}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
