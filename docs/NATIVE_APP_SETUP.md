# 네이티브 앱 출시 가이드 (Capacitor)

본인이 직접 해야 할 외부 작업 정리. 코드 셋업은 푸시 완료. 아래 단계 진행 후 첫 빌드 + 스토어 제출 가능.

---

## 0. 개요

- **Bundle ID**: `com.healthplatform.app` (절대 변경 X — App Store 제출 후 고정)
- **앱 이름**: 건강증진 플랫폼
- **Mac 환경**: 없음 → GitHub Actions Mac runner 사용
- **빌드 워크플로**: `.github/workflows/ios-build.yml` + `android-build.yml`

---

## 1. Apple Developer Program 가입 (iOS 출시 필수)

### 1-1. 가입
1. <https://developer.apple.com> 접속 → Apple ID 로그인
2. **Enroll in the Apple Developer Program**
3. **개인** 또는 **법인** 선택 — 개인 가입이 베타엔 충분
4. 연 회비 **$99 결제** (약 130,000 KRW)
5. 신원 확인 1-2일 소요

### 1-2. App ID 등록
1. <https://developer.apple.com/account> > **Certificates, IDs & Profiles**
2. **Identifiers** > **+** > **App IDs** > **App**
3. 입력:
   - Description: `Health Platform`
   - Bundle ID: `com.healthplatform.app` (코드와 정확히 일치)
4. **Capabilities** 선택 (현재 필요한 것):
   - Push Notifications (선택 — 추후 활성)
5. Continue → Register

### 1-3. 인증서 + 프로비저닝 프로파일 생성
1. **Certificates** > **+** > **Apple Distribution**
2. CSR(Certificate Signing Request) 필요 — 다음 중 하나:
   - Mac 있는 친구 빌려 Keychain Access 에서 생성
   - **온라인 CSR 생성기** (`certificatesigningrequest.com`) 사용
3. CSR 업로드 → 인증서 `.cer` 다운로드
4. `.cer` 를 `.p12` 로 변환 + 비밀번호 설정 (윈도우의 경우 OpenSSL 사용)
5. **Profiles** > **+** > **App Store** → 위 App ID 선택 → 위 인증서 선택 → 다운로드

### 1-4. GitHub Secrets 등록
Repository > Settings > Secrets and variables > Actions > **New repository secret**:

| Secret 이름 | 값 |
|---|---|
| `APPLE_TEAM_ID` | Developer 계정 페이지의 Team ID (10자리 영숫자) |
| `APPLE_DISTRIBUTION_CERTIFICATE_BASE64` | `.p12` 인증서를 base64 인코딩 (`base64 cert.p12 | tr -d '\n'`) |
| `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD` | `.p12` 파일 비밀번호 |
| `APPLE_PROVISIONING_PROFILE_BASE64` | `.mobileprovision` 파일을 base64 인코딩 |

선택 (TestFlight 자동 업로드):
| Secret 이름 | 값 |
|---|---|
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect > Users and Access > Keys 에서 발급 |
| `APP_STORE_CONNECT_API_ISSUER_ID` | 같은 페이지에서 확인 |
| `APP_STORE_CONNECT_API_KEY` | `.p8` 파일 base64 인코딩 |

### 1-5. App Store Connect 앱 등록
1. <https://appstoreconnect.apple.com> 접속
2. **My Apps** > **+** > **New App**
3. 입력:
   - Platform: iOS
   - Name: 건강증진 플랫폼
   - Primary Language: Korean
   - Bundle ID: `com.healthplatform.app` (1-2 에서 등록한 것 선택)
   - SKU: `health-platform-001` (내부 식별자, 자유)
   - User Access: Full Access

---

## 2. Google Play Console 가입 (Android 출시 필수)

### 2-1. 가입
1. <https://play.google.com/console> 접속
2. Google 계정 로그인 → **개발자 계정 만들기**
3. **개인** 또는 **조직** 선택
4. 일회성 **$25 결제** (약 33,000 KRW)
5. 신원 확인 1-3일

### 2-2. 키스토어 생성 (서명용)
로컬에서 한 번만:
```bash
# JDK 설치 후 keytool 사용 (java JDK 17+)
keytool -genkey -v -keystore release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias healthplatform
```
- 비밀번호 2개 (키스토어용·키용) 설정 — **잊으면 영구 복구 불가**
- `release.jks` 파일 **반드시 안전한 곳에 백업** (Google Drive, 1Password 등)

### 2-3. GitHub Secrets 등록
| Secret 이름 | 값 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 release.jks | tr -d '\n'` |
| `ANDROID_KEYSTORE_PASSWORD` | 키스토어 비밀번호 |
| `ANDROID_KEY_ALIAS` | `healthplatform` (생성 시 alias) |
| `ANDROID_KEY_PASSWORD` | 키 비밀번호 |

선택 (Play Store 자동 업로드):
| Secret 이름 | 값 |
|---|---|
| `PLAY_STORE_SERVICE_ACCOUNT_JSON` | Play Console > Settings > API access 에서 발급한 service account JSON 전체 |

### 2-4. Play Console 앱 등록
1. Play Console > **앱 만들기**
2. 앱 이름: `건강증진 플랫폼`
3. 기본 언어: 한국어 - ko-KR
4. 앱/게임: 앱
5. 무료/유료: 무료
6. 약관 동의 → 만들기

---

## 3. 공통 환경변수 — GitHub Secrets 에 추가

빌드 시 환경변수 주입을 위해:

| Secret 이름 | 값 |
|---|---|
| `VITE_KAKAO_REST_API_KEY` | 본인 Kakao 키 (`.env.local` 의 값과 동일) |
| `VITE_SENTRY_DSN` | 본인 Sentry DSN |

---

## 4. 앱 아이콘 + 스플래시 이미지

Capacitor 는 별도 도구 `@capacitor/assets` 로 자동 생성:

```bash
npm install -D @capacitor/assets
mkdir resources
# 아래 2개 파일 만들기:
#   resources/icon.png    1024×1024 정사각 PNG (배경 포함, 모서리 둥글지 않음)
#   resources/splash.png  2732×2732 정사각 PNG (가운데 로고, 배경)
npx capacitor-assets generate
```

자동으로 iOS/Android 의 모든 해상도 (32개+) 생성됨.

**디자인 가이드:**
- 아이콘: 단순한 로고 (텍스트 X), 배경색 = brand mint (#d1fae5)
- 스플래시: 중앙 로고만 (가장자리는 잘릴 수 있음 — safe zone 600px 중앙)

---

## 5. 스토어 제출 준비물

### iOS App Store (가장 깐깐)
- 앱 아이콘 1024×1024
- **스크린샷**:
  - iPhone 6.7" (12 Pro Max): 1290×2796 — 최소 3장
  - iPhone 6.5" (XS Max): 1242×2688 — 최소 3장
  - (선택) iPad
- 앱 설명: 4,000자 이내
- 키워드: 100자 이내 (쉼표 구분)
- 지원 URL, 마케팅 URL
- **개인정보처리방침 URL** (필수): `https://본인도메인/privacy`
- 콘텐츠 권한 (만 17세 등급)
- **App Review 정보**:
  - 데모 계정 (베타 테스트용 임시 계정) — 심사관이 접속해볼 수 있게
  - 연락처 (본인 이메일·전화)

### Google Play Store (덜 깐깐)
- 앱 아이콘 512×512
- **스크린샷**: 320-3840px, 최소 2장 (phone)
- Feature Graphic (대표 이미지): 1024×500
- 짧은 설명: 80자
- 자세한 설명: 4,000자
- **개인정보처리방침 URL** (필수)
- 콘텐츠 등급 설문 (앱 안에서 자동)
- 타겟 연령

---

## 6. 첫 빌드 트리거

위 GitHub Secrets 모두 등록 후:

```bash
# 코드 변경 push → 자동 빌드
git push origin mvp-v2

# 또는 수동 트리거
# GitHub > Actions > "iOS Build" 또는 "Android Build" > Run workflow
```

빌드 성공 시:
- iOS: `.ipa` 아티팩트 다운로드 가능 (수동) 또는 자동 TestFlight 업로드
- Android: `.apk` (debug) + `.aab` (release) 아티팩트 다운로드

---

## 7. 첫 심사 제출 흐름

### iOS
1. TestFlight 업로드 → 내부 테스트 (본인 + 베타 테스터)
2. 1-2주 베타 테스트 후 버그 픽스
3. App Store Connect > **버전 + 추가 정보 입력**
4. **「심사 제출」** 클릭
5. **첫 심사 1-2주** (이후 업데이트는 24-48h)
6. 리젝트 시 사유 보고 수정 → 재제출
7. 통과 → App Store 게시 (수동 또는 자동)

### Android (훨씬 빠름)
1. Play Console > Internal Testing 트랙으로 .aab 업로드
2. 테스터 추가 → 즉시 사용 가능
3. Closed → Open → Production 단계적 승급
4. **첫 심사 수 시간-며칠** (자동 검수가 대부분)

---

## 8. 출시 후 업데이트 흐름 (Capacitor 의 핵심 강점)

| 변경 유형 | 처리 |
|---|---|
| React 코드 (UI/기능) | `git push` → Vercel 즉시 반영 (네이티브 앱이 web 자산을 어떻게 로드하느냐에 따라 다름) |
| 백엔드 (Supabase) | DB 직접 수정 — 즉시 |
| 앱 아이콘 변경 | 빌드 다시 + 스토어 심사 |
| 플러그인 추가 (푸시 등) | 빌드 다시 + 스토어 심사 |

**팁:**
- 본인 React 코드만 바꾸는 99% 경우 — Capacitor Live Updates (구 Appflow) 또는 단순히 `npx cap sync` 후 재배포
- 베타엔 단순 워크플로 충분: 코드 변경 → 빌드 → 새 .ipa/.aab → 스토어 업로드

---

## 9. 예상 일정

| 단계 | 본인 시간 | 외부 대기 |
|---|---|---|
| Apple Developer 가입 + 신원 확인 | 1h | 1-2일 |
| Google Play Console 가입 | 30min | 1-3일 |
| 인증서/키스토어 생성 + Secrets 등록 | 2-3h | — |
| 앱 아이콘·스플래시 디자인 | 1-2h | — |
| 첫 GitHub Actions 빌드 성공까지 디버깅 | 2-5h | — |
| 스크린샷·메타데이터 작성 | 3-5h | — |
| Apple 첫 심사 | — | 1-2주 |
| Google 첫 심사 | — | 1-3일 |
| **본인 작업 합계** | **약 10-17h** | + 심사 대기 |

---

## 10. 문제 발생 시 디버깅 포인트

- **iOS 인증서 에러**: `.p12` 비밀번호 또는 base64 인코딩 잘못
- **Android 키스토어 에러**: alias·비밀번호 불일치
- **CocoaPods 설치 실패**: `pod install` 명령 수동 실행 필요 — Mac 없으면 GitHub Actions 가 처리
- **빌드 시간 초과**: GitHub Actions macOS 무료 분 (월 200분) 초과 가능 — Pro 플랜 또는 직접 Mac 사용 검토
- **App Store 리젝트**:
  - "충분한 native 기능 없음" → 푸시 알림·카메라 등 의미 있는 native API 사용
  - "단순 웹사이트 wrapping" → 본인은 PWA + 다양한 기능 있어 안전한 편

진행 중 막히는 부분 알려주시면 단계별 도움 드리겠음.
