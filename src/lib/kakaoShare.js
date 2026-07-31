// 카카오톡 공유 (Kakao JS SDK).
//   JS 키는 도메인 제한 공개키라 클라이언트 노출 무방(빌드 번들에 어차피 포함됨).
//   콘솔 설정: 플랫폼 키 > JavaScript SDK 도메인 등록 + 제품 링크 관리 > 웹 도메인 등록 필요.
const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY || 'f0e507b8f3e9fa24b4eaf93544c7a045'
const SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'

let loadPromise = null

// SDK 로드 + init (1회). 반환: window.Kakao
export function loadKakao() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.Kakao?.isInitialized?.()) return Promise.resolve(window.Kakao)
  if (loadPromise) return loadPromise
  loadPromise = new Promise((resolve, reject) => {
    const finish = () => {
      try {
        if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_JS_KEY)
        resolve(window.Kakao)
      } catch (e) { reject(e) }
    }
    if (window.Kakao) return finish()
    const s = document.createElement('script')
    s.src = SDK_SRC
    s.async = true
    s.onload = finish
    s.onerror = () => { loadPromise = null; reject(new Error('Kakao SDK load failed')) }
    document.head.appendChild(s)
  })
  return loadPromise
}

// 초대 카드 공유 — feed 타입(이미지 + 제목 + 설명 + 「참여하기」 버튼).
//   실패 시 throw → 호출측이 공유 시트/복사로 폴백.
export async function shareInviteToKakao({ url, title, description, imageUrl }) {
  const Kakao = await loadKakao()
  Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: title || '프로그램 초대',
      description: description || '초대 링크로 프로그램에 참여해보세요!',
      imageUrl,
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: '참여하기', link: { mobileWebUrl: url, webUrl: url } }],
  })
}
