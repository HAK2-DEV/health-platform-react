# 홈 화면 디자인 의뢰 프롬프트 (이미지 생성 AI용)

> 아래 「===== 복사 =====」 블록을 UI 목업 생성이 가능한 AI(ChatGPT 이미지, Gemini, Midjourney 등)에 붙여넣으세요.
> ⚠️ 참고: 이미지 AI는 **한글·세밀한 UI 텍스트를 자주 깨뜨립니다.** 결과물은 **레이아웃·색·분위기 레퍼런스**로만 쓰고, 실제 화면은 코드로 구현합니다.

===== 복사 =====

You are a senior product UI designer. Design **one mobile app HOME screen** (portrait, fits a single screen with no scrolling) for **"도담(Dodam)"**, a Korean health-promotion platform. Produce a clean, high-fidelity, production-quality UI mockup.

## Brand & visual style
- App: 도담 — warm, trustworthy, modern, soft. Tagline mood: "운영은 쉽게, 건강은 단단하게."
- Palette (Emerald Refresh): primary green **#059669**, accent mint **#34D399**, app background light mint **#ECFDF5**, text/ink **#073B33**, cards pure white.
- Korean sans-serif like Pretendard. Rounded cards (corner radius ~24px), soft green-tinted shadows, generous whitespace, pill-shaped buttons.
- Tone: clean, friendly, premium, calm. NOT cluttered, NOT cold/medical, NOT childish. Mostly flat with only subtle gradients.

## Layout (top → bottom, must fit ONE screen)
1. **Header** on a soft mint area:
   - Greeting line (small, gray): "안녕하세요, 오늘도 건강한 하루 되세요!"
   - Date below (bold, larger, dark): "2026.06.16 (월)"
   - Top-right: a round white button with a **bell icon** and a tiny red unread badge.
2. **Slim summary strip** — one thin row of 3 small chips: "참여 중 3" · "오늘 2/5" · "누적 1,250P".
3. **Section "✨ 오늘의 미션"** with a small "전체보기" link on the right. Below it, **two horizontal mission cards** (slightly cut off on the right edge to hint horizontal scrolling). Each card: a rounded icon tile (leaf/walking), a title (e.g. "오늘 걷기"), a green "+7P" label, and a green pill button "인증". One card shows a "✓ 완료" chip instead of the button.
4. **Section "🎯 참여 중인 프로그램"** with "전체보기". One or two program cards: small rounded thumbnail photo + program name + a thin progress bar + a bold green percentage (e.g. "64%") + a small "진행중" badge.
5. **Section "바로가기"** — a **2×2 grid of 4 tiles**, each a white rounded card with a soft-tinted icon and a Korean label:
   - 🔍 "둘러보기"  |  📊 "내 기록"
   - 🏆 "랭킹"      |  ➕ "운영하기"
6. **Bottom tab bar** (white, subtle top border, 4 tabs, simple line icons): **홈** (active, emerald green) | **프로그램** | **랭킹** | **프로필**. (No notifications tab.)

## Constraints
- Mobile portrait, ~9:19.5 aspect, everything compact enough to fit one screen without scrolling.
- Use the Korean labels exactly as written.
- No people, no before/after, no body/weight/diet imagery.
- Realistic iOS/Android-style app UI, not an illustration.

===== 복사 끝 =====

---

## (선택) Midjourney/이미지 모델용 짧은 버전
```
Clean modern mobile app home screen UI mockup, Korean health app "도담",
emerald green #059669 and mint #34D399 accents, light mint #ECFDF5 background,
white rounded cards with soft shadows, Pretendard-like Korean sans-serif,
top greeting + date + bell icon, a "today's missions" horizontal card row with
green pill buttons, a "my programs" card with progress bar, a 2x2 quick-menu
grid of icon tiles, bottom tab bar with 4 line icons (home active),
flat, friendly, premium, generous whitespace, portrait 9:19.5
--no people, no before-after, no clutter, no medical look
```
