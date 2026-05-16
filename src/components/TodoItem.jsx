function TodoItem ({todo, onToggle, onDelete}) {
    return(
        <li
        className={todo.done ? "compelted" : ""}
        onClick={onToggle}
        >
            {todo.text}
            <button onClick= {(e) => {
                e.stopPropagation()
                onDelete()
            }}>
                삭제
            </button>
        </li>
    )

}

export default TodoItem