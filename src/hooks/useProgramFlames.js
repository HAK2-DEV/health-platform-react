import { useQuery } from '@tanstack/react-query'
import { queryKeys, fetchProgramFlames } from '../lib/queries'

// 프로그램의 불꽃 맵 { [user_id]: { level, weeks } } — 280.
//   어느 컴포넌트가 몇 번 불러도 react-query 가 한 요청으로 합친다.
//   주 단위로 바뀌는 값이라 길게 들고 있어도 된다(10분).
export function useProgramFlames(programId, { enabled = true } = {}) {
  const { data } = useQuery({
    queryKey: queryKeys.programFlames(programId),
    queryFn: () => fetchProgramFlames(programId),
    enabled: !!programId && enabled,
    staleTime: 10 * 60_000,
  })
  return data || EMPTY
}

const EMPTY = Object.freeze({})
