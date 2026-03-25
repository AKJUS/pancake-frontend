import { createPublicClient, http, fallback } from 'viem'
import { polygon } from 'viem/chains'

export const polygonRpcProvider = createPublicClient({
  transport: fallback([
    http('https://polygon.drpc.org'),
    http('https://polygon.publicnode.com'),
    http('https://polygon-public.nodies.app/'),
  ]),
  chain: polygon,
  batch: {
    multicall: {
      batchSize: 1024 * 200,
      wait: 16,
    },
  },
  pollingInterval: 6_000,
})
