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
      0.9
    )
  })
}
