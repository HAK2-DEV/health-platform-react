# Kakao 소셜 로그인 설정 가이드

본인이 직접 해야 할 4개 단계. 코드 자체는 푸시 완료 — 아래 외부 설정만 끝나면 동작.

---

## 1. Kakao Developers 앱 생성

1. <https://developers.kakao.com> 접속 → 로그인
2. **내 애플리케이션 > 애플리케이션 추가하기**
   - 앱 이름: `Health Platform` (원하는 이름)
   - 사업자명: 본인 이름 또는 단체명
3. 생성 후 **앱 키** 탭에서 **REST API 키** 복사 — 잠시 후 사용

## 2. Kakao 로그인 활성화 + redirect URI 등록

1. 생성한 앱 > **카카오 로그인** 탭 → 활성화 토글 **ON**
2. **Redirect URI** 추가 (여러 개 등록 가능, **쿼리스트링 X**):
   - 개발용: `http://localhost:5173/auth/callback`
   - 프로덕션: `https://본인도메인/auth/callback`
   - ⚠️ **path-only — `?provider=kakao` 같은 쿼리 X** (Kakao 가 자동 제거하는 경우 있어 정확 일치 위해)
   - provider 정보는 frontend sessionStorage 로 callback 페이지에 전달함
3. **동의항목** 탭 → 다음 2개 활성화 (**필수 동의**로 설정):
   - **닉네임** (`profile_nickname`)
   - **프로필 사진** (`profile_image`)

   > ⚠️ **이메일(`account_email`)은 비즈 앱 권한 필요**해서 일반 앱은 "권한 없음" 상태로 보임. 본 구현은 이메일 없이 동작 — Kakao ID 로 가상 이메일(`kakao_{id}@kakao.local`) 자동 생성. 나중에 비즈 앱 전환 후 진짜 이메일로 마이그레이션 가능 (user_metadata.placeholder_email 플래그 활용).

## 3. 환경변수 설정

### 3-1. 프론트엔드 (.env.local + 호스팅)

프로젝트 루트의 `.env.local` 에 추가 (없으면 생성):

```
VITE_KAKAO_REST_API_KEY=여기에_복사한_REST_API_키
```

Vercel/Netlify 등 호스팅에 배포 중이면 호스팅 대시보드에도 동일 변수 추가 + 재배포.

### 3-2. Supabase Edge Function Secrets

Supabase Dashboard > **Edge Functions > Manage secrets** 에서 추가:

| Key | Value |
|---|---|
| `KAKAO_REST_API_KEY` | (3-1 과 동일한 REST API 키) |
| `KAKAO_REDIRECT_URI` | `https://본인도메인/auth/callback?provider=kakao` (프로덕션 기준) |

> ⚠️ `KAKAO_REDIRECT_URI` 는 Kakao Developers 에 등록한 redirect URI **하나** 와 정확히 일치해야 함. dev/prod 가 다르면 Edge Function 을 환경별로 분리하거나, 프론트가 body 로 보낸 `redirect_uri` 를 우선 사용 (현재 코드는 이미 그렇게 동작).

> Supabase 가 자동 주입하는 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 는 별도 설정 불필요.

## 4. Edge Function 배포

로컬에서 Supabase CLI 로:

```bash
supabase functions deploy kakao-oauth --project-ref <PROJECT_REF>
```

`<PROJECT_REF>` 는 Supabase Dashboard URL 의 프로젝트 식별자.

배포 후 Supabase Dashboard > Edge Functions 에 `kakao-oauth` 항목이 보이면 성공.

---

## 동작 확인

1. 본인 사이트의 로그인/회원가입 페이지 진입
2. **Kakao 로 계속하기** 클릭
3. Kakao 동의 화면 → 동의
4. `/auth/callback?provider=kakao&code=...` 로 자동 복귀
5. "로그인 처리 중..." 잠깐 노출 후 홈 화면
6. 최초 가입자는 `/nickname-setup` 으로 자동 이동 (기존 흐름)

## 문제 발생 시

본인이 첫 설정 시 실제로 만난 함정들 (해결 순서) — Naver 등 추가 시 참고:

- **KOE205 — "설정하지 않은 동의 항목"**: scope 에 동의항목 켜지 않은 항목 요청.
  본 구현은 이메일(`account_email`) 권한이 일반 앱은 "권한 없음" 이라 처음부터 scope 에서 제외.

- **KOE006 — "등록하지 않은 리다이렉트 URI"**: Kakao Developers 등록 URI 와 코드 전송 URI 불일치.
  - 등록 위치: **카카오 로그인 페이지의 "Redirect URI" 섹션** (고급 > 로그아웃 리다이렉트 URI 아님!)
  - 쿼리스트링 X — Kakao 가 자동 제거하는 경우 있음
  - 코드 변경 후 등록도 다시 정리 필요

- **401 UNAUTHORIZED_INVALID_JWT_FORMAT**: Edge Function 의 JWT 검증이 ON 이라 익명 호출 거부.
  - `supabase/config.toml` 의 `[functions.kakao-oauth] verify_jwt = false` 로 해결.
  - `supabase functions deploy kakao-oauth --no-verify-jwt` 플래그로도 가능.

- **KOE010 — "Bad client credentials" (invalid_client)**: Kakao 가 client_id/client_secret 거부.
  - REST API 키가 잘못됨 (다른 키 복사, 공백 포함 등)
  - **클라이언트 시크릿** 활성화 후 저장 안 함 → 「사용 안 함」으로 변경 후 **반드시 저장 버튼 클릭**
  - 또는 시크릿 사용 중이면 Supabase env `KAKAO_CLIENT_SECRET` 추가

- **"Only the token_hash and type should be provided"**: `verifyOtp` 호출 시 email 같이 보냄.
  token_hash 사용 모드는 email 없이 `{token_hash, type}` 만 전달.

- **"이메일 정보가 필요해요"**: scope 에 `account_email` 두고 사용자가 미동의.
  본 구현은 가상 이메일 fallback 이라 발생 안 함.

- **Edge Function 로그 확인**: Supabase Dashboard > Edge Functions > kakao-oauth > **Logs** (boot/restart) 와 **Invocations** (개별 호출 상세) 두 탭.
