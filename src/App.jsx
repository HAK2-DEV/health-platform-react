import { useState } from 'react'
import './App.css'


// ⭐ 데이터 - 배열
const users = [
  { id: 1, name: "HAK2", age: 30, role: "개발자" },
  { id: 2, name: "길동", age: 25, role: "디자이너" },
  { id: 3, name: "철수", age: 35, role: "기획자" },
  { id: 4, name: "영희", age: 28, role: "기획자" },
  { id: 5, name: "민수", age: 33, role: "개발자" },
  { id: 6, name: "hak", age: 30, role: "개발자 겸 관리자" }
]

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

function App() {
  // ⭐ 상태 추가
  const [count, setCount] = useState(0)
  const [likedUsers, setLikedUsers] = useState([])   // ⭐ id 들의 배열
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
      <p>총 {users.length}명 </p>

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