// 건강 관련 정보(민감정보) 별도 동의 — 개인정보 보호법 제23조.
//   가입 동의 4개(약관·개인정보·만14세·마케팅)에 없던 항목. 건강 정보를 «처음 입력하는 시점»에
//   1회 모달로 받아 users.agreed_health_at(마이그 261)에 기록한다.
//   ⚠️ 가입 폼 체크박스 방식은 금지 — 이미 가입한 회원은 그 폼을 다시 지나가지 않는다.
//   게이트 지점(4): 기분 체크 저장 · 설문 응답 제출 · 미션 «수치» 입력 제출 · 금연 프로그램 참여.
//   문구는 개인정보처리방침 2조 «건강 관련 정보(민감정보)» 항목과 «동일하게» 유지할 것.
import { supabase } from '../supabaseClient'

export const HEALTH_CONSENT_VERSION = '2026-09-22'   // 방침 v1.1 시행일. 항목이 바뀌면 갱신 + 재동의 정책 검토.

export const HEALTH_CONSENT = {
  title: '건강 정보 수집·이용 동의',
  intro: '이 기능을 쓰려면 건강 관련 정보(민감정보)를 저장해야 해요. 한 번만 동의하면 돼요.',
  rows: [
    { k: '수집 항목', v: '기분 체크 기록, 금연 시작일·연속 금연 일수, 프로그램 설문 응답, 미션 인증 시 직접 입력한 수치(체중 등)' },
    { k: '이용 목적', v: '프로그램 진행·인증 관리, 참여한 프로그램 운영자의 운영·집계' },
    { k: '보유 기간', v: '회원 탈퇴 시까지 (탈퇴 즉시 삭제)' },
    { k: '거부 시', v: '해당 기능만 이용할 수 없고, 나머지 서비스는 그대로 이용할 수 있어요' },
  ],
  note: '동의는 「계정 설정」 또는 00jonghak@gmail.com 으로 언제든 철회할 수 있어요.',
}

export const healthConsentKey = (userId) => ['health-consent', userId]

// 동의 여부 — users.agreed_health_at 이 있으면 true
export async function fetchHealthConsent(userId) {
  if (!userId) return false
  const { data, error } = await supabase
    .from('users')
    .select('agreed_health_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return !!data?.agreed_health_at
}

export async function grantHealthConsent(userId) {
  if (!userId) throw new Error('로그인이 필요해요')
  const { error } = await supabase
    .from('users')
    .update({ agreed_health_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw error
}
