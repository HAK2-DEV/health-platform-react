import { useEffect, useState } from 'react'
import { getLegacyKeyboardOpen, subscribeLegacyKeyboard } from '../lib/nativeKeyboard'

// 구형 안드로이드(네이티브 + 안드14 이하)에서 «고정 모달 안 입력칸에 키보드가 떠 있는가».
//   이 기기들은 키보드 «높이» 를 알 방법이 없어(visualViewport·플러그인 모두 무반응) 높이 대신
//   이 불리언만 쓴다 — 모달을 화면 위쪽에 붙여 어떤 키보드보다 위에 두는 용도. [[lib/nativeKeyboard]]
export function useLegacyKeyboardOpen() {
  const [open, setOpen] = useState(getLegacyKeyboardOpen)
  useEffect(() => subscribeLegacyKeyboard(setOpen), [])
  return open
}
