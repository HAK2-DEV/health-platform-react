// src/components/SupabaseTodos.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'    // ⭐ 위 폴더!

function SupabaseTodos() {
  const [todos, setTodos] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    const loadTodos = async () => {
      try {
        const { data, error } = await supabase
          .from('todos')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (error) {
          setError(error.message)
        } else {
          setTodos(data)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadTodos()
  }, [])
  
  if (isLoading) return <p>⏳ DB 에서 불러오는 중...</p>
  if (error) return <p>⚠️ 에러: {error}</p>
  
  return (
    <div className="supabase-todos">
      <h2>📦 진짜 DB 의 TODO ({todos.length}개)</h2>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <span>{todo.done ? "✅" : "⏳"}</span>
            <span>{todo.text}</span>
            <small>{new Date(todo.created_at).toLocaleString('ko-KR')}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SupabaseTodos