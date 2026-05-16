// src/components/AuthForm.jsx
import { useState } from "react";
import { supabase } from "../supabaseClient";

function AuthForm() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isSignUp, setIsSignUp] = useState(false)
    const [message, setMessage] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async(e) => {
        e.preventDefault()
        setIsLoading(true)
        setMessage("")

        try {
            if (isSignUp) {
                //회원가입
                const { data, error} = await supabase.auth.signUp({
                    email, password
                })
                
                if (error) {
                    setMessage("❌ 회원가입 실패: " + error.message)
                } else {
                    setMessage("✅ 회원가입 성공! 이메일 확인 후 로그인하세요.")
                }
            } else {
                //로그인
                const {data, error} = await supabase.auth.signInWithPassword({
                    email, password
                })
                if (error) {
                    setMessage("❌ 로그인 실패: " + error.message)
                } else {
                     setMessage("✅ 로그인 성공!")
                }

                }
            } catch (err) {
                setMessage("❌ 에러: " + err.message)
            } finally {
                setIsLoading(false)
            }
        }
    
    return (
         <div className="auth-form">
      <h2>{isSignUp ? "📝 회원가입" : "🔐 로그인"}</h2>
      <form onSubmit={handleSubmit}>
        <input 
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          required
        />
        <input 
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (6자 이상)"
          required
          minLength={6}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "처리 중..." : (isSignUp ? "회원가입" : "로그인")}
        </button>
      </form>

       <p>
        {isSignUp ? "이미 계정이 있나요?" : "계정이 없나요?"}
        <button 
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp)
            setMessage("")
          }}
          className="toggle-btn"
        >
          {isSignUp ? "로그인" : "회원가입"}
        </button>
      </p>
       {message && <p className="auth-message">{message}</p>}
    </div>
    )
    }

    export default AuthForm