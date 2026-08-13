-- ============================================================
-- Migration: 205 - send_test_push() tag 고유화 방식 안전화 (204 수정)
-- 작성일: 2026-08-14
-- 설명:
--   204 에서 tag 를 gen_random_uuid()::text 로 바꿨는데, 이 함수가 프로젝트의
--   search_path(=public)/스키마에서 안 잡히면 send_test_push 가 예외로 실패 → 테스트 푸시가
--   아예 안 나가는 증상(204 적용 후 "테스트 알림 안 옴") 가능.
--   해결: 확장/스키마 의존 없는 코어 함수 clock_timestamp() 로 매 호출 고유 tag 생성.
--   (실제 리마인드/알림은 203(new.id)으로 이미 정상.)
--
--   함수 CREATE OR REPLACE 만 — 하위호환. 클라이언트 변경 불필요.
--
-- 복구:
--   178 의 send_test_push() 정의로 되돌리면 됨 ('tag','test').
-- ============================================================

create or replace function public.send_test_push()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text := current_setting('app.push_function_url', true);
  v_secret text := current_setting('app.push_hook_secret', true);
  v_tag    text := 'test-' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text;
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
      -- ⭐ 205: 확장 없는 코어 함수(clock_timestamp)로 매 호출 고유 tag. (204 gen_random_uuid 대체)
      'tag',     v_tag
    )
  );
end;
$$;

grant execute on function public.send_test_push() to authenticated;
