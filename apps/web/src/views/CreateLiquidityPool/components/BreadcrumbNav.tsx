import { useTranslation } from '@pancakeswap/localization'
import { useCallback, useMemo } from 'react'
import styled from 'styled-components'
import { Breadcrumbs, Link, Text } from '@pancakeswap/uikit'
import { useRouter } from 'next/router'
import { NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'
import { useSelectIdRoute } from 'hooks/dynamicRoute/useSelectIdRoute'
import { TabMenu } from 'views/BurnDashboard/components/TabMenu'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { getChainName } from '@pancakeswap/chains'
import { LiquidityType } from 'utils/types'
import { useProtocolSupported } from '../hooks/useProtocolSupported'

const StyledLink = styled(NextLinkFromReactRouter)`
  &:hover {
    text-decoration: underline;
  }
`

// @todo @ChefJerry UI no match with design
export const BreadcrumbNav: React.FC = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const { chainId } = useActiveChainId()
  const chainName = useMemo(() => getChainName(chainId), [chainId])

  const { isInfinitySupported: checkIsInfinitySupported, isV2Supported } = useProtocolSupported()
  const isInfinitySupported = checkIsInfinitySupported(chainId)

  const { protocolName, routeParams } = useSelectIdRoute()
  const protocolFromQuery = routeParams?.selectId?.[1]

  const handleProtocolChange = useCallback(
    (tab: { value: LiquidityType; label: string; disabled?: boolean }) => {
      const protocol = tab.value

      if (protocol === 'infinity' && !isInfinitySupported) return

      const currencyIdA = routeParams?.selectId?.[2]
      const currencyIdB = routeParams?.selectId?.[3]
      if (currencyIdA && currencyIdB) {
        router.push(`/liquidity/create/${chainName}/${protocol}/${currencyIdA}/${currencyIdB}`)
      } else router.push(`/liquidity/create/${chainName}/${protocol}`)
    },
    [router, chainName, routeParams, isInfinitySupported],
  )

  return (
    <Breadcrumbs mb="32px">
      <Link href="/liquidity/pools">
        <Text color="primary60">{t('Farms')}</Text>
      </Link>
      <StyledLink to="/liquidity/create">
        <Text color="primary60">{t('Create Liquidity Pool')}</Text>
      </StyledLink>

      {protocolFromQuery && (
        <TabMenu
          tabs={[
            { value: LiquidityType.Infinity, label: 'Infinity', disabled: !isInfinitySupported },
            { value: LiquidityType.V3, label: 'V3' },
            { value: LiquidityType.V2, label: 'V2', disabled: !isV2Supported(chainId) },
          ]}
          defaultTab={{
            value: protocolName,
            label: protocolName,
            disabled: !isInfinitySupported,
          }}
          onTabChange={handleProtocolChange}
        />
      )}
    </Breadcrumbs>
  )
}
