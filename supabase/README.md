markdown# Supabase 마이그레이션

본인의 Supabase 의 DB 변경 사항을 시간순으로 기록한 SQL 파일들.

## 사용법

새 환경 (스테이징, 프로덕션 등) 에 본인의 DB 구조 적용 시:

1. 새 Supabase 프로젝트 만들기
2. SQL Editor 에서 `migrations/` 폴더의 파일들을 시간순으로 실행
3. 본인의 DB 구조 완벽 복원

## 명명 규칙
YYYYMMDD_NNN_description.sql

- YYYYMMDD: 작성 날짜
- NNN: 같은 날짜의 순서 (001, 002, 003...)
- description: 영문 설명 (snake_case)

## 마이그레이션 목록

| 번호 | 파일 | 설명 |
| --- | --- | --- |
| 001 | 20260519_001_users_table.sql | public.users 테이블 + RLS 활성화 |
| 002 | 20260519_002_user_triggers.sql | 회원가입 자동 INSERT + 닉네임 7일 제한 |
| 003 | 20260519_003_users_rls.sql | is_admin() 함수 + RLS 정책 3개 |
| 004 | 20260519_004_todos_fk_cascade.sql | todos.user_id FK ON DELETE CASCADE 진화 |

## 주의

- 마이그레이션 파일은 한 번 commit 후 절대 수정 X (적용된 상태에 영향)
- 새 변경은 새 파일로 (예: 20260520_005_xxx.sql)
- 본인의 DB 의 현재 상태는 모든 마이그레이션의 합 = 적용된 결과