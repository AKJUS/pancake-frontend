import type { V3PoolInfo } from 'state/farmsV4/state/type'
import { useV3FormDerivedApr } from 'views/universalFarms/hooks/usePositionAPR'
import { EstimatedFeesPanel as SharedEstimatedFeesPanel } from './EstimatedFeesPanel'

// useV3FormDerivedApr (the long-serving hook powering PoolInfoHeader's V3 APR) dereferences
// pool.chainId unguarded and must run inside LiquidityFormProvider — the outer wrapper enforces
// the non-null poolInfo precondition by conditionally mounting this component.
const V3EstimatedFeesPanelInner: React.FC<{
  poolInfo: V3PoolInfo
  outOfRange: boolean
  totalUsdValue: number
  invertPrice?: boolean
}> = ({ poolInfo, outOfRange, totalUsdValue, invertPrice }) => {
  const { lpApr, cakeApr, merklApr, incentraApr } = useV3FormDerivedApr(poolInfo, invertPrice)
  if (outOfRange) return null
  return (
    <SharedEstimatedFeesPanel
      lpApr={lpApr ?? 0}
      cakeAprValue={parseFloat(cakeApr?.value ?? '0') || 0}
      merklApr={merklApr ?? 0}
      incentraApr={incentraApr ?? 0}
      totalUsdValue={totalUsdValue}
    />
  )
}

export const V3EstimatedFeesPanel: React.FC<{
  poolInfo: V3PoolInfo | undefined | null
  outOfRange: boolean
  totalUsdValue: number
  invertPrice?: boolean
}> = ({ poolInfo, outOfRange, totalUsdValue, invertPrice }) => {
  if (!poolInfo) return null
  return (
    <V3EstimatedFeesPanelInner
      poolInfo={poolInfo}
      outOfRange={outOfRange}
      totalUsdValue={totalUsdValue}
      invertPrice={invertPrice}
    />
  )
}
