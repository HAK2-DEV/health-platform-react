-- ============================================================
-- Rollback: 267 - 문의 게시판 「버그 신고」 분류 되돌리기
-- ============================================================
-- ⚠️ 버그 신고로 들어온 글은 category 를 지우면 1:1 문의 목록에 섞인다.
--    글 자체는 남으므로 데이터 손실은 없다.
-- ⚠️ 코드(3탭 고객센터)가 아직 라이브면 되돌리지 말 것 — 작성이 깨진다.

-- 1) 작성 RPC 를 4인자 원본으로 되돌린다.
DROP FUNCTION IF EXISTS public.create_inquiry(TEXT, TEXT, BOOLEAN, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_inquiry(
  p_title TEXT, p_body TEXT, p_is_private BOOLEAN, p_password TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_hash TEXT;
  v_title TEXT := btrim(COALESCE(p_title, ''));
  v_body TEXT := btrim(COALESCE(p_body, ''));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '로그인이 필요해요'; END IF;
  IF v_title = '' THEN RAISE EXCEPTION '제목을 입력해주세요'; END IF;
  IF char_length(v_title) > 100 THEN RAISE EXCEPTION '제목은 최대 100자예요'; END IF;
  IF v_body = '' THEN RAISE EXCEPTION '내용을 입력해주세요'; END IF;

  IF COALESCE(p_is_private, false) THEN
    IF btrim(COALESCE(p_password, '')) = '' THEN
      RAISE EXCEPTION '비공개 글은 비밀번호가 필요해요';
    END IF;
    v_hash := crypt(p_password, gen_salt('bf'));
  END IF;

  INSERT INTO public.inquiries (author_id, title, body, is_private, password_hash)
  VALUES (v_uid, v_title, v_body, COALESCE(p_is_private, false), v_hash)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_inquiry(TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;

-- 2) 알림 트리거 함수는 134 원본으로 되돌린다(탭 분기 제거).
--    → supabase/migrations/20260624_134_inquiry_board.sql 의 6)·8) 블록을 그대로 재실행.

-- 3) 컬럼 제거 (마지막)
DROP INDEX IF EXISTS public.idx_inquiries_category_created;
ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_category_check;
ALTER TABLE public.inquiries DROP COLUMN IF EXISTS category;
