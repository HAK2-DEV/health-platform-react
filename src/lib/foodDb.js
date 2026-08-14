// 식품 영양 데이터 소스 — 검색 인터페이스. 지금은 목(mock), 나중에 실제 API(엣지함수 프록시)로 스왑.
//   반환 음식 1개 = 1회 표준제공량 기준 { id, name, serving, kcal, carb, protein, fat }.
//   호출측(MealLogger)은 이 인터페이스만 사용 → 데이터 소스 교체에 영향 없음.
//
//   [나중에 실제 API 스왑]
//   searchFoods() 내부를 supabase.functions.invoke('food-search', { body:{ q } }) 로 교체.
//   실제 소스: data.go.kr / data.mfds.go.kr 「식품영양성분DB」(서비스키 필요, CORS 때문에 엣지함수 프록시).

// 목 식품 DB — 자주 먹는 한식/간편식 (1회 표준제공량 기준, 대략치). 실제 API 붙기 전 UX 검증용.
const MOCK_FOODS = [
  { id: 'rice',        name: '공기밥',       serving: '1공기 (210g)', kcal: 310, carb: 69, protein: 6,  fat: 1 },
  { id: 'kimchi_jji',  name: '김치찌개',     serving: '1인분 (400g)', kcal: 243, carb: 12, protein: 15, fat: 14 },
  { id: 'doenjang',    name: '된장찌개',     serving: '1인분 (400g)', kcal: 180, carb: 14, protein: 12, fat: 8 },
  { id: 'bibimbap',    name: '비빔밥',       serving: '1인분 (500g)', kcal: 560, carb: 90, protein: 18, fat: 14 },
  { id: 'kimbap',      name: '김밥',         serving: '1줄',          kcal: 480, carb: 78, protein: 12, fat: 12 },
  { id: 'ramen',       name: '라면',         serving: '1봉지',        kcal: 500, carb: 79, protein: 10, fat: 16 },
  { id: 'samgyeop',    name: '삼겹살',       serving: '100g',         kcal: 331, carb: 0,  protein: 17, fat: 28 },
  { id: 'chicken_br',  name: '닭가슴살',     serving: '100g',         kcal: 165, carb: 0,  protein: 31, fat: 4 },
  { id: 'fried_chick', name: '후라이드치킨', serving: '3조각',        kcal: 450, carb: 25, protein: 30, fat: 26 },
  { id: 'egg_fry',     name: '계란후라이',   serving: '1개',          kcal: 90,  carb: 1,  protein: 6,  fat: 7 },
  { id: 'egg_boil',    name: '삶은계란',     serving: '1개',          kcal: 68,  carb: 1,  protein: 6,  fat: 5 },
  { id: 'tofu',        name: '두부',         serving: '반 모 (150g)', kcal: 120, carb: 3,  protein: 13, fat: 7 },
  { id: 'salad',       name: '샐러드',       serving: '1접시',        kcal: 150, carb: 12, protein: 5,  fat: 9 },
  { id: 'banana',      name: '바나나',       serving: '1개',          kcal: 105, carb: 27, protein: 1,  fat: 0 },
  { id: 'apple',       name: '사과',         serving: '1개',          kcal: 95,  carb: 25, protein: 0,  fat: 0 },
  { id: 'sweetpotato', name: '고구마',       serving: '1개 (130g)',   kcal: 130, carb: 30, protein: 2,  fat: 0 },
  { id: 'milk',        name: '우유',         serving: '200ml',        kcal: 130, carb: 10, protein: 6,  fat: 7 },
  { id: 'yogurt',      name: '그릭요거트',   serving: '100g',         kcal: 97,  carb: 4,  protein: 9,  fat: 5 },
  { id: 'americano',   name: '아메리카노',   serving: '1잔',          kcal: 10,  carb: 2,  protein: 0,  fat: 0 },
  { id: 'latte',       name: '카페라떼',     serving: '1잔',          kcal: 180, carb: 15, protein: 9,  fat: 9 },
  { id: 'toast',       name: '식빵',         serving: '1장',          kcal: 80,  carb: 15, protein: 3,  fat: 1 },
  { id: 'jjajang',     name: '짜장면',       serving: '1인분',        kcal: 700, carb: 110, protein: 16, fat: 20 },
  { id: 'jjambbong',   name: '짬뽕',         serving: '1인분',        kcal: 540, carb: 78, protein: 22, fat: 15 },
  { id: 'gimchi',      name: '김치',         serving: '1접시 (50g)',  kcal: 15,  carb: 3,  protein: 1,  fat: 0 },
  { id: 'pork_cutlet', name: '돈까스',       serving: '1인분',        kcal: 650, carb: 45, protein: 30, fat: 38 },
  { id: 'sundubu',     name: '순두부찌개',   serving: '1인분',        kcal: 250, carb: 10, protein: 16, fat: 15 },
  { id: 'bulgogi',     name: '불고기',       serving: '1인분 (200g)', kcal: 400, carb: 18, protein: 30, fat: 22 },
  { id: 'protein_shk', name: '단백질쉐이크', serving: '1스쿱',        kcal: 120, carb: 5,  protein: 24, fat: 1 },
]

// 검색 — 식품명 부분일치. (실제 API 스왑 시 이 함수 내부만 교체)
export async function searchFoods(query) {
  const q = (query || '').trim()
  if (!q) return []
  const lc = q.toLowerCase()
  return MOCK_FOODS.filter((f) => f.name.toLowerCase().includes(lc)).slice(0, 20)
}

// 음식 × 배수(qty) → 반올림 영양치
export function scaleNutrients(food, qty) {
  const r = (n) => Math.round((Number(n) || 0) * qty)
  return { kcal: r(food.kcal), carb: r(food.carb), protein: r(food.protein), fat: r(food.fat) }
}
