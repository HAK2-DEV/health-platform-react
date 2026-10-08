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
// ⚠️ cap sync 는 복사에 실패해도(EBUSY — 누가 assets/public 안에 cwd 를 두고 있으면 rmdir 이 막힌다) 0 으로 끝난다.
//   그대로 두면 «옛 웹 자산이 든 새 versionCode AAB» 가 조용히 만들어진다(2026-10-08 실제로 겪음: v51 첫 빌드에 13:21 번들).
//   → dist 와 assets/public 의 index.html 이 바이트 단위로 같아야 다음으로 간다.
{
  const fs = await import('node:fs')
  const a = fs.readFileSync(path.join(root, 'dist', 'index.html'))
  const b = fs.readFileSync(path.join(root, 'android', 'app', 'src', 'main', 'assets', 'public', 'index.html'))
  if (!a.equals(b)) {
    // cap sync 는 폴더 «자체»를 지웠다 다시 만든다. 누가 그 폴더를 cwd 로 잡고 있으면(터미널·탐색기) 루트 rmdir 만 막히고
    //   안의 파일 쓰기·하위 폴더 삭제는 된다(2026-10-08 진단) → 폴더는 두고 «내용물만» 비우고 dist 를 복사한다.
    console.warn('⚠️ cap sync 가 웹 자산을 복사하지 못했습니다(assets/public 잠김) → 폴더를 지우지 않는 미러 복사로 대신합니다.')
    const dst = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'public')
    for (const n of fs.readdirSync(dst)) fs.rmSync(path.join(dst, n), { recursive: true, force: true })
    fs.cpSync(path.join(root, 'dist'), dst, { recursive: true })
    const b2 = fs.readFileSync(path.join(dst, 'index.html'))
    if (!a.equals(b2)) {
      console.error('❌ 미러 복사도 실패 — assets/public/index.html 이 dist 와 다릅니다. 폴더를 잡은 프로세스를 닫고 다시 실행하세요.')
      process.exit(1)
    }
  }
  console.log('✅ 웹 자산 복사 확인 (dist == assets/public)')
}
// 네이티브는 서비스워커를 쓰지 않는다 — 옛 버전이 남긴 서비스워커를 걷어낼 자기 삭제 sw.js 로 교체 (scripts/native-sw.mjs)
run('네이티브 sw.js 교체', 'node', ['scripts/native-sw.mjs'])
// ⚠️ 절대 경로로 — cmd.exe 는 spawn cwd 의 'gradlew.bat' 를 이름만으로는 못 찾는다(실측 2026-09-15).
const androidDir = path.join(root, 'android')
const gradlew = path.join(androidDir, isWin ? 'gradlew.bat' : 'gradlew')
run('gradle bundleRelease assembleRelease', isWin ? `"${gradlew}"` : gradlew, ['bundleRelease', 'assembleRelease'], androidDir)
run('머지 매니페스트 권한 검증', 'node', ['scripts/verify-manifest.mjs'])
console.log('\n✅ 완료 — android/app/build/outputs/bundle/release/app-release.aab')
