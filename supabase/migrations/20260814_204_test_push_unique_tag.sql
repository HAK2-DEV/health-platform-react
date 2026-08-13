-- ============================================================
-- Migration: 204 - send_test_push() tag 고정('test')→고유 (203 후속)
-- 작성일: 2026-08-14
-- 설명:
--   203 은 notifications 트리거(notify_push)의 tag 만 고유화했다. 그러나 설정 화면
--   「테스트 푸시」는 send_test_push() 가 트리거를 거치지 않고 직접 발송하며 tag 를 'test'
--   로 고정 → 반복 전송 시 iOS 가 같은 tag 알림을 조용히 교체하여 "알림은 오는데 무음".
--   해결: send_test_push 의 tag 도 gen_random_uuid() 로 매 호출 고유화 → 매번 소리.
--   (실제 리마인드/알림은 203 으로 이미 해결됨. 이건 테스트 버튼 자체를 신뢰 가능하게.)
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
      -- ⭐ 204: 고정 'test' → 매 호출 고유(uuid). iOS 무음(조용한 교체) 방지.
      'tag',     gen_random_uuid()::text
    )
  );
end;
$$;

grant execute on function public.send_test_push() to authenticated;
