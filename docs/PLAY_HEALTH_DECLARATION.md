# Google Play 건강 데이터 선언 (도담 자체 만보기 · 달리기 기록)

> 상태(2026-10-26): **자체 만보기 1차 코드 완료 · 에뮬 검증 완료 · Play Console 입력과 내부 테스트 업로드 대기(본인)**.
> 10-25 의 A안(Health Connect 읽기)은 본인 결정(10-26)으로 **보관(끔)** — 도담이 폰 걸음 센서로 직접 센다.
> 선언은 «앱이 실제로 쓰는 권한·데이터» 기준으로 심사하므로, 아래 §0 의 권한 목록이 곧 선언 범위다.

---

## 0. 구글이 요구하는 것 — 4가지

| # | 무엇 | 어디서 | 핵심 |
|---|---|---|---|
| 1 | **Health apps 선언 폼** | Play Console → App content → Health apps | 건강 기능 = **Activity and fitness**. 신체활동 권한(ACTIVITY_RECOGNITION)이 정책 범위라 폼은 필수. Health Connect 데이터 종류는 **0개**(Part 2 비움). 비공개·공개·정식 트랙에 필요하고 **내부 테스트 트랙은 목록에 없음** |
| 2 | **데이터 보안(Data safety) 갱신** | Play Console → App content → Data safety | 「건강 및 피트니스 › 피트니스 정보」 추가. 초안 [PLAY_STORE_RELEASE.md §2](PLAY_STORE_RELEASE.md) |
| 3 | **포그라운드 서비스 종류 선언** (targetSdk 34+) | Play Console → App content → Foreground service permissions | `health` 타입 1개. ① 기능 설명 ② 중단 시 사용자 영향 ③ **시연 영상 링크**(걷기 프로그램 참여 → 권한 허용 → 알림 한 줄 → 걸음 미션 자동 인증) ④ 용도 「Health Data Sync — step counters」. 정식·비공개 출시 때. **내부 테스트엔 불필요** |
| 4 | **앱 안 눈에 띄는 고지 + 명시적 동의** | 앱 코드 | 신체활동 권한 창 **직전** 에 StepsVerify 의 「걸음 수를 이렇게 써요」 단계(읽는 것/쓰는 곳/남기는 것/끄기) + 민감정보 동의 모달. 같은 내용이 개인정보처리방침 2조 「걸음 수」 항목에 있음 |

**앱이 쓰는 권한(2026-10-26, `scripts/verify-manifest.mjs` 가 빌드 뒤 검사):** INTERNET · ACCESS_NETWORK_STATE · POST_NOTIFICATIONS · WAKE_LOCK · **ACTIVITY_RECOGNITION** · **FOREGROUND_SERVICE** · **FOREGROUND_SERVICE_HEALTH** · **RECEIVE_BOOT_COMPLETED** · FCM RECEIVE · 앱 내부 권한 1개. Health Connect(`android.permission.health.*`) **0개**.

설계 규칙: **백그라운드 위치 권한은 받지 않는다**(달리기도 사용자가 「시작」을 누른 뒤 `location` 타입 FGS 로). **배터리 최적화 제외 권한(REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)도 받지 않는다** — 설정 화면으로 안내만(StepsVerify 의 「배터리 최적화 끄기」 글자 버튼).

---

## 1. 지금 구조 (자체 만보기 1차)

```
폰 걸음 센서(TYPE_STEP_COUNTER, 부팅 뒤 누적) ─▶ 걸음 일꾼(StepCounterService, FGS type health, 알림 「오늘 N걸음 · 목표 M」)
   배칭: 인증하는 날 2분 / 쉬는 날 30분 · 자정에 날짜 넘김 · 재부팅·앱 업데이트 뒤 BootReceiver 가 되살림
        ─▶ 걸음 장부(StepLedger, SharedPreferences, 날짜별 60일) ─▶ StepCounter 플러그인 ─▶ lib/stepCounter.js
   스위치 = 걷기 테마 프로그램(theme='WALKING') 참여 기간 (lib/stepWorkerSync.js, 로그인·앱 복귀 때 StepWorkerSync)
   미션 날 자동 인증 = 앱이 앞으로 올 때 오늘 걸음 ≥ 목표면 verifications INSERT (numeric_value=걸음)
```

---

## 2. 체크리스트

### 코드·문서
- [x] **개인정보처리방침 개정** — v1.2, 시행일 2026-11-05(웹 배포일 기준 7일 이상 뒤로. 바꾸려면 LegalContent·PolicyUpdateNotice·healthConsent 세 곳). 「걸음 수(안드로이드 앱, 걷기 프로그램에 참여하는 동안만)」 항목 = 폰 걸음 센서·기기 안 60일·서버엔 달성 걸음 수 하나
- [x] **고지 단계** — StepsVerify 「걸음 수를 이렇게 써요」(권한 창 직전) + healthConsent 수집 항목에 걸음 수
- [x] **네이티브 걸음 일꾼** — `android/app/src/main/java/com/healthplatform/app/steps/` 4 파일 + 매니페스트(권한 4·서비스·리시버·uses-feature stepcounter required=false) + 상태바 아이콘 `ic_stat_steps`
- [x] **JS** — `lib/stepCounter.js`(래퍼) · `lib/stepWorkerSync.js`(프로그램 참여 ↔ 켜기/끄기, 자동 인증) · `components/common/StepWorkerSync.jsx`(로그인·복귀 때) · StepsVerify 소스 교체
- [x] **걷기 테마** — 새 카테고리 **「걷기」(CATEGORY.STEPS, 본인 결정 10-26: 운동·달리기와 분리)**. 앱 53 출시 전엔 Step1Basic 에서 관리자에게만 보임. 걷기면 Step2Type **첫 질문** 「앱이 걸음을 자동으로 셀까요?」(기본 예) → theme='WALKING'. 미션 만들기에서 걸음 자동 인증 노출·기본값
- [x] **Health Connect 보관** — includePlugins 에서 제거, 매니페스트 health 권한 0개, PrivacyPolicyActivity 파일만 남김
- [x] **verify-manifest** — 신체활동·FGS·BOOT 권한 + 서비스 선언 마커, health 0개
- [x] **에뮬 검증(API 36)** — §5. 실제 걸음·배터리는 친구 테스트
- [x] **데이터 보안 답변 초안** — [PLAY_STORE_RELEASE.md §2](PLAY_STORE_RELEASE.md)
- [x] **Health apps 폼 답변 초안** — §3
- [ ] **FGS 시연 영상**(비공개·정식 출시 전) — 걷기 프로그램 참여 → 걸음 미션 열기 → 고지 → 권한 허용 → 알림 한 줄 → 화면 끔/다른 앱 → 돌아와서 「목표 달성·자동 인증」. 유튜브 미등록 링크
- [ ] `STEPS_ENABLED` 는 내부 테스트 뒤(걷기 테마 밖 일반 프로그램 노출용 — 지금은 걷기 테마만 노출)

### Play Console (본인)
- [ ] Data safety 갱신 → 저장
- [ ] Health apps 폼 작성 → 제출 (내부 테스트엔 필수 아님. 미리 내 두면 비공개·정식 때 대기 없음)
- [ ] 내부 테스트 트랙: 테스터 이메일(친구 2~3명) 등록 → **AAB 53** 업로드 → 참여 링크 공유
- [ ] (비공개·정식 전) Foreground service permissions 선언 → 제출
- [ ] 승인 후 프로덕션 → 배포 공지(release notes modal)

### 내부 테스트 진행 순서 (초등학생 버전)
1. 본인: 걷기 테마 프로그램 하나 만들기(카테고리 **「걷기」** → 2단계 첫 질문 「앱이 걸음을 자동으로 셀까요?」 예) + 걸음 미션(목표·요일).
2. 본인: Play Console 내부 테스트에 친구 이메일 넣고 AAB 53 올리기 → 링크 보내기.
3. 친구: 링크로 앱 설치(이미 있으면 업데이트) → 프로그램 참여 → 걸음 미션 열기 → 「동의하고 권한 허용하기」 → 알림 한 줄 확인.
4. 친구: 하루 3번 삼성헬스·도담 숫자 사진, 하루 1번 설정 › 배터리 화면 사진, 알림 거슬림 한 줄 — 3일.
5. 우리: 숫자 차이·자동 인증 성공·배터리 % 로 판정(§4).

---

## 3. 폼 답변 초안

**Health apps — Part 1 건강 기능:** 기존 선언 그대로 — **활동 및 피트니스 · 수면 관리 · 스트레스 관리**([PLAY_STORE_RELEASE.md §2](PLAY_STORE_RELEASE.md)의 결정, 기분 체크·수면 카테고리 때문). 걸음 수는 「활동 및 피트니스」에 포함되므로 새 항목은 없다. **Part 2(Health Connect 데이터 종류):** 없음.

**신체활동 권한(ACTIVITY_RECOGNITION) 사유 — 데이터 보안·심사 문의 대비, 영문 제출·한글 대조**
- KO: 참여자가 「걷기 프로그램」에 참여하는 동안 앱이 기기의 걸음 센서로 하루 걸음 수를 세어, 운영자가 만든 걸음 미션(예: 하루 8,000보)을 사진·입력 없이 자동으로 인증합니다. 측정은 참여 기간에만 하고 끝나면 멈춥니다. 날짜별 걸음은 기기 안에만 보관하며 서버에는 인증한 날의 달성 걸음 수만 저장합니다. 광고·분석·제3자 제공에 쓰지 않습니다.
- EN: While a participant is enrolled in a walking program, Dodam counts daily steps with the device step sensor so that step-goal missions set by the program operator (e.g., 8,000 steps/day) are verified automatically without photos or manual entry. Counting runs only during the enrollment and stops when the program ends. Daily counts stay on the device; the server stores only the step total of the day a mission was verified. Step data is never used for advertising or analytics and is never shared with third parties.

**포그라운드 서비스(health) 선언 — 비공개·정식 출시 때**
- 기능 설명: 걷기 프로그램 참여 중 걸음 센서로 하루 걸음을 세고 알림 한 줄에 오늘 걸음을 표시. 사용자가 걸음 미션에서 권한을 허용하면 시작, 프로그램이 끝나거나 나가면 자동 종료.
- 중단 시 영향: 자정 기준값과 하루 걸음이 끊겨 미션 인증이 틀리거나 누락됨.
- 용도: Health Data Sync — on-device step counter.

---

## 4. 친구 내부 테스트 판정 기준 (2026-10-26 본인 결정)

| 항목 | 기준 |
|---|---|
| 정확도 | 같은 시각 삼성헬스 vs 도담 걸음 차이 1% 안 (하루 3번 사진) |
| 자동 인증 | 3일 중 하루 이상 「목표 달성 → 자동 인증」 성공 |
| 배터리 | 설정 › 배터리에서 도담 하루 2% 아래 (추정치, 실측이 목적) |
| 생존 | 알림 한 줄이 하루 종일 남아 있음(삼성이 일꾼을 재우지 않음). 재웠으면 「배터리 최적화 끄기」 안내 효과 확인 |
| 느낌 | 알림이 거슬렸는지, 어디서 막혔는지 한 줄 |

---

## 5. 에뮬레이터(API 36) 검증에서 잡은 것

**2026-10-26 자체 만보기** — 에뮬엔 걸음 센서가 없어 디버그 빌드만 센서 없이 일꾼을 켜고 `debugAddSteps` 로 숫자를 흉내 냈다. 확인: 신체활동 권한 창 → 허용 → `status=ready` → 일꾼 켜기 → 서비스 동작(dumpsys) → +50×2 → 오늘 200보 → StepsVerify 「목표 달성 · 자동 인증하기」 → 끄기 → 서비스 종료. 알림 한 줄·상태바 아이콘은 스크린샷으로 확인(§5 아래 표).
잡은 것: **안드13+ 는 알림 권한(POST_NOTIFICATIONS)이 없으면 포그라운드 서비스는 돌아도 「오늘 N걸음」 알림이 안 보인다.** 새로 깐 앱(푸시를 안 켠 사용자)이 딱 그 상태였다 → StepCounter 플러그인이 신체활동 권한과 함께 알림 권한도 묻고(안드13+), 거절하면 StepsVerify 가 「알림 설정 열기」 글자 버튼을 보인다. 허용 뒤엔 알림 제목 「오늘 50걸음 · 목표 100」, 본문 「시험 걷기 프로그램 · 도담이 걸음을 세고 있어요」가 조용한(Silent) 알림으로 떴고, 끄면 사라졌다.
확인 못 한 것: **실제 센서 숫자·배칭·자정 넘김·재부팅 되살리기·삼성 배터리 관리**(모두 갤럭시 실기=친구 테스트), 360px 레이아웃.

**2026-10-26 배포 전 검토(5관점 탐색 + 반박 검증)에서 잡아 고친 것**
- 일꾼을 껐다 켜면 그 사이(며칠·몇 주) 걸음이 한 번에 오늘로 들어와 가짜 「목표 달성」 → 끌 때 센서 기준값을 지우고, 날짜를 넘긴 첫 샘플은 기준값만 갱신.
- 재부팅 판별을 벽시계로 하면 시간 보정도 재부팅으로 오인(센서 누적값 전부가 오늘로) → OS 부팅 횟수(BOOT_COUNT)로.
- 시스템이 뒤에서 되살릴 때 포그라운드 시작이 막히면 «영구히» 꺼졌음 → 권한 없음(SecurityException)만 끄고, 나머진 켜짐 유지(다음 앱 복귀 때 재시작).
- 프로그램 종료일이 지나도 일꾼이 계속 돎(방침 문구 「끝나면 멈춰요」와 불일치) → JS 가 종료일(KST 23:59:59)을 넘기고 네이티브가 그 뒤엔 스스로 끔. 시작일 전·종료일 뒤 프로그램은 제외.
- 로그아웃·계정 전환 뒤에도 일꾼·상시 알림이 남음 → StepWorkerSync 가 끔.
- 뒤에서 자동 인증한 뒤 미션 화면에 「자동 인증하기」가 또 보여 2중 인증 → doneToday 로 「인증 완료」 표시 + 걸음 미션은 daily_limit=1(서버 트리거 103 이 중복 거부).
- 걸음 미션에 image_point 가 저장돼 채점(276)이 입력별 모드로 들어가 0점 → 걸음은 point 하나로.
- 자동 인증 INSERT 에 feed_visible 이 없어 비공개 피드 정책을 어김 → 프로그램 정책대로 넣음.
- 걷기 테마가 아닌 프로그램의 걸음 미션은 일꾼이 켜졌다 꺼졌다 → «살아 있는 걸음 미션»이 있는 프로그램도 켜는 대상으로.
- 알림 연타(배치 한 묶음에 이벤트 여러 개) → 300ms 로 모아서 한 번만. 자정 틱이 깊은 잠에서 늦어도 다음 샘플에서 스스로 맞춤.
- 문구: 운영자가 달성 걸음 수를 본다는 점을 고지·방침에 명시, 미션 만들기 문구에서 Health Connect 제거, 스토어 설명 초안의 「걸음 수 수집 안 함」 수정, 검사 스크립트가 versionCode 까지 확인.
- 검증 못 한 지적(무시 결정): 달리기+운동 두 카테고리 프로그램은 만보기 「네」면 걷기 테마가 달리기 홈을 대체 — 관리자만 보는 질문이라 당장은 그대로.

**2026-10-25 Health Connect(보관됨)** — 플러그인의 사유 화면이 JS 꺼진 WebView 라 빈 화면(→ PrivacyPolicyActivity 로 대체, 파일 보관) · 권한 응답이 타입 정의와 달리 객체(→ lib/health.js 가 둘 다 읽음). 되살릴 때 참고.

---

## 6. 출처 (2026-10-25~26 확인)
- [Publish your health app on Google Play](https://developer.android.com/health-and-fitness/health-connect/publish) — Health apps 폼 위치·Part 1/2
- [Health apps 선언 안내](https://support.google.com/googleplay/android-developer/answer/14738291) — 비공개·공개·정식 트랙 필수(내부 테스트 언급 없음)
- [Health apps 정책](https://support.google.com/googleplay/android-developer/answer/13996367) — ACTIVITY_RECOGNITION 등 범위 권한·고지+동의
- [포그라운드 서비스 선언 안내](https://support.google.com/googleplay/android-developer/answer/13392821) — 타입별 필드·health 용도·영상
- [Use Sensor Manager to measure steps](https://developer.android.com/health-and-fitness/fitness/basic-app/read-step-count-data) — 앱이 뒤에 있을 때 세려면 포그라운드 서비스
