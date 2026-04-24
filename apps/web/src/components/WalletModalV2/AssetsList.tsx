import React, { useCallback, useEffect, useRef, useState } from 'react'

import { BalanceData } from 'hooks/useAddressBalance'
import styled from 'styled-components'
import { formatAmount } from 'utils/formatInfoNumbers'
import { safeGetAddress } from 'utils/safeGetAddress'

import { ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'
import { Box, FlexGap, Skeleton, Text } from '@pancakeswap/uikit'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'

import { PnLTag } from './PnLTag'
import { useEnhancedTokenLogo } from './hooks/useEnhancedTokenLogo'

const SCROLLBAR_SHIFT_PX = 8

const AssetListContainer = styled(Box)`
  overflow-y: auto;
  padding: 0;
  width: calc(100% + ${SCROLLBAR_SHIFT_PX}px);
  margin-right: -${SCROLLBAR_SHIFT_PX}px;
  padding-right: ${SCROLLBAR_SHIFT_PX}px;
  min-height: 250px;
  ${({ theme }) => theme.mediaQueries.md} {
    flex: 1;
    min-height: 0;
  }
`

const AssetListWrapper = styled(Box)`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`

const BottomGradient = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: ${SCROLLBAR_SHIFT_PX}px;
  height: 74px;
  pointer-events: none;
  background: linear-gradient(180deg, transparent 0%, ${({ theme }) => theme.colors.backgroundAlt} 100%);
`

const AssetItem = styled(FlexGap)<{ $clickable: boolean }>`
  padding: 10px 8px;
  margin-bottom: 0;
  align-items: center;
  justify-content: space-between;
  border-radius: 16px;
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  overflow: hidden;
  transition: background 150ms ease;
  &:hover {
    background: ${({ theme, $clickable }) => ($clickable ? theme.colors.tertiary : 'transparent')};
  }
`

const TokenIcon = styled(Box)`
  width: 40px;
  height: 40px;
  margin-right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
`

interface AssetsListProps {
  assets: BalanceData[]
  isLoading: boolean
  onRowClick?: (asset: BalanceData) => void
}

export const AssetsList: React.FC<AssetsListProps> = ({ assets, isLoading, onRowClick }) => {
  const { getEnhancedLogoURI } = useEnhancedTokenLogo()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasMoreBelow, setHasMoreBelow] = useState(false)

  const checkScrollable = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setHasMoreBelow(el.scrollHeight > el.clientHeight + el.scrollTop + 1)
  }, [])

  useEffect(() => {
    checkScrollable()
  }, [assets, isLoading, checkScrollable])

  return (
    <AssetListWrapper>
      <AssetListContainer ref={scrollRef as any} onScroll={checkScrollable}>
        {isLoading ? (
          <FlexGap justifyContent="center" padding="4px" flexDirection="column" gap="8px">
            <Skeleton height="55px" width="100%" />
            <Skeleton height="55px" width="100%" />
            <Skeleton height="55px" width="100%" />
            <Skeleton height="55px" width="100%" />
            <Skeleton height="55px" width="100%" />
            <Skeleton height="55px" width="100%" />
          </FlexGap>
        ) : assets.length === 0 ? null : (
          assets.map((asset) => {
            const address = safeGetAddress(asset.token.address)
            const isNative = address === ZERO_ADDRESS
            const enhancedLogoURI = getEnhancedLogoURI(asset.token.address, asset.chainId, asset.token.logoURI)
            const tokenInfo = {
              chainId: asset.chainId,
              address: address === ZERO_ADDRESS ? undefined : address,
              isNative,
              isToken: !isNative,
              decimals: asset.token.decimals,
              symbol: asset.token.symbol,
              name: asset.token.name,
              logoURI: enhancedLogoURI,
            }
            const quantityNum = parseFloat(asset.quantity)
            const quantityDisplay =
              quantityNum < 0.000001
                ? '<0.000001'
                : quantityNum.toLocaleString(undefined, {
                    maximumFractionDigits:
                      asset?.price?.totalUsd !== undefined &&
                      asset?.price?.totalUsd !== null &&
                      asset?.price?.totalUsd > 0 &&
                      asset?.price?.totalUsd < 1
                        ? 6
                        : 4,
                    minimumFractionDigits: 2,
                  })
            return (
              <AssetItem
                key={asset.id}
                $clickable={Boolean(onRowClick)}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(asset) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onRowClick(asset)
                        }
                      }
                    : undefined
                }
              >
                <FlexGap alignItems="center" minWidth={0} flex={1}>
                  <TokenIcon>
                    <CurrencyLogo showChainLogo currency={tokenInfo} size="40px" />
                  </TokenIcon>
                  <Box minWidth={0}>
                    <FlexGap alignItems="baseline" gap="4px">
                      <Text
                        bold
                        fontSize="16px"
                        style={{
                          maxWidth: '80px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {asset.token.symbol}
                      </Text>
                      <Text
                        color="textSubtle"
                        fontSize="14px"
                        style={{
                          maxWidth: '80px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {asset.token.name}
                      </Text>
                    </FlexGap>
                    <Text bold fontSize="14px">
                      {quantityDisplay} {asset.token.symbol}
                    </Text>
                  </Box>
                </FlexGap>
                <FlexGap flexDirection="column" alignItems="flex-end" gap="2px" flexShrink={0}>
                  <Text bold fontSize="16px">
                    {asset.price?.totalUsd
                      ? asset.price?.totalUsd < 0.01
                        ? '<$0.01'
                        : `$${formatAmount(asset.price.totalUsd)}`
                      : '$0.00'}
                  </Text>
                  {asset.price?.usd != null && asset.price.usd24h != null && asset.price.usd24h > 0 && (
                    <PnLTag
                      priceChangePercent={((asset.price.usd - asset.price.usd24h) / asset.price.usd24h) * 100}
                      size="sm"
                    />
                  )}
                </FlexGap>
              </AssetItem>
            )
          })
        )}
      </AssetListContainer>
      {hasMoreBelow && <BottomGradient />}
    </AssetListWrapper>
  )
}

export default AssetsList
