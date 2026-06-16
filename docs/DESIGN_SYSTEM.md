# 디자인 시스템 — 도담 (건강증진 플랫폼)

> **버전**: 2026-06-16
> **단일 출처(Source of Truth):** `src/index.css` 의 `@theme` 토큰 (Tailwind v4). 토큰을 정의하면 `bg-/text-/border-` 유틸이 자동 생성됨.
> **참고:** `src/App.css` 에는 초기 템플릿 잔재(`--color-primary:#4CAF50`, `.auth-form`, `.supabase-todos`)가 남아 있음 → **레거시(todos/구 폼 전용), 신규 작업엔 사용 금지.** 점진 정리 대상.

---

## 1. 글꼴 (Typeface)

- **본문 글꼴:** **Pretendard Variable** (jsDelivr CDN)
- **스택:** `'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`
- **자간:** `body { letter-spacing: -0.01em; }` — 모던 한국 앱 톤(살짝 좁게). 제목엔 `tracking-tight` 관용.
- **렌더링:** `-webkit-font-smoothing: antialiased`
- 토큰: `--font-sans` (Tailwind `font-sans`)

---

## 2. 타입 스케일 (Type Scale)

토큰으로 **본문 기본(text-sm)을 15px로 상향**한 게 핵심. text-sm 이 본문·댓글·알림의 주력(약 367곳)이라 한 줄로 전반 가독성이 올라감.

| 클래스 | 크기 | line-height | 용도 |
| --- | --- | --- | --- |
| `text-xs` | **12.5px** (토큰) | 1.5 | 보조 라벨, 메타, 칩 |
| `text-sm` | **15px** (토큰, 본문 기본) | 1.55 | 본문·댓글·알림·설명 — **주력** |
| `text-base` | 16px | 기본 | 카드 제목, 입력 |
| `text-lg` | 18px | 기본 | **섹션 제목(h2)** |
| `text-xl` | 20px | 기본 | 강조 제목 |
| `text-2xl` | 24px | 기본 | 대제목, 통계 숫자, 로고(헤더) |
| `text-3xl` | 30px | 기본 | 스플래시·로그인 로고 워드마크 |
| `text-[11px]` / `clamp(11px,3vw,13px)` | 11~13px | — | 마이크로 라벨(통계 카드 등, 자동 축소) |

> 모바일 input 은 `@media(max-width:640px)` 에서 **16px 강제** — iOS Safari 포커스 자동 줌 방지.

---

## 3. 위계 (Hierarchy) — 관용 클래스

| 레벨 | 관용 클래스 | 비고 |
| --- | --- | --- |
| 페이지 제목 (`PageHeader`) | `font-bold` | Day66: medium→**bold** 상향 |
| 섹션 제목 (h2) | `text-lg font-bold text-gray-800` | "✨ 오늘의 미션" 등 (이모지 + gap-2) |
| 카드 제목 (h3) | `text-base font-semibold text-gray-800` | 단독 강조 카드는 `font-bold` |
| 본문 | `text-sm text-gray-600` | 기본 15px |
| 설명/부가(카드 내) | `text-xs font-semibold text-gray-600` | 프로그램 설명 등 |
| 메타/날짜 | `text-xs text-gray-500` | Calendar 아이콘 + gap-1 관용 |
| 마이크로/힌트 | `text-[11px] text-gray-400~500` | 보조 안내 |
| 통계 숫자 | `text-2xl font-bold text-gray-800` | 단위는 `text-xs text-gray-500` |
| 포인트 강조 | `text-emerald-600 font-semibold` | `+10P` 식 |

### 회색(중립) 스케일 사용 규칙
| 색 | 용도 |
| --- | --- |
| `text-gray-800` | 제목·주요 텍스트 |
| `text-gray-600` | 본문 |
| `text-gray-500` | 메타·보조 라벨 |
| `text-gray-400` | 아이콘·placeholder·비활성 힌트 |
| `text-gray-300` | 미세 아이콘(삭제 등 평상시) |

---

## 4. 색상 (Color Tokens)

### 4.1 브랜드
| 토큰 | HEX | 용도 |
| --- | --- | --- |
| `brand-mint` | `#d1fae5` | 가장 연한 민트 — 배경 틴트 |
| `brand-sage` | `#a7f3d0` | 연한 세이지 — 보조 배경 |
| `brand-primary` | `#10b981` | 메인 그린 — 버튼/링크 (emerald-500) |
| `brand-deep` | `#047857` | 진한 그린 — 강조 텍스트 (emerald-700) |

> ⚠️ **브랜드 색 정합 메모(2026-06-16):** 확정 브랜드 팔레트는 **Emerald Refresh** — Primary `#059669` / Accent `#34D399` / Bg `#ECFDF5` / Ink `#073B33`. 현재 앱 토큰 `brand-primary` 는 아직 `#10b981`(emerald-500). 파비콘·앱아이콘·`theme-color`·PWA manifest 는 이미 `#059669` 로 맞춰둠. **인앱 토큰 일괄 전환은 별도 작업으로 검토**(전 화면 영향).

### 4.2 표면 (배경/카드)
| 토큰 | HEX | 용도 |
| --- | --- | --- |
| `surface-app` | `#f8fbf9` | 앱 배경 (민트 도는 아이보리) |
| `surface-card` | `#ffffff` | 기본 카드 |
| `surface-mint` | `#ecfdf5` | 카드 틴트 — 운동/건강 |
| `surface-peach` | `#fff7ed` | 카드 틴트 — 마음관리 |
| `surface-cream` | `#fefce8` | 카드 틴트 — 랭킹/포인트 |

### 4.3 카테고리 액센트
| 카테고리 | 토큰 | HEX |
| --- | --- | --- |
| 운동 | `cat-exercise` | `#10b981` |
| 마음관리 | `cat-mindcare` | `#f97316` (orange-500) |
| 식단 | `cat-diet` | `#0ea5e9` (sky-500) |
| 공감 | `cat-empathy` | `#ec4899` (pink-500) |
| 수면 | `cat-sleep` | `#6366f1` (indigo-500) |
| 금연 | `cat-nosmoke` | `#ef4444` (red-500) |
| 기타 | `cat-etc` | `#64748b` (slate-500) |

> 카드 틴팅·% 텍스트·참여자 pill 색은 `lib/programVisuals.js` 의 `CATEGORY_COLORS` 와 연동.

### 4.4 상태 (랭킹)
| 토큰 | HEX | 용도 |
| --- | --- | --- |
| `rank-gold` | `#f59e0b` | 1등 |
| `rank-silver` | `#94a3b8` | 2등 |
| `rank-bronze` | `#d97706` | 3등 |

---

## 5. 그림자 (Shadow) — 그린 틴트의 부드러운 그림자
| 토큰 | 용도 |
| --- | --- |
| `shadow-soft` | 기본 카드 |
| `shadow-elevated` | 호버·강조 카드 |
| `shadow-fab` | FAB(+) 버튼 (그린 글로우) |

---

## 6. 라운드 (Radius)
| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `radius-card` | 24px | 기본 카드 (`rounded-card`) |
| `radius-card-lg` | 28px | 강조 카드 (`rounded-card-lg`) |
| `radius-pill` | 9999px | 칩/뱃지/탭 (`rounded-pill`) |

---

## 7. 간격 (Spacing) — 4px 베이스

전용 spacing 토큰은 **없음.** **Tailwind 기본 스케일(1 = 0.25rem = 4px)** 을 쓰되, 코드에 굳어진 관용이 있다. (`App.css` 의 `--spacing-xs/sm/md/lg` 는 레거시 — 사용 금지.)

| 감각 | px | Tailwind | 주 용도 |
| --- | --- | --- | --- |
| micro | 4 | `1` · `gap-1` | 아이콘+텍스트, 라벨 묶음(`space-y-1`) |
| tight | 8 | `2` · `gap-2` | 칩·인라인, 폼 필드(`space-y-2`), 통계 그리드 `gap-2` |
| base | 12 | `3` · `gap-3` · `p-3` | 카드 내부 요소(썸네일↔본문), 카드 리스트(`space-y-3`), 콤팩트 패딩 |
| comfortable | 16 | `4` · `p-4` | **섹션 세로 간격 `space-y-4`**, 섹션 헤더 `mb-4`, 카드 패딩 기본 |
| loose | 20 | `5` · `p-5` | 패널·피처 카드, 피드 간격(`space-y-5`) |
| section | 24 | `6` · `p-6` | 모달·풀스크린·빈 상태 컨테이너 패딩 |

### 관용 규칙 (de-facto)
- **페이지 좌우 여백:** `px-3 sm:px-4` (모바일 12 → sm 16)
- **섹션 사이:** `space-y-4`
- **섹션 헤더 아래:** `mb-4`
- **카드 패딩:** `Card` 프리미티브로 표준화 — `padding="sm"`=`p-3`(12) / `"md"`=`p-4`(16, **기본**) / `"lg"`=`p-5`(20)
- **카드 안 요소 gap:** `gap-3`(썸네일↔본문) · `gap-2`(칩/인라인) · `gap-1`~`1.5`(아이콘↔텍스트)
- **리스트 간격:** 카드형 `space-y-3` · 콤팩트/폼 `space-y-2`
- **모달 / 풀스크린 / 빈 상태:** `p-6`
- **하단 탭바 확보:** 본문 `pb-24`

> 요약: **4 / 8 / 12 / 16 / 20 / 24** 의 6단계만 쓴다고 보면 됨. 새 화면도 이 단계 안에서 고르면 자동으로 톤이 맞는다.

---

## 8. 버튼 · 인터랙션 관용
- **Primary CTA / 인증 버튼:** `bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white rounded-full` (pill)
- **칩/토글:** `rounded-pill`, 선택 시 브랜드 틴트 배경
- **호버:** 카드 `hover:shadow-elevated`, 틴트 카드 `hover:brightness-95`
- **비활성:** `disabled:opacity-40`

---

## 9. 컴포넌트 프리미티브
| 컴포넌트 | 요약 |
| --- | --- |
| `Badge` | 상태 뱃지. variant: `progress`(진행중) / `upcoming`(예정) / `ended`(종료) / `draft`(임시저장). size: `sm` 등 |
| `IconBox` | 아이콘 컨테이너. tone: `emerald`/`sky`/`amber`/`violet`…, size: `md`, shape: `circle` |
| `ProgramCover` | 표지 이미지(없으면 카테고리 이모지 fallback). variant: `thumb` 등 |
| `EmptyState` | 빈 상태. icon/title/description/action, variant `mint`, size `lg` |
| `LoadingState` | 로딩. variant `page`(전체 스피너) |
| `PageHeader` | 페이지 상단 제목(뒤로가기 포함) — `font-bold` |
| `Modal` | 바텀시트형. 모바일=손잡이 슬라이드 다운, 데스크톱=배경 클릭+ESC (X 버튼 제거됨) |
| `SplashScreen` | 콜드 스타트 1.5초 스플래시(태그라인+아이콘+도담) |

### 기본 카드 패턴
```
bg-white border border-gray-100 rounded-card-lg shadow-soft p-4
```
페이지 컨테이너: `max-w-4xl mx-auto px-3 sm:px-4`, 섹션 간격 `space-y-4`.

---

## 10. 반응형 · 모바일
- 모바일 우선. 하단 `BottomTabBar` 5탭 → 본문 `pb-24`.
- `input/textarea/select` 모바일 16px 강제(iOS 줌 방지).
- 가로 스와이프 뒤로가기 차단(`overscroll-behavior-x:none` + JS), safe-area 패딩(`env(safe-area-inset-top)`).
- 라우트 전환 시 `window.scrollTo(0,0)`.

---

## 11. 톤 & 카피 (요약)
- "따뜻한 동반자 + 친근한 전문 트레이너". 정보는 전문가, 격려는 따뜻하게.
- 금지선: 외형·체중·Before/After·비교 압박·사용자 대상 광고. (브랜드 컨셉 `docs/UIUX_REDESIGN.md` 참조)
