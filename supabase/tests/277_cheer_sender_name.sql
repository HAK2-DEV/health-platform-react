-- Run ONLY in an empty, disposable PostgreSQL database (PGlite runner strips \set / \ir / BEGIN / ROLLBACK).
-- psql "$TEST_DATABASE_URL" -X -f supabase/tests/277_cheer_sender_name.sql
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE public._t_uid (id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM public._t_uid LIMIT 1 $$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE TABLE public.users (id uuid PRIMARY KEY, nickname text);
CREATE TABLE public.programs (id uuid PRIMARY KEY, owner_id uuid, name text);
CREATE TABLE public.program_participants (program_id uuid, user_id uuid, status text);
CREATE TABLE public.blocked_users (blocker_id uuid, blocked_id uuid);
CREATE TABLE public.notifications (
  id serial, user_id uuid, type text, title text, body text, link_path text, actor_id uuid,
  created_at timestamptz DEFAULT now()
);
\ir ../migrations/20261001_277_cheer_sender_name.sql

-- 운영자 o1(닉네임 있음, 짧은 프로그램) / o2(닉네임 공백, 긴 프로그램)
INSERT INTO users VALUES ('00000000-0000-0000-0000-0000000000a1','정민 코치'), ('00000000-0000-0000-0000-0000000000a2','  ');
INSERT INTO programs VALUES
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','3km 챌린지'),
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a2','아주아주 긴 이름의 건강증진 프로그램 2026 가을 기수');
INSERT INTO program_participants VALUES
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1','ACTIVE'),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c2','ACTIVE'),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c3','ACTIVE'),
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000c1','ACTIVE');
-- c3 는 o1 을 차단
INSERT INTO blocked_users VALUES ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000a1');

-- o1: 개별 1건 + 일괄(c1 은 오늘 이미 받음 → 제외, c3 은 차단 → 제외, c2 만)
INSERT INTO _t_uid VALUES ('00000000-0000-0000-0000-0000000000a1');
SELECT send_operator_cheer('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1','오랜만이에요', '🌱 다시 함께해요');
DO $$ DECLARE n int; BEGIN
  n := send_operator_cheer_bulk('00000000-0000-0000-0000-0000000000b1',
    ARRAY['00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000c3']::uuid[],
    '오늘 가볍게 하나 어때요?', NULL);
  IF n <> 1 THEN RAISE EXCEPTION 'bulk sent % (expected 1)', n; END IF;
END $$;
-- 같은 날 다시 개별 → 막혀야 함
DO $$ BEGIN
  PERFORM send_operator_cheer('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1','또', NULL);
  RAISE EXCEPTION 'dedup did not block';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE '오늘은 이미%' THEN RAISE; END IF;
END $$;
-- 차단한 사람에게 개별 → 막혀야 함
DO $$ BEGIN
  PERFORM send_operator_cheer('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c3','안녕', NULL);
  RAISE EXCEPTION 'block did not stop';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE '이 참여자에게는%' THEN RAISE; END IF;
END $$;

-- o2: 닉네임 공백 → '운영자', 긴 이름 → 19자 + …
DELETE FROM _t_uid; INSERT INTO _t_uid VALUES ('00000000-0000-0000-0000-0000000000a2');
SELECT send_operator_cheer('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000c1','화이팅');

DO $$ DECLARE r record; got text := ''; BEGIN
  FOR r IN SELECT user_id, title, body FROM notifications ORDER BY id LOOP
    got := got || r.title || ' | ' || r.body || E'\n';
  END LOOP;
  IF got <> E'3km 챌린지 | 정민 코치: 오랜만이에요\n'
          || E'3km 챌린지 | 정민 코치: 오늘 가볍게 하나 어때요?\n'
          || E'아주아주 긴 이름의 건강증진 프로그…' || E' | 운영자: 화이팅\n' THEN
    RAISE EXCEPTION E'unexpected notifications:\n%', got;
  END IF;
  RAISE NOTICE '277 cheer sender cases passed';
END $$;
ROLLBACK;
