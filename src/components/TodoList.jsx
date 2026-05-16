import TodoItem  from "./TodoItem";

function TodoList({
    todos,
    inputValue,
    onInputChange, 
  onSubmit, 
  onToggle, 
  onDelete 
}) {
    return (
    <div className='input-test'>
      <form onSubmit={onSubmit}>
        <input
          type='text'
          value={inputValue}
          onChange={onInputChange}
          placeholder='입력 후 Enter'
        />
        <button type='submit'>추가</button>
      </form>
      
     
      <ul>
        {todos.map((todo, i) => (
          <TodoItem
            key={i}
            todo={todo}
            onToggle={() => onToggle(i)}     // ⭐ 인덱스 묶어서
            onDelete={() => onDelete(i)}     // ⭐ 인덱스 묶어서
          />
        ))}
      </ul>
    </div>
  )
}

export default TodoList