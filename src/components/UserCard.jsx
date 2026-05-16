//// ⭐ 새 컴포넌트 정의 
function UserCard({ name, age, role, liked, onToggle }) {
  return (
    <div className="card">
      <h2>{name}</h2>
      <p>나이: {age}</p>
      <p>역할: {role}</p>

      {/* ⭐ 좋아요 영역 */}
      <div className="like-area">
        <span>❤️ {liked ? " 1": ""}</span>
        <button 
        onClick={onToggle}
        className={liked ? "liked" : ""}
        >
          {liked ?  "👍 취소" : "👍 좋아요"}
        </button>
      </div>
    </div>
  )
}

export default UserCard