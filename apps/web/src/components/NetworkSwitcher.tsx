import { ChainId, Chains, NonEVMChainId, UnifiedChainId } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import { NATIVE } from '@pancakeswap/sdk'
import { Box, UserMenu, useTooltip, useMatchBreakpoints } from '@pancakeswap/uikit'
import { ASSET_CDN } from 'config/constants/endpoints'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useSwitchNetwork } from 'hooks/useSwitchNetwork'
import { useAtom } from 'jotai'
import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import { NetworkSwitcherModal, networkSwitcherModalAtom } from './NetworkSwitcherModal'

export const SHORT_SYMBOL = {
  [ChainId.ETHEREUM]: 'ETH',
  [ChainId.BSC]: 'BNB',
  [ChainId.BSC_TESTNET]: 'tBNB',
  [ChainId.GOERLI]: 'GOR',
  [ChainId.ARBITRUM_ONE]: 'ARB',
  [ChainId.ARBITRUM_GOERLI]: 'tARB',
  [ChainId.ZKSYNC]: 'zkSync',
  [ChainId.ZKSYNC_TESTNET]: 'tZkSync',
  [ChainId.LINEA]: 'Linea',
  [ChainId.LINEA_TESTNET]: 'tLinea',
  [ChainId.OPBNB]: 'opBNB',
  [ChainId.OPBNB_TESTNET]: 'tOpBNB',
  [ChainId.BASE]: 'Base',
  [ChainId.BASE_TESTNET]: 'tBase',
  [ChainId.SCROLL_SEPOLIA]: 'tScroll',
  [ChainId.SEPOLIA]: 'sepolia',
  [ChainId.BASE_SEPOLIA]: 'Base Sepolia',
  [ChainId.ARBITRUM_SEPOLIA]: 'Arb Sepolia',
  [ChainId.MONAD_MAINNET]: 'Monad',
  [ChainId.MONAD_TESTNET]: 'tMonad',
  [NonEVMChainId.SOLANA]: 'Sol',
  [NonEVMChainId.APTOS]: 'Aptos',
} as const satisfies Record<UnifiedChainId, string>

export const NetworkSwitcher = () => {
  const { t } = useTranslation()
  const { isMobile } = useMatchBreakpoints()
  const { chainId, isWrongNetwork } = useActiveChainId()
  const { isLoading, canSwitch } = useSwitchNetwork()
  const router = useRouter()
  const [, setIsNetworkSwitcherOpen] = useAtom(networkSwitcherModalAtom)

  const foundChain = useMemo(() => Chains.find((c) => c.id === chainId), [chainId])
  const symbol = foundChain?.id ? SHORT_SYMBOL[foundChain.id] ?? NATIVE[foundChain.id]?.symbol : undefined
  const { targetRef, tooltip, tooltipVisible } = useTooltip(
    t('Unable to switch network. Please try it on your wallet'),
    { placement: 'bottom', avoidToStopPropagation: isMobile },
  )

  const cannotChangeNetwork = !canSwitch

  const handleOpenNetworkModal = useCallback(() => {
    if (!cannotChangeNetwork) {
      setIsNetworkSwitcherOpen(true)
    }
  }, [cannotChangeNetwork, setIsNetworkSwitcherOpen])

  if (!chainId || router.pathname.includes('/info')) {
    return null
  }

  return (
    <Box ref={targetRef} height="100%">
      {cannotChangeNetwork && tooltipVisible && tooltip}
      <UserMenu
        mr="8px"
        placement="bottom"
        variant={isLoading ? 'pending' : isWrongNetwork ? 'danger' : 'default'}
        avatarSrc={`${ASSET_CDN}/web/chains/${chainId}.png`}
        disabled={cannotChangeNetwork}
        text={
          isLoading ? (
            t('Requesting')
          ) : isWrongNetwork ? (
            t('Network')
          ) : foundChain ? (
            <>
              <Box display={['none', null, null, null, null, null, 'block']}>{foundChain.fullName}</Box>
              <Box display={['block', null, null, null, null, null, 'none']}>{symbol}</Box>
            </>
          ) : (
            t('Select a Network')
          )
        }
        onClick={handleOpenNetworkModal}
      />

      <NetworkSwitcherModal />
    </Box>
  )
}
