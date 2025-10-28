import { useTranslation } from '@pancakeswap/localization'
import { useMatchBreakpoints } from '@pancakeswap/uikit'
import { HomepageChain, HomePageCurrency } from 'edge/home/types'
import React from 'react'
import { CardRowLayout } from './component/CardRowLayout'
import { CardRowSectionButton } from './component/CardRowSectionButton'
import { CardSection } from './component/CardSection'
import { MultipleCurrencyLogos } from './component/MultipleCurrencyLogos'

interface BridgeAndBuyCryptoCardProps {
  chains: HomepageChain[]
  currencies: HomePageCurrency[]
}

// Added a small helper function for borderRadius to support tablet
const getBorderRadius = (isMobile: boolean, isTablet: boolean) => {
  if (isMobile) return '12px'
  if (isTablet) return '14px'
  return '16px'
}

export const BridgeCryptoCard: React.FC<BridgeAndBuyCryptoCardProps> = ({ chains, currencies }) => {
  const { t } = useTranslation()
  // Added isTablet for layout changes
  const { isMobile, isTablet } = useMatchBreakpoints()

  return (
    <CardSection title={t('Bridge & Buy Crypto')} subtitle={t('Seamlessly')}>
      <CardRowLayout
        left={
          <MultipleCurrencyLogos
            gap={-12}
            borderRadius={getBorderRadius(isMobile, isTablet)}
            maxDisplay={4}
            tokens={chains.map((chain) => ({ logo: chain.logo }))}
          />
        }
      >
        <CardRowSectionButton
          alwaysShow
          link="/bridge"
          hover={{
            text: t('Bridge Now'),
            width: 240,
            originalWidth: 250,
          }}
          text={isMobile ? t('Bridge Now') : t('Bridge across %num% chains', { num: chains.length })}
        />
      </CardRowLayout>

      <CardRowLayout
        left={
          <MultipleCurrencyLogos
            gap={-12}
            maxDisplay={4}
            tokens={currencies.map((currency) => ({ logo: currency.logo }))}
          />
        }
        isLast
      >
        <CardRowSectionButton
          alwaysShow
          link="/buy-crypto"
          hover={{
            text: t('Buy Crypto Now'),
            width: 240,
            originalWidth: 250,
          }}
          text={isMobile ? t('Buy Now') : t('Choose from %num% Currencies', { num: currencies.length })}
        />
      </CardRowLayout>
    </CardSection>
  )
}
