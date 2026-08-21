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

    // 팀 변경(참여·초대·위임·점수) → 팀 랭킹+멤버·내 초대·초대후보 (마이그 199)
    const teamInvalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['rankings'] })              // teamByProgram(멤버·점수 포함)
      queryClient.invalidateQueries({ queryKey: ['my-team-invites'] })
      queryClient.invalidateQueries({ queryKey: ['team-invite-candidates'] })
    }

    // 참여자 변경 → 참여자 수·통계·홈지표·랭킹·내 참여목록 무효화
    const partChannel = supabase
      .channel('rt-participants')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'program_participants' },
        () => debounce('participants', () => {
          queryClient.invalidateQueries({ queryKey: ['programs', 'participant-counts'] })
          queryClient.invalidateQueries({ queryKey: ['my-part-status'] })   // 강퇴/탈퇴 시 본인 참여 상태 즉시 갱신
          queryClient.invalidateQueries({ queryKey: ['stats'] })
          queryClient.invalidateQueries({ queryKey: ['home-stats'] })
          queryClient.invalidateQueries({ queryKey: ['rankings'] })
          queryClient.invalidateQueries({ queryKey: ['programs', 'active', userId] })
          queryClient.invalidateQueries({ queryKey: ['programs', 'pending', userId] })  // 승인되면 대시보드 「대기중」 칩 → 활성으로 전환
          queryClient.invalidateQueries({ queryKey: ['program-left'] })            // 내보냄/재참여 시 「내보낸 참여자」 목록 즉시 갱신
          queryClient.invalidateQueries({ queryKey: ['program-pending'] })         // 참여 승인 대기 목록(운영자 모달)
          queryClient.invalidateQueries({ queryKey: ['program-pending-count'] })   // 승인 대기 카운트 뱃지
          queryClient.invalidateQueries({ queryKey: ['activationState'] })         // 운영자 마일스톤 축하(참여자 수)
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
          // 단일 프로그램 상세(헤더·커뮤니티 스타일/게시판/규칙·공지·목표 등) 도 갱신 →
          // 운영자 저장 시 그 프로그램을 보고 있는 참여자 화면에 즉시 반영.
          // prefix 무효화라 캐시에 있는(=지금 보고 있는) 프로그램만 실제 refetch 됨.
          queryClient.invalidateQueries({ queryKey: ['programs', 'detail'] })
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

    // 인증 피드 소셜(댓글=응원·좋아요·댓글좋아요) 변경 → 피드/응원 게시판 캐시 무효화 (마이그 196).
    //   다른 참여자가 인증글에 남긴 댓글(응원)이 화면에 즉시 반영된다. RLS 존중(같은 프로그램 멤버).
    const feedSocialChannel = supabase
      .channel('rt-feed-social')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments' },
        () => debounce('feed-social', () => {
          queryClient.invalidateQueries({ queryKey: ['post-comments'] })      // 인증글 댓글 목록
          queryClient.invalidateQueries({ queryKey: ['feed', 'posts'] })      // 피드 목록(댓글 수)
          queryClient.invalidateQueries({ queryKey: ['recent-cheers'] })      // 응원 게시판 최근 응원글
          queryClient.invalidateQueries({ queryKey: ['best-cheers'] })        // 응원 게시판 베스트 응원
        }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_likes' },
        () => debounce('feed-social', () => {
          queryClient.invalidateQueries({ queryKey: ['feed', 'posts'] })      // 피드 목록(좋아요 수)
        }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comment_likes' },
        () => debounce('feed-clike', () => {
          queryClient.invalidateQueries({ queryKey: ['post-comment-likes'] }) // 인증글 댓글 좋아요
          queryClient.invalidateQueries({ queryKey: ['recent-cheers'] })
          queryClient.invalidateQueries({ queryKey: ['best-cheers'] })        // 좋아요 순 베스트 응원
        }),
      )
      .subscribe()

    // 미션·퀴즈 변경(새 발행·수정·삭제) → 미션/퀴즈 목록 무효화 (마이그 197).
    //   운영자가 새 미션/퀴즈를 발행하면 화면을 켜둔 참여자 목록에 즉시 나타난다.
    //   RLS 존중 → 해당 프로그램을 볼 수 있는 멤버/운영자에게만 이벤트가 배달됨.
    const contentChannel = supabase
      .channel('rt-mission-quiz')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'missions' },
        () => debounce('missions', () => {
          queryClient.invalidateQueries({ queryKey: ['missions'] })   // byProgram/today/detail 등 전체
        }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quizzes' },
        () => debounce('quizzes', () => {
          queryClient.invalidateQueries({ queryKey: ['quizzes'] })    // byProgram/participant/stats 등 전체
        }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_questions' },   // 문항 편집 → 푸는 화면 (마이그 199)
        () => debounce('quizzes', () => {
          queryClient.invalidateQueries({ queryKey: ['quizzes'] })
        }),
      )
      .subscribe()

    // 운영자↔참여자 핵심 상호작용 (마이그 198). RLS 존중 → 볼 수 있는 행만 배달됨.
    //   - verifications    : 인증 제출(→운영자 심사목록)·승인/거절(→참여자 상태·미션완료)·피드
    //   - score_ledgers    : 점수 지급/변동 → 랭킹·점수·통계
    //   - quiz_submissions : 퀴즈 제출 → 결과·통계
    //   - notifications    : 알림 생성 → 알림 목록·안읽음 뱃지
    const interactionChannel = supabase
      .channel('rt-interactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'verifications' },
        () => debounce('verifications', () => {
          queryClient.invalidateQueries({ queryKey: ['verifications'] })  // 심사 대기 / todayCounts
          queryClient.invalidateQueries({ queryKey: ['my-activity-series'] })  // 내 활동 추이(누적/주간) — 승인 시 갱신
          queryClient.invalidateQueries({ queryKey: ['missions'] })       // 오늘 미션 완료 상태
          queryClient.invalidateQueries({ queryKey: ['feed'] })           // 인증 피드
          queryClient.invalidateQueries({ queryKey: ['stats'] })
          queryClient.invalidateQueries({ queryKey: ['home-stats'] })
          queryClient.invalidateQueries({ queryKey: ['activationState'] })  // 운영자 마일스톤 축하(누적 인증 수)
        }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'score_ledgers' },
        () => debounce('scores', () => {
          queryClient.invalidateQueries({ queryKey: ['scores'] })         // total/byProgram/recentSeries
          queryClient.invalidateQueries({ queryKey: ['rankings'] })       // 개인·팀·변동
          queryClient.invalidateQueries({ queryKey: ['stats'] })
          queryClient.invalidateQueries({ queryKey: ['home-stats'] })
        }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_submissions' },
        () => debounce('quiz-sub', () => {
          queryClient.invalidateQueries({ queryKey: ['quizzes'] })        // results/stats/participant/detail
          queryClient.invalidateQueries({ queryKey: ['stats'] })
        }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => debounce('notif', () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] })
          queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
        }),
      )
      .subscribe()

    // 팀·신고 (마이그 199). 팀 참여·초대·위임 / 신고 접수·처리.
    const teamReportChannel = supabase
      .channel('rt-teams-reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' },
        () => debounce('teams', () => teamInvalidate()))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' },
        () => debounce('teams', () => teamInvalidate()))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_invites' },
        () => debounce('teams', () => teamInvalidate()))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' },
        () => debounce('reports', () => {
          queryClient.invalidateQueries({ queryKey: ['reports'] })
          queryClient.invalidateQueries({ queryKey: ['reportsUnresolvedCount'] })
          queryClient.invalidateQueries({ queryKey: ['reporterStats'] })
        }))
      .subscribe()

    // 클래스 신청/취소·출석 (마이그 199).
    const classChannel = supabase
      .channel('rt-class-detail')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_registrations' },
        () => debounce('class', () => {
          queryClient.invalidateQueries({ queryKey: ['sessions'] })   // 정원 수
          queryClient.invalidateQueries({ queryKey: ['session'] })    // 상세
          queryClient.invalidateQueries({ queryKey: ['roster'] })     // 신청자 명단
        }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_attendance' },
        () => debounce('attend', () => {
          queryClient.invalidateQueries({ queryKey: ['my-attendance'] })
          queryClient.invalidateQueries({ queryKey: ['my-attendance-map'] })
          queryClient.invalidateQueries({ queryKey: ['roster'] })
        }))
      .subscribe()

    // 1:1 문의·답변 + 금연 기분체크 (마이그 199).
    const supportChannel = supabase
      .channel('rt-support-mood')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' },
        () => debounce('inquiry', () => {
          queryClient.invalidateQueries({ queryKey: ['inquiries'] })
          queryClient.invalidateQueries({ queryKey: ['inquiry'] })
        }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiry_comments' },
        () => debounce('inquiry', () => {
          queryClient.invalidateQueries({ queryKey: ['inquiry-comments'] })
          queryClient.invalidateQueries({ queryKey: ['inquiry'] })
        }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mood_logs' },
        () => debounce('mood', () => {
          queryClient.invalidateQueries({ queryKey: ['mood-trend'] })
          queryClient.invalidateQueries({ queryKey: ['stats'] })
        }))
      .subscribe()

    // 프로필(닉네임·아바타) 변경 → 사용자 표시 화면 (마이그 200). 드문 이벤트라 넉넉히 디바운스.
    const usersChannel = supabase
      .channel('rt-users')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' },
        () => debounce('users', () => {
          queryClient.invalidateQueries({ queryKey: ['rankings'] })
          queryClient.invalidateQueries({ queryKey: ['feed'] })
          queryClient.invalidateQueries({ queryKey: ['post-comments'] })
          queryClient.invalidateQueries({ queryKey: ['community-posts'] })
          queryClient.invalidateQueries({ queryKey: ['community-post-social'] })
          queryClient.invalidateQueries({ queryKey: ['verifications'] })   // 심사목록 닉/아바타
          queryClient.invalidateQueries({ queryKey: ['stats'] })
        }, 800))
      .subscribe()

    return () => {
      Object.values(timersMap).forEach(clearTimeout)
      supabase.removeChannel(partChannel)
      supabase.removeChannel(progChannel)
      supabase.removeChannel(sessChannel)
      supabase.removeChannel(communityChannel)
      supabase.removeChannel(communitySocialChannel)
      supabase.removeChannel(feedSocialChannel)
      supabase.removeChannel(contentChannel)
      supabase.removeChannel(interactionChannel)
      supabase.removeChannel(teamReportChannel)
      supabase.removeChannel(classChannel)
      supabase.removeChannel(supportChannel)
      supabase.removeChannel(usersChannel)
    }
  }, [userId, queryClient])
}