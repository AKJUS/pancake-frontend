import { isPoolId } from 'hooks/infinity/utils/pool'
import { fetchCLPoolInfo } from 'state/farmsV4/state/accountPositions/fetcher/infinity/getPoolInfo'
import { getCurrencyAddress, Token } from '@pancakeswap/sdk'
import { Pool as CLPool, DYNAMIC_FEE_FLAG } from '@pancakeswap/infinity-sdk'
import { atomWithQuery } from 'jotai-tanstack-query'
import { FAST_INTERVAL } from 'config/constants'
import { accountActiveChainAtom } from 'wallet/atoms/accountStateAtoms'
import { LIMIT_ORDER_FEE_OPTIONS, LIMIT_ORDER_SUPPORTED_LP_FEES, selectedFeeTierAtom } from '../form/feeTierAtom'
import { supportedPoolsListAtom } from './poolsListAtom'
import { inputCurrencyAtom, outputCurrencyAtom } from '../currency/currencyAtoms'

export const selectedPoolAtom = atomWithQuery((get) => {
  const { chainId } = get(accountActiveChainAtom)
  const selectedFeeTier = get(selectedFeeTierAtom)
  return {
    queryKey: ['selectedPool', chainId, get(inputCurrencyAtom), get(outputCurrencyAtom), selectedFeeTier],
    refetchInterval: FAST_INTERVAL,
    queryFn: async () => {
      const inputCurrency = get(inputCurrencyAtom)
      const outputCurrency = get(outputCurrencyAtom)

      if (!inputCurrency || !outputCurrency) return null

      const idA = getCurrencyAddress(inputCurrency)
      const idB = getCurrencyAddress(outputCurrency)

      // Collect all basic pools matching the selected pair on the active chain
      const pools = await get(supportedPoolsListAtom)
      const pairPools = pools.filter(
        (pool) =>
          pool.chainId === inputCurrency.chainId &&
          ((pool.currency0 === idA && pool.currency1 === idB) || (pool.currency0 === idB && pool.currency1 === idA)),
      )

      if (pairPools.length === 0) return null

      // Only proceed with pools that have valid poolIds
      const validPools = pairPools.filter((pool) => isPoolId(pool.poolId))
      if (validPools.length === 0) return null

      // Fetch CL pool info for all valid pools in parallel
      const poolInfoResults = await Promise.all(
        validPools.map(async (basicPool) => {
          const poolInfo = await fetchCLPoolInfo(basicPool.poolId, basicPool.chainId)
          return { basicPool, poolInfo }
        }),
      )

      const targetLpFee = LIMIT_ORDER_FEE_OPTIONS.find((o) => o.value === selectedFeeTier)?.lpFee
      if (targetLpFee === undefined) return null

      // Filter to supported tiers, validate pool state, and find the one matching the selected tier
      const match = poolInfoResults.find(({ poolInfo }) => {
        if (!poolInfo) return false
        // Reject uninitialized or fee-overflowing pools (existing validity guard)
        if (!poolInfo.dynamic && poolInfo.fee >= 1e6) return false
        // Only consider pools whose lpFee is a supported Limit Order tier
        if (!LIMIT_ORDER_SUPPORTED_LP_FEES.has(poolInfo.lpFee)) return false
        return poolInfo.lpFee === targetLpFee
      })

      if (!match || !match.poolInfo) return null

      const { basicPool, poolInfo } = match
      const { poolId } = basicPool
      const { currency0, fee, liquidity, lpFee, protocolFee, sqrtPriceX96, tick, parameters } = poolInfo

      // Sort currencies
      const zeroForOne = idA.toLowerCase() === currency0.toLowerCase()
      const [currencyA, currencyB] = zeroForOne ? [inputCurrency, outputCurrency] : [outputCurrency, inputCurrency]

      // Construct Pool
      const pool = new CLPool({
        poolType: 'CL',
        tokenA: currencyA as Token,
        tokenB: currencyB as Token,
        fee: lpFee,
        protocolFee,
        dynamic: fee === DYNAMIC_FEE_FLAG,
        sqrtRatioX96: sqrtPriceX96,
        liquidity,
        tickCurrent: tick,
        tickSpacing: parameters.tickSpacing,
      })
      pool.feeProtocol = protocolFee

      return { poolId, pool, poolInfo, zeroForOne, currencyA, currencyB }
    },
  }
})
