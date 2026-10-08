import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { MAKEUP_MAX_REJECTS, kstDayNum, makeupDayWord, makeupLeftText } from '../lib/makeup'

// 「오늘 할 일」에 띄울 «다시 인증할 수 있는 인증» 목록 (마이그 283).
//   반려 알림을 열어 본 사람은 40% 뿐인데, 반려 = 그날 기록이 사라지는 일이다 →
//   알림을 못 본 사람도 프로그램에 들어오면 바로 보이도록 오늘 할 일에 올린다(본인 2026-10-08).
//
// 내릴 조건(= 서버 규칙과 같은 것). 하나라도 걸리면 목록에서 뺀다:
//   · 반려 시각부터 24시간이 지났다 → 더는 만회 불가
//   · 이미 다시 올렸다 → 그 결과(심사 중·승인·또 반려)가 따로 보인다
//   · 같은 묶음이 3번 반려됐다 → 그날은 마감
//   · 그날 몫이 이미 찼다 → 만회가 들어갈 자리가 없다(서버 하루 한도 169 와 같은 셈)
//
// ⚠️ 만회 행은 제출 시각이 «원래 날»이라 시각 비교로는 못 찾는다 — makeup_of 로 잇는다.
const SINCE_DAYS = 14

export function useRedoVerifications(programId, userId, { enabled = true } = {}) {
  const on = !!programId && !!userId && enabled

  const { data: rows = [] } = useQuery({
    // 'verifications' 아래 키 — 인증 제출·심사 뒤 화면들이 ['verifications'] 를 통째로 새로 고칠 때 함께 새로 고쳐진다.
    //   따로 두었더니 다시 올린 직후 홈으로 돌아오면 처리한 «다시 인증»이 최대 1분 남았다(2026-10-08 실측).
    queryKey: ['verifications', 'redo', programId, userId],
    queryFn: async () => {
      const since = new Date(Date.now() - SINCE_DAYS * 86400000).toISOString()
      const { data, error } = await supabase
        .from('verifications')
        .select('id, mission_id, status, submitted_at, reviewed_at, rejection_reason, makeup_of, makeup_root, missions!inner(title, daily_limit, program_id)')
        .eq('user_id', userId)
        .eq('missions.program_id', programId)
        .in('status', ['PENDING_REVIEW', 'APPROVED', 'REJECTED'])
        .or(`submitted_at.gte.${since},reviewed_at.gte.${since},makeup_at.gte.${since}`)
        .order('reviewed_at', { ascending: false })
      // 283 미적용 DB(만회 열 없음) — 만회할 수 있는 것이 애초에 없다
      if (error?.code === '42703') return []
      if (error) throw error
      return data || []
    },
    enabled: on,
    staleTime: 60_000,
  })

  return useMemo(() => {
    const out = []
    for (const v of rows) {
      if (v.status !== 'REJECTED' || !v.reviewed_at) continue
      const left = makeupLeftText(v.reviewed_at)
      if (!left) continue
      if (rows.some((o) => o.makeup_of === v.id)) continue
      const root = v.makeup_root || v.id
      const rejects = rows.filter((o) => (o.id === root || o.makeup_root === root) && o.status === 'REJECTED').length
      if (rejects >= MAKEUP_MAX_REJECTS) continue
      const limit = v.missions?.daily_limit
      if (limit != null && rows.filter((o) => o.mission_id === v.mission_id && o.status !== 'REJECTED'
        && kstDayNum(new Date(o.submitted_at)) === kstDayNum(new Date(v.submitted_at))).length >= limit) continue
      out.push({
        id: v.id,
        missionId: v.mission_id,
        title: v.missions?.title || '인증',
        dayWord: makeupDayWord(v.submitted_at),
        left,
        reason: (v.rejection_reason || '').trim() || null,
        lastChance: rejects >= MAKEUP_MAX_REJECTS - 1,
      })
    }
    return out
  }, [rows])
}
