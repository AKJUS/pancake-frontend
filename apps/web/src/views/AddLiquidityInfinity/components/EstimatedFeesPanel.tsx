import { useMemo } from 'react'
import { Currency } from '@pancakeswap/swap-sdk-core'
import { useUnifiedTokenUsdPrice } from 'hooks/useUnifiedTokenUsdPrice'
import { useInfinityBinDerivedApr, useInfinityCLDerivedApr } from 'views/universalFarms/hooks/usePositionAPR'
import type { InfinityBinPoolInfo, InfinityCLPoolInfo } from 'state/farmsV4/state/type'
import { EstimatedFeesPanel as SharedEstimatedFeesPanel } from 'components/Liquidity/EstimatedFeesPanel'
import { useAddDepositAmounts } from '../hooks/useAddDepositAmounts'

function useDepositTotalUsd(baseCurrency: Currency | undefined, quoteCurrency: Currency | undefined) {
  const { depositCurrencyAmount0, depositCurrencyAmount1 } = useAddDepositAmounts()
  const { data: basePriceUsd } = useUnifiedTokenUsdPrice(baseCurrency, Boolean(baseCurrency))
  const { data: quotePriceUsd } = useUnifiedTokenUsdPrice(quoteCurrency, Boolean(quoteCurrency))

  return useMemo(() => {
    let total = 0
    if (depositCurrencyAmount0 && basePriceUsd) {
      const n = Number(depositCurrencyAmount0.toExact())
      if (Number.isFinite(n)) total += n * basePriceUsd
    }
    if (depositCurrencyAmount1 && quotePriceUsd) {
      const n = Number(depositCurrencyAmount1.toExact())
      if (Number.isFinite(n)) total += n * quotePriceUsd
    }
    return total
  }, [depositCurrencyAmount0, depositCurrencyAmount1, basePriceUsd, quotePriceUsd])
}

export const BinEstimatedFeesPanel: React.FC<{
  poolInfo: InfinityBinPoolInfo
  baseCurrency: Currency | undefined
  quoteCurrency: Currency | undefined
}> = ({ poolInfo, baseCurrency, quoteCurrency }) => {
  const { lpApr, cakeApr, merklApr, incentraApr } = useInfinityBinDerivedApr(poolInfo)
  const totalUsdValue = useDepositTotalUsd(baseCurrency, quoteCurrency)
  return (
    <SharedEstimatedFeesPanel
      lpApr={lpApr}
      cakeAprValue={parseFloat(cakeApr?.value ?? '0')}
      merklApr={merklApr}
      incentraApr={incentraApr}
      totalUsdValue={totalUsdValue}
    />
  )
}

export const CLEstimatedFeesPanel: React.FC<{
  poolInfo: InfinityCLPoolInfo
  baseCurrency: Currency | undefined
  quoteCurrency: Currency | undefined
}> = ({ poolInfo, baseCurrency, quoteCurrency }) => {
  const { lpApr, cakeApr, merklApr, incentraApr } = useInfinityCLDerivedApr(poolInfo)
  const totalUsdValue = useDepositTotalUsd(baseCurrency, quoteCurrency)
  return (
    <SharedEstimatedFeesPanel
      lpApr={lpApr}
      cakeAprValue={parseFloat(cakeApr?.value ?? '0')}
      merklApr={merklApr}
      incentraApr={incentraApr}
      totalUsdValue={totalUsdValue}
    />
  )
}
