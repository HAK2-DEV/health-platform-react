import { useEffect } from 'react'
import { useKeyboardInset } from './useKeyboardInset'
import { useLegacyKeyboardOpen } from './useLegacyKeyboardOpen'

// 입력칸이 있는 «직접 만든 fixed 오버레이»(신고·댓글 상세·미션 만들기 등)용 키보드 대응.
//   공용 Modal 은 자체적으로 처리하므로 이 훅이 필요 없다. [[components/common/Modal]]
//
// 두 가지 환경을 한 번에 덮는다:
//   ① iOS·안드15+ : visualViewport 가 줄어드니 그 높이만큼 아래 여백 → 카드가 키보드 위로.
//   ② 안드14 이하(노트9) : 창이 안 줄고 visualViewport 도 무반응이라 높이를 알 수 없다(2026-09-16 실측).
//      대신 «키보드가 떴다» 는 사실만 받아 카드를 화면 위쪽에 붙이고 높이를 52vh 로 가둔다
//      — 어떤 키보드보다 위라 항상 보인다. Modal 과 같은 방식·같은 값.
//
// 사용:
//   const { overlayStyle, cardStyle } = useKeyboardOverlay()
//   <div className="fixed inset-0 flex items-center justify-center p-5" style={overlayStyle}>
//     <div className="max-h-[85vh] …" style={cardStyle}> … </div>
//
// ⚠️ 화면 하단에 «고정 바»를 붙이는 화면(MissionVerifyPage·QuizSolvePage 의 bottom: kbInset)에는 쓰지 말 것.
//    그쪽은 ①번 값만 필요하고, ②번을 적용하면 바가 화면 중앙으로 떠버린다.
export function useKeyboardOverlay(extra = 20) {
  const kbInset = useKeyboardInset()
  const legacyOpen = useLegacyKeyboardOpen()
  const lift = legacyOpen && !kbInset     // 구형: 높이를 모르니 «위쪽으로 올리기» 로 대체

  // ⚠️ 카드가 52vh 로 «접힌 뒤» 포커스된 입력칸을 카드 스크롤 영역 가운데로 직접 끌어온다.
  //    [[lib/nativeKeyboard]] 의 포커스 스크롤은 고정 컨테이너 안 입력칸을 건너뛴다(window 스크롤로는
  //    못 올리니 당연하다) → 카드 «안쪽» 은 아무도 스크롤해주지 않는다.
  //    공용 Modal 은 2026-09-16 에 같은 보정을 넣었는데 이 훅으로는 옮겨오지 않아,
  //    이 훅을 쓰는 오버레이 18곳에서 「입력칸이 버튼에 가림」이 남아 있었다(2026-09-17 노트9 제보).
  //    [[components/common/Modal]] 와 같은 타이밍(320ms — nativeKeyboard 의 300ms 올리기 직후).
  //
  //    ⚠️ 카드를 flex(스크롤영역 + flex-shrink-0 푸터)로 바꾸는 것만으로는 «해결되지 않았다».
  //       CheerModal 을 그 구조로 만든 빌드에서도 노트9 실기기는 그대로 가려졌고(22:49),
  //       이 줄을 넣은 빌드에서 비로소 분리됐다(23:13, uiautomator 실측 여유 116px).
  //       구조만으로 왜 부족했는지는 아직 설명하지 못한다 — 이 보정을 «구조 개선의 곁다리»로 보고
  //       걷어내지 말 것. 지우려면 노트9 실기기에서 다시 재보고 판단해야 한다.
  useEffect(() => {
    if (!lift) return
    const t = setTimeout(() => {
      const el = document.activeElement
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 320)
    return () => clearTimeout(t)
  }, [lift])

  return {
    lift,
    kbInset,   // 전체화면 오버레이 등 «여백만» 필요한 곳에서 그대로 쓸 수 있게 함께 돌려준다
    overlayStyle: {
      paddingBottom: kbInset ? kbInset + extra : undefined,
      transition: 'padding-bottom .2s ease',
      ...(lift ? { alignItems: 'flex-start', paddingTop: 8 } : null),
    },
    cardStyle: lift ? { maxHeight: '52vh' } : undefined,
  }
}
