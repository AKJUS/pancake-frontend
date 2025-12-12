import { DecreaseLiquidityEventLayout, Raydium, TxVersion } from '@pancakeswap/solana-core-sdk'
import { SolanaV3PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { SolanaV3PoolInfo } from 'state/farmsV4/state/type'
import BN from 'bn.js'

export type RemoveLiquidityParams = {
  raydium: Raydium | undefined
  poolInfo: SolanaV3PoolInfo
  position: SolanaV3PositionDetail
  liquidity: bigint
  amountMinA: bigint
  amountMinB: bigint
  simulateOnly?: boolean
}
export const removeLiquidity = async ({
  raydium,
  poolInfo,
  position,
  liquidity,
  amountMinA,
  amountMinB,
  simulateOnly,
}: RemoveLiquidityParams) => {
  if (!raydium) return undefined

  const { simulate } = await raydium.clmm.decreaseLiquidity({
    poolInfo: poolInfo.rawPool,
    poolKeys: raydium.clmm.getClmmKeysFromPoolInfo(poolInfo.rawPool),
    ownerPosition: position,
    ownerInfo: {
      useSOLBalance: true,
      closePosition: false,
    },
    liquidity: new BN(liquidity),
    amountMinA: new BN(amountMinA),
    amountMinB: new BN(amountMinB),
    txVersion: TxVersion.V0,
  })

  if (simulateOnly) {
    try {
      const simulateResult = await simulate({
        accounts: {
          encoding: 'base64',
          addresses: poolInfo.rawPool.rewardDefaultInfos.map((r) => r.mint.address),
        },
      })

      if (!simulateResult.value.logs || simulateResult.value.logs.length < 3) {
        return undefined
      }

      const disclaimerDigest = await crypto.subtle.digest(
        'SHA-256',
        Buffer.from('event:DecreaseLiquidityEvent', 'utf-8'),
      )
      const disclaimer = Buffer.from(disclaimerDigest).toString('base64').slice(0, 8)

      const data = simulateResult.value.logs
        .find((log) => log.startsWith(`Program data: ${disclaimer}`))
        ?.slice(`Program data: `.length)

      if (!data) {
        return undefined
      }

      const decreaseLiquidityEventData = DecreaseLiquidityEventLayout.decode(Buffer.from(data, 'base64'))

      return decreaseLiquidityEventData
    } catch (e) {
      console.error('Simulation error:', e)
      return undefined
    }
  }

  return undefined
}
