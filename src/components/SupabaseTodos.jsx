import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { ClipboardList, Check, Clock, Trash2, Image as ImageIcon, X } from 'lucide-react'


function SupabaseTodos({ session }) {
  const [todos, setTodos] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [inputValue, setInputValue] = useState("")
  
  // ⭐ 추가 - 사진 관련 state
  const [selectedFile, setSelectedFile] = useState(null)
  const [imageUrls, setImageUrls] = useState({})    // {todo_id: signed_url}

  // 처음 로드 시 DB 에서 가져오기
  useEffect(() => {
    if (!session) {
      setTodos([])
      setIsLoading(false)
      return
    }

    const loadTodos = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) setError(error.message)
      else {
        setTodos(data)
        // ⭐ 사진 있는 todo 의 URL 가져오기
        await loadImageUrls(data)
      }
      setIsLoading(false)
    }

    loadTodos()
  const channel = supabase
    .channel('todos-changes')
    .on(
      'postgres_changes',
      {
        event: '*',                    // INSERT, UPDATE, DELETE 모두
        schema: 'public',
        table: 'todos',
        filter: `user_id=eq.${session.user.id}`   // 본인 거만
      },
      (payload) => {
        console.log('🔄 변경 감지:', payload)
        
        if (payload.eventType === 'INSERT') {
          setTodos(prev => [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setTodos(prev => prev.map(t => 
            t.id === payload.new.id ? payload.new : t
          ))
        } else if (payload.eventType === 'DELETE') {
          setTodos(prev => prev.filter(t => t.id !== payload.old.id))
        }
      }
    )
    .subscribe()

  // ⭐ cleanup
  return () => {
    supabase.removeChannel(channel)
  }
}, [session])

  // ⭐ 추가 - 사진 URL 가져오기
  const loadImageUrls = async (todoList) => {
    const urls = {}
    for (const todo of todoList) {
      if (todo.image_path) {
        const { data } = await supabase.storage
          .from('todo-images')
          .createSignedUrl(todo.image_path, 3600)
        if (data) urls[todo.id] = data.signedUrl
      }
    }
    setImageUrls(urls)
  }

  // 추가 (사진 업로드 통합)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (inputValue.trim() === "") return

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      alert("로그인 필요")
      return
    }

    let imagePath = null

    // ⭐ 사진 선택됐으면 업로드
    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('todo-images')
        .upload(filePath, selectedFile)

      if (uploadError) {
        console.error('사진 업로드 실패:', uploadError)
        alert('사진 업로드 실패: ' + uploadError.message)
        return
      }

      imagePath = filePath
    }

    // TODO 추가 (image_path 포함)
    const { data, error } = await supabase
      .from('todos')
      .insert({
        text: inputValue,
        done: false,
        user_id: user.id,
        image_path: imagePath    // ⭐ 추가
      })
      .select()

    if (error) {
      console.error('추가 실패:', error)
      return
    }

    // ⭐ 새 todo 의 사진 URL 도 가져오기
    if (imagePath) {
      const { data: urlData } = await supabase.storage
        .from('todo-images')
        .createSignedUrl(imagePath, 3600)
      if (urlData) {
        setImageUrls(prev => ({ ...prev, [data[0].id]: urlData.signedUrl }))
      }
    }

    setTodos([...data, ...todos])
    setInputValue("")
    setSelectedFile(null)    // ⭐ 초기화
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

  // 삭제 (사진도 같이 삭제)
  const deleteTodo = async (id) => {
    // ⭐ 사진 있으면 Storage 에서도 삭제
    const todo = todos.find(t => t.id === id)
    if (todo?.image_path) {
      await supabase.storage
        .from('todo-images')
        .remove([todo.image_path])
    }

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
      <h2 className="flex items-center justify-center gap-2 text-lg text-emerald-500 mb-4">
        <ClipboardList className="w-5 h-5" />
        나의 할 일 ({todos.length}개)
      </h2>

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex flex-nowrap gap-2 mb-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="할 일을 입력하세요"
            className="flex-1 min-w-0 px-3 py-2 text-base border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-medium rounded-md whitespace-nowrap transition"
          >
            추가
          </button>
        </div>

        {/* ⭐ 사진 선택 - 추가 */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded cursor-pointer transition">
            <ImageIcon className="w-4 h-4" />
            사진 선택
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              className="hidden"
            />
          </label>
          {selectedFile && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <span className="truncate max-w-[200px]">{selectedFile.name}</span>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </form>

      {/* 빈 상태 또는 목록 */}
      {todos.length === 0 ? (
        <div className="text-center p-6 text-gray-500">
          <ClipboardList className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p className="text-base mb-2">아직 할 일이 없어요</p>
          <p className="text-sm opacity-70">위에서 첫 할 일을 추가해보세요!</p>
        </div>
      ) : (
        <ul className="list-none p-0 m-0 space-y-2">
          {todos.map(todo => (
            <li
              key={todo.id}
              onClick={() => toggleTodo(todo.id, todo.done)}
              className="flex flex-col gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer transition"
            >
              {/* 첫 줄: 체크 + 텍스트 + 시간 + 삭제 */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span>
                  {todo.done ? (
                    <Check className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500" />
                  )}
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
                  className="self-end sm:self-auto flex items-center gap-1 flex-shrink-0 px-2 py-1 bg-red-500 hover:bg-red-700 text-white text-xs rounded transition"
                >
                  <Trash2 className="w-3 h-3" />
                  삭제
                </button>
              </div>

              {/* ⭐ 사진 - 추가 */}
              {imageUrls[todo.id] && (
                <img
                  src={imageUrls[todo.id]}
                  alt="todo 사진"
                  className="w-full max-h-64 object-contain rounded"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default SupabaseTodos