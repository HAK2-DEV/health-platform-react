-- ============================================================
-- Migration: 203 - Web Push 알림 tag 를 "알림 종류"→"알림별 고유(id)"로
-- 작성일: 2026-08-14
-- 설명:
--   기존 notify_push() 트리거(178)는 푸시 payload 의 tag 를 new.type(알림 종류)로 보냈다.
--   → 같은 종류(예: OPERATOR_CHEER 응원·환영·리마인드) 알림이 전부 같은 tag 를 공유.
--   iOS 웹 푸시(WebKit)는 같은 tag 알림을 "조용히 교체"하고 renotify 를 사실상 무시 →
--   첫 알림만 소리가 나고, 같은 종류의 이후 알림은 무음으로 갈아치워지는 문제.
--   (안드로이드도 collapse 되어 개별 주목도 저하.)
--   해결: tag 를 new.id(알림별 고유)로 → iOS/안드 모두 매번 새 알림으로 인식해 소리/주목 정상.
--   부작용: 같은 종류 알림이 더 이상 하나로 합쳐지지 않음(각각 표시) — 알림 주목이 목적이라 의도된 변경.
--
--   함수 CREATE OR REPLACE 만 — 하위호환. 클라이언트 변경 불필요(SW 는 data.tag 를 그대로 사용).
--
-- 복구:
--   178 의 notify_push() 정의로 되돌리면 됨 (body 의 'tag' 를 new.type 으로).
-- ============================================================

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
      -- ⭐ 203: tag 를 알림 종류(new.type) → 알림별 고유(new.id) 로.
      --   같은 종류 알림이 iOS 에서 조용히 교체되며 무음 되던 문제 해결.
      'tag',     new.id::text
    )
  );
  return new;
end;
$$;
