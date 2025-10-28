import { useTranslation } from '@pancakeswap/localization'
import { Box, useMatchBreakpoints } from '@pancakeswap/uikit'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'
import { HomePageToken } from 'edge/home/types'
import { CardRowLayout } from './component/CardRowLayout'
import { CardSection } from './component/CardSection'
import { HomepageCardBadge } from './component/HomepageCardBadge'
import { HomepageSymbol } from './component/HomepageSymbol'

type SwapPricesCardProps = {
  tokens: HomePageToken[]
}

// Helper function to determine dimension based on device type
const getDimension = (isMobile: boolean, isTablet: boolean) => {
  if (isMobile) return '32px'
  if (isTablet) return '36px'
  return '40px'
}

// Helper function to determine logo size
const getLogoSize = (isMobile: boolean, isTablet: boolean) => {
  if (isMobile) return '20px'
  if (isTablet) return '22px'
  return '24px'
}

const TokenRow = ({ token, isLast }: { token: HomePageToken; isLast?: boolean }) => {
  const { isMobile, isTablet } = useMatchBreakpoints()

  const dimension = getDimension(isMobile, isTablet)
  const logoSize = getLogoSize(isMobile, isTablet)

  return (
    <CardRowLayout
      isLast={isLast}
      left={
        <>
          <CurrencyLogo
            style={{
              width: dimension,
              height: dimension,
              marginRight: '12px',
            }}
            currency={{ address: token.id, chainId: 56, isToken: true }}
            size={logoSize}
          />
          <HomepageSymbol isMobile={isMobile} isTablet={isTablet}>
            {token.symbol}
          </HomepageSymbol>
        </>
      }
    >
      <HomepageCardBadge text={`$${formatNumber(token.price)}`} priceChange={token.percent} />
    </CardRowLayout>
  )
}

export const SwapWithBestPriceCard = ({ tokens }: SwapPricesCardProps) => {
  const { t } = useTranslation()

  return (
    <CardSection
      title={t('Swap with Best Prices')}
      subtitle={t('with Fees as Low as 0.01%')}
      button={{
        link: '/swap',
        text: 'Swap',
      }}
    >
      <Box mt="8px">
        {tokens.slice(0, 3).map((token, i) => (
          <TokenRow key={token.id} token={token} isLast={i === 2} />
        ))}
      </Box>
    </CardSection>
  )
}
