-- ============================================================
-- Migration: 004 - todos FK CASCADE 진화
-- 작성일: 2026-05-19
-- 설명: todos.user_id 의 FK 를 NO ACTION → ON DELETE CASCADE 진화
--
-- 본인의 옛 todos 테이블의 user_id FK 가 NO ACTION 설정으로 만들어졌음.
-- 다만 auth.users 에서 사용자 삭제 시 todos 의 행 처리 방식이 없어
-- 사용자 삭제 자체가 거부되는 함정.
--
-- 진화: NO ACTION → ON DELETE CASCADE
-- 결과: 사용자 삭제 시 그 사용자의 todos 도 자동 삭제
-- ============================================================

ALTER TABLE public.todos
DROP CONSTRAINT todos_user_id_fkey;

ALTER TABLE public.todos
ADD CONSTRAINT todos_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;