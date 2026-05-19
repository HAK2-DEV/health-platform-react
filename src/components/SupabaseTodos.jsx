// src/components/SupabaseTodos.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function SupabaseTodos({session}) {
  const [todos, setTodos] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [inputValue, setInputValue] = useState("")
  
  // 처음 로드 시 DB 에서 가져오기
useEffect (() => {
  //로그인 안됬음
   if (!session) {
    setTodos([])
    setIsLoading(false)
    return
  }

  //로그인 됬음
const loadTodos = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })

  if(error) setError(error.message)
    else setTodos(data)
  setIsLoading(false)
} 


loadTodos()


}, [session])
  
  // 추가
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (inputValue.trim() === "") return
    
    const { data: {user} } = await supabase.auth.getUser()

    if(!user) {
      alert("로그인 필요")
      return
    }
    //user_id포함해서 insert
    const {data, error}=await supabase
      .from('todos')
      .insert({ 
        text: inputValue,
        done: false,
        user_id: user.id
      })
      
      .select()
    
    if (error) {
      console.error('추가 실패:', error)
      return
    }
    
    setTodos([...data, ...todos])
    setInputValue("")
  }
  
  // 토글
  const toggleTodo = async (id, currentDone) => {
    const { error } = await supabase
      .from('todos')
      .update({ done: !currentDone })
      .eq('id', id)
    
    if (error) {
      console.error('토글 실패:', error)
      return
    }
    
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, done: !currentDone } : todo
    ))
  }
  
  // 삭제
  const deleteTodo = async (id) => {
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('삭제 실패:', error)
      return
    }
    
    setTodos(todos.filter(todo => todo.id !== id))
  }
  
  if (isLoading) return <p>⏳ DB 에서 불러오는 중...</p>
  if (error) return <p>⚠️ 에러: {error}</p>
  
 return (
  <div className="bg-white p-4 rounded-md shadow-md max-w-2xl mx-auto my-4">
    {/* 제목 */}
    <h2 className="text-lg text-green-500 mb-4 text-center">
      📝 나의 할 일 ({todos.length}개)
    </h2>
    
    {/* 입력 폼 */}
    <form 
      onSubmit={handleSubmit} 
      className="flex flex-nowrap gap-2 mb-4"
    >
      <input 
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="할 일을 입력하세요"
        className="flex-1 min-w-0 px-3 py-2 text-base border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500"
      />
      <button 
        type="submit"
        className="flex-shrink-0 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-md whitespace-nowrap transition"
      >
        추가
      </button>
    </form>
    
    {/* 빈 상태 또는 목록 */}
    {todos.length === 0 ? (
      <div className="text-center p-6 text-gray-500">
        <p className="text-base mb-2">📋 아직 할 일이 없어요</p>
        <p className="text-sm opacity-70">위에서 첫 할 일을 추가해보세요!</p>
      </div>
    ) : (
      <ul className="list-none p-0 m-0 space-y-2">
        {todos.map(todo => (
          <li 
            key={todo.id}
            onClick={() => toggleTodo(todo.id, todo.done)}
            className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer transition"
          >
            <span className="text-lg">
              {todo.done ? "✅" : "⏳"}
            </span>
            <span className="flex-1 min-w-0 font-medium break-words">
              {todo.text}
            </span>
            <small className="text-xs text-gray-500">
              {new Date(todo.created_at).toLocaleString('ko-KR')}
            </small>
            <button 
              onClick={(e) => {
                e.stopPropagation()
                deleteTodo(todo.id)
              }}
              className="self-end sm:self-auto flex-shrink-0 px-2 py-1 bg-red-500 hover:bg-red-700 text-white text-xs rounded transition"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
)
}

export default SupabaseTodos 