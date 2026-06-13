# 건강증진 플랫폼 SSRD (mvp-v2)

> **버전**: 2026-06-13 (mvp-v2 브랜치 기준)
> **출처 형식**: 본인 기존 SSRD(`Desktop/health-promotion-platform-requirements/SSRD.md`)의 9개 섹션 구조 유지.
> **이 문서의 목적**: 초기 SSRD 이후 진화한 mvp-v2 현재 구현 상태를 단일 진실로 정리.
> **2026-06-02 이후 갱신**: 소셜 로그인(카카오·구글), 미션 입력별 점수·필수/선택, 미션 아이콘, 퀴즈 라이브러리(대상자별), 점수 제외·피드 가리기, 운영자 가이드·환영 캐러셀, 알림/계정 설정, 댓글 lazy 로딩, 베타 운영 2개 제한, 마이그레이션 071~085 반영.

---

## 1. 프로젝트 개요

### 프로젝트 이름
- 한국어 이름: 건강증진 플랫폼
- 영문 이름: Health Promotion Platform
- 짧은 식별자: health-platform

### 서비스 형태
- 모바일 중심 웹앱 (PWA, Service Worker 적용)
- 데스크톱 웹 호환 (운영자 시점)
- 네이티브 앱은 후속 범위

### 한 줄 설명
건강증진 프로그램을 직접 설계하고, 참여자의 활동을 기록·점수화·랭킹화하여 운영 자동화를 제공하는 모바일 중심 웹 플랫폼.

### 핵심 흐름
```text
프로그램 설계 (운영자, 마법사 4단계 + 게이미피케이션 트랙 선택)
  -> 참여 (FREE / INVITE_CODE / APPROVAL, 시작 전 참여 예약 가능)
  -> 미션 인증 (사진/숫자/소감, 입력별 점수·필수/선택, AUTO/MANUAL 심사)
  -> 점수 자동 부여 (score_ledger 트리거, 입력 조합별 가점)
  -> 랭킹 반영 (program별 / 옵션: 포디움/추세/기간필터, 운영자 점수 제외 가능)
  -> 커뮤니티 피드 + 좋아요/댓글 (feed_enabled, 댓글 lazy 로딩, 운영자 피드 가리기)
  -> 퀴즈 풀이 + 점수 (객관식/OX/서술형, 라이브러리 대상자별 사전 제작 + 해설/출처)
  -> 알림 (in-app, type별 ON/OFF)
```

### 기술 스택
- Frontend: React 19 + rolldown-vite + Tailwind CSS v4 + React Router 7 + TanStack Query 5 + framer-motion + lucide-react
- 폰트: Pretendard Variable (jsDelivr CDN), 타입 스케일 토큰(`@theme`)
- 인증: Supabase Auth (이메일/비밀번호) + 소셜 로그인(카카오, 구글 GIS)
- Backend: Supabase (Postgres + RLS + Auth + Storage + Edge Functions 잠재)
- PWA: vite-plugin-pwa (autoUpdate, Workbox precache) + 청크 404 자가복구(vite:preloadError)
- 오류 수집: Sentry
- 네이티브: Capacitor 셋업 완료 (정식 출시 시 스토어 배포)
- Markdown: react-markdown + remark-gfm (개요 글 전용)
- 이미지 압축: browser-image-compression (클라이언트)
- 이미지 크롭: react-easy-crop (프로필/표지/미션 아이콘)

### 비즈니스 목표 / 성공 지표 / 가격 정책 / 경쟁사 분석
초기 SSRD와 동일. 변경 없음.

---

## 2. 사용자

### 사용자 그룹

1. **참가자 (Participant)** — 미션을 인증하고 점수·랭킹·피드를 확인.
2. **운영자 (Organizer)** — 본인이 만든 프로그램의 미션·심사·통계·개요 글·옵션 관리.
3. **(예정) 관리자 (Admin)** — 현재 별도 분리 없음. 운영자 권한이 본인 프로그램에 한정.

### 권한 모델
- Supabase Auth (이메일/비밀번호)
- 각 프로그램의 `programs.owner_id` 가 운영자 결정 — 같은 사용자가 프로그램 A 운영자 + 프로그램 B 참가자 가능.
- RLS 정책: 본인 데이터 / 같은 프로그램 ACTIVE 참여자 / 운영자(=owner_id) 기준 분기.

### 페르소나 (요약)
- 운영자: 회사·기관 보건담당. 모바일 + 데스크톱 혼용. 점수 자동화 + 인증 심사 효율 중시.
- 참가자: 일반 직장인. 모바일 위주. 매일 미션 인증 + 점수/랭킹 동기.

---

## 3. 기능 명세서

> EARS 형식: "When X, the system shall Y." 유지.
> 초기 SSRD 대비 변경: program_type 폐기, 마법사 6단계 → 4단계, 기능 모듈 → 옵션 토글로 단순화, ScorePolicy/SchedulePolicy → mission 단위 스케줄, 신체지표/패널티/시뮬레이션 미구현.

### 3.1 인증/온보딩 (F-AUTH)

| ID | 기능 | 요구사항 |
| --- | --- | --- |
| F-AUTH-010 | 회원가입 | When 비로그인 사용자가 `/signup`에서 이메일·비밀번호를 입력할 때, the system shall Supabase Auth에 계정을 생성하고 `/nickname-setup`으로 이동시킨다. |
| F-AUTH-020 | 로그인 | When 사용자가 `/login`에서 인증할 때, the system shall 세션을 발급하고 `/dashboard`로 이동시킨다. |
| F-AUTH-021 | 소셜 로그인 | When 사용자가 카카오 또는 구글(GIS 인페이지) 버튼을 누를 때, the system shall OAuth 인증 후 세션을 발급하고 닉네임 미설정 시 `/nickname-setup`으로 보낸다. (네이버 미진행) |
| F-AUTH-030 | 닉네임 설정 | When 로그인 사용자의 `users.nickname`이 NULL일 때, the system shall `/nickname-setup`에서 닉네임 입력을 강제한다. |
| F-AUTH-040 | 닉네임 7일 쿨다운 | When 사용자가 닉네임을 변경할 때, the system shall `nickname_changed_at`을 갱신하고 이후 7일간 재변경을 차단한다. |
| F-AUTH-050 | 아바타 변경 | When 사용자가 프로필 사진을 변경할 때, the system shall react-easy-crop로 1:1 원형 크롭하고 512x512 JPEG로 `profile-avatars` 버킷에 업로드한다. |
| F-AUTH-060 | 로그아웃 | When 사용자가 프로필에서 로그아웃을 클릭할 때, the system shall Supabase Auth 세션을 종료하고 `/login`으로 이동시킨다. |

### 3.2 프로그램 생성 (F-PROG)

| ID | 기능 | 요구사항 |
| --- | --- | --- |
| F-PROG-010 | 마법사 진입 | When 사용자가 `/programs/new` 또는 우하단 FAB(`+`)를 누를 때, the system shall 4단계 마법사를 시작한다. (베타: 1인당 운영 프로그램 2개 제한, 관리자 면제, ENDED 시 슬롯 반환 — migr 079) |
| F-PROG-020 | Step1 기본 정보 | When 운영자가 이름·기간·목표설명·카테고리·대표사진을 입력할 때, the system shall 입력 유효성을 검증하고 임시저장 또는 다음 단계로 진행한다. |
| F-PROG-030 | Step2 프로그램 옵션 | When 운영자가 Step2에서 옵션 토글을 설정할 때, the system shall 피드 활성화, 랭킹 표시, 포디움 Top3, 14일 추세, 기간 필터를 저장한다. (랭킹 OFF 시 하위 옵션 자동 OFF) |
| F-PROG-035 | 게이미피케이션 트랙 | When 운영자가 마법사에서 게이미피케이션 트랙을 선택할 때, the system shall 랭킹 / 정원 / 별자리 중 하나를 프로그램에 저장한다 (「물=인증, 햇빛=출석」 메타포, 시각 연출은 단계적 적용). |
| F-PROG-040 | Step3 참여 조건 | When 운영자가 참여 방식·공개 여부·최대 인원·초대 코드·입장 질문을 설정할 때, the system shall `join_type` (FREE/INVITE_CODE/APPROVAL)과 부가 필드를 저장한다. |
| F-PROG-050 | Step4 요약·발행 | When 운영자가 Step4 요약을 확인하고 발행을 클릭할 때, the system shall `status`를 `DRAFT`→`PUBLISHED`로 전환하고 `published_at`을 기록한다. |
| F-PROG-060 | 임시 저장 | When 운영자가 Step1~3에서 임시 저장을 누를 때, the system shall 현재 입력을 `programs` 행에 UPDATE하고 대시보드로 복귀한다 (status=DRAFT 유지). |
| F-PROG-070 | DRAFT 재진입 | When 운영자가 대시보드/프로그램 탭에서 DRAFT 카드를 누를 때, the system shall `/programs/new?id=<id>`로 이동하여 마법사를 재진입한다. |
| F-PROG-080 | 프로그램 수정 | When 운영자가 운영자 패널 → 프로그램 수정을 누를 때, the system shall ProgramEditModal에서 이름·설명·카테고리·종료일·최대인원·공개·옵션 5종을 수정한다 (시작일 readonly). |
| F-PROG-090 | 프로그램 삭제 | When 운영자가 PUBLISHED 프로그램을 삭제할 때, the system shall DeleteProgramConfirmModal에서 이름 재입력 확인 후 CASCADE로 모든 자식 데이터를 함께 삭제한다. |
| F-PROG-100 | 개요 글 작성 | When 운영자가 운영자 패널 → 개요 글 작성/수정을 누를 때, the system shall OverviewEditModal에서 마크다운(GFM) 5000자 이내 글을 작성·저장한다 (`programs.overview_content`). |

### 3.3 미션 (F-MISSION)

| ID | 기능 | 요구사항 |
| --- | --- | --- |
| F-MISSION-010 | 미션 추가 | When 운영자가 프로그램 상세 → 미션 탭 → 미션 추가를 누를 때, the system shall MissionLibraryModal(추천 묶음) 또는 MissionCreateModal(직접 생성)을 제공한다. |
| F-MISSION-020 | 미션 묶음 | When 운영자가 추천 묶음에서 미션을 추가할 때, the system shall 미션들의 `bundle_title`을 공통 값으로 저장하여 그룹화한다. |
| F-MISSION-030 | 미션 인증 방식 | When 운영자가 미션을 생성/수정할 때, the system shall `requires_image`/`requires_numeric`/`requires_note` 조합 + `verification_type`(AUTO/MANUAL) + `daily_limit` + `point` + `instruction`을 저장한다. |
| F-MISSION-035 | 입력별 점수·필수 | When 운영자가 미션을 생성/수정할 때, the system shall 입력 종류별 점수(`image_point`/`numeric_point`/`note_point`)와 필수 여부(`image_required`/`numeric_required`/`note_required`)를 개별 저장한다. 미설정(레거시)이면 단일 `point`로 동작 (migr 084, 하위호환). |
| F-MISSION-036 | 미션 아이콘 | When 운영자가 미션 아이콘을 설정할 때, the system shall 기본 아이콘 갤러리(프리셋, `/mission-icons/`) 선택 또는 직접 업로드(1:1 크롭)를 제공하고 `icon_path`(migr 075)에 저장하여 미션 카드·인증 화면에 반영한다 (MissionIconPicker, `resolveMissionIcon`). |
| F-MISSION-037 | 참여자 제출 미리보기 | When 운영자가 미션 생성 시 「참여자 제출화면 미리보기」를 누를 때, the system shall 참여자 시점의 제출 화면을 보여준다. 입력 안내 문구(instruction)는 연필 아이콘으로 직접 수정 가능하다. |
| F-MISSION-040 | 미션 스케줄 | When 운영자가 schedule_mode를 설정할 때, the system shall ALL_DAYS(매일) / SPECIFIC_DAYS(요일 지정) / SPECIFIC_DATES(날짜 지정) 중 하나로 active_days 또는 excluded_periods를 저장한다 (마이그레이션 032). |
| F-MISSION-050 | 미션 삭제 | When 운영자가 미션 삭제를 두 번 확인할 때, the system shall CASCADE로 verifications + score_ledgers를 함께 삭제한다. |
| F-MISSION-060 | 묶음 디테일 | When 사용자가 묶음 카드를 누를 때, the system shall `/programs/:id/bundles/:bundleParam`으로 이동하여 해당 묶음의 미션들만 표시한다. |
| F-MISSION-070 | 묶음 완료 축하 | When 묶음 내 모든 미션이 오늘 한도를 채우고 PENDING이 없을 때, the system shall 묶음 디테일 하단에 트로피 + 별 폭발 축하 카드를 자동 스크롤 표시한다. |

### 3.4 인증 (F-VERIFY)

| ID | 기능 | 요구사항 |
| --- | --- | --- |
| F-VERIFY-010 | 인증 페이지 | When 참가자가 미션 카드의 인증 버튼을 누를 때, the system shall `/programs/:programId/missions/:missionId` 풀스크린 페이지로 이동한다 (BottomTabBar 숨김). |
| F-VERIFY-020 | 인증 입력 | When 미션이 요구하는 입력(사진/숫자/소감)을 참가자가 작성할 때, the system shall 각 입력의 유효성을 즉시 검증하고 제출 버튼 활성화 여부를 결정한다. |
| F-VERIFY-025 | 입력별 점수 적용 | When 참가자가 입력 조합으로 인증을 제출할 때, the system shall 작성한 입력의 점수 합으로 획득 점수를 산정한다 (예: 사진7 필수 + 소감3 선택 → 사진만 7점, 소감까지 10점). 필수 입력 미작성 시 제출을 차단하고 에러 위치로 자동 스크롤한다. |
| F-VERIFY-030 | 이미지 압축 | When 참가자가 사진을 선택할 때, the system shall 원본을 5MB 이하로만 허용하고 업로드 직전 `browser-image-compression`으로 0.6MB 이하 + 1280px 리사이즈 + JPEG로 압축한다 (실패 시 원본 fallback). |
| F-VERIFY-040 | 중복 사진 차단 | When 참가자가 이미지를 업로드할 때, the system shall 원본 파일의 SHA-256 해시를 `image_hash`에 저장하고 동일 사용자의 동일 해시 재사용을 UNIQUE 인덱스로 차단한다 (마이그레이션 029). |
| F-VERIFY-050 | AUTO 인증 | When 미션 `verification_type='AUTO'`일 때, the system shall verification.status를 `APPROVED`로 즉시 전환하고 점수 트리거를 발동한다. |
| F-VERIFY-060 | MANUAL 인증 | When 미션 `verification_type='MANUAL'`일 때, the system shall status를 `PENDING_REVIEW`로 두고 운영자 심사 화면에 노출한다 (마이그레이션 030). |
| F-VERIFY-070 | daily_limit 검증 | When 참가자가 인증을 제출할 때, the system shall 오늘 같은 미션의 `total + pending` 카운트가 `daily_limit` 미만임을 검증한다 (마이그레이션 030). |
| F-VERIFY-080 | 일정 제한 | When 미션의 schedule_mode가 오늘 비활성/제외 기간일 때, the system shall 인증 제출을 차단하고 사유를 표시한다 (마이그레이션 033). |
| F-VERIFY-090 | 피드 공개 옵션 | When 참가자가 인증을 제출할 때, the system shall `program.feed_enabled=true`인 경우 `feed_visible` 토글(기본 ON)을 노출하고 선택값을 저장한다. |
| F-VERIFY-100 | 인증 심사 | When 운영자가 `/programs/:id/reviews`에서 PENDING_REVIEW 인증을 승인/반려할 때, the system shall status를 `APPROVED`/`REJECTED`로 전환하고 점수 트리거 결과를 반영한다. |

### 3.5 점수 (F-SCORE)

| ID | 기능 | 요구사항 |
| --- | --- | --- |
| F-SCORE-010 | 점수 자동 부여 | When verification.status가 `APPROVED`로 전환될 때, the system shall `grant_score_on_approval()` 트리거가 `score_ledgers`에 점수 행을 INSERT한다. 입력별 점수가 설정된 미션은 제출된 입력 조합의 합을, 미설정 레거시 미션은 단일 `point`를 부여한다 (migr 084). |
| F-SCORE-015 | 사후 점수 제외 | When 운영자가 AUTO 즉시 승인된 부적절한 인증을 「점수 제외」할 때, the system shall `exclude_verification_score` RPC로 `score_ledgers` 행을 삭제(랭킹 즉시 회수)하고 status를 `REJECTED`로 전환하며(기록·사진 보존, 피드에서 제외) 참가자에게 알림을 보낸다 (migr 080, 운영자만). 베타에선 복구 UI 미제공 — 재승인으로 복구. |
| F-SCORE-020 | 반려/취소 차감 | When verification이 `APPROVED`→`REJECTED` 또는 삭제될 때, the system shall 해당 score_ledger 행을 자동 삭제한다. |
| F-SCORE-030 | 점수 합산 | When 사용자/프로그램 점수를 조회할 때, the system shall `score_ledgers`의 SUM(point)으로 누적 점수를 계산한다. |
| F-SCORE-040 | 오늘 점수 | When 사용자가 프로그램 상세 → 개요 탭에 진입할 때, the system shall 오늘 KST 기준 `score_ledgers`를 집계하여 오늘 획득 / 누적 카드를 표시한다. |
| F-SCORE-050 | 일일 최대 점수 | When 운영자가 `daily_max_score`를 설정할 때, the system shall 오늘 점수 카드의 분모로 사용한다 (NULL이면 미션별 point × daily_limit 합으로 추정). |

### 3.6 랭킹 (F-RANK)

| ID | 기능 | 요구사항 |
| --- | --- | --- |
| F-RANK-010 | 프로그램 랭킹 | When 사용자가 프로그램 상세 → 랭킹 탭에 진입할 때, the system shall `program_ranking` RPC로 누적 점수 기준 순위를 fetch한다. |
| F-RANK-020 | ranking_enabled OFF | When 운영자가 마법사 Step2 또는 ProgramEditModal에서 랭킹 표시를 OFF할 때, the system shall 프로그램 상세 탭 바와 `/rankings` 페이지에서 해당 프로그램을 숨긴다 (마이그레이션 055). |
| F-RANK-030 | 포디움 Top3 | When `program.podium_enabled=true`이고 참여자 ≥3명일 때, the system shall `/rankings` 페이지 상단에 2-1-3 시각 시상대를 표시한다 (마이그레이션 060). |
| F-RANK-040 | 14일 추세 | When `program.trend_enabled=true`일 때, the system shall 본인 요약 카드에 최근 14일 점수 sparkline을 표시한다 (마이그레이션 060). |
| F-RANK-050 | 기간 필터 | When `program.period_filter_enabled=true`일 때, the system shall '전체 / 최근 7일 / 최근 30일' 토글을 노출하고 기간별 누적 점수로 재계산한다 (마이그레이션 060). |
| F-RANK-060 | 내 위치 점프 | When 본인 랭킹 행이 viewport 밖일 때, the system shall floating "내 위치 (N등)" 버튼으로 자동 스크롤 진입을 제공한다. |
| F-RANK-070 | 동점자 처리 | When 동점자가 발생할 때, the system shall Standard Rank 방식(같은 점수=같은 순위, 다음 순위 건너뜀)을 적용한다. |

### 3.7 커뮤니티 피드 (F-FEED)

| ID | 기능 | 요구사항 |
| --- | --- | --- |
| F-FEED-010 | 피드 활성화 | When 운영자가 `feed_enabled=true`로 설정할 때, the system shall 프로그램 상세 → 커뮤니티 탭과 `/programs/:id/feed` 라우트를 활성화한다. |
| F-FEED-020 | 게시물 노출 | When 같은 프로그램의 ACTIVE 참여자가 피드를 볼 때, the system shall `status='APPROVED' AND feed_visible=true`인 verification을 최신순 10개씩 페이지네이션 표시한다 (마이그레이션 037 RLS). |
| F-FEED-030 | 좋아요 | When 참가자가 게시물 좋아요를 토글할 때, the system shall `post_likes`에 INSERT/DELETE한다 (UNIQUE: verification_id + user_id). |
| F-FEED-035 | 댓글 lazy 로딩 | When 피드를 표시할 때, the system shall 게시물별 댓글 수만 먼저 표시하고, 사용자가 댓글 아이콘을 누를 때 해당 게시물의 댓글 본문을 그때 fetch한다 (`fetchPostComments`, 부하 절감). |
| F-FEED-040 | 댓글 작성 | When 참가자 또는 프로그램 운영자가 200자 이내 댓글을 작성할 때, the system shall `post_comments`에 INSERT한다. 운영자는 본인 프로그램 참여자가 아니어도 좋아요·댓글 가능하다 (migr 085: `owner_id = auth.uid()` 허용). |
| F-FEED-045 | 피드에서 제외 | When 운영자가 인증을 「점수 제외」(F-SCORE-015)할 때, the system shall 해당 게시물을 status=REJECTED 처리로 피드에서도 제외한다 (별도의 "피드만 가리기" 토글은 베타 범위 밖). |
| F-FEED-050 | 댓글 삭제 | When 댓글 작성자 또는 프로그램 운영자가 삭제 버튼을 누를 때, the system shall 댓글을 삭제한다. |
| F-FEED-060 | 알림 진입 | When 좋아요/댓글 알림 클릭으로 `/programs/:id/feed?v=<verifId>&c=<commentId>`에 진입할 때, the system shall 해당 게시물/댓글 위치로 자동 스크롤 + 강조한다. |
| F-FEED-070 | 탭 임베드 | When 사용자가 프로그램 상세 → 커뮤니티 탭을 누를 때, the system shall FeedContent 컴포넌트를 임베드하여 진입 카드 없이 바로 피드를 표시한다 (Day 65). |

### 3.8 퀴즈 (F-QUIZ)

| ID | 기능 | 요구사항 |
| --- | --- | --- |
| F-QUIZ-010 | 퀴즈 생성 | When 운영자가 운영자 패널 → 게시물 관리 → 퀴즈 만들기를 클릭할 때, the system shall `/programs/:id/posts/quiz/new`에서 제목·설명·시작/종료일·정답공개·문제 동적 추가를 제공한다. |
| F-QUIZ-015 | 퀴즈 라이브러리 | When 운영자가 퀴즈 라이브러리에서 대상자(군인/근로자)를 선택할 때, the system shall 주제별 사전 제작 문항(각 12주제 × 5문항)을 미리보기(해설·출처 링크 포함)로 보여주고 프로그램에 일괄 추가한다. |
| F-QUIZ-020 | 문제 유형 | When 운영자가 문제를 추가할 때, the system shall MULTIPLE(객관식) / OX / SHORT(서술형) 중 선택하게 한다. |
| F-QUIZ-030 | 서술형 채점 모드 | When 운영자가 SHORT 문제의 `grading_mode`를 설정할 때, the system shall AUTO(정확 일치 자동) / MANUAL(운영자 수동) 중 선택하게 한다. |
| F-QUIZ-040 | 점수 지급 모드 | When 운영자가 문제의 `award_mode`를 설정할 때, the system shall CORRECT_ONLY(맞추면) / ALWAYS(틀려도) 중 선택하게 한다. |
| F-QUIZ-050 | 퀴즈 풀이 | When 참가자가 `/programs/:id/quiz/:quizId`에서 답변을 제출할 때, the system shall submitQuiz RPC가 자동 채점 가능한 문제를 즉시 채점하고 점수를 score_ledger에 반영한다. |
| F-QUIZ-060 | 수동 채점 | When 운영자가 `/programs/:id/posts/quiz/:quizId`에서 MANUAL 답안을 정답/오답 선택할 때, the system shall gradeQuizAnswer RPC가 결과를 반영하고 점수를 갱신한다. |
| F-QUIZ-070 | 정답 공개 | When 퀴즈 `reveal_answers=true`이고 참가자가 제출한 후일 때, the system shall 각 문제의 정답을 표시한다. |
| F-QUIZ-080 | 퀴즈 기한 | When 퀴즈 `start_at`이 미래일 때 the system shall "시작 예정" 표시 / `due_at`이 과거일 때 the system shall "마감됨" 표시한다. |
| F-QUIZ-090 | 퀴즈 메타 수정 | When 운영자가 퀴즈 카드의 수정을 클릭할 때, the system shall QuizEditModal에서 제목·기간·정답공개 토글을 수정하게 한다 (문제 자체는 폐기 후 재생성). |

### 3.9 알림 (F-NOTI)

| ID | 기능 | 요구사항 |
| --- | --- | --- |
| F-NOTI-010 | 알림 생성 | When verification 상태 변경 / 좋아요 / 댓글이 발생할 때, the system shall 트리거 또는 mutation에서 `notifications`에 행을 INSERT한다. |
| F-NOTI-020 | 알림 배지 | When 사용자에게 `is_read=false` 알림이 있을 때, the system shall DashboardPage 알림 아이콘과 BottomTabBar 알림 탭에 빨간 배지(수)를 표시한다. |
| F-NOTI-030 | 알림 진입 | When 사용자가 알림 카드를 클릭할 때, the system shall `is_read`를 true로 갱신하고 `link_path`로 이동한다. |
| F-NOTI-040 | 일괄 읽음 | When 사용자가 NotificationsPage 헤더의 "모두 읽음 (N)"을 클릭할 때, the system shall 본인의 모든 `is_read=false`를 true로 UPDATE한다. |
| F-NOTI-050 | 알림 설정 | When 사용자가 `/profile/notifications-settings`에서 알림 type을 OFF할 때, the system shall 해당 type 알림을 목록과 미읽음 배지 집계에서 즉시 제외한다. |

### 3.10 본인 활동 (F-MYACTIVITY)

| ID | 기능 | 요구사항 |
| --- | --- | --- |
| F-MYACTIVITY-010 | 진입 | When 사용자가 ProfilePage → "📊 내 인증 현황"을 클릭할 때, the system shall `/profile/activity`로 이동한다. |
| F-MYACTIVITY-020 | 프로그램 칩 선택 | When MyActivityPage 진입 시 참여 프로그램이 있을 때, the system shall 첫 프로그램을 자동 선택하고 칩으로 전환 가능하게 한다. |
| F-MYACTIVITY-030 | 4지표 카드 | When 본인 활동을 표시할 때, the system shall 누적 점수 / 누적 인증 / 활동 일수 / 마지막 활동을 카드 4개로 표시한다. |
| F-MYACTIVITY-040 | 14일 차트 | When 본인 활동을 표시할 때, the system shall 최근 14일 APPROVED 카운트를 막대 차트로 표시한다. |
| F-MYACTIVITY-050 | 미션별 분포 | When 사용자가 "🎯 미션별 분포" 진입 카드를 누를 때, the system shall 묶음(bundle_title)별 그룹화된 미션 카운트 + 막대를 표시한다. |
| F-MYACTIVITY-060 | 인증 기록 묶음 | When 사용자가 "📝 인증 기록"을 누를 때, the system shall 묶음 목록을 표시하고 각 묶음 진입 시 10개씩 페이지네이션 카드(사진 + 기록 + 소감 + 상태 배지)를 표시한다. |

### 3.11 참여 흐름 (F-JOIN)

| ID | 기능 | 요구사항 |
| --- | --- | --- |
| F-JOIN-010 | 공개 둘러보기 | When 사용자가 `/programs` 탭에서 둘러보기 섹션을 볼 때, the system shall `is_public=true AND status='PUBLISHED'`인 프로그램을 표시한다. |
| F-JOIN-020 | FREE 참여 | When 사용자가 공개 프로그램의 참여하기를 누를 때, the system shall `program_participants`에 INSERT(status=ACTIVE)한다. |
| F-JOIN-030 | INVITE_CODE 참여 | When 사용자가 `/join?code=<CODE>` 또는 직접 코드 입력으로 진입할 때, the system shall `lookupInviteProgram` RPC → `joinByInviteCode` RPC로 가입한다. |
| F-JOIN-040 | APPROVAL 참여 | When 사용자가 APPROVAL 프로그램에 참여 요청할 때, the system shall `entry_question`이 있으면 답변 입력을 요구하고 status=PENDING으로 INSERT, 운영자가 승인 시 ACTIVE로 전환한다. |
| F-JOIN-050 | 초대 링크 | When 운영자가 INVITE_CODE PUBLISHED 프로그램 상세 → 개요 탭에서 초대 링크 카드의 복사를 누를 때, the system shall 클립보드에 `<origin>/join?code=<CODE>`를 복사한다. |

### 3.12 통계 (F-STATS) — 운영자 전용

| ID | 기능 | 요구사항 |
| --- | --- | --- |
| F-STATS-010 | 통계 메인 | When 운영자가 운영자 패널 → 참여자 통계를 누를 때, the system shall `/programs/:id/stats`에서 3가지 카드(미션별/유저별/퀴즈) 진입을 제공한다. |
| F-STATS-020 | 미션별 통계 | When 운영자가 미션별 카드를 누를 때, the system shall 묶음/미션별 인증 카운트 + 비율을 표시한다. |
| F-STATS-030 | 유저별 통계 | When 운영자가 유저별 카드를 누를 때, the system shall 참여자 목록 + 각 사용자의 인증 카운트·점수를 표시한다. |
| F-STATS-040 | 유저 디테일 | When 운영자가 특정 사용자를 누를 때, the system shall 4지표 + 14일 차트 + 미션별 분포 + 인증 기록 진입을 제공한다 (MyActivityPage 미러). |
| F-STATS-050 | 인증 기록 묶음 | When 운영자가 사용자의 인증 기록을 깊이 탐색할 때, the system shall 묶음 → 미션 → 개별 인증 사진 경로로 진입 가능하게 한다. |

### 3.13 온보딩 / 가이드 (F-ONBOARD)

| ID | 기능 | 요구사항 |
| --- | --- | --- |
| F-ONBOARD-010 | 운영자 가이드 | When 사용자가 프로필 → 운영자 가이드(`/operator-guide`)에 진입할 때, the system shall 마법사·운영자 패널·미션·퀴즈를 주제 탭별 주석 스크린샷 워크스루로 안내한다. |
| F-ONBOARD-020 | 환영 캐러셀 | When 운영자가 첫 프로그램을 발행하고 환영 안내를 본 적이 없을 때, the system shall 4슬라이드 환영 캐러셀을 1회 노출한다 (`localStorage('operator_welcome_seen')`). |

### 3.14 계정 설정 (F-ACCOUNT)

| ID | 기능 | 요구사항 |
| --- | --- | --- |
| F-ACCOUNT-010 | 비밀번호 변경 | When 사용자가 `/profile/account-settings`에서 비밀번호 변경을 요청할 때, the system shall Supabase Auth로 비밀번호를 갱신한다. |
| F-ACCOUNT-020 | 회원 탈퇴 | When 사용자가 회원 탈퇴를 확인할 때, the system shall 계정·연관 데이터를 정리하고 세션을 종료한다. |

### 우선순위 (mvp-v2 시점 기준)

- **완료**: 인증/회원가입 + 소셜 로그인(카카오·구글), 마법사 4단계 + 게이미피케이션 트랙, 미션 묶음·아이콘·입력별 점수, 인증(AUTO/MANUAL), 점수 트리거, 랭킹, 피드(좋아요/댓글·lazy·운영자 가리기), 퀴즈(3유형 + 라이브러리), 알림(설정 포함), 본인 활동, 개요 글(마크다운), 운영자 가이드·환영 캐러셀, 계정 설정, 약관 동의, 모바일 UX(PWA + 압축 + 인덱스 + Sentry)
- **MVP 후속**: 게이미피케이션 정원/별자리 시각 연출, 운영자/참가자 레벨·칭호, 온도 랭킹, 신체 지표, 패널티 규칙, 점수 시뮬레이션, 연속 참여 보너스, AI 생성/판별
- **장기**: 다국어, 네이티브 앱(스토어), 결제 시스템

---

## 4. 화면흐름

### 4.1 라우트 전체 맵

| 경로 | 페이지 | 권한 |
| --- | --- | --- |
| `/` | HomePage (라우팅 진입점) | 누구나 |
| `/login` `/signup` | 로그인 / 회원가입 | 누구나 |
| `/nickname-setup` | 닉네임 초기 설정 | 로그인 |
| `/dashboard` | 대시보드 (메인) | 로그인 |
| `/programs` | 프로그램 탭 (3섹션) | 로그인 |
| `/programs/new` `/programs/new?id=<draftId>` | 마법사 4단계 | 로그인 |
| `/programs/:id` | 프로그램 상세 (5탭) | 로그인 |
| `/programs/:id/bundles/:bundleParam` | 묶음 디테일 | 로그인 |
| `/programs/:programId/missions/:missionId` | 미션 인증 (풀스크린) | 로그인 |
| `/programs/:id/feed?v=&c=` | 피드 단독 (알림 진입용) | 로그인 |
| `/programs/:id/posts` `/posts/quiz/new` `/posts/quiz/:quizId` | 운영자 게시물 관리 | 운영자 |
| `/programs/:id/quiz/:quizId` | 퀴즈 풀이 | 참가자 |
| `/programs/:id/reviews` `/reviews/:bundleParam` `/reviews/:bundleParam/:missionId` | 운영자 인증 심사 | 운영자 |
| `/programs/:id/stats/...` | 운영자 통계 (7페이지) | 운영자 |
| `/rankings` `/rankings?program=<id>` | 랭킹 페이지 (선택 프로그램 URL 보존) | 로그인 |
| `/notifications` | 알림 센터 | 로그인 |
| `/profile` `/profile/activity/...` | 프로필 + 본인 활동 (4페이지) | 로그인 |
| `/profile/notifications-settings` | 알림 설정 (type별 ON/OFF) | 로그인 |
| `/profile/account-settings` | 계정 설정 (비밀번호 변경·탈퇴) | 로그인 |
| `/operator-guide` | 운영자 가이드 (주제 탭 워크스루) | 로그인 |
| `/join?code=` | 초대 코드 참여 | 로그인 |

### 4.2 ProgramDetailPage 5탭 구조 (Day 65 신규)

```text
[Hero 카드]
  배경 사진 좌측 페이드
  + 진행중/예정/임시저장 배지
  + 프로그램명 / 기간 / 진행률 / 참여자 / 내 순위

[탭 바: 개요 | 미션 | 퀴즈 | 커뮤니티 | 랭킹]
  (랭킹은 ranking_enabled=true 일 때만)

개요 탭:
  - 운영자 패널 (운영자만, 5개 액션)
  - 초대 링크 카드 (운영자 + INVITE_CODE + PUBLISHED + 코드 있음)
  - 점수 요약 (⭐ 오늘 / 🎁 누적)
  - 📝 안내 (개요 글 마크다운 표시 + 운영자 ✏️ 수정)

미션 탭:
  - 미션 목록 (묶음 그룹화, 4개 이상 시 전체보기)
  - 운영자: + 미션 추가

퀴즈 탭:
  - 참가자: 퀴즈 목록 (4개 이상 시 전체보기)
  - 운영자: "게시물 관리로" 안내

커뮤니티 탭:
  - feed_enabled: FeedContent 임베드 (페이지네이션 10개씩)
  - 미활성: 안내

랭킹 탭:
  - 랭킹 (10명씩 + 페이드 + 더보기)
```

### 4.3 미션 인증 흐름 (참가자)

```text
[프로그램 상세 → 미션 탭]
  -> [미션 카드 인증 버튼]
  -> [풀스크린 인증 페이지]
    - 카테고리 히어로 그라데이션
    - 사진 / 숫자 / 소감 입력
    - 피드 공개 토글 (feed_enabled)
  -> [제출]
    - 이미지 압축 + SHA-256 해시 → Storage 업로드
    - verification INSERT
    - AUTO → 즉시 APPROVED + score_ledger 트리거
    - MANUAL → PENDING_REVIEW
  -> [복귀 (BundleDetailPage 또는 ProgramDetailPage)]
```

### 4.4 운영자 인증 심사 흐름

```text
[운영자 패널 → ✅ 인증 심사]
  -> [/programs/:id/reviews]
    - 묶음별 PENDING 카운트
  -> [묶음 진입 → 미션 진입]
    - 사진 + 기록 + 소감 + 닉네임
  -> [승인 / 반려]
    - APPROVED → score_ledger 자동 생성
    - REJECTED → 알림 발송
```

### 4.5 마법사 4단계 흐름

```text
[/programs/new]
  Step1 기본 정보 (이름/기간/카테고리/표지/목표)
  -> Step2 옵션 (피드/랭킹/포디움/추세/기간필터)
  -> Step3 참여 조건 (FREE/INVITE_CODE/APPROVAL + 입장질문)
  -> Step4 요약 + 발행
  -> [/dashboard]
  -> 발행 후 운영자 패널에서 미션 추가 / 개요 글 작성
```

---

## 5. 데이터 모델

### 5.1 주요 테이블 (현재 마이그레이션 1~85 반영)

```text
users
  id (UUID, FK auth.users)
  nickname (TEXT, UNIQUE, 7일 쿨다운)
  nickname_changed_at (TIMESTAMPTZ)
  avatar_path (TEXT, profile-avatars 버킷)
  created_at

programs
  id (UUID, PK)
  owner_id (UUID, FK users)
  name (TEXT)
  description (TEXT, 짧은 한 줄)
  overview_content (TEXT, 마크다운 5000자, mvp-v2 추가) [migr 069]
  start_date / end_date (DATE)
  status (ENUM: DRAFT, PUBLISHED, ENDED)
  published_at (TIMESTAMPTZ)
  categories (TEXT[])
  cover_image_path (TEXT, program-covers 버킷)
  is_public (BOOLEAN)
  max_participants (INT, NULL=무제한)
  daily_max_score (INT)
  join_type (ENUM: FREE, INVITE_CODE, APPROVAL)
  invite_code (TEXT, UNIQUE)
  entry_question (TEXT)                       [migr 055]
  feed_enabled (BOOLEAN, DEFAULT true)
  ranking_enabled (BOOLEAN, DEFAULT true)     [migr 055]
  podium_enabled (BOOLEAN, DEFAULT false)     [migr 060]
  trend_enabled (BOOLEAN, DEFAULT false)      [migr 060]
  period_filter_enabled (BOOLEAN, DEFAULT false) [migr 060]
  gamification_type (랭킹/정원/별자리 트랙)    [migr 076]
  -- 폐기: program_type (Day 58)

missions
  id, program_id (FK), title, instruction, point, daily_limit
  bundle_title (TEXT)                         -- 묶음 그룹화
  icon_path (TEXT)                            -- 미션 아이콘 (프리셋 상대경로 '/mission-icons/..' 또는 업로드 http URL) [migr 075]
  requires_image / requires_numeric / requires_note (BOOLEAN)
  image_point / numeric_point / note_point (INT, NULL=레거시) [migr 084]
  image_required / numeric_required / note_required (BOOLEAN) [migr 084]
  verification_type (AUTO / MANUAL)
  schedule_mode (ALL_DAYS / SPECIFIC_DAYS / SPECIFIC_DATES) [migr 032]
  active_days (INT[])
  active_from / active_until (DATE)
  excluded_periods (JSONB)

program_participants
  id, program_id (FK), user_id (FK)
  status (ACTIVE / PENDING / LEFT)
  entry_answer (TEXT)                         [migr 055]
  joined_at, left_at

verifications
  id, mission_id (FK), user_id (FK)
  status (PENDING_REVIEW, APPROVED, REJECTED)
  submitted_at, reviewed_at
  image_path (TEXT)
  image_hash (TEXT)                           -- SHA-256 중복 차단 [migr 029]
  numeric_value (NUMERIC), note (TEXT)
  feed_visible (BOOLEAN, DEFAULT true)
  -- 점수 제외: 별도 컬럼 없이 exclude_verification_score RPC 가
  --   score_ledgers 행 삭제 + status=REJECTED 처리(기록·사진 보존) [migr 080]

score_ledgers
  id, user_id, program_id, mission_id, verification_id
  point (INT, +가점 / -감점)
  created_at
  -- 트리거: verification APPROVED 시 자동 INSERT [migr 020+]

post_likes
  verification_id, user_id (UNIQUE 복합)
post_comments
  id, verification_id, user_id, content, created_at, updated_at

quizzes
  id, program_id, title, description
  start_at, due_at, reveal_answers, created_by
quiz_questions
  id, quiz_id, type (MULTIPLE/OX/SHORT)
  question_text, options (TEXT[]), correct_answer
  point, award_mode (CORRECT_ONLY/ALWAYS)
  grading_mode (AUTO/MANUAL), order_index
quiz_submissions
  id, quiz_id, user_id, status (PENDING/COMPLETE), total_score, submitted_at
quiz_answers
  id, submission_id, question_id, answer
  is_correct (NULL=수동채점대기), awarded_point

notifications
  id, user_id, title, body
  link_path (TEXT), is_read (BOOLEAN)
  type (TEXT)                                 -- 알림 종류 (설정 ON/OFF 기준)
  created_at

notification_preferences                       [migr 072]
  user_id, type별 ON/OFF                       -- OFF면 목록·배지에서 제외

growth_state                                   [migr 077]
  user_id, program_id, 성장 단계/상태           -- 정원·별자리 트랙 진척
  -- programs.gamification_type (RANKING/GARDEN/CONSTELLATION) + streak_preset/streak_milestones [migr 076]
```

### 5.2 인덱스 (마이그레이션 070까지)

```text
verifications:
  user_id, mission_id, status
  (user_image_hash) UNIQUE [029]
  (user_id, submitted_at DESC) [070]
  (mission_id, submitted_at DESC) WHERE status='APPROVED' AND feed_visible=true [070, partial]

score_ledgers: user_id, (program_id, user_id) 복합
notifications: (user_id, created_at DESC), (user_id, is_read) WHERE is_read=false
post_likes: verification_id, user_id
post_comments: verification_id, user_id, (verification_id, created_at) [070]
programs: owner_id, status, is_public, categories(GIN), invite_code UNIQUE
program_participants: program_id, user_id
missions: program_id
quizzes/quiz_*: 각 program_id / quiz_id / submission_id
```

### 5.3 RLS 정책 (요약)

- 본인 데이터 (users, notifications): 본인만 SELECT/UPDATE
- programs: PUBLISHED + is_public OR 운영자(owner_id) OR 참여자(program_participants)
- missions / verifications / score_ledgers: 같은 프로그램의 ACTIVE 참여자 SELECT + 본인 INSERT/UPDATE
- post_likes / post_comments: feed_enabled 프로그램의 **운영자(owner_id) 또는 ACTIVE 참여자** SELECT/INSERT [036→085]
- quiz_*: 참가자(본인 제출만) / 운영자(전체)
- notification_preferences: 본인만 [072]

### 5.4 Storage 버킷

- `verification-images` (private): 사용자 폴더 구조 `{user_id}/{timestamp}.jpg`. signed URL 1시간.
- `profile-avatars` (private): `{user_id}/{timestamp}.jpg`, 512x512 JPEG, signed URL.
- `program-covers` (public): `{owner_id}/{timestamp}.jpg`, public URL.

---

## 6. 비기능 요구사항

### 6.1 성능
- **첫 진입 번들**: gzip 144KB (코드 스플리팅, Day 65)
- **페이지별 chunk**: 1-30KB (lazy load, PWA precache 보장)
- **이미지**: 클라이언트 압축 후 1MB 이하 (browser-image-compression)
- **DB query**: 95th percentile 2초 이내 (성능 인덱스 070)
- **React Query staleTime**: 5분 (mutation invalidate 패턴 활용)

### 6.2 보안
- Supabase RLS 모든 테이블 적용
- 이미지 SHA-256 중복 차단 (verification 도용 방지)
- 비밀번호: Supabase Auth bcrypt
- 시크릿: 환경 변수 (Vite `.env`)

### 6.3 가용성 / 인프라
- Supabase Free 플랜 (Day 65 시점):
  - Compute: NANO (t4g.nano, 1 vCPU, ~0.5GB RAM)
  - Region: ap-northeast-1 (Tokyo)
  - 한도: Egress 5GB/월, Storage 1GB, DB 500MB, MAU 50K, Connection 60
- 본격 베타 (MAU 100+) 시점 Pro 플랜 ($25/월) 전환 권장

### 6.4 사용성
- 모바일 우선 (BottomTabBar 5탭)
- PWA 설치 가능
- 한글 우선
- KST 시간대 통일 (`formatKstDate`)
- 위계: h1 text-2xl font-semibold / h2 text-lg font-semibold / h3 font-medium
- 카드: rounded-2xl 통일

### 6.5 접근성
- 시맨틱 HTML (article, section, button)
- 키보드 진입 가능 (Tab order)
- 색 대비 (Tailwind 기본 팔레트 위주)

---

## 7. 제약사항

- **Supabase Free 플랜 한도**: Egress 5GB/월 (이미지 압축 미적용 시 MAU 35-40명 한도, 적용 후 MAU 200-300명).
- **NANO 인스턴스 RAM 0.5GB**: 동시 활성 30-50명에서 RAM 한계 우려.
- **Connection 60개**: 동시 60명 도달 시 connection pool 부족.
- **DB Size 500MB**: 텍스트 위주라 수 년간 여유, 다만 이미지 메타 + 댓글 누적 시 모니터링 필요.
- **이미지 Storage 1GB**: 압축 후 1MB 평균, 1000장 = 1GB → 본격 베타에서 빠르게 도달 가능.
- **vite-plugin-pwa precache 83 entries (1.2MB)**: 첫 진입 시 백그라운드 전체 다운로드 → Egress 영향.

---

## 8. 가정

- 사용자는 모바일 우선 (모바일 화면 기준 UX 우선 설계).
- 운영자는 기본 마크다운 사용 가능 (개요 글 편집).
- 사용자는 한국어를 사용 (UI/UX 한국어 단일).
- 시간대는 KST 통일.
- 이미지 업로드 환경에서 클라이언트 압축 (Web Worker) 가능.
- Supabase는 외부 SaaS로 의존성 위험 수용 (lock-in 일부 인정).

---

## 9. 비범위 (Out of Scope)

- AI 기반 미션 추천 / 인증 판별 (후속 마일스톤)
- 패널티 / 신체 지표 / 점수 시뮬레이션 (후속)
- 결제 시스템 / B2B 청구 자동화 (수동 운영)
- 네이티브 앱: 베타는 PWA, Capacitor 셋업 완료 — 정식 출시 시 스토어 배포 예정
- 다국어 (한국어 단일)
- 실시간 채팅 (피드 댓글로 대체)
- 다중 역할 시스템 (admin 별도 분리 안 함)
- 게이미피케이션 정원/별자리 시각 연출은 단계적 적용 (트랙 선택·메타포는 구현, 풀 연출은 후속)

---

## 부록 A. 마이그레이션 타임라인 (선별)

| # | 주제 | 일자 |
| --- | --- | --- |
| 001~019 | 초기 스키마 (users, programs, missions, verifications, score_ledgers) | mvp-v1 |
| 020~027 | 점수 트리거, 알림, RLS 정비 | mvp-v1 |
| 028~030 | 운영자 미션 추가 + MANUAL 심사 + daily_limit 검증 | Day 49 |
| 032 | mission 스케줄 (active_days, excluded_periods) | Day 50 |
| 033 | 점수 트리거 schedule_mode 가드 | Day 50 |
| 037 | 피드 RLS (feed_enabled + ACTIVE 참여자) | Day 52 |
| 055 | ranking_enabled + entry_question | Day 58 |
| 060 | podium_enabled / trend_enabled / period_filter_enabled | Day 58 |
| 063~067 | 퀴즈 시스템 (3 유형, AUTO/MANUAL 채점) | Day 62 |
| 068 | invite_code UNIQUE 인덱스 | Day 64 |
| 069 | programs.overview_content 추가 (마크다운 글) | Day 65 |
| 070 | 성능 인덱스 3개 (verifications 복합, post_comments) | Day 65 |
| 071 | rank_snapshots (랭킹 변동 history) | 2026-06-03 |
| 072 | notification_preferences (알림 type별 ON/OFF) | 2026-06-03 |
| 073 | delete_my_account RPC (회원 탈퇴) | 2026-06-03 |
| 074 | verification_submitted 알림 선호 | 2026-06-03 |
| 075 | missions.icon_path (미션 아이콘) | 2026-06-05 |
| 076 | programs.gamification_type (랭킹/정원/별자리 트랙) | 2026-06-05 |
| 077 | growth_state (정원·별자리 성장 상태) | 2026-06-05 |
| 078 | verification note 갱신 | 2026-06-11 |
| 079 | 베타 운영 프로그램 2개 제한 | 2026-06-11 |
| 080 | 인증 점수 제외 (score_excluded) | 2026-06-11 |
| 081 | 운영 제한 관리자 면제 | 2026-06-11 |
| 082 | active 참여자 수 카운트 RPC | 2026-06-11 |
| 083 | quiz_questions.explanation (해설) | 2026-06-11 |
| 084 | 미션 입력별 점수·필수 + 채점 트리거 재작성 | 2026-06-12 |
| 085 | 피드 좋아요/댓글 운영자(owner) 허용 RLS | 2026-06-13 |

## 부록 B. 핵심 컴포넌트 매핑

| 책임 | 컴포넌트 / 파일 |
| --- | --- |
| 마법사 4단계 | `components/program/ProgramWizard/Step1-4` + `WizardLayout` |
| 프로그램 상세 5탭 | `pages/program/ProgramDetailPage.jsx` |
| 미션 인증 | `pages/program/MissionVerifyPage.jsx` |
| 미션 아이콘 | `components/program/MissionIconPicker.jsx` + `lib/missionIcons.js` (`resolveMissionIcon`) |
| 피드 본문 / 댓글 lazy | `components/program/FeedContent.jsx` (공용, 내부 `CommentsSection` per-post fetch) |
| 운영자 가이드 / 환영 | `pages/OperatorGuidePage.jsx` + `components/program/WelcomeOperatorModal.jsx` |
| 퀴즈 라이브러리 | `lib/quizLibrary.js` (군인·근로자, 해설·출처) |
| 퀴즈 풀이 / 결과 | `QuizSolvePage` / `QuizResultsPage` |
| 본인 활동 | `pages/MyActivity*` 4페이지 + `components/common/MyVerificationCard.jsx` |
| 운영자 통계 | `pages/program/ProgramStats*` 7페이지 |
| 운영자 심사 | `pages/program/ProgramReviews*` 3페이지 |
| 모달 | `ProgramEditModal`, `OverviewEditModal`, `MissionCreateModal`, `MissionLibraryModal`, `QuizEditModal`, `ProgramDetailModal`, `DeleteProgramConfirmModal`, `VerificationSubmitModal`, `ReviewModal`, `ImageCropModal` |
| 공용 | `MarkdownView`, `ProgramCover`, `UserAvatar`, `EmptyState`, `LoadingState`, `StickyBackBar`, `PageHeader`, `BottomTabBar`, `ProtectedRoute` |
| 데이터 layer | `lib/queries.js` (모든 fetch 함수 + queryKeys) |
| 유틸 | `lib/imageCompression.js`, `lib/formatters.js`, `lib/programVisuals.js`, `lib/constants.js`, `lib/missionLibrary.js`, `lib/missionIcons.js`, `lib/quizLibrary.js` |
