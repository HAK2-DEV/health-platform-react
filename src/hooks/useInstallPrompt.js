import { useEffect, useState } from 'react'
import { getInstallState, subscribeInstall } from '../lib/installPrompt'

// 전역 설치 상태(beforeinstallprompt 보관/설치완료)를 React 로 구독.
export function useInstallPrompt() {
  const [state, setState] = useState(getInstallState())
  useEffect(() => subscribeInstall(() => setState({ ...getInstallState() })), [])
  return state // { deferredPrompt, installed }
}
