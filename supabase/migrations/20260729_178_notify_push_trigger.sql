-- ============================================================
-- Migration: 178 - notifications → Web Push 발송 트리거 (pg_net)
-- 작성일: 2026-07-29
-- 설명:
--   notifications 새 행 INSERT 시 Edge Function(send-push)을 비동기 호출해
--   해당 user 의 폰으로 시스템 푸시 전송.
--   - 함수 URL / 공유 시크릿은 파일에 넣지 않고 DB GUC 로 읽음(current_setting).
--     설정 전이면 조용히 return NEW → 기존 알림 흐름 무변경(안전한 선적용).
--   - net.http_post 는 fire-and-forget(응답 안 기다림) → INSERT 지연 없음.
--   - send_test_push(): 로그인 사용자가 자기 자신에게 테스트 푸시(설정 화면 버튼용).
--
-- 사전 조건(본인이 프로드에서 1회):
--   1) create extension if not exists pg_net;   (Supabase: Database > Extensions 에서 pg_net 켜기)
--   2) alter database postgres set app.push_function_url =
--        'https://<project-ref>.supabase.co/functions/v1/send-push';
--   3) alter database postgres set app.push_hook_secret = '<PUSH_HOOK_SECRET 와 동일한 값>';
--   ※ 2,3 반영을 위해 세션 재접속(또는 few seconds) 필요할 수 있음.
--
-- 하위호환: 트리거는 GUC 미설정 시 no-op. 신규 함수만 추가.
-- 복구:
--   DROP TRIGGER IF EXISTS trg_notify_push ON public.notifications;
--   DROP FUNCTION IF EXISTS public.notify_push();
--   DROP FUNCTION IF EXISTS public.send_test_push();
-- ============================================================

create extension if not exists pg_net;

-- notifications INSERT → send-push 호출
create or replace function public.notify_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text := current_setting('app.push_function_url', true);
  v_secret text := current_setting('app.push_hook_secret', true);
begin
  -- 설정 전이면 아무것도 안 함 (기존 알림 흐름 그대로)
  if v_url is null or v_url = '' or v_secret is null or v_secret = '' then
    return new;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body    := jsonb_build_object(
      'user_id', new.user_id,
      'title',   coalesce(new.title, '도담'),
      'body',    coalesce(new.body, ''),
      'link',    coalesce(new.link_path, '/notifications'),
      'tag',     new.type
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_push on public.notifications;
create trigger trg_notify_push
  after insert on public.notifications
  for each row execute function public.notify_push();

-- 설정 화면 「테스트 푸시」 버튼용 — 호출자 본인에게 직접 발송(알림 행 안 남김)
create or replace function public.send_test_push()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text := current_setting('app.push_function_url', true);
  v_secret text := current_setting('app.push_hook_secret', true);
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;
  if v_url is null or v_url = '' or v_secret is null or v_secret = '' then
    raise exception '푸시 서버가 아직 설정되지 않았습니다';
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body    := jsonb_build_object(
      'user_id', auth.uid(),
      'title',   '도담 · 테스트 알림',
      'body',    '폰 푸시가 정상적으로 연결됐어요 🎉',
      'link',    '/profile/notifications-settings',
      'tag',     'test'
    )
  );
end;
$$;

grant execute on function public.send_test_push() to authenticated;
