// src/components/SupabaseTodos.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function SupabaseTodos() {
  const [todos, setTodos] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [inputValue, setInputValue] = useState("")
  
  // 처음 로드 시 DB 에서 가져오기
  useEffect(() => {
    const loadTodos = async () => {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) setError(error.message)
      else setTodos(data)
      setIsLoading(false)
    }
    loadTodos()
  }, [])
  
  // 추가
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (inputValue.trim() === "") return
    
    const { data, error } = await supabase
      .from('todos')
      .insert({ text: inputValue, done: false })
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
    <div className="supabase-todos">
      <h2>📦 진짜 DB 의 TODO ({todos.length}개)</h2>
      
      <form onSubmit={handleSubmit}>
        <input 
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="DB 에 추가할 할 일"
        />
        <button type="submit">DB 에 추가</button>
      </form>
      
      <ul>
        {todos.map(todo => (
          <li 
            key={todo.id}
            onClick={() => toggleTodo(todo.id, todo.done)}
            style={{ cursor: 'pointer' }}
          >
            <span>{todo.done ? "✅" : "⏳"}</span>
            <span style={{ textDecoration: todo.done ? 'line-through' : 'none' }}>
              {todo.text}
            </span>
            <small>{new Date(todo.created_at).toLocaleString('ko-KR')}</small>
            <button onClick={(e) => {
              e.stopPropagation()
              deleteTodo(todo.id)
            }}>
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SupabaseTodos