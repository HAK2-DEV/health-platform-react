import { createClient } from '@supabase/supabase-js'
import { captureAuthUrlError } from './lib/authUrlError'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// ⚠️ createClient 보다 먼저 호출할 것.
//   클라이언트가 생성 즉시 URL 해시를 소비하고 history 를 정리하기 때문에,
//   인증 링크 실패 정보(#error=...)를 여기서 먼저 붙잡아 두지 않으면 영영 사라진다.
captureAuthUrlError()

export const supabase = createClient(supabaseUrl, supabaseKey)