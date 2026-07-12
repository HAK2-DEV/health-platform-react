-- ============================================================
-- Migration: 158 - 강사 초청 클래스(일정) 기능
-- 작성일: 2026-07-12
-- 설명:
--   운동/달리기(추후 금연·정신건강 등) 프로그램에서 외부 강사가 특정 날짜에
--   진행하는 클래스(요가·필라테스·크로스핏·헬스 등) 일정을 운영.
--   - programs 에 기능 on/off + 출석 확정 방식 2필드 추가(additive, 하위호환).
--   - instructors: 운영자가 입력하는 강사 프로필(계정 없음).
--   - sessions: 클래스 1건(종목·강사·일시·장소·정원·신청방식·포인트).
--   - session_registrations: 사전 신청(RSVP) — signup_mode='rsvp' 일 때 정원 관리.
--   - session_attendance: 출석 확정 → (후속) 포인트·연속인증 반영.
--
--   출석 확정 방식(programs.class_attendance_mode):
--     operator_roll : 운영자 출석부 체크(운영자가 confirmed 기록 생성)
--     venue_code    : 현장 6자리 코드 자가체크(후속 RPC 로 confirmed)
--     self_approve  : 참가자 자가출석(pending) → 운영자 승인(confirmed)
--
-- RLS:
--   - instructors/sessions: 운영자(programs.owner_id) 전체 CRUD, 활성 참가자 SELECT.
--   - session_registrations: 본인 신청 CRUD(활성 참가자), 운영자 SELECT(명단·정원).
--   - session_attendance: 본인 SELECT + 본인 INSERT(pending), 운영자 전체(체크·승인).
--   ※ venue_code 확정/포인트 지급 등 통제 필요한 흐름은 후속 SECURITY DEFINER RPC 로.
--
-- 영향: programs 2컬럼(기본값) + 신규 테이블 4개. 기존 동작 불변.
--
-- 복구:
--   DROP TABLE IF EXISTS public.session_attendance, public.session_registrations,
--     public.sessions, public.instructors;
--   ALTER TABLE public.programs
--     DROP COLUMN IF EXISTS class_feature_enabled,
--     DROP COLUMN IF EXISTS class_attendance_mode;
-- ============================================================

-- ── programs: 기능 토글 + 출석 확정 방식 ──────────────────────
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS class_feature_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS class_attendance_mode TEXT NOT NULL DEFAULT 'operator_roll'
    CHECK (class_attendance_mode IN ('operator_roll', 'venue_code', 'self_approve'));

-- ── instructors: 강사 프로필(운영자 입력) ─────────────────────
CREATE TABLE IF NOT EXISTS public.instructors (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  specialty  TEXT,                 -- 전문(요가·필라테스…) / 경력 한 줄
  bio        TEXT,
  photo_path TEXT,                 -- storage 경로(선택)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instructors_program_idx ON public.instructors (program_id);

-- ── sessions: 클래스 1건 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES public.instructors(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'etc',   -- yoga|crossfit|pilates|gym|etc (앱에서 확장)
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  place_name    TEXT,
  place_address TEXT,
  online_url    TEXT,                          -- 후속 온라인 지원용(선택)
  capacity      INT,                           -- NULL = 정원 무제한
  signup_mode   TEXT NOT NULL DEFAULT 'rsvp' CHECK (signup_mode IN ('rsvp', 'open')),
  points        INT NOT NULL DEFAULT 0,        -- 출석 시 지급 포인트
  description   TEXT,
  cover_path    TEXT,
  attend_code   TEXT,                          -- venue_code 모드의 현장 코드(선택)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_program_start_idx ON public.sessions (program_id, starts_at);

-- ── session_registrations: 사전 신청(RSVP) ───────────────────
CREATE TABLE IF NOT EXISTS public.session_registrations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS session_reg_session_idx ON public.session_registrations (session_id);

-- ── session_attendance: 출석 ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_attendance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  method       TEXT CHECK (method IN ('operator_roll', 'venue_code', 'self_approve')),
  confirmed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS session_att_session_idx ON public.session_attendance (session_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.instructors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_registrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_attendance     ENABLE ROW LEVEL SECURITY;

-- 헬퍼 조건(인라인): 운영자 = programs.owner_id, 참가자 = program_participants ACTIVE.

-- ── instructors ──
DROP POLICY IF EXISTS instructors_owner_all ON public.instructors;
CREATE POLICY instructors_owner_all ON public.instructors
  FOR ALL TO authenticated
  USING     (EXISTS (SELECT 1 FROM public.programs p WHERE p.id = instructors.program_id AND p.owner_id = auth.uid()))
  WITH CHECK(EXISTS (SELECT 1 FROM public.programs p WHERE p.id = instructors.program_id AND p.owner_id = auth.uid()));

DROP POLICY IF EXISTS instructors_participant_read ON public.instructors;
CREATE POLICY instructors_participant_read ON public.instructors
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.program_participants pp
                 WHERE pp.program_id = instructors.program_id AND pp.user_id = auth.uid() AND pp.status = 'ACTIVE'));

-- ── sessions ──
DROP POLICY IF EXISTS sessions_owner_all ON public.sessions;
CREATE POLICY sessions_owner_all ON public.sessions
  FOR ALL TO authenticated
  USING     (EXISTS (SELECT 1 FROM public.programs p WHERE p.id = sessions.program_id AND p.owner_id = auth.uid()))
  WITH CHECK(EXISTS (SELECT 1 FROM public.programs p WHERE p.id = sessions.program_id AND p.owner_id = auth.uid()));

DROP POLICY IF EXISTS sessions_participant_read ON public.sessions;
CREATE POLICY sessions_participant_read ON public.sessions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.program_participants pp
                 WHERE pp.program_id = sessions.program_id AND pp.user_id = auth.uid() AND pp.status = 'ACTIVE'));

-- ── session_registrations ──
DROP POLICY IF EXISTS session_reg_own ON public.session_registrations;
CREATE POLICY session_reg_own ON public.session_registrations
  FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK(user_id = auth.uid()
             AND EXISTS (SELECT 1 FROM public.sessions s
                         JOIN public.program_participants pp ON pp.program_id = s.program_id
                         WHERE s.id = session_registrations.session_id
                           AND pp.user_id = auth.uid() AND pp.status = 'ACTIVE'));

DROP POLICY IF EXISTS session_reg_owner_read ON public.session_registrations;
CREATE POLICY session_reg_owner_read ON public.session_registrations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s JOIN public.programs p ON p.id = s.program_id
                 WHERE s.id = session_registrations.session_id AND p.owner_id = auth.uid()));

-- ── session_attendance ──
-- 본인 조회
DROP POLICY IF EXISTS session_att_own_read ON public.session_attendance;
CREATE POLICY session_att_own_read ON public.session_attendance
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 본인 자가출석 신청(pending) — self_approve. confirmed 는 운영자/RPC 경유.
DROP POLICY IF EXISTS session_att_own_insert ON public.session_attendance;
CREATE POLICY session_att_own_insert ON public.session_attendance
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending'
              AND EXISTS (SELECT 1 FROM public.sessions s
                          JOIN public.program_participants pp ON pp.program_id = s.program_id
                          WHERE s.id = session_attendance.session_id
                            AND pp.user_id = auth.uid() AND pp.status = 'ACTIVE'));

-- 운영자: 자기 프로그램 세션 출석 전체(체크·승인·거절)
DROP POLICY IF EXISTS session_att_owner_all ON public.session_attendance;
CREATE POLICY session_att_owner_all ON public.session_attendance
  FOR ALL TO authenticated
  USING     (EXISTS (SELECT 1 FROM public.sessions s JOIN public.programs p ON p.id = s.program_id
                     WHERE s.id = session_attendance.session_id AND p.owner_id = auth.uid()))
  WITH CHECK(EXISTS (SELECT 1 FROM public.sessions s JOIN public.programs p ON p.id = s.program_id
                     WHERE s.id = session_attendance.session_id AND p.owner_id = auth.uid()));
