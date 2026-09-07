-- 257 되돌리기 — DB 테이블별 크기 조회 함수 제거.
-- 조회 전용이라 데이터 영향 없음. /admin 의 「DB 상세」 섹션이 사라지므로 코드 롤백을 먼저 할 것.

DROP FUNCTION IF EXISTS public.admin_db_tables(INT);
