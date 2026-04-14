import { POOLS_SLOW_REVALIDATE } from 'config/pools'
import { getCorsHeaders, handleCors } from 'edge/cors'
import { NextRequest, NextResponse } from 'next/server'
import { edgeQueries } from 'quoter/utils/edgePoolQueries'
import { parseCandidatesQuery } from 'quoter/utils/edgeQueries.util'
import { ChainId } from '@pancakeswap/chains'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: NextRequest) {
  const cors = handleCors(req)
  if (cors) {
    return cors
  }
  const raw = new URL(req.url).search.slice(1)
  try {
    const { chainId, addressA, addressB, protocols, type } = parseCandidatesQuery(raw)
    const preferOnChain = chainId === ChainId.BSC_TESTNET

    const pools =
      type === 'light'
        ? await edgeQueries.fetchAllCandidatePoolsLite(addressA, addressB, chainId, protocols, { preferOnChain })
        : await edgeQueries.fetchAllCandidatePools(addressA, addressB, chainId, protocols, { preferOnChain })

    const age = Math.floor((POOLS_SLOW_REVALIDATE[chainId] as number) / 1000)
    const staleAge = age * 2
    return NextResponse.json(
      {
        data: pools,
        lastUpdated: Number(Date.now()),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': `public, s-maxage=${age}, stale-while-revalidate=${staleAge}`,
          'Content-Type': 'application/json',
          ...getCorsHeaders(req),
        },
      },
    )
  } catch (ex) {
    console.error(ex)
    return NextResponse.json({ error: `fetch candidates error ` }, { status: 400, headers: getCorsHeaders(req) })
  }
}
