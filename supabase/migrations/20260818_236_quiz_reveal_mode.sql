-- ============================================================
-- Migration: 236 - 퀴즈 정답 공개 3단계(reveal_mode)
-- 작성일: 2026-08-18
-- 설명:
--   G39 — 기존엔 reveal_answers(불리언) + 마감 후 자동공개(마이그 173)라
--   "정답공개 OFF인데 마감 후 공개"되는 기대 불일치가 있었다. 3단계로 명확화:
--     reveal_mode: 'IMMEDIATE'(제출 즉시 공개) | 'AFTER_CLOSE'(마감 후 공개) | 'NEVER'(완전 비공개)
--   - get_user_quiz_review 노출 조건을 reveal_mode 기준으로 재정의.
--   - 구프론트 호환: reveal_mode 미설정(null) 행은 reveal_answers 로 폴백
--     (true→IMMEDIATE, false→AFTER_CLOSE = 마이그 173 동작 그대로).
--
-- 기존 동작 보존 백필: ON→IMMEDIATE, OFF→AFTER_CLOSE.
-- 하위호환: 컬럼 추가(nullable) + 함수 CREATE OR REPLACE(시그니처 동일). 프론트는 이 후 배포.
-- 복구:
--   alter table public.quizzes drop column if exists reveal_mode;
--   -- get_user_quiz_review 를 마이그 173 본문으로 되돌림.
-- ============================================================

alter table public.quizzes
  add column if not exists reveal_mode text
  check (reveal_mode in ('IMMEDIATE', 'AFTER_CLOSE', 'NEVER'));

-- 기존 동작 보존: 정답공개 ON→즉시, OFF→마감 후(173 동작)
update public.quizzes
  set reveal_mode = case when reveal_answers then 'IMMEDIATE' else 'AFTER_CLOSE' end
  where reveal_mode is null;

create or replace function public.get_user_quiz_review(p_program_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_owner boolean := false;
  v_result jsonb;
begin
  select (owner_id = v_uid) into v_is_owner from public.programs where id = p_program_id;

  if not (coalesce(v_is_owner, false) or v_uid = p_user_id) then
    raise exception 'not allowed';
  end if;

  select coalesce(jsonb_agg(sub order by (sub->>'submitted_at') desc), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', s.id,
      'title', q.title,
      'total_score', s.total_score,
      'status', s.status,
      'submitted_at', s.submitted_at,
      -- 노출: owner / reveal_mode=IMMEDIATE / (AFTER_CLOSE 이고 마감 지남). NEVER 는 owner 만.
      --   reveal_mode 미설정(null)은 reveal_answers 로 폴백(구프론트/구행 호환).
      'reveal', (
        v_is_owner
        or coalesce(q.reveal_mode, case when q.reveal_answers then 'IMMEDIATE' else 'AFTER_CLOSE' end) = 'IMMEDIATE'
        or (coalesce(q.reveal_mode, case when q.reveal_answers then 'IMMEDIATE' else 'AFTER_CLOSE' end) = 'AFTER_CLOSE'
            and q.due_at is not null and q.due_at < now())
      ),
      'answers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'text', qq.question_text,
          'type', qq.type,
          'order', qq.order_index,
          'userAnswer', a.answer,
          'isCorrect', a.is_correct,
          'point', qq.point,
          'awarded', a.awarded_point,
          'correctAnswer', case when (
              v_is_owner
              or coalesce(q.reveal_mode, case when q.reveal_answers then 'IMMEDIATE' else 'AFTER_CLOSE' end) = 'IMMEDIATE'
              or (coalesce(q.reveal_mode, case when q.reveal_answers then 'IMMEDIATE' else 'AFTER_CLOSE' end) = 'AFTER_CLOSE'
                  and q.due_at is not null and q.due_at < now())
            ) then qq.correct_answer else null end,
          'explanation', case when (
              v_is_owner
              or coalesce(q.reveal_mode, case when q.reveal_answers then 'IMMEDIATE' else 'AFTER_CLOSE' end) = 'IMMEDIATE'
              or (coalesce(q.reveal_mode, case when q.reveal_answers then 'IMMEDIATE' else 'AFTER_CLOSE' end) = 'AFTER_CLOSE'
                  and q.due_at is not null and q.due_at < now())
            ) then qq.explanation else null end
        ) order by qq.order_index)
        from public.quiz_answers a
        join public.quiz_questions qq on qq.id = a.question_id
        where a.submission_id = s.id
      ), '[]'::jsonb)
    ) as sub
    from public.quiz_submissions s
    join public.quizzes q on q.id = s.quiz_id
    where q.program_id = p_program_id and s.user_id = p_user_id
  ) t;

  return v_result;
end;
$$;
