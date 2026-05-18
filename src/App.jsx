import { useState, useEffect } from 'react' 
import './App.css'
import UserCard from './components/UserCard'
import TodoList from './components/TodoList'
import ApiUsers from './components/ApiUsers'
import { supabase } from './supabaseClient'
import SupabaseTodos from './components/SupabaseTodos'
import AuthForm from './components/AuthForm'

// ⭐ 데이터 - 배열
const users = [
  { id: 1, name: "HAK2", age: 30, role: "개발자" },
  { id: 2, name: "길동", age: 25, role: "디자이너" },
  { id: 3, name: "철수", age: 35, role: "기획자" },
  { id: 4, name: "영희", age: 28, role: "기획자" },
  { id: 5, name: "민수", age: 33, role: "개발자" },
  { id: 6, name: "hak", age: 30, role: "개발자 겸 관리자" }
]


function App() {
  // 새 state - 현재 사용자
  const [session, setSession] = useState(null)
  //세션 감지 - 중요!!
  useEffect(()=> {
    //처음 로드 시 현재 세션 확인
    supabase.auth.getSession().then(({data: {session} }) => {
      setSession(session)
    })
    //세션 변화 감지(로그인/로그아웃 실시간)
    const {data: {subscription}} = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )
    return () => subscription.unsubscribe()

  },[])

 const [count, setCount] = useState(0)
 const [inputValue, setInputValue] = useState("")  // ⭐ 새 상태 - 입력칸의 값
 const [likedUsers, setLikedUsers] = useState(() => {
 const saved = localStorage.getItem("likedUsers")
    return saved ? JSON.parse(saved) : []
  })   // ⭐ id 들의 배열
  
  const [todos, setTodos] = useState(() => {
  const saved =localStorage.getItem("todos")
    return saved ? JSON.parse(saved) : []})
  const [isLoaded, setIsLoaded] = useState(false)   // ⭐ 불러오기 완료 표시:

// ⭐ 시험 1: 빈 배열 - 처음 한 번만
  useEffect(() => {
 localStorage.setItem("todos", JSON.stringify(todos))
  }, [todos])

 // ⭐ 새로 추가 - likedUsers 저장
useEffect(() => {
  localStorage.setItem("likedUsers", JSON.stringify(likedUsers))
}, [likedUsers])
  
  // ENTER 처리 함수
  const handleSubmit = async (e) => {
    e.preventDefault()
    if(inputValue.trim() ==="") return
    
  // DB에 추가
   const {data, error} =  await supabase.from('todos').insert({ text: inputValue, done: false})
   .select()

   if (error) {
    console.error('추가 실패:', error)
    return
   }


      // ⭐ 화면에도 즉시 추가 (위에)
  setTodos([...data, ...todos])
  setInputValue("")
}
  
  // 토글
const toggleTodo = (i) => {
  setTodos(todos.map((todo, idx) => 
    idx === i ? { ...todo, done: !todo.done } : todo
  ))
}
// 삭제
const deleteTodo = (i) => {
  setTodos(todos.filter((_, idx) => idx !== i))}





  // ⭐ 좋아요 토글 함수
    const toggleLike = (userId) => {
      if (likedUsers.includes(userId)) {
 // 이미 좋아요 → 제거
 setLikedUsers(likedUsers.filter(id => id !== userId))
      } else {
        // 아직 좋아요 안함-> 추가
        setLikedUsers([...likedUsers, userId])
      }
    }


  return (
    <div>
      <h1>HAK2 의 React 페이지 🎉</h1>
      {/*로그인 상태에 따라 화면 변화*/}
      {session ? (
        //로그인 상태면
        <div className='user-info'>
          <p>👤 로그인: <strong>{session.user.email}</strong></p>
          <button onClick={()=> supabase.auth.signOut()}>
            로그아웃
          </button> 
          </div>
      ) : (
        //비로그인 상태
        <AuthForm/>
      )}
<p>
  총 {todos.length}개 | 
  완료 {todos.filter(t => t.done).length}개 | 
  남은 {todos.filter(t => !t.done).length}개
</p>
{/* ⭐ TodoList 한 줄로! */}
      <TodoList
        todos={todos}
        inputValue={inputValue}
        onInputChange={(e) => setInputValue(e.target.value)}
        onSubmit={handleSubmit}
        onToggle={toggleTodo}
        onDelete={deleteTodo}
      />
 {/* ⭐ SupabaseTodos - 진짜 DB 버전! */}
    <SupabaseTodos session={session} />
      <ApiUsers />

        {/* ⭐ 합계 표시 */}
      <div className="total-likes">
        <h2>❤️ 총 좋아요: {likedUsers.length}</h2>
      </div> 


      {/* ⭐ 카운터 추가 */}
      <div className='counter'>
        <p> 방문자: {count}</p>
        <button onClick={() => setCount(count + 1)}>
          +1
        </button>
      </div>


      {/* ⭐ map 으로 사용자 카드 자동 생성 */}
      {users.map(user => (
        <UserCard
         key={user.id}
         {...user}
         liked={likedUsers.includes(user.id)} 
         onToggle={() => toggleLike(user.id)} 
        />
      ))}
    </div>
  )
}

export default App