import { createContext, useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { pushSupported, subscribeToPush } from "../lib/push";

export const AuthContext = createContext(null)

export function AuthProvider({children}) {
    const [session, setSession] = useState(null)
    const [nickname, setNickname] = useState(null)          // ⭐ 추가
    const [isLoading, setIsLoading] = useState(true)
    const queryClient = useQueryClient()
    const prevUserIdRef = useRef(null)   // 직전 로그인 사용자 id — 바뀌면 캐시 전체 비움

    // 1. 세션 가져오기 + 구독
    useEffect(() => {
        supabase.auth.getSession().then(({data: {session}}) => {
            prevUserIdRef.current = session?.user?.id ?? null
            setSession(session)
            setIsLoading(false)
        })

        const {data: {subscription}} = supabase.auth.onAuthStateChange(
            (_event, session) => {
                // 계정 변경/로그아웃 시 React Query 캐시 전체 클리어 →
                //   이전 계정 데이터(운영자 전용 등)가 다음 계정 화면에 새어 보이는 누수 방지.
                //   토큰 갱신(같은 사용자)엔 비우지 않음.
                const newUserId = session?.user?.id ?? null
                if (newUserId !== prevUserIdRef.current) {
                    queryClient.clear()
                    prevUserIdRef.current = newUserId
                    // 로그인/계정전환 — 이 기기 알림 권한이 이미 허용돼 있으면 현재 사용자로 푸시 구독 재등록.
                    //   (endpoint upsert → 이전 계정 구독이 현재 계정으로 재할당. 권한 없으면 아무것도 안 함/프롬프트 X)
                    if (newUserId && pushSupported() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                        subscribeToPush().catch(() => {})
                    }
                }
                setSession(session)
            }
        )

        return () => subscription.unsubscribe()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // 2. 닉네임 가져오기 함수                              // ⭐ 추가
    const fetchNickname = useCallback(async () => {
        if (!session) {
            setNickname(null)
            return
        }

        const { data } = await supabase
            .from('users')
            .select('nickname')
            .eq('id', session.user.id)
            .maybeSingle()
        
        setNickname(data?.nickname || null)
    }, [session])

    // 3. 세션 변경 시 자동 가져오기                        // ⭐ 추가
    useEffect(() => {
        fetchNickname()
    }, [fetchNickname])

    return (
        <AuthContext.Provider value={{
            session, 
            nickname,                                       // ⭐ 추가
            isLoading, 
            refreshNickname: fetchNickname                  // ⭐ 추가
        }}>
            {children}
        </AuthContext.Provider>
    )
}