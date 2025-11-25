import { ChainId, Chains, NonEVMChainId, UnifiedChainId } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import {
  appearAnimation,
  ArrowDropDownIcon,
  AutoColumn,
  AutoRow,
  Flex,
  InlineMenu,
  SkeletonText,
  Text,
} from '@pancakeswap/uikit'
import { ChainLogo } from '@pancakeswap/widgets-internal'
import { useActiveChainId } from 'hooks/useActiveChainId'
import drop from 'lodash/drop'
import take from 'lodash/take'
import { useMemo, useRef } from 'react'
import { css, styled } from 'styled-components'
import { useRouter } from 'next/router'

import { chainNameConverter } from 'utils/chainNameConverter'
import { useBridgeAvailableChains } from 'views/Swap/Bridge/hooks'
import { chains as evmChains } from 'utils/wagmi'
import { TWAP_LIMIT_SUPPORTED_CHAINS } from 'views/Swap/utils'

import { BaseWrapper, ButtonWrapper, RowWrapper } from './CommonBases'

const NetworkMenuColumn = styled(Flex)`
  flex-direction: column;
  overflow: hidden;

  background-color: ${({ theme }) => theme.colors.input};
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  border-radius: ${({ theme }) => theme.radii.card};

  animation: ${() =>
    css`
      ${appearAnimation} 0.2s ease
    `};
`

// Constants for width calculations
const CONTAINER_MAX_WIDTH = 370
const CHAIN_BUTTON_WIDTH = 42
const CHAIN_BUTTON_MARGIN = 5
const HIDDEN_CHAINS_BUTTON_WIDTH = CHAIN_BUTTON_WIDTH
const CHAIN_BUTTON_HEIGHT = 40

const ChainOption = styled(Flex)`
  padding: 8px 16px;
  &:hover {
    cursor: pointer;
    background-color: ${({ theme }) => theme.colors.background};
  }
  transition: background-color 0.15s;
`

const useIsTwap = () => {
  const router = useRouter()
  return router.pathname.includes('twap') || router.pathname.includes('limit')
}

const useCustomChains = () => {
  const isTWAP = useIsTwap()

  if (isTWAP) {
    return TWAP_LIMIT_SUPPORTED_CHAINS
  }

  return undefined
}

export default function SwapNetworkSelection({
  chainId,
  onSelect,
  isDependent,
}: {
  isDependent?: boolean
  chainId?: UnifiedChainId
  onSelect: (chainId: UnifiedChainId) => void
}) {
  const { chainId: activeChainId } = useActiveChainId()
  const isTWAP = useIsTwap()

  const usedChainId = chainId ?? activeChainId

  const { chains: supportedBridgeChains, loading: supportedBridgeChainsLoading } = useBridgeAvailableChains({
    originChainId: isDependent ? activeChainId : usedChainId,
  })

  const customChains = useCustomChains()

  const { t } = useTranslation()

  // if is twap and is dependent, show only the selected chain
  const showOnlySelectedChain = isTWAP && isDependent

  const supportedChains = useMemo(() => {
    if (showOnlySelectedChain) {
      return Chains.filter((chain) => chain.id === usedChainId)
    }
    if (isDependent) {
      return Chains.filter((chain) => chain.id === usedChainId || supportedBridgeChains.includes(chain.id))
    }

    return Chains.filter((chain) => {
      // NOTE: because Aptos is using different domain, we cannot show it in the network selector in Search Modal
      if (chain.id === NonEVMChainId.APTOS) {
        return false
      }

      if (
        chain.id !== ChainId.MONAD_TESTNET &&
        (('testnet' in chain && chain.testnet) || evmChains.find((c) => c.id === chain.id)?.testnet)
      ) {
        return false
      }

      if (customChains) {
        return customChains.includes(chain.id as number)
      }

      return true
    })
  }, [supportedBridgeChains, usedChainId, isDependent, customChains, showOnlySelectedChain])

  const selectedChain = useMemo(
    () => supportedChains.find((chain) => chain.id === usedChainId),
    [usedChainId, supportedChains],
  )

  const containerRef = useRef<HTMLDivElement>(null)

  const containerWidth = containerRef.current?.getBoundingClientRect()?.width || CONTAINER_MAX_WIDTH

  const [_, shownChains, hiddenChains] = useMemo(() => {
    const filtered = supportedChains.filter((chain) => {
      if (chain.id === usedChainId) return false
      return true
    })

    // Calculate available width and how many chains can fit
    const availableWidth = containerWidth - HIDDEN_CHAINS_BUTTON_WIDTH - CHAIN_BUTTON_MARGIN
    const chainsToShow = Math.max(1, Math.floor(availableWidth / (CHAIN_BUTTON_WIDTH + CHAIN_BUTTON_MARGIN)))

    return [filtered, take(filtered, chainsToShow), drop(filtered, chainsToShow)]
  }, [supportedChains, usedChainId, containerWidth])

  return (
    <AutoColumn gap="sm">
      <AutoRow>
        <Text color="textSubtle" fontSize="14px">
          {t('Network')}
          {selectedChain ? `: ${chainNameConverter(selectedChain.fullName)}` : ''}
        </Text>
      </AutoRow>
      <RowWrapper ref={containerRef}>
        <SkeletonText
          loading={supportedBridgeChainsLoading}
          initialWidth={CONTAINER_MAX_WIDTH}
          initialHeight={CHAIN_BUTTON_HEIGHT}
        >
          {selectedChain ? (
            <ButtonWrapper style={{ marginRight: `${CHAIN_BUTTON_MARGIN}px` }}>
              <BaseWrapper style={{ height: `${CHAIN_BUTTON_HEIGHT}px` }} id="selected-chain-wrapper" disable>
                <ChainLogo
                  imageStyles={{
                    borderRadius: '35%',
                  }}
                  chainId={selectedChain.id}
                  px="4px"
                  pt="5px"
                />
              </BaseWrapper>
            </ButtonWrapper>
          ) : null}

          {shownChains.map((chain) => {
            return (
              <ButtonWrapper
                key={`buttonNetworkSelect#${chain.id}`}
                style={{ marginRight: `${CHAIN_BUTTON_MARGIN}px`, height: `${CHAIN_BUTTON_HEIGHT}px` }}
              >
                <BaseWrapper onClick={() => onSelect(chain.id)} style={{ height: `${CHAIN_BUTTON_HEIGHT}px` }}>
                  <ChainLogo
                    imageStyles={{
                      borderRadius: '35%',
                    }}
                    chainId={chain.id}
                    px="4px"
                    pt="5px"
                  />
                </BaseWrapper>
              </ButtonWrapper>
            )
          })}

          {hiddenChains.length > 0 && (
            <InlineMenu
              component={
                <ButtonWrapper style={{ marginRight: 0, width: `${CHAIN_BUTTON_WIDTH + 8}px` }}>
                  <BaseWrapper style={{ height: `${CHAIN_BUTTON_HEIGHT}px` }}>
                    <Text color="textSubtle" bold pl="6px">
                      +{hiddenChains.length}
                    </Text>
                    <ArrowDropDownIcon color="textSubtle" width="22px" height="22px" ml="-1px" />
                  </BaseWrapper>
                </ButtonWrapper>
              }
            >
              <NetworkMenuColumn>
                {hiddenChains.map((chain) => {
                  return (
                    <ChainOption key={`buttonNetworkSelect#${chain.id}`} onClick={() => onSelect(chain.id)} pb="8px">
                      <ChainLogo
                        chainId={chain.id}
                        px="4px"
                        imageStyles={{
                          borderRadius: '35%',
                        }}
                        pt="2px"
                      />
                      <Text color="inherit" px="6px">
                        {chainNameConverter(chain.fullName)}
                      </Text>
                    </ChainOption>
                  )
                })}
              </NetworkMenuColumn>
            </InlineMenu>
          )}
        </SkeletonText>
      </RowWrapper>
    </AutoColumn>
  )
}
