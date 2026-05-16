import {useState, useEffect} from 'react'

function ApiUsers () {
    const [apiUsers, setApiUsers] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [search,setSearch] = useState("")
    
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const response =await fetch ("https://jsonplaceholder.typicode.com/users")
                const data = await response.json()
                setApiUsers(data)
            } catch(error) {
                console.error("에러:", error)

            } finally {
                setIsLoading(false)

            }
            }

            loadUsers()
        
    }, [])

return (
    <div className='api-users'>
        <h2>외부사용자(api)</h2>
        <input
        type='text'
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder='이름검색'
        className='search-input'
        />
        {isLoading ? (
            <p>⏳ 불러오는 중...</p>
      ) : (
        <ul>
          {apiUsers
            .filter(user => 
              user.name.toLowerCase().includes(search.toLowerCase())
            )
            .map(user => (
              <li key={user.id}>
                <strong>{user.name}</strong>
                <span> - {user.email}</span>
              </li>
            ))}
        </ul>
      )}
    </div>

)
}

export default ApiUsers