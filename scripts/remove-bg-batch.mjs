// remove.bg API 일괄 누끼 처리 — public/mission-icons 하위 모든 .png 원본 덮어쓰기.
// 사용: REMOVEBG_API_KEY=xxx node scripts/remove-bg-batch.mjs
//   또는 .env.local 에 REMOVEBG_API_KEY=xxx 작성 (자동 로딩).
//
// 안전:
// - 원본 백업은 public/mission-icons.bak 에 별도 보관 (이 스크립트는 만들지 않음).
// - API 호출 실패 시 해당 파일은 건너뜀 (원본 보존).
// - 처리 후 출력 PNG 가 비정상적으로 작으면 (1KB 미만) 실패 처리 후 원본 유지.

import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// .env.local 로컬 로딩 (간단 파서, dotenv 의존성 없이)
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/i)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const API_KEY = process.env.REMOVEBG_API_KEY
if (!API_KEY) {
  console.error('✗ REMOVEBG_API_KEY 환경변수 미설정. .env.local 또는 inline 으로 전달하세요.')
  process.exit(1)
}

const ROOT = 'public/mission-icons'
const MIN_OK_BYTES = 1024  // 1KB 미만이면 실패로 간주

async function listPngs(dir) {
  const result = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) result.push(...(await listPngs(full)))
    else if (e.isFile() && e.name.toLowerCase().endsWith('.png')) result.push(full)
  }
  return result
}

async function removeBg(path) {
  const buf = await readFile(path)
  const form = new FormData()
  form.append('image_file', new Blob([buf], { type: 'image/png' }), path.split(/[\\/]/).pop())
  form.append('size', 'auto')

  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': API_KEY },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  const out = Buffer.from(await res.arrayBuffer())
  if (out.length < MIN_OK_BYTES) {
    throw new Error(`응답이 너무 작음 (${out.length} bytes) — 의심스러움`)
  }
  return out
}

const files = (await listPngs(ROOT)).sort()
console.log(`📂 ${files.length} 파일 발견. 처리 시작...\n`)

let ok = 0, fail = 0
const failures = []

for (let i = 0; i < files.length; i++) {
  const path = files[i]
  const rel = path.replace(/\\/g, '/').replace(`${ROOT}/`, '')
  const prefix = `[${String(i + 1).padStart(2, '0')}/${files.length}]`
  try {
    const before = (await stat(path)).size
    const out = await removeBg(path)
    await writeFile(path, out)
    console.log(`${prefix} ✓ ${rel}  (${(before / 1024).toFixed(1)}KB → ${(out.length / 1024).toFixed(1)}KB)`)
    ok++
  } catch (e) {
    console.log(`${prefix} ✗ ${rel}  — ${e.message}`)
    failures.push({ path: rel, error: e.message })
    fail++
  }
  // API rate limit 보호 — 짧은 간격 (remove.bg 는 명시적 제한 없으나 안전 차원)
  if (i < files.length - 1) await new Promise(r => setTimeout(r, 250))
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`✓ 성공: ${ok}`)
console.log(`✗ 실패: ${fail}`)
if (failures.length) {
  console.log(`\n실패 목록:`)
  for (const f of failures) console.log(`  - ${f.path}: ${f.error}`)
  console.log(`\n실패한 파일은 원본 유지됨. 백업: public/mission-icons.bak/`)
}
