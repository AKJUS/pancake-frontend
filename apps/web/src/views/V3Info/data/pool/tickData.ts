import { Protocol } from '@pancakeswap/farms'
import { Native, Token, WNATIVE } from '@pancakeswap/sdk'
import { TickMath, tickToPrice } from '@pancakeswap/v3-sdk'
import { explorerApiClient } from 'state/info/api/client'
import { components } from 'state/info/api/schema'
import { Address, zeroAddress } from 'viem'
import { isAddressEqual } from 'utils/safeGetAddress'

/** Detect native token: Explorer API may return zero address or WNATIVE address for native ETH (PAN-10696) */
function toCurrency(chainId: number, tokenData: { id: string; decimals: number; symbol: string }) {
  const addr = tokenData.id as Address
  if (isAddressEqual(addr, zeroAddress)) return Native.onChain(chainId)
  const wnative = WNATIVE[chainId as keyof typeof WNATIVE]
  if (wnative && isAddressEqual(addr, wnative.address as Address)) return Native.onChain(chainId)
  return new Token(chainId, addr, tokenData.decimals, tokenData.symbol)
}

const PRICE_FIXED_DIGITS = 8
const DEFAULT_SURROUNDING_TICKS = 300
// Tick with fields parsed to bigints, and active liquidity computed.
export interface TickProcessed {
  liquidityGross: bigint
  liquidityNet: bigint
  tickIdx: number
  liquidityActive: bigint
  price0: string
  price1: string
}

export interface PoolTickData {
  ticksProcessed: TickProcessed[]
  feeTier: string
  tickSpacing: number
  activeTickIdx: number
}

export const fetchTicksSurroundingPrice = async ({
  protocol,
  poolAddress,
  tickSpacing,
  chainName,
  chainId,
  numSurroundingTicks = DEFAULT_SURROUNDING_TICKS,
  signal,
}: {
  protocol: Protocol.V3 | Protocol.InfinityCLAMM
  poolAddress: string
  tickSpacing: number
  chainName: components['schemas']['ChainName']
  chainId: number
  numSurroundingTicks?: number
  signal?: AbortSignal
}): Promise<{
  error?: boolean
  data?: PoolTickData
}> => {
  try {
    const poolData = await explorerApiClient
      .GET(
        protocol === Protocol.V3
          ? '/cached/pools/v3/{chainName}/{address}'
          : '/cached/pools/infinityCl/{chainName}/{address}',
        {
          signal,
          params: {
            path: {
              chainName,
              address: poolAddress,
            },
          },
        },
      )
      .then((res) => res.data)

    const rawTickData: {
      id: string
      tickIdx: number
      liquidityGross: string
      liquidityNet: string
      price0: string
      price1: string
    }[] = []
    let hasNextPage = true
    let endCursor = ''

    while (hasNextPage) {
      // eslint-disable-next-line no-await-in-loop
      const result = await explorerApiClient
        .GET(`/cached/pools/ticks/{protocol}/{chainName}/{pool}`, {
          signal,
          params: {
            path: {
              protocol,
              chainName,
              pool: poolAddress,
            },
            query: {
              after: endCursor,
            },
          },
        })
        .then((res) => res.data)

      rawTickData.push(...(result?.rows ?? []))
      hasNextPage = result?.hasNextPage ?? false
      endCursor = result?.endCursor ?? ''
    }

    if (!poolData || !rawTickData) {
      return { error: false }
    }

    const poolCurrentTickIdx = poolData.tick ?? 0
    // The pools current tick isn't necessarily a tick that can actually be initialized.
    // Find the nearest valid tick given the tick spacing.
    const activeTickIdx = Math.floor(poolCurrentTickIdx / tickSpacing) * tickSpacing

    // Our search bounds must take into account fee spacing. i.e. for fee tier 1%, only
    // ticks with index 200, 400, 600, etc can be active.
    const tickIdxLowerBound = activeTickIdx - numSurroundingTicks * tickSpacing
    const tickIdxUpperBound = activeTickIdx + numSurroundingTicks * tickSpacing

    const tickData = rawTickData?.reduce(
      (acc, item) => {
        if (item.tickIdx >= tickIdxLowerBound && item.tickIdx <= tickIdxUpperBound) {
          // eslint-disable-next-line no-param-reassign
          acc[item.tickIdx] = item
        }
        return acc
      },
      {} as {
        [tickIdx: number]: {
          id: string
          tickIdx: number
          liquidityGross: string
          liquidityNet: string
          price0: string
          price1: string
        }
      },
    )

    // Use Native for zero or WNATIVE addresses - Explorer API may return wrong decimals
    // for native tokens, causing tickToPrice to produce wildly incorrect values (PAN-10696)
    const token0 = toCurrency(chainId, poolData.token0)
    const token1 = toCurrency(chainId, poolData.token1)
    // console.log({ activeTickIdx, poolCurrentTickIdx }, 'Active ticks')

    // If the pool's tick is MIN_TICK (-887272), then when we find the closest
    // initializable tick to its left, the value would be smaller than MIN_TICK.
    // In this case we must ensure that the prices shown never go below/above.
    // what actual possible from the protocol.
    let activeTickIdxForPrice = activeTickIdx
    if (activeTickIdxForPrice < TickMath.MIN_TICK) {
      activeTickIdxForPrice = TickMath.MIN_TICK
    }
    if (activeTickIdxForPrice > TickMath.MAX_TICK) {
      activeTickIdxForPrice = TickMath.MAX_TICK
    }

    const activeTickProcessed: TickProcessed = {
      liquidityActive: BigInt(poolData.liquidity ?? 0),
      tickIdx: activeTickIdx,
      liquidityNet: 0n,
      price0: tickToPrice(token0, token1, activeTickIdxForPrice).toFixed(PRICE_FIXED_DIGITS),
      price1: tickToPrice(token1, token0, activeTickIdxForPrice).toFixed(PRICE_FIXED_DIGITS),
      liquidityGross: 0n,
    }

    // If our active tick happens to be initialized (i.e. there is a position that starts or
    // ends at that tick), ensure we set the gross and net.
    // correctly.
    const activeTick = tickData[activeTickIdx]
    if (activeTick) {
      activeTickProcessed.liquidityGross = BigInt(activeTick.liquidityGross)
      activeTickProcessed.liquidityNet = BigInt(activeTick.liquidityNet)
    }

    enum Direction {
      ASC,
      DESC,
    }

    // Computes the numSurroundingTicks above or below the active tick.
    const computeSurroundingTicks = (
      activeTickProcessedParam: TickProcessed,
      tickSpacingParam: number,
      numSurroundingTicksParam: number,
      direction: Direction,
    ) => {
      let previousTickProcessed: TickProcessed = {
        ...activeTickProcessedParam,
      }

      // Iterate outwards (either up or down depending on 'Direction') from the active tick,
      // building active liquidity for every tick.
      let processedTicks: TickProcessed[] = []
      for (let i = 0; i < numSurroundingTicksParam; i++) {
        const currentTickIdx =
          direction === Direction.ASC
            ? previousTickProcessed.tickIdx + tickSpacingParam
            : previousTickProcessed.tickIdx - tickSpacingParam
        // console.log(currentTickIdx, 'currentTickIdx??????')

        if (currentTickIdx < TickMath.MIN_TICK || currentTickIdx > TickMath.MAX_TICK) {
          break
        }

        const currentTickProcessed: TickProcessed = {
          liquidityActive: previousTickProcessed.liquidityActive,
          tickIdx: currentTickIdx,
          liquidityNet: 0n,
          price0: tickToPrice(token0, token1, currentTickIdx).toFixed(PRICE_FIXED_DIGITS),
          price1: tickToPrice(token1, token0, currentTickIdx).toFixed(PRICE_FIXED_DIGITS),
          liquidityGross: 0n,
        }

        // Check if there is an initialized tick at our current tick.
        // If so copy the gross and net liquidity from the initialized tick.
        const currentInitializedTick = tickData[currentTickIdx]
        if (currentInitializedTick) {
          currentTickProcessed.liquidityGross = BigInt(currentInitializedTick.liquidityGross)
          currentTickProcessed.liquidityNet = BigInt(currentInitializedTick.liquidityNet)
        }

        // Update the active liquidity.
        // If we are iterating ascending and we found an initialized tick we immediately apply
        // it to the current processed tick we are building.
        // If we are iterating descending, we don't want to apply the net liquidity until the following tick.
        if (direction === Direction.ASC && currentInitializedTick) {
          currentTickProcessed.liquidityActive =
            previousTickProcessed.liquidityActive + BigInt(currentInitializedTick.liquidityNet)
        } else if (direction === Direction.DESC && previousTickProcessed.liquidityNet !== 0n) {
          // We are iterating descending, so look at the previous tick and apply any net liquidity.
          currentTickProcessed.liquidityActive =
            previousTickProcessed.liquidityActive - previousTickProcessed.liquidityNet
        }

        processedTicks.push(currentTickProcessed)
        previousTickProcessed = currentTickProcessed
      }

      if (direction === Direction.DESC) {
        processedTicks = processedTicks.reverse()
      }

      return processedTicks
    }

    const subsequentTicks: TickProcessed[] = computeSurroundingTicks(
      activeTickProcessed,
      tickSpacing,
      numSurroundingTicks,
      Direction.ASC,
    )

    const previousTicks: TickProcessed[] = computeSurroundingTicks(
      activeTickProcessed,
      tickSpacing,
      numSurroundingTicks,
      Direction.DESC,
    )

    const ticksProcessed = previousTicks.concat(activeTickProcessed).concat(subsequentTicks)
    return {
      data: {
        ticksProcessed,
        feeTier: poolData.feeTier?.toString() ?? '0',
        tickSpacing,
        activeTickIdx,
      },
    }
  } catch (e) {
    console.error(e)
    return { error: true }
  }
}
