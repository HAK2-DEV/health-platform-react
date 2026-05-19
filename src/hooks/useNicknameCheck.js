import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { validateNickname } from '../lib/validators'

// debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => clearTimeout(timer)
  }, [value, delay])
  
  return debouncedValue
}

// 닉네임 중복 체크 hook
export function useNicknameCheck(nickname, currentUserId = null) {
  const [status, setStatus] = useState({ 
    checking: false, 
    available: null, 
    reason: null 
  })
  
  const debouncedNickname = useDebounce(nickname, 500)
  
  useEffect(() => {
    // 빈 값
    if (!debouncedNickname) {
      setStatus({ checking: false, available: null, reason: null })
      return
    }
    
    // 1. 클라이언트 검증 먼저
    const validation = validateNickname(debouncedNickname)
    if (!validation.valid) {
      setStatus({ 
        checking: false, 
        available: false, 
        reason: validation.reason 
      })
      return
    }
    
    // 2. DB 중복 체크
    const checkAvailability = async () => {
      setStatus({ checking: true, available: null, reason: null })
      
      let query = supabase
        .from('users')
        .select('id')
        .eq('nickname', debouncedNickname)
      
      // 본인 닉네임은 제외 (변경 시 본인 거 제외)
      if (currentUserId) {
        query = query.neq('id', currentUserId)
      }
      
      const { data, error } = await query.maybeSingle()
      
      if (error) {
        setStatus({ 
          checking: false, 
          available: false, 
          reason: '확인 중 오류가 발생했습니다' 
        })
        return
      }
      
      if (data) {
        setStatus({ 
          checking: false, 
          available: false, 
          reason: '이미 사용 중인 닉네임입니다' 
        })
      } else {
        setStatus({ 
          checking: false, 
          available: true, 
          reason: null 
        })
      }
    }
    
    checkAvailability()
  }, [debouncedNickname, currentUserId])
  
  return status
}