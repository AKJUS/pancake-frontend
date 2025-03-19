import { bCakeSupportedChainId } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import {
  Box,
  Button,
  Flex,
  Heading,
  HelpIcon,
  LinkExternal,
  Message,
  MessageText,
  PageHeader,
  Text,
  useMatchBreakpoints,
} from '@pancakeswap/uikit'
import useActiveWeb3React from 'hooks/useActiveWeb3React'
import useTheme from 'hooks/useTheme'
import { memo, useCallback } from 'react'
import { BCakeBoosterCard } from 'views/Farms/components/YieldBooster/components/bCakeV3/BCakeBoosterCard'
import { BCakeMigrationBanner } from 'views/Home/components/Banners/BCakeMigrationBanner'

export const Header = memo(function Header() {
  const { t } = useTranslation()
  const { isDesktop, isMobile } = useMatchBreakpoints()
  const { chainId } = useActiveWeb3React()
  const { theme } = useTheme()
  const redirectToDocs = useCallback(() => {
    if (typeof window !== 'undefined' && window) {
      window.open(
        'https://blog.pancakeswap.finance/articles/pancakeswap-rolls-out-the-position-manager-feature-on-v3',
        '_blank',
        'noopener noreferrer',
      )
    }
  }, [])

  return (
    <PageHeader style={isMobile ? { padding: '16px 0' } : undefined}>
      {!isMobile && (
        <Box mb="32px" mt="16px">
          <BCakeMigrationBanner />
        </Box>
      )}
      <Flex justifyContent="space-between" alignItems="flex-start" flexDirection="row" flexWrap="nowrap">
        <Flex
          flex="1"
          flexDirection="column"
          mr={['8px', 0]}
          alignSelf={['flex-start', 'flex-start', 'flex-start', 'center']}
        >
          <Heading
            as="h1"
            scale={isMobile ? 'md' : 'xxl'}
            color={isMobile ? 'text' : 'secondary'}
            mb={isMobile ? '8px' : '24px'}
          >
            {t('Position Manager')}
          </Heading>
          <Heading scale={isMobile ? 'md' : 'lg'} color={isMobile ? 'secondary' : 'text'}>
            {t('Automate your PancakeSwap V3 liquidity')}
          </Heading>
          {!isMobile && (
            <LinkExternal
              href="https://blog.pancakeswap.finance/articles/pancakeswap-rolls-out-the-position-manager-feature-on-v3"
              showExternalIcon={false}
            >
              <Button p="0" variant="text">
                <Text color="primary" bold fontSize="16px" mr="4px">
                  {t('Learn How')}
                </Text>
              </Button>
            </LinkExternal>
          )}
        </Flex>

        {isDesktop && bCakeSupportedChainId.includes(chainId) && <BCakeBoosterCard variants="pm" />}
        {isMobile && (
          <Button width="40px" height="40px" variant="subtle" px="16px" scale="md" onClick={redirectToDocs}>
            <HelpIcon color={theme.isDark ? '#280D5F' : 'white'} />
          </Button>
        )}
      </Flex>
    </PageHeader>
  )
})

export const DefiEdgeWarning = () => {
  const { t } = useTranslation()
  return (
    <Box maxWidth="1200px" m="0 auto">
      <Message variant="warning">
        <MessageText fontSize="17px">
          <Text color="warning" as="span" bold>
            {t(
              'DeFiEdge will stop maintaining its vaults from 10 Oct 2024 onwards. Please remove your funds before that to avoid any issues. Beyond 10 Oct, they will place the liquidity in a wide range, and will no longer actively manage it.',
            )}
          </Text>
        </MessageText>
      </Message>
    </Box>
  )
}
