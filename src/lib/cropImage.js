// react-easy-crop 의 croppedAreaPixels 를 받아 지정 크기 JPEG Blob 으로 출력.
// 원본 이미지에서 crop 영역만 잘라 출력 캔버스에 그려 다운스케일.
//   아바타: 512x512 (정사각형) / 표지: 1200x675 (16:9) 등

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (err) => reject(err))
    image.setAttribute('crossOrigin', 'anonymous') // canvas 오염 방지
    image.src = url
  })

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
