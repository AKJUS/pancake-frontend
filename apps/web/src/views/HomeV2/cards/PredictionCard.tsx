import { useTranslation } from '@pancakeswap/localization'
import { ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'
import { Flex, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { formatAmount } from '@pancakeswap/utils/formatInfoNumbers'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'
import BlockiesSvg from 'blockies-react-svg'
import { HomePageToken, HomePageUser } from 'pages/api/home/types'
import styled from 'styled-components'
import { CardRowLayout } from './component/CardRowLayout'
import { CardSection } from './component/CardSection'
import { HomepageCardBadge } from './component/HomepageCardBadge'
import { HomepageSymbol } from './component/HomepageSymbol'

// Tablet uses the same color set as PC, so no color changes.
// We'll only handle layout updates (font sizes, image sizes, etc.).

function getWinnerTextFontSize(isMobile?: boolean, isTablet?: boolean) {
  if (isMobile) return '16px'
  if (isTablet) return '17px'
  return '18px'
}

function getTopWinnerFontSize(isMobile?: boolean, isTablet?: boolean) {
  if (isMobile) return '12px'
  if (isTablet) return '13px'
  return '14px'
}

// For the CurrencyLogo, avatar and BunnyPlaceholderIcon
// we provide slightly larger size for tablet.
function getImageStyle(isMobile?: boolean) {
  if (isMobile) {
    return {
      width: '32px',
      height: '32px',
    }
  }
  return {
    width: '40px',
    height: '40px',
  }
}

const WinnerText = styled(Text)<{ isMobile?: boolean; isTablet?: boolean }>`
  font-weight: 600;
  font-size: ${({ isMobile, isTablet }) => getWinnerTextFontSize(isMobile, isTablet)};
  color: ${({ theme }) => theme.colors.text};
`

const TopWinnerTitle = styled(Text)<{ isMobile?: boolean; isTablet?: boolean }>`
  font-family: Kanit;
  font-weight: 600;
  font-size: ${({ isMobile, isTablet }) => getTopWinnerFontSize(isMobile, isTablet)};
  line-height: 21px;
  letter-spacing: 0%;
`

interface PredictionCardProps {
  token?: HomePageToken
  winner?: HomePageUser
}

export const PredictionCard: React.FC<PredictionCardProps> = ({ token, winner }) => {
  const { t } = useTranslation()
  const { isMobile, isTablet } = useMatchBreakpoints()

  if (!token || !winner) {
    return null
  }

  const { user, profile } = winner
  const avatar = profile?.nft?.image.thumbnail
  const win = user.totalBNBClaimed - user.totalBNB

  return (
    <CardSection
      // Keep the original logic for isFrameLess.
      // Not changing logic, only layout.
      isFrameLess={isMobile}
      // title={t('BNB 5-Min Prediction')}
      subtitle={t('Prediction')}
      button={{
        text: t('Play Now'),
        link: '/prediction',
      }}
    >
      <CardRowLayout
        left={
          <Flex alignItems="center">
            <CurrencyLogo
              style={getImageStyle(isMobile)}
              currency={{
                chainId: 56,
                address: ZERO_ADDRESS,
                isNative: true,
              }}
            />
            <HomepageSymbol isMobile={isMobile} isTablet={isTablet} ml="8px">
              {token.symbol}USD
            </HomepageSymbol>
          </Flex>
        }
      >
        <HomepageCardBadge text={`$${token.price.toFixed(2)}`} priceChange={token.percent} />
      </CardRowLayout>

      <CardRowLayout
        left={
          <Flex alignItems="center">
            {avatar ? (
              <img
                src={avatar}
                alt="avatar"
                style={{
                  ...getImageStyle(isMobile),
                  borderRadius: '50%',
                }}
              />
            ) : (
              <BlockiesSvg
                address={user.id}
                style={{
                  ...getImageStyle(isMobile),
                  borderRadius: '50%',
                }}
              />
            )}
            <Flex flexDirection="column" ml="8px">
              <TopWinnerTitle isMobile={isMobile} isTablet={isTablet} color="textSubtle">
                {t('Last Top Winner')}
              </TopWinnerTitle>
              <WinnerText isMobile={isMobile} isTablet={isTablet}>
                {user.id.slice(0, 6)}...{user.id.slice(-4)}
              </WinnerText>
            </Flex>
          </Flex>
        }
        isLast
      >
        <HomepageCardBadge
          text={`+${formatAmount(win, {
            precision: 1,
          })} BNB`}
        />
      </CardRowLayout>
    </CardSection>
  )
}
