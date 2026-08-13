-- ============================================================
-- Migration: 206 - Web Push 함수: push_config 테이블 읽기 "복원" + tag 고유화
-- 작성일: 2026-08-14
-- 설명:
--   179 가 설정을 GUC→push_config 테이블로 옮겼는데(Supabase 는 ALTER DATABASE SET app.* 가
--   42501 권한오류로 막힘), 203/204/205 가 실수로 옛 GUC(current_setting) 방식으로 함수를
--   되돌려 push_config 를 안 읽게 됨 → GUC 미설정이라 "푸시 서버 미설정" 으로 전송 중단.
--   → 179 의 테이블 읽기 방식으로 복원. 단, tag 고유화(iOS 무음 수정)는 유지.
--   push_config 테이블의 값은 그대로 살아있으므로 재설정/시크릿 교체 불필요.
--
--   변경점(179 대비): 푸시 tag 를 알림 종류(new.type)→고유값으로.
--     · notify_push:   tag = new.id      (알림별 고유)
--     · send_test_push: tag = 'test-'+ms (매 호출 고유, 확장 무관 clock_timestamp)
--
-- 복구:
--   179 의 함수 정의로 되돌리면 됨(tag 만 new.type/'test' 로).
-- ============================================================

-- notifications INSERT → send-push 호출 (push_config 테이블에서 설정 읽음)
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
      -- ⭐ 206: tag 를 알림별 고유(new.id) — iOS 조용한 교체(무음) 방지
      'tag',     new.id::text
    )
  );
  return new;
end;
$$;

-- 설정 화면 「테스트 푸시」 버튼용 — 호출자 본인에게 직접 발송 (push_config 테이블에서 설정 읽음)
create or replace function public.send_test_push()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
  v_tag    text := 'test-' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text;
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
      -- ⭐ 206: 매 호출 고유 tag — iOS 무음 방지
      'tag',     v_tag
    )
  );
end;
$$;

grant execute on function public.send_test_push() to authenticated;
