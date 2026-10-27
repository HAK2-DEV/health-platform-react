import { Link } from 'react-router-dom'

// 걸음 데이터 사용 안내 — Google Play 건강 앱 정책의 «눈에 띄는 고지»(prominent disclosure). (2026-10-27 분리)
//   신체활동 권한 창을 띄우기 «직전»에 무엇을 읽고, 어디에 쓰고, 무엇을 남기는지 구체적으로 말한다.
//   쓰는 곳 두 군데: 걷기 프로그램 첫 방문 고지 시트(WalkingTodayCard) · 걸음 미션 화면(StepsVerify)의 disclose 단계.
//   개인정보처리방침 2조 「걸음 수」 항목과 같은 내용이어야 한다(문구를 바꾸면 양쪽 함께).
const ROWS = [
  { k: '읽는 것', v: '폰의 걸음 센서가 센 오늘 걸음. 앱이 직접 세요' },
  { k: '쓰는 곳', v: '이 프로그램의 걸음 미션 인증, 알림 한 줄의 「오늘 걸음」' },
  { k: '남기는 것', v: '날짜별 걸음은 폰 안에만(60일). 서버에는 인증한 날의 달성 걸음 수 하나가 인증 기록으로 남아 운영자가 다른 인증처럼 봐요. 광고에 쓰지 않고 밖에 주지 않아요' },
  { k: '끄기', v: '프로그램이 끝나면 자동으로 멈춰요. 설정 › 앱 권한 › 신체활동에서 끌 수도 있어요' },
]

export default function StepsDisclosure({ onPolicyClick }) {
  return (
    <div className="w-full text-left">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <img src="/icons/running/shoe.png" alt="" className="w-6 h-6 object-contain" />
        </span>
        <h2 className="text-base font-semibold text-gray-800">걸음 수를 이렇게 써요</h2>
      </div>
      <dl className="rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white text-xs">
        {ROWS.map((r) => (
          <div key={r.k} className="grid grid-cols-[64px_1fr] gap-2 px-3 py-2">
            <dt className="font-bold text-gray-500">{r.k}</dt>
            <dd className="text-gray-800 leading-relaxed break-keep">{r.v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-gray-500 leading-relaxed break-keep mt-2">
        다음 화면에서 「신체활동」 권한을 허용하면 걸음을 세기 시작해요. 자세한 내용은{' '}
        <Link to="/privacy" onClick={onPolicyClick} className="underline text-emerald-700">개인정보처리방침</Link> 2조에 있어요.
      </p>
    </div>
  )
}
