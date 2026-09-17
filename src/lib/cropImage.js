// react-easy-crop 의 croppedAreaPixels 를 받아 지정 크기 JPEG Blob 으로 출력.
// 원본 이미지에서 crop 영역만 잘라 출력 캔버스에 그려 다운스케일.
//   아바타: 512x512 (정사각형) / 표지: 1200x675 (16:9) 등

// ⚠️ 무한 대기 차단 (2026-09-17 「저장하면 업로드가 안돼」 제보 — 「저장 중…」에서 스피너만 돌고 멈춤).
//   원래 이 Promise 는 load·error 둘 중 하나가 와야만 끝났다. 그런데 메모리가 빠듯한 기기에서 크롬이
//   이미지 디코딩을 지연시키면 «둘 다 오지 않고», Promise 가 영원히 미해결로 남는다.
//   → getCroppedImg 의 await 가 끝나지 않아 handleSave 가 setProcessing(true) 인 채 굳고,
//     예외가 아니라 «대기» 라 catch 에도 안 걸려 오류 문구조차 뜨지 않는다(제보 화면 그대로).
//   타임아웃을 걸면 (1) 멈춤이 사라지고 (2) reject 가 되므로 아래 createImage 의 fetch+ImageBitmap
//   폴백이 «비로소 동작한다» — 지금은 첫 시도가 멈추면 폴백까지 영영 못 간다.
const LOAD_TIMEOUT_MS = 12_000

const loadImage = (url, useCors) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    let settled = false
    const finish = (fn, arg) => { if (settled) return; settled = true; clearTimeout(timer); fn(arg) }
    const timer = setTimeout(() => finish(reject, new Error('image-timeout')), LOAD_TIMEOUT_MS)
    image.addEventListener('load', () => finish(resolve, image))
    image.addEventListener('error', () => finish(reject, new Error('image-load')))
    if (useCors) image.setAttribute('crossOrigin', 'anonymous') // 원격 표지 재조정 시 canvas 오염 방지
    image.src = url
  })

// 캔버스에 그릴 원본 확보 — 실패해도 한 번 더 다른 길로.
//   배경(2026-09-15 S20+ 제보): 편집 창엔 사진이 보이는데 저장 시 «다시 불러오기» 가 메시지 없는 error 이벤트로
//   실패 → 화면엔 기본 문구 "이미지 처리에 실패했어요" 만 떠 원인을 알 수 없었다.
//   ① Image 로드 → ② 실패 시 데이터를 직접 받아 ImageBitmap 으로 → ③ 그래도 실패면 원인 코드를 문구에 담는다.
const createImage = async (url) => {
  const remote = /^https?:/i.test(url)
  try {
    return await loadImage(url, remote)
  } catch (first) {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      if (typeof createImageBitmap === 'function') return await createImageBitmap(blob)
      const objectUrl = URL.createObjectURL(blob)
      try { return await loadImage(objectUrl, false) } finally { setTimeout(() => URL.revokeObjectURL(objectUrl), 0) }
    } catch (second) {
      const code = [first?.message, second?.name || second?.message].filter(Boolean).join('/')
      throw new Error(`사진을 다시 불러오지 못했어요. 다른 사진으로 시도해주세요 [${code}]`, { cause: second })
    }
  }
}

// imageSrc: 원본 dataURL/objectURL
// croppedAreaPixels: { x, y, width, height } (react-easy-crop onCropComplete 두 번째 인자)
// outputWidth/outputHeight: 출력 크기 (기본 512x512)
// 반환: JPEG Blob
// 원본 보관용 — 최장변 maxDim 이하로 다운스케일 + JPEG 압축. 원본을 저장하되 용량은 줄임.
//   반환: JPEG Blob (실패 시 throw)
export async function compressImage(file, maxDim = 1600, quality = 0.82) {
  const url = URL.createObjectURL(file)
  try {
    const image = await createImage(url)
    const scale = Math.min(1, maxDim / Math.max(image.width, image.height))
    const w = Math.max(1, Math.round(image.width * scale))
    const h = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(image, 0, 0, w, h)
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('이미지 압축에 실패했어요')), 'image/jpeg', quality)
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function getCroppedImg(imageSrc, croppedAreaPixels, outputWidth = 512, outputHeight = 512) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const ctx = canvas.getContext('2d')

  // 흰 배경 (투명 PNG 를 JPEG 로 변환 시 검은 배경 방지)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, outputWidth, outputHeight)

  // crop 영역을 출력 크기로 그림
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outputWidth,
    outputHeight
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('이미지 변환에 실패했어요'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      // JPEG 품질 — 0.9 → 0.85 (2026-08-28 본인 결정).
      //   커버·표지·인증 사진 등 크롭을 거치는 모든 이미지에 적용된다.
      //   장당 20%쯤 가벼워지는데 육안 차이는 사실상 없다(0.8 아래로 내리면 매끈한 면에 얼룩이 보인다).
      0.85
    )
  })
}
