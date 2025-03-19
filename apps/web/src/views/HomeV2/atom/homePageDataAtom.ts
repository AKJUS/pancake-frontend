import { atomWithAsyncRetry } from 'utils/atomWithAsyncRetry'

export const homePageDataAtom = atomWithAsyncRetry({
  asyncFn: async () => {
    const response = await fetch('/api/home')
    if (!response.ok) throw new Error('Fetch error')
    return response.json()
  },
  fallbackValue: {
    tokens: [],
    pools: [],
    currencies: [],
    chains: [],
    cakeRelated: undefined,
    stats: undefined,
    partners: [],
    topWinner: undefined,
  },
})
