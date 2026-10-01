-- Run ONLY in an empty, disposable PostgreSQL database:
-- psql "$TEST_DATABASE_URL" -X -f supabase/tests/276_input_scoring.sql
-- Existing public tables cause immediate failure. All fixtures roll back.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE public.missions (
  id text PRIMARY KEY, program_id text DEFAULT 'program', point int DEFAULT 15,
  daily_limit int, active_from timestamptz, active_until timestamptz,
  verification_type text DEFAULT 'AUTO', schedule_mode text DEFAULT 'ALL_DAYS',
  active_days int[], excluded_periods jsonb DEFAULT '[]',
  image_point int DEFAULT 10, numeric_point int, note_point int DEFAULT 5
);
CREATE TABLE public.verifications (
  id text PRIMARY KEY, mission_id text, user_id text DEFAULT 'participant',
  status text DEFAULT 'APPROVED', submitted_at timestamptz DEFAULT '2026-09-29 12:00+09',
  image_path text, numeric_value numeric, metric_values jsonb, note text
);
CREATE TABLE public.score_ledgers (
  verification_id text UNIQUE, program_id text, user_id text, point int, reason text,
  created_at timestamptz DEFAULT now()
);
\ir ../migrations/20260929_276_restore_input_scoring.sql
CREATE TRIGGER grant_score_after_verification
AFTER INSERT OR UPDATE OF status ON public.verifications
FOR EACH ROW EXECUTE FUNCTION public.grant_score_on_approval();

INSERT INTO missions(id) VALUES ('inputs');
INSERT INTO missions(id, image_point, note_point, point) VALUES ('legacy', NULL, NULL, 23);
INSERT INTO missions(id, image_point, note_point, numeric_point) VALUES ('numbers', NULL, NULL, 7);
INSERT INTO missions(id, daily_limit) VALUES ('limited', 1);
INSERT INTO missions(id, schedule_mode) VALUES ('weekends', 'WEEKENDS');
INSERT INTO missions(id, excluded_periods) VALUES ('excluded', '[{"start_date":"2026-09-29","end_date":"2026-09-29"}]');
INSERT INTO verifications(id,mission_id,image_path,note) VALUES
  ('photo','inputs','photo.jpg',NULL), ('both','inputs','photo.jpg','hello'),
  ('blank','inputs','photo.jpg','   '), ('empty','inputs',NULL,NULL),
  ('old','legacy',NULL,NULL), ('weekend','weekends','photo.jpg',NULL),
  ('excluded','excluded','photo.jpg',NULL);
INSERT INTO verifications(id,mission_id,numeric_value,metric_values) VALUES
  ('zero','numbers',0,NULL), ('metrics','numbers',NULL,'{"distance":3,"time":20}'),
  ('empty-metrics','numbers',NULL,'{}'), ('null-metric','numbers',NULL,'{"distance":null}'),
  ('clock','numbers',NULL,'{"times":[0,60]}'), ('empty-clock','numbers',NULL,'{"times":[]}');
INSERT INTO verifications(id,mission_id,image_path,status) VALUES ('manual','inputs','photo.jpg','PENDING_REVIEW');
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM score_ledgers WHERE verification_id='manual') THEN
    RAISE EXCEPTION 'pending submission received points';
  END IF;
END $$;
UPDATE verifications SET status='APPROVED' WHERE id='manual';
UPDATE verifications SET status='APPROVED' WHERE id='manual';
-- Same submitted day, even though ledger creation happens on another date.
INSERT INTO verifications(id,mission_id,image_path,submitted_at) VALUES
  ('limit-first','limited','photo.jpg','2026-09-28 23:59+09'),
  ('limit-same','limited','photo.jpg','2026-09-28 23:59:30+09'),
  ('limit-next','limited','photo.jpg','2026-09-29 00:01+09');
DO $$
DECLARE c record; actual int;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('photo',10),('both',15),('blank',10),('empty',0),('old',23),
    ('weekend',0),('excluded',0),('zero',7),('metrics',7),
    ('empty-metrics',0),('null-metric',0),('clock',7),('empty-clock',0),
    ('manual',10),('limit-first',10),('limit-same',0),('limit-next',10)
  ) AS cases(id, expected) LOOP
    SELECT COALESCE(SUM(point),0) INTO actual FROM score_ledgers WHERE verification_id=c.id;
    IF actual <> c.expected THEN RAISE EXCEPTION '%: expected %, actual %',c.id,c.expected,actual; END IF;
  END LOOP;
  RAISE NOTICE '17 scoring cases passed';
END $$;
ROLLBACK;
