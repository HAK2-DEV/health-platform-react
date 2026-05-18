import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export function useAuth() {
    const context = useContext(AuthContext)

    //안전장치 - Provider 없이 사용 시 에러
    if (context === null) {
        throw new Error('useAuth must be used within AuthProvider')

    }
return context
}
