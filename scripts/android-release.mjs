// 릴리스 AAB/APK 한 번에: 웹 빌드 → cap sync → gradle bundleRelease+assembleRelease → 머지 매니페스트 권한 검증.
//   npm 스크립트에 `gradlew` 를 직접 쓰면 셸에 따라(Git Bash 는 ./gradlew, cmd 는 gradlew.bat) 조용히 실패한다 →
//   node 가 플랫폼별 실행 파일을 골라 순서대로 돌리고, 하나라도 실패하면 즉시 종료 코드 1.
//   사용: `npm run android:release`
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const isWin = process.platform === 'win32'
const root = process.cwd()
const run = (label, cmd, args, cwd = root) => {
  console.log(`\n▶ ${label}`)
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: isWin })
  if (r.status !== 0) { console.error(`\n❌ ${label} 실패 (exit ${r.status})`); process.exit(r.status || 1) }
}

run('웹 빌드', 'npm', ['run', 'build'])
run('cap sync android', 'npx', ['cap', 'sync', 'android'])
// 네이티브는 서비스워커를 쓰지 않는다 — 옛 버전이 남긴 서비스워커를 걷어낼 자기 삭제 sw.js 로 교체 (scripts/native-sw.mjs)
run('네이티브 sw.js 교체', 'node', ['scripts/native-sw.mjs'])
// ⚠️ 절대 경로로 — cmd.exe 는 spawn cwd 의 'gradlew.bat' 를 이름만으로는 못 찾는다(실측 2026-09-15).
const androidDir = path.join(root, 'android')
const gradlew = path.join(androidDir, isWin ? 'gradlew.bat' : 'gradlew')
run('gradle bundleRelease assembleRelease', isWin ? `"${gradlew}"` : gradlew, ['bundleRelease', 'assembleRelease'], androidDir)
run('머지 매니페스트 권한 검증', 'node', ['scripts/verify-manifest.mjs'])
console.log('\n✅ 완료 — android/app/build/outputs/bundle/release/app-release.aab')
