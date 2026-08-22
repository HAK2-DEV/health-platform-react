# Google Play 출시 준비 (도담)

> 상태(2026-08-22): 개발자 계정 **미생성**. 계정 없이 준비 가능한 항목을 미리 정리.
> 계정 생기면 「4. Play Console 흐름」대로 진행. Android 우선(iOS는 별도).

---

## 0. 현재 준비 상태

| 항목 | 상태 | 비고 |
|---|---|---|
| Capacitor Android 프로젝트 | ✅ | `android/`, appId `com.healthplatform.app` |
| appId (변경 불가) | ✅ | `com.healthplatform.app` — 제출 후 영구 고정 |
| versionCode / versionName | ✅ | 1 / "1.0" (첫 출시 OK) |
| min / target SDK | ✅ | 26 / 36 (Play 요건 34+ 충족) |
| 디버그 빌드 실행 확인 | ✅ | 에뮬레이터 dodam_test 정상 |
| 512×512 앱 아이콘 | ✅ | `public/app-icon.png` (리프 로고) |
| 개인정보처리방침 URL | ✅ | `https://healthplatform-pi.vercel.app/privacy` |
| 서비스 약관 URL | ✅ | `https://healthplatform-pi.vercel.app/terms` |
| **업로드 키스토어 + 서명 설정** | ✅ | `android/dodam-upload.jks` (gitignore). ⚠️ jks+비번 **백업 필수** |
| **서명된 릴리스 AAB** | ✅ | `android/app/build/outputs/bundle/release/app-release.aab` (30.6MB) — 업로드 대기 |
| **피처 그래픽 1024×500** | ✅ | `docs/store-screenshots/feature-graphic-1024x500.png` |
| **폰 스크린샷 5장** | ✅ | `docs/store-screenshots/01~05*.png` (에뮬레이터 캡처) |
| **개발자 계정 ($25)** | ⬜ | 본인 — 신원확인 며칠 소요 |

---

## 1. 스토어 등록정보 초안 (한국어)

**앱 이름** (≤30자)
```
도담 — 함께 만드는 건강습관
```

**간단한 설명** (≤80자)
```
운영은 쉽게, 건강은 단단하게. 미션·퀴즈·랭킹으로 함께 만드는 건강 습관 플랫폼.
```

**자세한 설명** (≤4000자)
```
도담은 "누구나 건강 운영자가 될 수 있도록" 돕는 도구예요.
혼자도 좋고, 함께라면 더 좋습니다. 격려와 도전의 조화로, 건강이라는 재산을 흩어버리지 않도록.

■ 운영자라면
- 클릭 몇 번으로 나만의 건강 챌린지를 만들고 운영해요.
- 미션·퀴즈·커뮤니티·랭킹·팀을 원하는 대로 켜고 끕니다.
- 참여자 현황·인증 관리·종료 리포트까지 한 곳에서.

■ 참여자라면
- 매일 미션을 인증하며 작은 습관을 단단하게 쌓아요.
- 건강 퀴즈로 지식을 채우고, 커뮤니티에서 서로 응원해요.
- 내 활동 추이와 연속 기록으로 꾸준함을 확인해요.

■ 이런 분께
- 우리 모임·동아리·팀의 건강 챌린지를 운영하고 싶은 분
- 혼자서도 습관을 꾸준히 만들고 싶은 분
- 보건소·기업·학교 등에서 건강증진 프로그램을 운영하는 분

지금 도담과 함께, 건강한 습관으로 더 나은 내일을 만들어요.
```

**카테고리**: 건강/피트니스 (Health & Fitness)
**태그(선택)**: 습관, 건강관리, 챌린지, 커뮤니티
**연락 이메일**: (본인 지원 이메일 — 약관 marker와 동일하게)

---

## 2. 데이터 보안(Data safety) 폼 답변 초안

> Play Console → 앱 콘텐츠 → 데이터 보안. 아래는 초안, 실제 수집 항목 최종 확인 후 제출.

**수집·공유하는 데이터** (모두 앱 기능 제공 목적, 제3자 판매 없음):
- **개인 정보**: 이메일, 이름/닉네임 — 계정·프로필. (소셜 로그인 시 제공자 경유)
- **건강 및 피트니스**: 걸음 수·체중·활동/인증 기록 — 핵심 기능.
- **사용자 콘텐츠**: 사진(인증 이미지), 게시글·댓글.
- **앱 활동/기기 ID**: 푸시 토큰, 진단(Sentry 오류 로그).

**보안**:
- 전송 중 암호화: 예 (HTTPS / Supabase).
- 데이터 삭제 요청 경로: 예 — (⬜ 앱 내 계정 삭제 기능 위치 확인해서 기입)
- 데이터는 사용자에게 연결됨(linked). 판매/광고 목적 공유 없음.

⚠️ 확인 필요: 위치정보 수집 여부(안 하면 "아니오"), 광고 SDK 없음 확인.

---

## 3. 업로드 키스토어 + 서명 (나중에 — 계정 전이라도 가능)

Play는 **Play App Signing**을 쓴다: 앱 서명 키는 Google이 보관, 우리는 **업로드 키**만 관리.
업로드 키 분실해도 재설정 가능(앱 서명 키는 Google이 가짐)이라 예전만큼 치명적이진 않지만, 백업 필수.

### 3-1. 업로드 키스토어 생성 (예시 — 비밀번호는 본인이 정함)
```powershell
$env:JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot"
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v `
  -keystore dodam-upload.jks -alias dodam-upload `
  -keyalg RSA -keysize 2048 -validity 10000
# → 비밀번호(스토어/키), 이름/조직 입력. jks 파일 + 비번 안전 보관(비밀번호 관리자/오프라인 백업).
```
- `dodam-upload.jks`는 **레포에 커밋 금지**(.gitignore). 안전한 곳 2벌 백업.

### 3-2. Gradle 서명 설정 (키스토어 만든 뒤)
`android/keystore.properties` (gitignore):
```
storeFile=../../dodam-upload.jks
storePassword=****
keyAlias=dodam-upload
keyPassword=****
```
`android/app/build.gradle`의 `buildTypes.release`에 signingConfig 연결 (그때 코드로 추가).

### 3-3. 릴리스 AAB 빌드
```powershell
npm run build; npx cap sync android
cd android; .\gradlew.bat bundleRelease
# 산출물: android/app/build/outputs/bundle/release/app-release.aab  ← Play 업로드용
```

---

## 4. Play Console 흐름 (계정 생긴 뒤)

1. **개발자 등록**: play.google.com/console, $25, 신원확인(개인=신분증, 며칠 소요).
   - ⚠️ **개인 계정(2023-11 이후 생성)**: 프로덕션 전에 **비공개 테스트 20명·14일** 필수.
     → 테스터 20명(지인/베타참여자) 확보해두면 좋음. 사업자등록 후 **조직 계정**이면 요건 완화 가능.
2. **앱 만들기**: 이름 "도담", 무료, 앱.
3. **설정 완료**(대시보드 체크리스트): 개인정보처리방침 URL, 앱 액세스(로그인 필요 시 테스트 계정 제공), 광고 없음, 콘텐츠 등급 설문, 타겟층(성인/전연령), 데이터 보안(위 2), 정부앱 아님.
4. **스토어 등록정보**: 위 1의 텍스트 + 아이콘(512) + 피처그래픽(1024×500) + 스크린샷(2~8장).
5. **비공개 테스트 트랙**: AAB 업로드 → 테스터 목록(이메일 20명) → 링크 배포 → 14일 운영.
6. **프로덕션 신청**: 14일 충족 후 프로덕션 출시 신청 → 검토(며칠) → 출시.

---

## 5. 준비된 자산 & 다음 액션

**준비 완료** (`docs/store-screenshots/`):
- ✅ 스크린샷 5장 — 01 환영 · 02 앱소개 · 03 대시보드 · 04 프로그램 홈 · 05 완주 리포트
- ✅ 피처 그래픽 1024×500 (`feature-graphic-1024x500.png`)
- ⚠️ 스크린샷은 에뮬레이터(Pixel 6, 1080×2400 = 20:9). Play 상한이 2:1이라 **거부되면 1080×2160으로 상·하 약간 크롭**.
- (재생성) 피처그래픽: `scratchpad/feature-graphic.html` → Chrome `--headless=new --screenshot --window-size=1024,500`.

**남은 다음 액션**:
- [ ] **앱 내 계정 삭제** 경로 확인(데이터 보안 폼용).
- [ ] 등록정보 문구 본인 검토·확정.
- [ ] **네이티브에서 PWA 「새 버전」 배너 숨김** — 네이티브는 APK로 업데이트되니 SW 새로고침 배너 불필요(에뮬 확인됨). `Capacitor.isNativePlatform()`이면 미표시.
- [ ] (계정 생기면) 「3」 키스토어 → AAB → 「4」 업로드.
```
