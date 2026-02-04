import { Currency, CurrencyAmount } from '@pancakeswap/sdk'
import { Pool } from '@pancakeswap/v3-sdk'
import { useV3NFTPositionManagerContract } from 'hooks/useContract'
import { useEffect, useMemo, useState } from 'react'
import { useReadContract } from '@pancakeswap/wagmi'
import { useCurrentBlock } from 'state/block/hooks'
import { unwrappedToken } from 'utils/wrappedCurrency'
import { Address } from 'viem'

const MAX_UINT128 = 2n ** 128n - 1n

// compute current + counterfactual fees for a v3 position
export function useV3PositionFees(
  pool?: Pool,
  tokenId?: bigint,
  asWNATIVE = false,
  enable = true,
): [CurrencyAmount<Currency>, CurrencyAmount<Currency>] | [undefined, undefined] {
  const chainId = pool?.chainId ?? pool?.token0.chainId
  const positionManager = useV3NFTPositionManagerContract({ chainId })

  // Use wagmi's useReadContract for cross-chain support - this is the key fix!
  const args = useMemo(() => (tokenId ? [tokenId] : undefined), [tokenId])
  const { data: owner } = useReadContract({
    abi: positionManager?.abi,
    address: positionManager?.address,
    functionName: 'ownerOf',
    args,
    chainId,
    query: {
      enabled: enable && !!positionManager && tokenId !== undefined,
    },
  })

  const latestBlockNumber = useCurrentBlock()

  // we can't use multicall for this because we need to simulate the call from a specific address
  // latestBlockNumber is included to ensure data stays up-to-date every block
  const [amounts, setAmounts] = useState<[bigint, bigint] | undefined>()

  // Reset amounts when tokenId changes to avoid showing stale fee data from previous position
  useEffect(() => {
    setAmounts(undefined)
  }, [tokenId])

  useEffect(() => {
    let isMounted = true

    if (enable && positionManager && typeof tokenId !== 'undefined' && owner) {
      const ownerAddress = owner as Address
      positionManager.simulate
        .collect(
          [
            {
              tokenId,
              recipient: ownerAddress, // some tokens might fail if transferred to address(0)
              amount0Max: MAX_UINT128,
              amount1Max: MAX_UINT128,
            },
          ],
          { account: ownerAddress, value: 0n }, // need to simulate the call as the owner
        )
        .then((results) => {
          if (isMounted) {
            const [amount0, amount1] = results.result
            setAmounts([amount0, amount1])
          }
        })
        .catch((error) => {
          if (isMounted) {
            console.error('[useV3PositionFees] Error simulating collect:', error)
            // Don't set amounts on error, keep previous value or undefined
          }
        })
    }

    return () => {
      isMounted = false
    }
  }, [enable, positionManager, owner, latestBlockNumber, tokenId])

  if (pool && amounts) {
    return [
      CurrencyAmount.fromRawAmount(asWNATIVE ? pool.token0 : unwrappedToken(pool.token0)!, amounts[0].toString()),
      CurrencyAmount.fromRawAmount(asWNATIVE ? pool.token1 : unwrappedToken(pool.token1)!, amounts[1].toString()),
    ]
  }
  return [undefined, undefined]
}
