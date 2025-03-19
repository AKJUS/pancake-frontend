import { useTranslation } from '@pancakeswap/localization'
import { Breadcrumbs, CopyButton, Flex, ScanLink, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'
import { ChainLinkSupportChains, multiChainId, multiChainScan } from 'state/info/constant'
import { useChainNameByQuery } from 'state/info/hooks'
import { getBlockExploreLink } from 'utils'
import { usePoolSymbol } from '../hooks/usePoolSymbol'
import { useRouterQuery } from '../hooks/useRouterQuery'

export const BreadcrumbNav: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useRouterQuery()
  const chainName = useChainNameByQuery()
  const { poolSymbol } = usePoolSymbol()
  const { isMobile } = useMatchBreakpoints()

  if (!poolSymbol || poolSymbol === ' / ') return null

  return (
    <Flex justifyContent="space-between">
      <Breadcrumbs mb="32px">
        <NextLinkFromReactRouter to="/liquidity/pools">
          <Text color="primary">{t('Farms')}</Text>
        </NextLinkFromReactRouter>
        <Flex>
          <Text mr="8px">{poolSymbol}</Text>
        </Flex>
      </Breadcrumbs>
      <Flex justifyContent={[null, null, 'flex-end']} mt={['8px', '8px', 0]}>
        <ScanLink
          useBscCoinFallback={ChainLinkSupportChains.includes(multiChainId[chainName])}
          mr="8px"
          href={getBlockExploreLink(id, 'address', multiChainId[chainName])}
        >
          {!isMobile && t('View on %site%', { site: multiChainScan[chainName] })}
        </ScanLink>
        <CopyButton ml="4px" text={id} tooltipMessage={t('Token address copied')} />
      </Flex>
    </Flex>
  )
}
