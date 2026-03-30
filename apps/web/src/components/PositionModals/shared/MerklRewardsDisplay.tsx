import { useTranslation } from '@pancakeswap/localization'
import { Protocol } from '@pancakeswap/farms'
import { Button, FlexGap, Link, Message, MessageText, PreTitle, RowBetween, Text } from '@pancakeswap/uikit'
import { CurrencyLogo, LightGreyCard } from '@pancakeswap/widgets-internal'
import useMerkl from 'hooks/useMerkl'
import { getMerklLink } from 'utils/getMerklLink'

interface MerklRewardsDisplayProps {
  poolAddress?: string
  poolProtocol?: Protocol
  chainId?: number
  disabled: boolean
  outRange?: boolean
  notEnoughLiquidity?: boolean
  hideButton?: boolean
}

export function MerklRewardsDisplay({
  poolAddress,
  poolProtocol,
  chainId,
  disabled,
  outRange,
  notEnoughLiquidity,
  hideButton,
}: MerklRewardsDisplayProps) {
  const { t } = useTranslation()
  const { claimTokenReward, isClaiming, rewardsPerToken, hasMerkl } = useMerkl(poolAddress, chainId)

  const merklLink = getMerklLink({
    hasMerkl,
    chainId,
    lpAddress: poolAddress,
    poolProtocol,
  })

  if (!rewardsPerToken.length || (!hasMerkl && rewardsPerToken.every((r) => r.equalTo('0')))) return null

  const allZero = rewardsPerToken.every((r) => r.equalTo('0'))

  return (
    <>
      <LightGreyCard mt="16px" padding="16px" borderRadius="24px" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <PreTitle color="secondary" mb="8px">
          {t('Merkl Rewards')}
        </PreTitle>

        {rewardsPerToken.map((tokenAmount) => (
          <RowBetween key={tokenAmount.currency.wrapped.address} mt="8px">
            <FlexGap gap="8px" alignItems="center">
              <CurrencyLogo currency={tokenAmount.currency} size="24px" />
              <Text small color="textSubtle">
                {tokenAmount.currency.symbol}
              </Text>
            </FlexGap>
            <Text small>{tokenAmount.toSignificant(6)}</Text>
          </RowBetween>
        ))}
      </LightGreyCard>

      {outRange && hasMerkl ? (
        <Message variant="warning" mt="8px">
          <MessageText>{t('This Merkl campaign is NOT rewarding out-of-range liquidity.')}</MessageText>
        </Message>
      ) : notEnoughLiquidity && hasMerkl ? (
        <Message variant="warning" mt="8px">
          <MessageText>
            {t('Position value is less than $20 — not eligible for Merkl rewards.')}{' '}
            {merklLink && (
              <Link fontSize="inherit" color="currentColor" external href={merklLink}>
                {t('Details')}
              </Link>
            )}
          </MessageText>
        </Message>
      ) : null}

      {hideButton ? null : (
        <Button mt="16px" width="100%" disabled={disabled || isClaiming || allZero} onClick={claimTokenReward}>
          {isClaiming ? t('Claiming...') : t('Claim')}
        </Button>
      )}
    </>
  )
}
