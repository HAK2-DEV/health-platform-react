-- ============================================================
-- Migration: 270 - 함수 실행 권한 전면 정리 (anon 차단 + 내부 함수는 authenticated 도 차단)
-- 작성일: 2026-09-22
-- 설명:
--   🔴 실측(2026-09-22, 익명 키 REST 호출):
--        get_active_participant_counts  200 → 임의 프로그램 참여자 수
--        is_notification_enabled        200 → 임의 사용자의 알림 설정
--        get_received_cheers            200 → 임의 (프로그램,사용자) 활동 수
--        get_preset_usage_counts        200 → 라이브러리 프리셋 사용 운영자 수
--      원인은 268/269 와 같다 — Supabase 가 public 스키마 함수의 EXECUTE 를
--      anon·authenticated 에 기본 부여하므로 `REVOKE ... FROM PUBLIC` 으로는 안 막힌다.
--      [[feedback_revoke_from_public_footgun]]
--
--   더 심각한 것: «내부 전용» 함수 7개가 누구나(익명 포함) 호출 가능했다.
--   인자로 대상을 받고 호출자 검사가 없어, 그대로 악용 가능하다.
--        _award_comment_points          → 임의 참여자에게 점수 발급(일일 한도 내)
--        notify_participants_new_content→ 임의 제목·내용·링크를 참여자 전원에게 알림 = 푸시 (피싱)
--        snapshot_program_rankings      → rank_snapshots 덮어쓰기(랭킹 변동 기능 오염)
--        snapshot_all_active_programs   → 위를 전 프로그램에 대해
--        check_capacity_usage           → 용량 수치 열람 + 관리자에게 경고 알림 스팸
--        is_notification_enabled        → 타인 알림 설정 열람
--      (apply_missions_from_program 은 조사 초안에 있었으나 031 에서 DROP 된 함수라 제외 —
--       2026-09-22 프로드 적용 시 42883 으로 드러났다. 파일의 마지막 CREATE 만 보면 안 된다.)
--   이들은 «트리거와 cron, 그리고 다른 SECURITY DEFINER 함수 내부»에서만 불린다.
--     · 트리거 함수의 EXECUTE 권한은 트리거 «생성 시점»에 검사된다 → 실행에 영향 없음
--     · SECURITY DEFINER 함수 내부 호출은 정의자(postgres) 권한으로 실행 → 영향 없음
--     · cron 작업도 postgres 로 돈다 → 영향 없음
--   따라서 권한만 회수하면 «내부 동작은 그대로, 외부 호출만» 막힌다.
--
--   ⚠️ 남겨야 하는 것 — RLS 정책 본문에서 쓰이는 함수는 «호출자 권한»으로 평가되므로
--      회수하면 그 테이블 조회가 42501 로 죽는다. 마이그레이션 전수 파싱 결과 4개다:
--        is_admin(30회) · _is_active_participant(21) · _is_pending_participant(3) · community_board_write_role(1)
--      → 이 4개는 anon 에도 그대로 둔다(내부 가드 있음, 대상 UUID 를 알아야 하고 테이블 조회는 RLS 로 막혀 있음).
--
--   ⚠️ 로그인 전 화면이 부르는 RPC 는 없음을 확인했다 — 초대 조회(lookup_invite_program)는
--      JoinByCodePage 에서 `if (!session || !urlCode) return` 뒤에만 호출된다.
--
-- 영향:
--   권한만 바꾼다(함수 본문·테이블·정책 변화 없음).
--   · anon: public 스키마 함수 전체 실행 불가(위 4개 예외).
--   · authenticated: 내부 전용 7개만 불가. 화면이 쓰는 RPC 는 전부 유지.
--   · 새로 만드는 함수는 기본적으로 anon 에 부여되지 않는다(ALTER DEFAULT PRIVILEGES).
--
-- 복구: supabase/rollbacks/270_revert_function_execute_hardening.sql
-- ============================================================

-- ── 1) anon·PUBLIC 은 public 스키마 함수를 실행하지 못한다 ──
--   ⚠️ PostgreSQL 은 함수에 PUBLIC(모든 역할) EXECUTE 를 «기본 부여» 한다.
--      anon 에서만 회수하면 PUBLIC 경로로 그대로 실행된다(2026-09-22 드라이런에서 확인).
--      269 가 통한 이유도 PUBLIC 을 함께 회수했기 때문.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

--   PUBLIC 을 회수하면 authenticated 가 «PUBLIC 경유로만» 권한을 갖던 함수도 막힐 수 있다.
--   화면이 깨지지 않도록 로그인 사용자에게는 명시적으로 부여한다(기존과 동일한 접근 범위).
--   트리거 함수(RETURNS trigger)는 PostgREST 가 노출하지 않으므로 함께 부여돼도 무해하다.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
--   서버(엣지 함수·cron)가 쓰는 service_role 도 명시로 보장한다. 현재 엣지 함수는 RPC 를
--   쓰지 않고 테이블만 접근하지만, PUBLIC 회수로 서버 경로가 막히는 일이 없게 못을 박는다.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 앞으로 만들 함수도 anon·PUBLIC 에 자동 부여되지 않게 (함수 소유자 기준 기본 권한)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- ── 2)·3) 함수별 권한 — 없는 함수는 건너뛴다 ─────────────
--   ⚠️ 마이그레이션 파일에 CREATE 가 있어도 «나중에 DROP» 된 함수가 있다
--      (apply_missions_from_program). 시그니처를 직접 나열하면 그 한 줄 때문에
--      스크립트 전체가 롤백된다 → to_regprocedure 로 존재를 확인하고 실행한다.
DO $do$
DECLARE
  sig TEXT;
  -- (2) RLS 정책이 호출자 권한으로 평가 → anon 에도 남겨야 한다
  keep TEXT[] := ARRAY[
    'public.is_admin()',
    'public._is_active_participant(uuid,uuid)',
    'public._is_pending_participant(uuid,uuid)',
    'public.community_board_write_role(uuid,text)'
  ];
  -- (3) 내부 전용 → 로그인 사용자에게서도 회수
  internal TEXT[] := ARRAY[
    'public._award_comment_points(uuid,uuid,uuid,timestamptz,text,boolean,text,uuid)',
    'public.notify_participants_new_content(uuid,text,text,text,text,text,uuid,uuid)',
    'public.is_notification_enabled(uuid,text)',
    'public.snapshot_program_rankings(uuid)',
    'public.snapshot_all_active_programs()',
    'public.check_capacity_usage()',
    'public.get_storage_usage()'
  ];
BEGIN
  FOREACH sig IN ARRAY keep LOOP
    IF to_regprocedure(sig) IS NULL THEN
      RAISE NOTICE '건너뜀(없는 함수): %', sig;
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', sig);
    END IF;
  END LOOP;

  FOREACH sig IN ARRAY internal LOOP
    IF to_regprocedure(sig) IS NULL THEN
      RAISE NOTICE '건너뜀(없는 함수): %', sig;
    ELSE
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', sig);
    END IF;
  END LOOP;
END $do$;

-- ⚠️ 검증 한계: 위 ALTER DEFAULT PRIVILEGES 두 줄은 PGlite 드라이런으로 확인할 수 없었다
--    (PGlite 18.3 에서는 ALTER DEFAULT PRIVILEGES 가 pg_default_acl 에 기록되지 않음 — GRANT 도 마찬가지).
--    나머지 항목은 드라이런 21개 중 20개 PASS. 적용 후 아래 4) 로 실제 상태를 확인할 것.

-- ── 4) 확인용 — 적용 후 남은 anon 실행 권한 (기대: 위 4개만) ──
--   SELECT p.proname
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
--   ORDER BY 1;

--   기본 권한이 실제로 바뀌었는지:
--   SELECT defaclobjtype, defaclacl::text FROM pg_default_acl;
--   (functions 행의 acl 에 anon 이 없어야 한다)
