import StickyBackBar from '../components/common/StickyBackBar'
import { LegalPageShell, Section, Sub } from '../components/legal/LegalPageShell'

// 이용약관 — 한국 표준 약관 구조 기반 템플릿.
// ⚠️ 본인 후속: (개인) / ds5acqsjh@naver.com 등 자리 표시자 교체 + 법률 전문가 검토.

function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-surface-app">
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-8">
        <StickyBackBar fallbackPath="/" title="뒤로" />
        <LegalPageShell
          title="📜 이용약관"
          effectiveDate="2026년 6월 3일"
          version="v1.0 (초안 — 법률 검토 전)"
        >
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
            ⚠️ 본 문서는 베타 단계 템플릿입니다. 정식 서비스 출시 전 법률 전문가 검토 후
            (개인) / 서종학 / 밀양 내일중앙길 2-3 등 자리 표시자를 실제 정보로 교체해야 합니다.
          </p>

          <Section title="제1조 (목적)">
            <p>
              본 약관은 「Health Platform」(이하 "서비스")이 제공하는 건강증진 프로그램 운영·참여
              서비스의 이용 조건과 절차, 회원과 회사의 권리·의무·책임 사항 등 기본적인 사항을
              규정함을 목적으로 합니다.
            </p>
          </Section>

          <Section title="제2조 (용어의 정의)">
            <Sub>
              <li><b>회원</b>: 본 약관에 동의하고 서비스에 가입한 자</li>
              <li><b>운영자</b>: 회원 중 프로그램을 생성하고 다른 회원의 참여를 받아 운영하는 자</li>
              <li><b>참여자</b>: 회원 중 다른 회원이 운영하는 프로그램에 가입하여 활동하는 자</li>
              <li><b>프로그램</b>: 운영자가 등록한 일정 기간의 건강증진 활동 묶음</li>
              <li><b>미션</b>: 프로그램 내 일별·주별 수행할 구체적 활동 단위</li>
              <li><b>인증</b>: 참여자가 미션 수행 결과를 사진/메모 등으로 등록하는 행위</li>
            </Sub>
          </Section>

          <Section title="제3조 (약관의 효력과 변경)">
            <Sub>
              <li>본 약관은 회원가입 시 동의를 통해 효력이 발생합니다.</li>
              <li>회사는 관련 법령에 위배되지 않는 범위에서 본 약관을 변경할 수 있으며, 변경 시 시행 7일 전 공지합니다. 단, 회원에게 불리한 변경은 30일 전 공지합니다.</li>
              <li>회원이 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
            </Sub>
          </Section>

          <Section title="제4조 (회원가입)">
            <Sub>
              <li>회원가입은 서비스가 제공하는 방식(이메일/소셜 로그인)으로 신청합니다.</li>
              <li>회원은 본인의 진실된 정보를 제공해야 하며, 타인의 정보 도용은 금지됩니다.</li>
              <li>만 14세 미만은 회원가입이 불가능합니다.</li>
              <li>다음 경우 가입이 거절·취소될 수 있습니다.
                <ul className="list-circle list-inside pl-3 mt-1 space-y-0.5">
                  <li>허위 정보 기재</li>
                  <li>타인 명의 도용</li>
                  <li>과거 본 서비스에서 이용 제한 조치를 받은 경우</li>
                </ul>
              </li>
            </Sub>
          </Section>

          <Section title="제5조 (서비스의 제공·변경)">
            <Sub>
              <li>서비스는 연중무휴, 1일 24시간 제공함을 원칙으로 합니다. 단, 정기·임시 점검 시 일시 중단될 수 있습니다.</li>
              <li>회사는 운영상·기술상 필요에 따라 서비스 일부 또는 전부를 변경·중단할 수 있습니다.</li>
              <li>중대한 변경 시 사전 공지하며, 부득이한 경우 사후 공지할 수 있습니다.</li>
            </Sub>
          </Section>

          <Section title="제6조 (회원의 의무)">
            <Sub>
              <li>회원은 본 약관 및 관계 법령을 준수해야 합니다.</li>
              <li>다음 행위는 금지됩니다.
                <ul className="list-circle list-inside pl-3 mt-1 space-y-0.5">
                  <li>타인의 명예를 훼손하거나 모욕하는 행위</li>
                  <li>음란물 · 폭력적 콘텐츠 게시</li>
                  <li>저작권 침해</li>
                  <li>거짓 인증·기록 등록</li>
                  <li>서비스 운영을 방해하는 행위(자동화 도구 사용 등)</li>
                  <li>타인 계정 부정 사용</li>
                </ul>
              </li>
              <li>위반 시 게시물 삭제, 일시·영구 이용 정지, 법적 조치가 취해질 수 있습니다.</li>
            </Sub>
          </Section>

          <Section title="제7조 (게시물의 관리)">
            <Sub>
              <li>회원이 등록한 인증 사진·메모·댓글 등의 저작권은 회원에게 있습니다.</li>
              <li>회원은 서비스 운영을 위해 회사가 해당 콘텐츠를 무상으로 이용·복제·전시할 수 있는 권리를 부여합니다 (단, 이는 서비스 운영 목적에 한합니다).</li>
              <li>본 약관 위반 콘텐츠는 사전 통지 없이 삭제될 수 있습니다.</li>
            </Sub>
          </Section>

          <Section title="제8조 (회원 탈퇴)">
            <Sub>
              <li>회원은 언제든 「프로필 &gt; 계정 설정 &gt; 회원 탈퇴」 메뉴에서 탈퇴할 수 있습니다.</li>
              <li>탈퇴 즉시 회원이 등록한 모든 데이터(인증·점수·게시물·랭킹 등)는 영구 삭제되며, 복구할 수 없습니다.</li>
              <li>운영자가 탈퇴할 경우 그 운영자가 만든 프로그램의 참여자 데이터에 영향이 있을 수 있으므로 사전에 다른 운영자에게 양도하거나 프로그램을 종료할 것을 권장합니다.</li>
            </Sub>
          </Section>

          <Section title="제9조 (운영자의 책임)">
            <Sub>
              <li>운영자는 자신이 만든 프로그램의 운영·심사·참여자 응대에 대한 책임을 집니다.</li>
              <li>운영자는 참여자 개인정보를 프로그램 운영 목적 외 사용해서는 안 됩니다.</li>
              <li>운영자가 본 약관을 위반하는 경우 프로그램이 비공개 처리되거나 삭제될 수 있습니다.</li>
            </Sub>
          </Section>

          <Section title="제10조 (회사의 책임의 한계)">
            <Sub>
              <li>회사는 천재지변·전쟁·기간통신사업자 장애 등 불가항력 사유로 인한 서비스 중단에 대해 책임지지 않습니다.</li>
              <li>회사는 회원 간 발생한 분쟁(예: 운영자–참여자 간 분쟁)에 직접 개입하지 않으며, 단순한 중개자 역할만 수행합니다.</li>
              <li>본 서비스는 의료 행위가 아닌 건강 관리 보조 도구이며, 의학적 조언을 대체하지 않습니다.</li>
            </Sub>
          </Section>

          <Section title="제11조 (광고 및 마케팅)">
            <p>
              회사는 회원이 동의한 경우에 한해 이메일·앱 알림 등으로 서비스 관련 정보 및 광고를
              제공할 수 있습니다. 회원은 「알림 설정」 메뉴에서 수신 여부를 변경할 수 있습니다.
            </p>
          </Section>

          <Section title="제12조 (분쟁 해결)">
            <Sub>
              <li>본 약관과 관련하여 발생한 분쟁은 대한민국 법률을 준거법으로 합니다.</li>
              <li>회사와 회원 간 발생한 분쟁의 관할 법원은 민사소송법상의 관할 법원으로 합니다.</li>
            </Sub>
          </Section>

          <p className="text-xs text-gray-500 mt-8 pt-4 border-t border-gray-200">
            본 약관은 2026년 6월 3일부터 시행됩니다.<br/>
            문의: ds5acqsjh@naver.com
          </p>
        </LegalPageShell>
      </div>
    </div>
  )
}

export default TermsOfServicePage
