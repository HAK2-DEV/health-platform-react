import { supabase } from '../supabaseClient'

// 공유 signed URL 캐시 — 버킷/경로 단위로 서명 URL 을 모듈 전역에 캐시.
//   목적: 칩 전환·화면 재방문 시 같은 이미지의 서명 URL 을 매번 재요청하던 것을 제거.
//   - 모듈 전역 Map (컴포넌트 언마운트/리마운트 가로질러 유지)
//   - sessionStorage 워밍 (탭 새로고침 후에도 만료 전이면 재사용)
//   - 동시 요청 중복 제거 (같은 경로를 여러 컴포넌트가 동시에 요청해도 1회만)
//   서명 만료(1h)보다 짧게 캐시(50분)해 만료 직전 URL 사용을 피한다.

const EXPIRES_SEC = 60 * 60          // createSignedUrls 서명 유효기간 (1시간)
const TTL_MS = 50 * 60 * 1000        // 캐시 보관 (50분 — 만료 여유)
const SS_KEY = 'signedUrlCache:v1'

const mem = new Map()                // key: `${bucket}|${path}` → { url, exp }
const inflight = new Map()           // key → Promise<string|null> (동시요청 합치기)
let ssLoaded = false

function k(bucket, path) { return `${bucket}|${path}` }

// 썸네일 경로 규칙 — 원본 `dir/name.jpg` → `dir/name_thumb.jpg`.
//   업로드 시 이 경로에 400px 썸네일을 함께 저장하고, 목록은 이 경로를 우선 로드.
export function thumbPathOf(path) {
  if (!path) return path
  const dot = path.lastIndexOf('.')
  if (dot <= path.lastIndexOf('/')) return `${path}_thumb`  // 확장자 없음
  return `${path.slice(0, dot)}_thumb${path.slice(dot)}`
}

function loadSS() {
  if (ssLoaded) return
  ssLoaded = true
  try {
    const raw = sessionStorage.getItem(SS_KEY)
    if (!raw) return
    const obj = JSON.parse(raw)
    const now = Date.now()
    for (const [key, v] of Object.entries(obj)) {
      if (v && v.exp > now) mem.set(key, v)
    }
  } catch { /* sessionStorage 불가 환경 무시 */ }
}

let saveTimer = null
function saveSS() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      const now = Date.now()
      const obj = {}
      for (const [key, v] of mem.entries()) if (v.exp > now) obj[key] = v
      sessionStorage.setItem(SS_KEY, JSON.stringify(obj))
    } catch { /* 용량 초과 등 무시 */ }
  }, 300)
}

// 동기 캐시 조회 — 즉시 표시용(빈칸 방지). 반환: { [path]: url } (캐시된 것만)
export function getCachedSignedUrls(bucket, paths) {
  loadSS()
  const now = Date.now()
  const out = {}
  for (const p of paths) {
    if (!p) continue
    const hit = mem.get(k(bucket, p))
    if (hit && hit.exp > now) out[p] = hit.url
  }
  return out
}

// 캐시 우선 + 누락분만 배치 서명. 반환: { [path]: url }
export async function getSignedUrls(bucket, paths) {
  loadSS()
  const now = Date.now()
  const out = {}
  const missing = []
  for (const p of [...new Set(paths.filter(Boolean))]) {
    const hit = mem.get(k(bucket, p))
    if (hit && hit.exp > now) out[p] = hit.url
    else if (inflight.has(k(bucket, p))) { /* 진행 중 — 아래서 await */ }
    else missing.push(p)
  }

  // 진행 중인 요청들 합류
  const waits = []
  for (const p of [...new Set(paths.filter(Boolean))]) {
    if (out[p]) continue
    const pending = inflight.get(k(bucket, p))
    if (pending) waits.push(pending.then(url => { if (url) out[p] = url }))
  }

  // 누락분 1회 배치 서명
  if (missing.length) {
    const promise = supabase.storage.from(bucket).createSignedUrls(missing, EXPIRES_SEC)
      .then(({ data, error }) => {
        const exp = Date.now() + TTL_MS
        const byPath = {}
        if (!error) {
          for (const r of (data || [])) {
            if (r.path && r.signedUrl && !r.error) {
              mem.set(k(bucket, r.path), { url: r.signedUrl, exp })
              byPath[r.path] = r.signedUrl
            }
          }
          saveSS()
        }
        return byPath
      })
    // 각 경로별 inflight 등록 (동시 요청 합치기)
    for (const p of missing) {
      inflight.set(k(bucket, p), promise.then(byPath => byPath[p] || null))
    }
    const byPath = await promise
    for (const p of missing) {
      inflight.delete(k(bucket, p))
      if (byPath[p]) out[p] = byPath[p]
    }
  }

  if (waits.length) await Promise.all(waits)
  return out
}
