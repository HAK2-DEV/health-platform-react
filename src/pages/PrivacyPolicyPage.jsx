import StickyBackBar from '../components/common/StickyBackBar'
import { LegalPageShell, Section, Sub } from '../components/legal/LegalPageShell'

// 개인정보처리방침 — 한국 정보통신망법 / 개인정보보호법 기준 템플릿.
// ⚠️ 본인 후속 액션:
//   1) [본인 정보] / ds5acqsjh@naver.com 등 marker 본인 정보로 교체
//   2) 변호사·전문가 검토 권장 (사업자등록 시점에 정식 검토)
//   3) /privacy 라우트로 회원가입·푸터·프로필에 링크
//   4) 약관 변경 시 시행일자 변경 + 공지

function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-surface-app">
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-8">
        <StickyBackBar fallbackPath="/" title="뒤로" />
        <LegalPageShell
          title="🔐 개인정보처리방침"
          effectiveDate="2026년 6월 3일"
          version="v1.0 (초안 — 법률 검토 전)"
        >
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
            ⚠️ 본 문서는 베타 단계 템플릿입니다. 정식 서비스 출시 전 법률 전문가 검토 후
            본인 정보 및 사업자 정보를 실제 정보로 교체·검토해야 합니다.
          </p>

          <p className="leading-relaxed mb-5">
            「Health Platform」 (이하 "서비스") 은 이용자의 개인정보를 중요시하며,
            「개인정보 보호법」 및 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관련 법령을
            준수하고 있습니다. 본 방침은 서비스가 이용자의 개인정보를 어떻게 수집·이용·보관·파기하는지를 안내합니다.
          </p>

          <Section title="1. 처리 목적">
            <p>서비스는 다음 목적을 위해 개인정보를 처리합니다.</p>
            <Sub>
              <li>회원 식별 및 본인 확인, 회원 자격 유지·관리</li>
              <li>건강증진 프로그램 참여·인증 기록의 관리</li>
              <li>프로그램 운영자–참여자 간 활동 데이터(인증·점수·랭킹) 제공</li>
              <li>서비스 이용 통계, 부정 이용 방지, 사고 원인 분석</li>
              <li>고객 응대 및 분쟁 처리</li>
              <li>중요 공지사항 및 약관 변경 안내</li>
            </Sub>
          </Section>

          <Section title="2. 수집 항목">
            <p>(필수)</p>
            <Sub>
              <li>이메일 주소 (회원 식별·로그인용)</li>
              <li>비밀번호 (해시 저장 — 평문 보관 X)</li>
              <li>닉네임 (본인이 직접 설정)</li>
              <li>소셜 로그인 시: 제공자 식별자 (Kakao ID 등) + 제공자가 동의 후 전달한 정보(닉네임·프로필 사진)</li>
              <li>서비스 이용 중 본인이 등록한 인증 사진·기록·메모, 참여 프로그램·미션 내역</li>
            </Sub>
            <p className="mt-3">(자동 수집)</p>
            <Sub>
              <li>접속 로그, IP 주소, 쿠키, 기기·브라우저 정보 (서비스 안정성·통계 목적)</li>
              <li>오류 추적 도구(Sentry)를 통한 익명화된 에러 발생 정보</li>
            </Sub>
            <p className="text-xs text-gray-500 mt-3">
              {'⚠️ Kakao 일반 앱 단계에서는 이메일 권한이 제한되어 가상 이메일(kakao_{ID}@kakao.local)이 생성됩니다. 이는 외부에 전송되지 않으며 본 서비스 내부 식별자로만 사용됩니다.'}
            </p>
          </Section>

          <Section title="3. 보유·이용 기간">
            <Sub>
              <li>회원 정보: 회원 탈퇴 시까지 (탈퇴 시 즉시 파기)</li>
              <li>관계 법령에 따른 보존 의무 데이터(부정 이용 기록 등): 관련 법령에 정한 기간</li>
              <li>랭킹·점수 history 스냅샷: 서비스 운영 목적의 통계 보관 (개인 식별 불가능 형태로 가공 가능)</li>
            </Sub>
          </Section>

          <Section title="4. 제3자 제공">
            <p>
              서비스는 이용자의 별도 동의 없이는 개인정보를 외부에 제공하지 않습니다.
              단, 다음 경우 예외적으로 제공할 수 있습니다.
            </p>
            <Sub>
              <li>법령에 따른 수사기관의 요청이 있는 경우</li>
              <li>이용자가 사전에 동의한 경우</li>
            </Sub>
          </Section>

          <Section title="5. 처리 위탁">
            <p>서비스는 다음 업체에 처리를 위탁하고 있습니다.</p>
            <Sub>
              <li>Supabase (데이터베이스·인증·스토리지 호스팅) — 미국</li>
              <li>Vercel (정적 자원 호스팅·CDN) — 미국</li>
              <li>Sentry (에러 추적·진단) — 미국</li>
              <li>Kakao (소셜 로그인 시 제공자) — 한국</li>
            </Sub>
            <p className="text-xs text-gray-500 mt-2">
              위탁 업체에는 처리 목적에 필요한 최소한의 정보만 제공되며, 위탁 계약 종료 시
              해당 정보는 즉시 파기됩니다.
            </p>
          </Section>

          <Section title="6. 정보주체의 권리">
            <p>이용자는 언제든 다음 권리를 행사할 수 있습니다.</p>
            <Sub>
              <li>개인정보 열람·정정 요청 — 프로필 페이지에서 직접 수정</li>
              <li>회원 탈퇴 — 「프로필 &gt; 계정 설정 &gt; 회원 탈퇴」 메뉴에서 즉시 처리</li>
              <li>처리 정지·동의 철회 — ds5acqsjh@naver.com 로 요청</li>
            </Sub>
          </Section>

          <Section title="7. 파기 절차 및 방법">
            <p>
              회원 탈퇴 시 본인이 등록한 모든 데이터(계정·인증 기록·점수·랭킹·게시물·댓글·좋아요)는
              FK CASCADE 정책에 따라 데이터베이스에서 즉시 영구 삭제됩니다.
              일부 자동 백업본은 백업 정책에 따라 최대 7일 후 자동 삭제됩니다.
            </p>
          </Section>

          <Section title="8. 안전성 확보 조치">
            <Sub>
              <li>전송 구간 암호화 (HTTPS/TLS 1.3)</li>
              <li>비밀번호 해시 저장 (Supabase Auth bcrypt)</li>
              <li>접근 권한 분리 (RLS Row Level Security)</li>
              <li>관리자 인증 정보 별도 보관</li>
            </Sub>
          </Section>

          <Section title="9. 만 14세 미만 처리">
            <p>
              본 서비스는 만 14세 이상만 이용할 수 있습니다. 회원가입 시 만 14세 이상임을
              동의해야 가입이 가능하며, 만 14세 미만 사용자의 가입은 차단됩니다.
            </p>
          </Section>

          <Section title="10. 쿠키·로컬 저장소">
            <p>
              서비스는 로그인 상태 유지, 마지막 방문 페이지 기억 등을 위해 쿠키 및
              브라우저 로컬 저장소(LocalStorage / SessionStorage / IndexedDB) 를 사용합니다.
              브라우저 설정에서 쿠키 차단 시 일부 기능 사용이 제한될 수 있습니다.
            </p>
          </Section>

          <Section title="11. 개인정보 보호책임자">
            <Sub>
              <li>성명: 서종학</li>
              <li>연락처: ds5acqsjh@naver.com</li>
            </Sub>
          </Section>

          <Section title="12. 권익침해 구제 방법">
            <Sub>
              <li>개인정보보호위원회 (privacy.go.kr / 국번없이 182)</li>
              <li>개인정보 분쟁조정위원회 (kopico.go.kr / 1833-6972)</li>
              <li>대검찰청 사이버수사과 (spo.go.kr / 02-3480-3573)</li>
              <li>경찰청 사이버수사국 (cyberbureau.police.go.kr / 국번없이 182)</li>
            </Sub>
          </Section>

          <Section title="13. 정책 변경">
            <p>
              본 처리방침이 변경되는 경우 시행 7일 전 서비스 내 공지사항 또는 이메일로 안내합니다.
              중대한 변경 시 30일 전 안내합니다.
            </p>
          </Section>

          <p className="text-xs text-gray-500 mt-8 pt-4 border-t border-gray-200">
            본 방침은 2026년 6월 3일부터 시행됩니다.
          </p>
        </LegalPageShell>
      </div>
    </div>
  )
}

export default PrivacyPolicyPage
