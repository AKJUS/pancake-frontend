import React from 'react'

import { BalanceData } from 'hooks/useAddressBalance'
import styled from 'styled-components'
import { formatAmount } from 'utils/formatInfoNumbers'
import { safeGetAddress } from 'utils/safeGetAddress'

import { useTranslation } from '@pancakeswap/localization'
import { ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'
import { Box, FlexGap, Skeleton, Text } from '@pancakeswap/uikit'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'

import { useEnhancedTokenLogo } from './hooks/useEnhancedTokenLogo'
import { getChainDisplayName } from './utils/getChainDisplayName'

const SCROLLBAR_SHIFT_PX = 8

const AssetListContainer = styled(Box)`
  max-height: 280px;
  overflow-y: auto;
  padding: 0;
  width: calc(100% + ${SCROLLBAR_SHIFT_PX}px);
  margin-right: -${SCROLLBAR_SHIFT_PX}px;
  padding-right: ${SCROLLBAR_SHIFT_PX}px;
  min-height: 250px;
  ${({ theme }) => theme.mediaQueries.md} {
    max-height: 340px;
    min-height: 300px;
  }
`

const AssetItem = styled(FlexGap)`
  padding: 4px 0px;
  margin-bottom: 8px;
  align-items: center;
  justify-content: space-between;
  border-radius: 16px;
  cursor: pointer;
  overflow: hidden;
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
  const { t } = useTranslation()
  const { getEnhancedLogoURI } = useEnhancedTokenLogo()

  return (
    <AssetListContainer>
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
          const chainName = getChainDisplayName(asset.chainId)
          return (
            <AssetItem key={asset.id} onClick={onRowClick ? () => onRowClick(asset) : undefined}>
              <FlexGap alignItems="center">
                <TokenIcon>
                  <CurrencyLogo showChainLogo currency={tokenInfo} size="40px" />
                </TokenIcon>
                <Box>
                  <FlexGap alignItems="center">
                    <Text
                      bold
                      fontSize="16px"
                      style={{
                        maxWidth: '70px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {asset.token.symbol}
                    </Text>
                    <Text
                      ml="8px"
                      color="textSubtle"
                      fontSize="14px"
                      style={{
                        maxWidth: '60px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {asset.token.name}
                    </Text>
                  </FlexGap>

                  <Text fontSize="12px" color="textSubtle" textTransform="uppercase" bold>
                    {chainName} {t('Chain')}
                  </Text>
                </Box>
              </FlexGap>
              <Box style={{ textAlign: 'right' }}>
                <Text bold fontSize="14px">
                  {parseFloat(asset.quantity) < 0.000001
                    ? '<0.000001'
                    : parseFloat(asset.quantity).toLocaleString(undefined, {
                        maximumFractionDigits:
                          asset?.price?.totalUsd !== undefined &&
                          asset?.price?.totalUsd !== null &&
                          asset?.price?.totalUsd > 0 &&
                          asset?.price?.totalUsd < 1
                            ? 6
                            : 4,
                        minimumFractionDigits: 2,
                      })}
                </Text>
                <Text color="textSubtle" fontSize="14px">
                  {asset.price?.totalUsd
                    ? asset.price?.totalUsd < 0.01
                      ? '<$0.01'
                      : `$${formatAmount(asset.price.totalUsd)}`
                    : '$0.00'}
                </Text>
              </Box>
            </AssetItem>
          )
        })
      )}
    </AssetListContainer>
  )
}

export default AssetsList
