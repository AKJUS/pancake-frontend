import Page from 'components/Layout/Page'
import styled, { css } from 'styled-components'
import { ArrowForwardIcon, Box, Card, CardBody, Container, FlexGap, LinkExternal, Text } from '@pancakeswap/uikit'
import { useTranslation } from '@pancakeswap/localization'
import { LightGreyCard, NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { getChainName } from '@pancakeswap/chains'
import { LiquidityType } from 'utils/types'
import { BreadcrumbNav } from './components/BreadcrumbNav'
import { useProtocolSupported } from './hooks/useProtocolSupported'

const StyledBox = styled(Box)`
  background: ${({ theme }) => theme.colors.backgroundPage};
`

const StyledCard = styled(LightGreyCard)<{ $disabled?: boolean }>`
  border-radius: 24px;
  border-color: ${({ theme }) => theme.colors.inputSecondary};

  padding: 12px 16px;

  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: center;

  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  transition: background-color 0.125s ease-out;

  .arrow-icon {
    opacity: 0.5;
    transition: opacity 0.2s ease-out;
  }

  ${({ $disabled }) =>
    !$disabled &&
    css`
      &:hover {
        background-color: ${({ theme }) => theme.colors.input};

        .arrow-icon {
          opacity: 1;
        }
      }

      &:active {
        background-color: ${({ theme }) => theme.colors.inputSecondary};
      }
    `}
`

function InfinityCard({ disabled }: { disabled?: boolean }) {
  const { t } = useTranslation()

  return (
    <StyledCard
      mt="16px"
      title={disabled ? t('Infinity Pools are not supported on this chain') : undefined}
      $disabled={disabled}
    >
      <Box>
        <Text fontSize="20px" color="secondary" bold>
          {t('Infinity Pool')}
        </Text>
        <Text small>
          {t(
            'Supports multiple pool types with gas-efficient design, hooks, and flexible liquidity options. Ideal for advanced strategies and maximizing returns.',
          )}
        </Text>
      </Box>
      <Box>
        <ArrowForwardIcon width="24px" height="24px" className="arrow-icon" />
      </Box>
    </StyledCard>
  )
}

function V2Card({ disabled }: { disabled?: boolean }) {
  const { t } = useTranslation()
  return (
    <StyledCard mt="16px" $disabled={disabled}>
      <Box>
        <Text fontSize="20px" color="secondary" bold>
          {t('V2 Pool')}
        </Text>
        <Text small>
          {t(
            'Classic pools that let you provide liquidity across the full price range for steady, predictable trading fees.',
          )}
        </Text>
      </Box>
      <Box>
        <ArrowForwardIcon width="24px" height="24px" className="arrow-icon" />
      </Box>
    </StyledCard>
  )
}

export const CreateLiquiditySelector = () => {
  const { t } = useTranslation()
  const { chainId } = useActiveChainId()

  const chainName = getChainName(chainId)

  const { isInfinitySupported, isV2Supported } = useProtocolSupported()

  return (
    <StyledBox>
      <Page>
        <Box mt="2px">
          <BreadcrumbNav />
        </Box>
        <Container px="0" mt="24px" maxWidth={[null, null, null, '520px']}>
          <Card>
            <CardBody>
              <FlexGap justifyContent="space-between" flexWrap="wrap" gap="16px">
                <Text>{t('Select the DEX type of the liquidity pool')}</Text>
                <LinkExternal color="primary60" href="https://docs.pancakeswap.finance/earn/pancakeswap-pools">
                  {t('Learn More')}
                </LinkExternal>
              </FlexGap>

              {isInfinitySupported(chainId) ? (
                <NextLinkFromReactRouter to={`/liquidity/create/${chainName}/${LiquidityType.Infinity}`}>
                  <InfinityCard />
                </NextLinkFromReactRouter>
              ) : (
                <>
                  <InfinityCard disabled />
                </>
              )}

              <NextLinkFromReactRouter to={`/liquidity/create/${chainName}/${LiquidityType.V3}`}>
                <StyledCard mt="16px">
                  <Box>
                    <Text fontSize="20px" color="secondary" bold>
                      {t('V3 Pool')}
                    </Text>
                    <Text small>
                      {t(
                        'Advanced pools where you choose specific price ranges to provide liquidity, earning higher fees in your chosen range.',
                      )}
                    </Text>
                  </Box>
                  <Box>
                    <ArrowForwardIcon width="24px" height="24px" className="arrow-icon" />
                  </Box>
                </StyledCard>
              </NextLinkFromReactRouter>

              {isV2Supported(chainId) ? (
                <NextLinkFromReactRouter to={`/liquidity/create/${chainName}/${LiquidityType.V2}`}>
                  <V2Card />
                </NextLinkFromReactRouter>
              ) : (
                <V2Card disabled />
              )}
            </CardBody>
          </Card>
        </Container>
      </Page>
    </StyledBox>
  )
}
