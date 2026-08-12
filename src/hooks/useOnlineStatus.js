import { useEffect, useState } from 'react'

// 네트워크 온라인/오프라인 상태 추적.
//   navigator.onLine 은 "네트워크 인터페이스 연결" 수준이라 완벽하진 않지만
//   (연결돼 있어도 인터넷이 안 될 수 있음) 오프라인 배너 용도로는 충분.
//   실제 요청 실패/재시도는 React Query 가 별도로 처리한다.
export function useOnlineStatus() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
