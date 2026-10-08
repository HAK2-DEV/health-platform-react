import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isNativeApp } from '../lib/installPrompt'

// 네이티브 «차가운 복귀» 처리기 (2026-10-08) — 소셜 로그인 딥링크가 앱을 «새로» 띄웠을 때.
//   카카오톡·크롬으로 갔다 오는 사이 앱 프로세스가 죽으면 nativeOAuth 의 waiter 는 사라지고,
//   딥링크는 getLaunchUrl(시작 URL) 또는 appUrlOpen 으로만 들어온다. 그대로 두면 아무 일도 안 생긴다 —
//   폰에서 「앱으로 돌아왔는데 로그인이 안 됨」으로 나타났던 그 구멍.
//   waiter 가 기다리는 중(따뜻한 복귀)이면 손대지 않는다(같은 code 를 두 번 쓰면 두 번째가 실패한다).
//   웹/PWA 에선 아무것도 하지 않는다. Capacitor 모듈도 네이티브에서만 불러온다(웹 번들 가볍게).
//
// ⚠️ 중복 전달 — Android 는 같은 딥링크를 두 번 준다(getLaunchUrl + appUrlOpen, onNewIntent 재전달).
//   판정·표시는 모듈을 «미리» 불러 둔 뒤 동기적으로 한다. 처음엔 await import 뒤에 표시했더니 두 호출이
//   나란히 통과해 두 번째가 「보안 검증 실패」를 띄웠다(2026-10-09 폰 재현). 집합은 nativeOAuth 와 공유.
export function useNativeAuthReturn() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isNativeApp()) return
    let handle
    let cancelled = false

    ;(async () => {
      const [{ App }, mod] = await Promise.all([import('@capacitor/app'), import('../lib/nativeOAuth')])
      if (cancelled) return

      // 동기 구간 — 여기서 걸러내고 표시까지 끝낸 뒤에만 await 로 넘어간다
      const consume = (url) => {
        if (!url || !mod.isNativeAuthUrl(url)) return
        if (mod.isAwaitingNativeAuth() || mod.isNativeAuthUrlHandled(url)) return
        mod.markNativeAuthUrlHandled(url)
        mod.handleNativeAuthUrl(url)
          .then(() => navigate('/', { replace: true }))   // HomePage 가 닉네임 확인 뒤 대시보드/닉네임 설정으로
          .catch((e) => {
            console.error('[useNativeAuthReturn] 소셜 로그인 마무리 실패:', e)
            alert(`로그인 실패: ${e?.message || e}`)
          })
      }

      // 1) 이 딥링크로 «시작»된 경우
      try { const l = await App.getLaunchUrl(); if (!cancelled) consume(l?.url) } catch { /* 없음 */ }
      // 2) 떠 있는 동안 들어온 경우(waiter 없이)
      handle = await App.addListener('appUrlOpen', ({ url }) => { consume(url) })
    })()

    return () => { cancelled = true; try { handle?.remove?.() } catch { /* 무시 */ } }
  }, [navigate])
}
