import { GraphQLClient, gql } from 'graphql-request'
import { atom } from 'jotai'
import { PANCAKE_SPACE } from '../config'

interface Space {
  id: string
  name: string
  about: string
  network: string
  symbol: string
  members: number
  voting: {
    delay: number
    period: number
  }
  strategies: any[]
}

export const spaceAtom = atom(async () => {
  const endpoint = 'https://hub.snapshot.org/graphql'
  const client = new GraphQLClient(endpoint, {
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // 2. Define the Query
  const GET_SPACE_DATA = gql`
    query {
      space(id: "${PANCAKE_SPACE}") {
        id
        name
        about
        network
        symbol
        members
        voting {
          delay
          period
        }
        strategies {
          name
          params
        }
        validation {
          name
          params
        }
      }
    }
  `
  try {
    const data = (await client.request(GET_SPACE_DATA)) as any
    return data.space as Space
  } catch (error) {
    console.error(error)
    return null
  }
})
