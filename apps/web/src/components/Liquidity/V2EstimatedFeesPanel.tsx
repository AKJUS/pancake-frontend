import { useV2DerivedApr } from 'hooks/useDerivedPoolApr'
import type { StablePoolInfo, V2PoolInfo } from 'state/farmsV4/state/type'
import { EstimatedFeesPanel as SharedEstimatedFeesPanel } from './EstimatedFeesPanel'

export const V2EstimatedFeesPanel: React.FC<{
  poolInfo: V2PoolInfo | StablePoolInfo | undefined | null
  totalUsdValue: number
}> = ({ poolInfo, totalUsdValue }) => {
  const { lpApr, cakeAprValue, merklApr, incentraApr } = useV2DerivedApr(poolInfo)
  return (
    <SharedEstimatedFeesPanel
      lpApr={lpApr}
      cakeAprValue={cakeAprValue}
      merklApr={merklApr}
      incentraApr={incentraApr}
      totalUsdValue={totalUsdValue}
    />
  )
}
