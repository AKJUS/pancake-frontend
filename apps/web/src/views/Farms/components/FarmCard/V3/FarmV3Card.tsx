import { useTranslation } from '@pancakeswap/localization'
import { Card, ExpandableSectionButton, Flex, Text, TooltipText, useModalV2, useTooltip } from '@pancakeswap/uikit'
import { FarmWidget } from '@pancakeswap/widgets-internal'
import BigNumber from 'bignumber.js'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useMerklInfo } from 'hooks/useMerkl'
import { useCallback, useMemo, useState } from 'react'
import { type V3Farm } from 'state/farms/types'
import { multiChainPaths } from 'state/info/constant'
import { styled } from 'styled-components'
import { getBlockExploreLink, isAddressEqual } from 'utils'
import { getMerklLink, useMerklUserLink } from 'utils/getMerklLink'
import { unwrappedToken } from 'utils/wrappedCurrency'
import { AddLiquidityV3Modal } from 'views/AddLiquidityV3/Modal'
import { useFarmV3Multiplier } from 'views/Farms/hooks/v3/useFarmV3Multiplier'
import { useIncentraInfo } from 'hooks/useIncentra'
import { getIncentraLink, INCENTRA_USER_LINK } from 'utils/getIncentraLink'
import { Protocol } from '@pancakeswap/farms'
import CardHeading from '../CardHeading'
import CardActionsContainer from './CardActionsContainer'
import { FarmV3ApyButton, FarmV3ApyButtonProps } from './FarmV3ApyButton'

const { DetailsSection } = FarmWidget.FarmCard

const StyledCard = styled(Card)`
  align-self: baseline;
  max-width: 100%;
  margin: 0 0 24px 0;
  ${({ theme }) => theme.mediaQueries.sm} {
    max-width: 350px;
    margin: 0 12px 46px;
  }
`

const FarmCardInnerContainer = styled(Flex)`
  flex-direction: column;
  justify-content: space-around;
  padding: 24px;
`

const ExpandingWrapper = styled.div`
  padding: 24px;
  border-top: 2px solid ${({ theme }) => theme.colors.cardBorder};
  overflow: hidden;
`

interface FarmCardProps {
  farm: V3Farm
  removed: boolean
  cakePrice?: BigNumber
  account?: string
}

export const FarmV3Card: React.FC<React.PropsWithChildren<FarmCardProps>> = ({ farm, removed, account }) => {
  const { t } = useTranslation()
  const { chainId } = useActiveChainId()
  const [showExpandableSection, setShowExpandableSection] = useState(false)

  const { totalMultipliers, getFarmCakePerSecond } = useFarmV3Multiplier()

  const farmCakePerSecond = getFarmCakePerSecond(farm.poolWeight)

  const lpLabel = farm.lpSymbol && farm.lpSymbol.replace(/pancake/gi, '')
  const { lpAddress } = farm
  const isPromotedFarm = farm.token.symbol === 'CAKE'
  const merklUserLink = useMerklUserLink()
  const { hasMerkl, merklApr } = useMerklInfo(lpAddress)
  const merklLink = getMerklLink({ hasMerkl, chainId, lpAddress, poolProtocol: Protocol.V3 })
  const { incentraApr, hasIncentra, incentraCampaignType } = useIncentraInfo(lpAddress)
  const incentraLink = getIncentraLink({ hasIncentra, chainId, lpAddress, campaignType: incentraCampaignType })
  const infoUrl = useMemo(() => {
    return chainId ? `/info/v3${multiChainPaths[chainId]}/pairs/${lpAddress}?chain=${CHAIN_QUERY_NAME[chainId]}` : ''
  }, [chainId, lpAddress])
  const hasBothFarmAndMerkl = useMemo(
    // for now, only rETH-ETH require both farm and merkl, so we hardcode it here
    () => Boolean(merklLink) && isAddressEqual(farm.lpAddress, '0x2201d2400d30BFD8172104B4ad046d019CA4E7bd'),
    [farm.lpAddress, merklLink],
  )

  const toggleExpandableSection = useCallback(() => {
    setShowExpandableSection((prev) => !prev)
  }, [])
  const aprTooltip = useTooltip(
    <>
      <Text>
        {t(
          'Global APR calculated using the total amount of active & staked liquidity with the pool CAKE reward emissions.',
        )}
      </Text>
      <br />
      <Text>{t('APRs for individual positions may vary depend on their price range settings.')}</Text>
    </>,
  )
  const addLiquidityModal = useModalV2()

  return (
    <StyledCard isActive={isPromotedFarm}>
      <FarmCardInnerContainer>
        <CardHeading
          lpLabel={lpLabel}
          hasBothFarmAndMerkl={hasBothFarmAndMerkl}
          multiplier={farm.multiplier}
          token={farm.token}
          quoteToken={farm.quoteToken}
          version={3}
          feeAmount={farm.feeAmount}
          farmCakePerSecond={farmCakePerSecond}
          totalMultipliers={totalMultipliers}
          isCommunityFarm={farm.isCommunity}
          lpAddress={lpAddress}
          merklApr={merklApr}
          merklLink={merklLink}
          merklUserLink={merklUserLink}
          incentraLink={incentraLink}
          incentraUserLink={INCENTRA_USER_LINK}
        />
        {!removed && (
          <Flex justifyContent="space-between" alignItems="center">
            <TooltipText ref={aprTooltip.targetRef}>{t('APR')}:</TooltipText>
            {aprTooltip.tooltipVisible && aprTooltip.tooltip}
            <Text style={{ display: 'flex', alignItems: 'center' }}>
              <FarmV3ApyButton
                farm={farm}
                additionAprInfo={
                  [
                    merklApr && merklLink
                      ? { aprTitle: t('Merkl APR'), aprValue: merklApr, aprLink: merklLink }
                      : undefined,
                    incentraApr && incentraLink
                      ? { aprTitle: `Incentra ${t('APR')}`, aprValue: incentraApr, aprLink: incentraLink }
                      : undefined,
                  ].filter(Boolean) as NonNullable<FarmV3ApyButtonProps['additionAprInfo']>
                }
              />
            </Text>
          </Flex>
        )}
        <Flex justifyContent="space-between">
          <Text>{t('Earn.verb')}:</Text>
          <Text>{t('CAKE + Fees')}</Text>
        </Flex>
        <CardActionsContainer farm={farm} lpLabel={lpLabel} account={account} />
      </FarmCardInnerContainer>
      <ExpandingWrapper>
        <ExpandableSectionButton onClick={toggleExpandableSection} expanded={showExpandableSection} />
        {showExpandableSection && (
          <>
            <AddLiquidityV3Modal
              {...addLiquidityModal}
              currency0={unwrappedToken(farm.token)}
              currency1={unwrappedToken(farm.quoteToken)}
              feeAmount={farm.feeAmount}
            />
            <DetailsSection
              removed={removed}
              scanAddress={{ link: getBlockExploreLink(lpAddress, 'address', chainId), chainId }}
              infoAddress={infoUrl}
              totalValueFormatted={`$${parseInt(farm.activeTvlUSD ?? '0').toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}`}
              totalValueLabel={t('Staked Liquidity')}
              lpLabel={lpLabel}
              onAddLiquidity={addLiquidityModal.onOpen}
              isCommunity={farm.isCommunity}
              multiplier={farm.multiplier}
              farmCakePerSecond={farmCakePerSecond}
              totalMultipliers={totalMultipliers}
            />
          </>
        )}
      </ExpandingWrapper>
    </StyledCard>
  )
}
