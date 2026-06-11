import { useEffect } from 'react'

// 전역 에러 바운더리 fallback.
//   배포로 청크 해시가 바뀌면 구버전 탭이 없어진 청크를 요청 →
//     · 404 → vite:preloadError (main.jsx 에서 처리)
//     · Vercel SPA fallback 이 index.html(text/html) 반환 → "not a valid JavaScript MIME type"
//       이건 preloadError 가 아니라 모듈 평가 에러로 바운더리까지 옴 → 여기서 자동 새로고침.
//   10초 가드로 새로고침 루프 방지. 청크 에러가 아니면 일반 오류 카드.
const CHUNK_ERROR_RE = /dynamically imported module|valid JavaScript MIME type|Importing a module script failed|Failed to fetch|Loading chunk|ChunkLoadError|error loading dynamically imported/i

function ErrorFallback({ error }) {
  const message = error?.message || ''
  const isChunkError = CHUNK_ERROR_RE.test(message)

  useEffect(() => {
    if (!isChunkError) return
    const KEY = 'chunk-error-reload-at'
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - last < 10_000) return // 직전에 이미 새로고침 → 루프 방지
    sessionStorage.setItem(KEY, String(Date.now()))
    window.location.reload()
  }, [isChunkError])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-app">
      <div className="max-w-sm bg-white rounded-2xl shadow-soft border border-gray-100 p-6 text-center">
        <div className="text-3xl mb-2">{isChunkError ? '✨' : '😢'}</div>
        <h1 className="text-base font-bold text-gray-800 mb-1">
          {isChunkError ? '새 버전을 불러오는 중이에요' : '앗, 문제가 발생했어요'}
        </h1>
        <p className="text-xs text-gray-500 mb-4 break-words">
          {isChunkError ? '잠시만 기다려주세요...' : (message || '예상치 못한 오류')}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-full transition"
        >
          새로고침
        </button>
      </div>
    </div>
  )
}

export default ErrorFallback
