-- ============================================================
-- Migration: 179 - Web Push 설정을 GUC → 전용 테이블로 전환
-- 작성일: 2026-07-29
-- 설명:
--   178 은 함수 URL/시크릿을 DB GUC(current_setting)로 읽었으나, Supabase 호스팅에선
--   `ALTER DATABASE ... SET app.*` 가 권한 오류(42501)로 막힘.
--   → 대신 private 설정 테이블 push_config(단일 행)에 저장하고, SECURITY DEFINER 함수가
--     읽는다. RLS 활성 + 정책 없음 → 일반 사용자는 못 읽음(서버 함수/service role 만 접근).
--
--   ⚠️ 실제 URL/시크릿 값은 이 파일에 넣지 않는다(깃 노출 방지).
--      아래 표준 함수만 배포하고, 값은 본인이 SQL Editor 에서 1회 INSERT (하단 안내).
--
-- 하위호환: notify_push()/send_test_push() 를 CREATE OR REPLACE 로 교체(트리거 그대로 유지).
--   push_config 미설정 시 notify_push 는 조용히 no-op → 기존 알림 흐름 무변경.
-- 복구:
--   DROP TABLE IF EXISTS public.push_config;  (함수는 178 버전으로 되돌리거나 그대로 두면 no-op)
-- ============================================================

-- 단일 행 설정 테이블 (id 는 항상 true → 한 행만 존재)
create table if not exists public.push_config (
  id           boolean primary key default true,
  function_url text not null,
  hook_secret  text not null,
  updated_at   timestamptz not null default now(),
  constraint push_config_singleton check (id)
);

-- RLS 활성 + 정책 없음 → authenticated/anon 은 SELECT 0행. 소유자(postgres) SECURITY DEFINER 만 읽음.
alter table public.push_config enable row level security;

-- notifications INSERT → send-push 호출 (설정을 테이블에서 읽도록 교체)
create or replace function public.notify_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  select function_url, hook_secret into v_url, v_secret from public.push_config limit 1;
  if v_url is null or v_url = '' or v_secret is null or v_secret = '' then
    return new;  -- 미설정 → no-op (기존 알림 흐름 그대로)
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

-- 설정 화면 「테스트 푸시」 버튼용 — 호출자 본인에게 직접 발송
create or replace function public.send_test_push()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;
  select function_url, hook_secret into v_url, v_secret from public.push_config limit 1;
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

-- ============================================================
-- ▶ 본인이 SQL Editor 에서 1회 실행 (이 파일에는 값 미포함 — 깃 노출 방지):
--
--   insert into public.push_config (id, function_url, hook_secret)
--   values (
--     true,
--     'https://xwmgwxdmhxnnnyzwxffy.supabase.co/functions/v1/send-push',
--     '<PUSH_HOOK_SECRET — 시크릿과 동일한 값>'
--   )
--   on conflict (id) do update
--     set function_url = excluded.function_url,
--         hook_secret  = excluded.hook_secret,
--         updated_at   = now();
-- ============================================================
