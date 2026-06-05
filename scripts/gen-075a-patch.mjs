import { MISSION_LIBRARY } from '../src/lib/missionLibrary.js'
import { writeFileSync, mkdirSync } from 'node:fs'

const rows = []
for (const b of MISSION_LIBRARY) {
  for (const x of b.missions) {
    if (x.icon) rows.push([x.title, x.icon])
  }
}

const lines = []
lines.push('-- 075a patch: 075 마이그레이션 이전에 라이브러리에서 추가된 미션의 icon_path 일회성 채우기.')
lines.push('-- 매칭 기준: title 정확 일치 + bundle_title IS NOT NULL (운영자 직접 생성 미션 보호)')
lines.push('--           + icon_path IS NULL (이미 채워진 row 건드리지 않음 — 멱등).')
lines.push('-- 적용 후 검증:')
lines.push("--   SELECT COUNT(*) FROM public.missions WHERE icon_path IS NOT NULL;")
lines.push('')
lines.push('UPDATE public.missions m')
lines.push('SET icon_path = lib.icon')
lines.push('FROM (VALUES')
rows.forEach(([t, i], idx) => {
  const safeTitle = t.replace(/'/g, "''")
  const sep = idx === rows.length - 1 ? '' : ','
  lines.push(`  ('${safeTitle}', '${i}')${sep}`)
})
lines.push(') AS lib(title, icon)')
lines.push('WHERE m.title = lib.title')
lines.push('  AND m.icon_path IS NULL')
lines.push('  AND m.bundle_title IS NOT NULL;')

mkdirSync('supabase/patches', { recursive: true })
writeFileSync('supabase/patches/075a_backfill_mission_icons.sql', lines.join('\n') + '\n')
console.log(`✓ ${rows.length} rows 매핑 → supabase/patches/075a_backfill_mission_icons.sql`)
