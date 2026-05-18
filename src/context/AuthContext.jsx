import { createContext, useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

//1.Context 만들기

export const AuthContext =createContext(null)

//2. provider로 컴포넌트 만들기
export function AuthProvider({children}) {
    const [session, setSession] =useState(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect (() => { 
        supabase.auth.getSession().then(({data:{session}}) => {
            setSession(session)
            setIsLoading(false)
        })

        const {data: {subscription}} = supabase.auth.onAuthStateChange(
            (_event, session) => setSession(session)
        )


        return () => subscription.unsubscribe()


    }, [])

    return (
        <AuthContext.Provider value={{session, isLoading}}>
            {children}
        </AuthContext.Provider>
    )
}