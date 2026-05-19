import { createContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";

export const AuthContext = createContext(null)

export function AuthProvider({children}) {
    const [session, setSession] = useState(null)
    const [nickname, setNickname] = useState(null)          // ⭐ 추가
    const [isLoading, setIsLoading] = useState(true)

    // 1. 세션 가져오기 + 구독
    useEffect(() => { 
        supabase.auth.getSession().then(({data: {session}}) => {
            setSession(session)
            setIsLoading(false)
        })

        const {data: {subscription}} = supabase.auth.onAuthStateChange(
            (_event, session) => setSession(session)
        )

        return () => subscription.unsubscribe()
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