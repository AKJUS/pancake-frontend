import { Chain, Chains } from '@pancakeswap/chains'
import { INFINITY_SUPPORTED_CHAINS } from '@pancakeswap/infinity-sdk'
import { Select } from '@pancakeswap/uikit'
import { ASSET_CDN } from 'config/constants/endpoints'
import { DISABLED_ADD_LIQUIDITY_CHAINS } from 'config/constants/liquidity'
import { useEffect, useMemo } from 'react'
import { useUserShowTestnet } from 'state/user/hooks/useUserShowTestnet'
import { LiquidityType } from 'utils/types'
import { useProtocolSupported } from 'views/CreateLiquidityPool/hooks/useProtocolSupported'

interface NetworkSelectorProps {
  chainId?: number
  version?: LiquidityType
  onChange?: (chain: Chain) => void
}

// TODO: should design in a better way to rely on infinity
// This should be a standalone component
export const NetworkSelector = ({
  version,
  onChange,
  chainId = INFINITY_SUPPORTED_CHAINS[0],
}: NetworkSelectorProps) => {
  const [showTestnet] = useUserShowTestnet()
  const { isInfinitySupported, isV2Supported, isV3Supported, isStableSwapSupported } = useProtocolSupported()

  const chainList = useMemo(
    () =>
      Chains.filter((chain) => !DISABLED_ADD_LIQUIDITY_CHAINS[chain.id])
        .filter((chain) => version !== 'infinity' || isInfinitySupported(chain.id))
        .filter((chain) => version !== 'v3' || isV3Supported(chain.id))
        .filter((chain) => version !== 'stableSwap' || isStableSwapSupported(chain.id))
        .filter((chain) => version !== 'v2' || isV2Supported(chain.id))
        .filter((chain) => {
          if (chain.id === chainId) return true
          if ('testnet' in chain && chain.testnet) return showTestnet
          return true
        }),
    [version, chainId, showTestnet, isInfinitySupported, isStableSwapSupported, isV2Supported, isV3Supported],
  )

  const defaultOptionIndex = useMemo(
    () => chainList.findIndex((chain) => chain.id === chainId) + 1,
    [chainList, chainId],
  )

  useEffect(() => {
    const chainInList = chainList.find((chain) => chain.id === chainId)
    if (!chainInList) {
      const chain = chainList[defaultOptionIndex]
      if (chain) {
        onChange?.(chainList[defaultOptionIndex])
      }
    }
  }, [chainList, defaultOptionIndex, chainId, onChange])

  return (
    <Select
      options={chainList.map((chain) => ({
        label: chain.fullName,
        value: chain,
        imageUrl: `${ASSET_CDN}/web/chains/${chain.id}.png`,
      }))}
      onOptionChange={(option) => onChange?.(option.value)}
      defaultOptionIndex={
        // Note: index needs to be plus one because of this:
        // packages/uikit/src/components/Select/Select.tsx:129
        defaultOptionIndex
      }
      style={{
        zIndex: 30,
      }}
      listStyle={{
        maxHeight: '45vh',
        overflowY: 'auto',
      }}
      textStyle={{
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        paddingRight: '16px',
      }}
    />
  )
}
