import imageCompression from 'browser-image-compression'

// 이미지 압축 유틸 — 클라이언트에서 업로드 직전 호출.
// 본인 결정 (Day 65): Supabase Free 플랜 Egress 5GB/월 한도에서
// verification-images 가 가장 큰 비중 → 1MB 이하 + 1920px 리사이즈로 70-80% 절감.
//
// 사용:
//   const compressed = await compressImage(file)
//   await supabase.storage.from('verification-images').upload(path, compressed, { contentType: 'image/jpeg' })
//
// 주의:
//   - 압축 결과는 항상 image/jpeg (확장자/MIME 통일)
//   - SHA-256 중복 차단은 원본 파일로 계산해야 함 (압축 결과는 deterministic X)
//   - useWebWorker: 메인 스레드 차단 회피
//
// 옵션 override 가능 — 표지 등 더 큰 사이즈가 필요한 경우 maxWidthOrHeight 지정.
export async function compressImage(file, options = {}) {
  const defaultOptions = {
    maxSizeMB: 1,            // 1MB 이하로
    maxWidthOrHeight: 1920,  // 최대 1920px (Full HD)
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,    // 85% 화질 — 시각적 차이 거의 없음
  }

  try {
    const compressed = await imageCompression(file, { ...defaultOptions, ...options })
    return compressed
  } catch (err) {
    console.warn('[imageCompression] 실패 — 원본 업로드로 fallback', err)
    // 압축 실패해도 원본은 업로드 가능하도록 fallback
    return file
  }
}
