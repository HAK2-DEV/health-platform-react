// 알림 센터 페이지 — Bottom Tab Bar 의 🔔 알림 탭 진입점
// 미래: notifications 테이블 + Realtime 구독 (TRD F-NOTI-010)
//   - 인증 승인/반려, 미션 리마인더, 랭킹 변동, 공지
function NotificationsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl text-gray-800 mb-4">🔔 알림</h1>
      <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 text-sm">
        알림 센터 (준비 중)
        <br />
        <span className="text-xs">인증 승인 · 미션 리마인더 · 랭킹 변동</span>
      </div>
    </div>
  )
}

export default NotificationsPage
