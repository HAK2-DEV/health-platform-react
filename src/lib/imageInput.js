// 사진 입력 전처리 — 파일 선택 직후 한 번 거쳐 「브라우저가 열 수 있는 이미지」로 만든다.
//
// 배경 (2026-09-15, 「탄탄 챌린지」 제보):
//   안드로이드 WebView·크롬·삼성 인터넷은 HEIC/HEIF 를 디코딩하지 못한다. 삼성 카메라 「고효율 사진」
//   설정이나 아이폰에서 받은 사진이 HEIC 인데, MIME 이 image/heic 라 `type.startsWith('image/')`
//   검사는 통과하고 크롭 모달에서 검은 화면 + "이미지 처리에 실패했어요" 로 죽었다.
//   반대로 일부 안드로이드 선택기는 멀쩡한 JPG 를 MIME 없이(type='') 넘겨 "이미지 파일만" 으로 거부됐다.
//
// 하는 일:
//   1) HEIC/HEIF 판정(MIME·확장자·매직바이트) → heic2any 를 필요할 때만 내려받아 JPEG 로 변환
//   2) 그 외는 실제 디코딩을 시험(createImageBitmap → Image 폴백). 못 열면 명확한 문구로 거부
//   3) MIME 이 비어 있어도 디코딩되면 매직바이트로 타입을 붙여 File 로 돌려준다
//
// 사용:
//   try { const file = await prepareImageFile(rawFile, { onConverting: setBusy }) } catch (e) { setError(e.message) }
//
// 주의: 변환은 수 초 걸릴 수 있어 onConverting(true/false) 로 로딩 표시를 주자.

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']

export const HEIC_HELP_MESSAGE =
  'HEIC 사진은 변환하지 못했어요. 카메라 설정에서 「고효율 사진」을 끄거나, 갤러리에서 JPG로 저장한 뒤 다시 올려주세요.'
export const UNDECODABLE_MESSAGE = '이 사진은 열 수 없는 형식이에요. JPG 또는 PNG 사진으로 다시 올려주세요.'
export const NOT_IMAGE_MESSAGE = '이미지 파일만 올릴 수 있어요'

async function readHead(file, n = 16) {
  try {
    const buf = await file.slice(0, n).arrayBuffer()
    return new Uint8Array(buf)
  } catch {
    return new Uint8Array(0)
  }
}

// 매직바이트로 타입 추정 — MIME 이 비어 있을 때만 쓴다.
function sniffType(head) {
  if (head.length < 12) return null
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg'
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image/png'
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return 'image/gif'
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) return 'image/webp'
  return null
}

function ftypBrand(head) {
  if (head.length < 12) return null
  if (head[4] !== 0x66 || head[5] !== 0x74 || head[6] !== 0x79 || head[7] !== 0x70) return null   // 'ftyp'
  return String.fromCharCode(head[8], head[9], head[10], head[11]).toLowerCase()
}

export async function isHeicFile(file) {
  const type = (file.type || '').toLowerCase()
  if (type === 'image/heic' || type === 'image/heif' || type === 'image/heic-sequence' || type === 'image/heif-sequence') return true
  if (/\.(heic|heif)$/i.test(file.name || '')) return true
  const brand = ftypBrand(await readHead(file))
  return !!brand && HEIC_BRANDS.includes(brand)
}

// 실제 디코딩 시험 — 브라우저가 못 여는 파일이면 false.
export async function canDecodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file)
      bmp.close?.()
      return true
    } catch {
      // createImageBitmap 이 지원 안 하는 형식(일부 브라우저의 SVG 등)은 Image 로 한 번 더
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img.naturalWidth > 0)
      img.onerror = () => resolve(false)
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function convertHeic(file, onConverting) {
  onConverting?.(true)
  try {
    const { default: heic2any } = await import('heic2any')   // 1MB 대 — 필요할 때만 청크 로드
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
    const blob = Array.isArray(out) ? out[0] : out
    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified || Date.now() })
  } catch (err) {
    console.warn('[imageInput] HEIC 변환 실패', err)
    throw new Error(HEIC_HELP_MESSAGE, { cause: err })
  } finally {
    onConverting?.(false)
  }
}

// 선택된 파일 → 브라우저가 열 수 있는 이미지 File. 아니면 사용자용 문구로 throw.
export async function prepareImageFile(file, { onConverting } = {}) {
  if (!file) throw new Error(NOT_IMAGE_MESSAGE)
  const type = (file.type || '').toLowerCase()

  if (await isHeicFile(file)) return convertHeic(file, onConverting)

  // MIME 이 이미지가 아니면서 매직바이트도 이미지가 아니면 거부
  const head = await readHead(file)
  const sniffed = sniffType(head)
  if (!type.startsWith('image/') && !sniffed) throw new Error(NOT_IMAGE_MESSAGE)

  if (!(await canDecodeImage(file))) throw new Error(UNDECODABLE_MESSAGE)

  // MIME 없는 멀쩡한 이미지(일부 안드로이드 선택기) → 타입 붙여서 반환
  if (!type.startsWith('image/') && sniffed) {
    return new File([file], file.name || 'photo', { type: sniffed, lastModified: file.lastModified || Date.now() })
  }
  return file
}
