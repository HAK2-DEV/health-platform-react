import { supabase } from '../supabaseClient'

// 운동 기록 앱 스크린샷(나이키런·삼성헬스·스트라바 등) → 거리·시간·페이스·칼로리 추출.
//   엣지함수 activity-screenshot(Gemini) 프록시. 미션의 metric 입력을 자동으로 채우는 용도.

// 파일 → 리사이즈·압축 base64 dataURL (전송량 절약)
export function fileToDataUrl(file, maxDim = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

// 스크린샷 dataURL → { distance_km, duration_sec, pace_sec_per_km, kcal, steps, confidence }
export async function readActivityScreenshot(imageDataUrl) {
  const { data, error } = await supabase.functions.invoke('activity-screenshot', { body: { image: imageDataUrl } })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.error || 'read_failed')
  return data.data
}

// 초 → "HHMMSS"(hms 입력 형식)
function secToHHMMSS(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return String(h).padStart(2, '0') + String(m).padStart(2, '0') + String(ss).padStart(2, '0')
}

// 추출값 → 미션 metric 입력값 매핑. 라벨/단위/inputFormat 으로 어떤 지표인지 추론.
//   반환: { updates: {key: value}, labels: ["거리 5.2km", ...] }  (labels 는 안내용)
export function mapActivityToMetrics(metricList, d) {
  const updates = {}
  const labels = []
  for (const m of Array.isArray(metricList) ? metricList : []) {
    const label = String(m.label || '')
    const unit = String(m.unit || '').toLowerCase()
    if (m.inputFormat === 'hms') {
      if (d.duration_sec > 0) { updates[m.key] = secToHHMMSS(d.duration_sec); labels.push(`${label || '시간'} ${Math.floor(d.duration_sec / 60)}분`) }
      continue
    }
    if (m.inputFormat === 'clock' || m.inputFormat === 'clock_multi') continue
    if (unit === 'km' || /거리|distance/i.test(label)) {
      if (d.distance_km > 0) { updates[m.key] = String(d.distance_km); labels.push(`${label || '거리'} ${d.distance_km}km`) }
    } else if (unit.includes('kcal') || /칼로리|열량|kcal/i.test(label)) {
      if (d.kcal > 0) { updates[m.key] = String(d.kcal); labels.push(`${label || '칼로리'} ${d.kcal}kcal`) }
    } else if (/걸음|steps/i.test(label) || unit.includes('걸음')) {
      if (d.steps > 0) { updates[m.key] = String(d.steps); labels.push(`${label || '걸음'} ${d.steps}`) }
    } else if (/페이스|pace/i.test(label) || unit.includes('/km')) {
      if (d.pace_sec_per_km > 0) { updates[m.key] = String(Math.round((d.pace_sec_per_km / 60) * 100) / 100); labels.push(`${label || '페이스'}`) }
    }
  }
  return { updates, labels }
}
