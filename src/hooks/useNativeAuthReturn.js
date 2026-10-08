import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { isNativeApp } from '../lib/installPrompt'

// 네이티브 «차가운 복귀» 처리기 (2026-10-08) — 소셜 로그인 딥링크가 앱을 «새로» 띄웠을 때.
//   카카오톡·크롬으로 갔다 오는 사이 앱 프로세스가 죽으면 nativeOAuth 의 waiter 는 사라지고,
//   딥링크는 getLaunchUrl(시작 URL) 또는 appUrlOpen 으로만 들어온다. 그대로 두면 아무 일도 안 생긴다 —
//   폰에서 「앱으로 돌아왔는데 로그인이 안 됨」으로 나타났던 그 구멍.
//   waiter 가 기다리는 중(따뜻한 복귀)이면 손대지 않는다(같은 code 를 두 번 쓰면 두 번째가 실패한다).
//   웹/PWA 에선 아무것도 하지 않는다. Capacitor 모듈도 네이티브에서만 불러온다(웹 번들 가볍게).
export function useNativeAuthReturn() {
  const navigate = useNavigate()
  const handledRef = useRef(new Set())   // 같은 URL 중복 처리 방지(getLaunchUrl + appUrlOpen 이 둘 다 올 수 있다)

  useEffect(() => {
    if (!isNativeApp()) return
    let handle
    let cancelled = false

    const consume = async (url) => {
      if (!url || handledRef.current.has(url)) return
      const { isNativeAuthUrl, isAwaitingNativeAuth, handleNativeAuthUrl } = await import('../lib/nativeOAuth')
      if (!isNativeAuthUrl(url) || isAwaitingNativeAuth()) return
      handledRef.current.add(url)
      try {
        await handleNativeAuthUrl(url)
        navigate('/', { replace: true })   // HomePage 가 닉네임 확인 뒤 대시보드/닉네임 설정으로
      } catch (e) {
        console.error('[useNativeAuthReturn] 소셜 로그인 마무리 실패:', e)
        alert(`로그인 실패: ${e?.message || e}`)
      }
    }

    ;(async () => {
      const { App } = await import('@capacitor/app')
      // 1) 이 딥링크로 «시작»된 경우
      try { const l = await App.getLaunchUrl(); if (!cancelled) await consume(l?.url) } catch { /* 없음 */ }
      // 2) 떠 있는 동안 들어온 경우(waiter 없이)
      handle = await App.addListener('appUrlOpen', ({ url }) => { consume(url) })
    })()

    return () => { cancelled = true; try { handle?.remove?.() } catch { /* 무시 */ } }
  }, [navigate])
}
