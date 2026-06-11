import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../supabaseClient'

// Google Identity Services(GIS) 인페이지 로그인 버튼.
//
// 왜 이걸 쓰나:
//   기존 supabase.auth.signInWithOAuth({provider:'google'}) 는 accounts.google.com 으로
//   top-level 리다이렉트 → iOS 홈화면 PWA(standalone) 가 깨지고 인앱 브라우저(크롬 바)에 갇힘.
//   GIS renderButton 은 iframe 오버레이로 ID 토큰을 받아오므로 페이지 이동이 없다.
//   → standalone 유지, 크롬 바 안 생김. 받은 ID 토큰으로 signInWithIdToken 로그인.
//
// nonce: 리플레이 방지. 원본 nonce 를 SHA-256 해시해 GIS 에 넘기고(=ID 토큰에 박힘),
//   원본은 signInWithIdToken 에 넘겨 Supabase 가 해시 비교 검증.
//
// 필요 설정:
//   - .env: VITE_GOOGLE_CLIENT_ID (Google Cloud Console 의 "웹 애플리케이션" OAuth 클라이언트 ID)
//   - Google Console > 승인된 JavaScript 원본에 배포 도메인 + localhost 추가
//   - Supabase Auth > Google provider 의 허용 client ID 에 위 ID 포함

const GIS_SRC = 'https://accounts.google.com/gsi/client'

// GIS 스크립트 1회 로드
function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', reject)
      return
    }
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = reject
    document.head.appendChild(s)
  })
}

const toHex = (buf) =>
  Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return toHex(buf)
}

function randomNonce() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return toHex(arr.buffer)
}

function GoogleSignInButton({ clientId }) {
  const ref = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const rawNonce = randomNonce()
        const hashedNonce = await sha256Hex(rawNonce)
        await loadGis()
        if (cancelled || !ref.current || !window.google?.accounts?.id) return

        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce: hashedNonce,
          callback: async (response) => {
            const { error: signErr } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: response.credential,
              nonce: rawNonce,
            })
            if (signErr) {
              console.error('Google 로그인 실패:', signErr)
              setError(`Google 로그인 실패: ${signErr.message}`)
            }
            // 성공 시 onAuthStateChange 가 세션 반영 → 로그인/회원가입 페이지가 자동 이동
          },
        })

        // 다른 소셜 버튼과 폭 맞춤 — 컨테이너 폭(최대 400) 사용
        const width = Math.min(400, Math.max(240, ref.current.clientWidth || 320))
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
          locale: 'ko',
          width,
        })
      } catch (e) {
        console.error('GIS 초기화 실패:', e)
        if (!cancelled) setError('Google 로그인 초기화에 실패했어요')
      }
    }

    init()
    return () => { cancelled = true }
  }, [clientId])

  return (
    <div className="w-full">
      <div ref={ref} className="flex justify-center" />
      {error && <p className="mt-1 text-[11px] text-red-600 text-center">{error}</p>}
    </div>
  )
}

export default GoogleSignInButton
