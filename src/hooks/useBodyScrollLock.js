import { useEffect } from 'react'

// body 스크롤 잠금 (iOS Safari 대응) — 모달/오버레이 열렸을 때 뒤 페이지 스크롤 차단.
//   iOS 는 body{overflow:hidden} 을 무시하고 터치 스크롤이 뒤로 샘 → position:fixed 기법.
//   전역 카운터로 여러 오버레이가 동시에 열려도(중첩) 한 번만 잠그고, 전부 닫힐 때 복원.
//   사용: useBodyScrollLock(isOpen)  — isOpen 이 true 인 동안 잠금.
let lockCount = 0
let savedScrollY = 0

function lockBody() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY
    const b = document.body
    b.style.overflow = 'hidden'
    b.style.position = 'fixed'
    b.style.top = `-${savedScrollY}px`
    b.style.left = '0'
    b.style.right = '0'
    b.style.width = '100%'
  }
  lockCount += 1
}

function unlockBody() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    const b = document.body
    b.style.overflow = ''
    b.style.position = ''
    b.style.top = ''
    b.style.left = ''
    b.style.right = ''
    b.style.width = ''
    window.scrollTo(0, savedScrollY)
  }
}

export function useBodyScrollLock(isOpen) {
  useEffect(() => {
    if (!isOpen) return
    lockBody()
    return unlockBody
  }, [isOpen])
}

export default useBodyScrollLock
