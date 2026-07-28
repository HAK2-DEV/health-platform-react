import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useAuth } from './useAuth'

// 참여자·프로그램 변경을 Supabase Realtime 으로 감지 → 관련 react-query 캐시 무효화.
//   목적: 화면을 켜둔 채로도 "참여자 수"·"둘러보기 목록"이 다른 사용자의 변경까지 반영되도록.
//   RLS 존중: 「내가 SELECT 할 수 있는 행」만 배달됨 (마이그 164 주석 참고).
//     - 운영자는 자기 프로그램 참여자 INSERT/UPDATE → 대시보드 참여자 수 라이브 갱신
//     - 참가자는 본인 참여 행 → 본인 화면 갱신
//     - 공개(PUBLISHED) 프로그램 신규/수정 → 둘러보기 목록 라이브 갱신
//   이벤트가 몰릴 때(대량 승인 등)는 짧게 디바운스해 한 번만 무효화한다.
//   마이그 164 미적용 환경에서는 이벤트가 오지 않을 뿐, 에러 없이 무해하게 동작.
export function useRealtimeSync() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const userId = session?.user?.id
  const timers = useRef({})

  useEffect(() => {
    if (!userId) return
    const timersMap = timers.current

    const debounce = (key, fn, ms = 400) => {
      clearTimeout(timersMap[key])
      timersMap[key] = setTimeout(fn, ms)
    }

    // 참여자 변경 → 참여자 수·통계·홈지표·랭킹·내 참여목록 무효화
    const partChannel = supabase
      .channel('rt-participants')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'program_participants' },
        () => debounce('participants', () => {
          queryClient.invalidateQueries({ queryKey: ['programs', 'participant-counts'] })
          queryClient.invalidateQueries({ queryKey: ['stats'] })
          queryClient.invalidateQueries({ queryKey: ['home-stats'] })
          queryClient.invalidateQueries({ queryKey: ['rankings'] })
          queryClient.invalidateQueries({ queryKey: ['programs', 'active', userId] })
        }),
      )
      .subscribe()

    // 프로그램 변경(신규 게시·수정·종료) → 둘러보기 목록·내 운영목록 무효화
    const progChannel = supabase
      .channel('rt-programs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'programs' },
        () => debounce('programs', () => {
          queryClient.invalidateQueries({ queryKey: ['programs', 'public'] })
          queryClient.invalidateQueries({ queryKey: ['programs', 'mine', userId] })
        }),
      )
      .subscribe()

    // 클래스 세션 변경(신청 인원·정원 마감 등) → 세션 목록·상세 무효화 (마이그 171).
    //   다른 참가자가 마지막 자리를 신청하면 registered_count(159) 가 바뀌고,
    //   이 이벤트로 내 화면의 신청 버튼이 즉시 「정원 마감」으로 갱신된다.
    const sessChannel = supabase
      .channel('rt-sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => debounce('sessions', () => {
          queryClient.invalidateQueries({ queryKey: ['sessions'] })
          queryClient.invalidateQueries({ queryKey: ['session'] })
        }, 150),   // 정원 마감 체감을 위해 짧게 디바운스
      )
      .subscribe()

    // 커뮤니티 글 변경(새 글·수정·삭제) → 게시판 목록·운영자 검토 대기 무효화 (마이그 181).
    //   다른 참여자가 글을 쓰면 화면을 켜둔 사용자의 목록에 즉시 나타난다.
    //   RLS 존중 → 같은 프로그램 멤버/운영자에게만 이벤트가 배달됨.
    const communityChannel = supabase
      .channel('rt-community')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_posts' },
        () => debounce('community', () => {
          queryClient.invalidateQueries({ queryKey: ['community-posts'] })
          queryClient.invalidateQueries({ queryKey: ['community-pending'] })
        }),
      )
      .subscribe()

    // 커뮤니티 소셜(댓글·좋아요·댓글좋아요) 변경 → 소셜 캐시 무효화 (마이그 182).
    //   다른 참여자의 댓글/좋아요가 화면에 즉시 반영된다. RLS 존중(같은 프로그램 멤버).
    const communitySocialChannel = supabase
      .channel('rt-community-social')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_post_comments' },
        () => debounce('community-social', () => {
          queryClient.invalidateQueries({ queryKey: ['community-post-social'] })
          queryClient.invalidateQueries({ queryKey: ['community-posts'] })  // 목록 댓글 수
        }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_post_likes' },
        () => debounce('community-social', () => {
          queryClient.invalidateQueries({ queryKey: ['community-post-social'] })
          queryClient.invalidateQueries({ queryKey: ['community-posts'] })  // 목록 좋아요 수
        }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_post_comment_likes' },
        () => debounce('community-clike', () => {
          queryClient.invalidateQueries({ queryKey: ['community-comment-likes'] })
        }),
      )
      .subscribe()

    return () => {
      Object.values(timersMap).forEach(clearTimeout)
      supabase.removeChannel(partChannel)
      supabase.removeChannel(progChannel)
      supabase.removeChannel(sessChannel)
      supabase.removeChannel(communityChannel)
      supabase.removeChannel(communitySocialChannel)
    }
  }, [userId, queryClient])
}