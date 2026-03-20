import { useMemo } from 'react'
import { useTranslation } from '@pancakeswap/localization'
import { Button, Card, CardBody, CardHeader, FlexGap, Image, Text } from '@pancakeswap/uikit'
import useTheme from 'hooks/useTheme'
import NextLink from 'next/link'
import { styled } from 'styled-components'
import { CAKEPAD_HISTORY_URL, withCakepadBaseChainQuery } from 'views/Cakepad/config/routes'
import { useCakepadBaseExperience } from 'views/Cakepad/hooks/useCakepadBaseExperience'
import useIfo from '../../hooks/useIfo'
import { useIFOClaimCallback } from '../../hooks/ifo/useIFOClaimCallback'
import { useVestingInfo } from '../../hooks/ifo/useVestingInfo'

const ProgressContainer = styled.div`
  width: 100%;
  height: 8px;
  border-radius: 8px;
  background-color: #e9eaeb;
  position: relative;
  overflow: hidden;
`

const ProgressBar = styled.div<{ width: number; color: string; left?: number }>`
  position: absolute;
  top: 0;
  left: ${({ left = 0 }) => `${left}%`};
  height: 100%;
  width: ${({ width }) => `${width}%`};
  background-color: ${({ color }) => color};
`

export const IfoVestingCard: React.FC = () => {
  const { t } = useTranslation()
  const { theme, isDark } = useTheme()
  const isBaseExperience = useCakepadBaseExperience()
  const { config, info, pools, users } = useIfo()
  const name = t(config.tgeTitle.i18nText)
  const [userStatus0, userStatus1] = users
  const { claim, isPending } = useIFOClaimCallback()
  const vesting = useVestingInfo()

  const totalClaimable = useMemo(() => {
    const amount0 = userStatus0?.claimableAmount
    const amount1 = userStatus1?.claimableAmount
    if (amount0 && amount1) return amount0.add(amount1)
    return amount0 ?? amount1
  }, [userStatus0, userStatus1])

  const userParticipated =
    (userStatus0?.stakedAmount?.greaterThan(0) ?? false) || (userStatus1?.stakedAmount?.greaterThan(0) ?? false)

  const claimedAll = (userStatus0?.claimed ?? false) && (userStatus1?.claimed ?? false)
  const amountString = totalClaimable?.toSignificant(6) ?? '0'

  const progress = useMemo(() => {
    if (!vesting || !vesting.duration) return 0
    const now = Math.floor(Date.now() / 1000)
    const elapsed = now - vesting.startTime
    if (elapsed <= vesting.cliff) return 0
    const vestingPeriod = vesting.duration - vesting.cliff
    if (vestingPeriod <= 0) return 100
    const percent = Math.min(100, ((elapsed - vesting.cliff) / vestingPeriod) * 100)
    return percent
  }, [vesting])

  const claimedPercent = claimedAll ? progress : 0
  const availablePercent = claimedAll ? 0 : progress
  const cakepadHistoryUrl = withCakepadBaseChainQuery(CAKEPAD_HISTORY_URL, isBaseExperience)

  const handleClaim = async () => {
    if (userStatus0?.claimableAmount?.greaterThan(0) && pools[0]) {
      await claim(pools[0].pid)
    }
    if (userStatus1?.claimableAmount?.greaterThan(0) && pools[1]) {
      await claim(pools[1].pid)
    }
  }
  if (!info || !userParticipated || !vesting || vesting.duration === 0) {
    return null
  }
  const { offeringCurrency } = info

  return (
    <Card background={isDark ? '#18171A' : theme.colors.background} mb="16px">
      <CardHeader>
        <FlexGap justifyContent="space-between" alignItems="center">
          <FlexGap flexDirection="column" gap="4px">
            <Text fontSize="20px" bold>
              {t('Token Vesting')}
            </Text>
            <Text fontSize="14px" color="textSubtle">
              {t('Claim available tokens from IFO token vesting.')}
            </Text>
          </FlexGap>
          <Image
            src={claimedAll ? '/images/ifos/vesting/in-vesting-end.svg' : '/images/ifos/vesting/in-vesting-period.svg'}
            width={64}
            height={64}
            alt="vesting-status"
          />
        </FlexGap>
      </CardHeader>
      <CardBody>
        <FlexGap flexDirection="column" gap="16px">
          <FlexGap flexDirection="column" gap="4px">
            <FlexGap gap="4px" alignItems="center">
              <Text fontSize="20px" bold>
                {offeringCurrency?.symbol}
              </Text>
              <Text color="textSubtle">{name}</Text>
            </FlexGap>
            <Text fontSize="20px" bold>
              {amountString}
            </Text>
          </FlexGap>
          <FlexGap flexDirection="column" gap="8px">
            <Text fontSize="12px" bold color="secondary" textTransform="uppercase">
              {t('Vesting Schedule')}
            </Text>
            <ProgressContainer>
              {claimedPercent > 0 && <ProgressBar width={claimedPercent} color="#280D5F" />}
              {availablePercent > 0 && <ProgressBar width={availablePercent} left={claimedPercent} color="#7A6EAA" />}
            </ProgressContainer>
          </FlexGap>
          {!claimedAll ? (
            <>
              <Button
                width="100%"
                mt="8px"
                disabled={isPending || !(totalClaimable && totalClaimable.greaterThan(0))}
                onClick={handleClaim}
              >
                {t('Claim')}
              </Button>
              <NextLink href={cakepadHistoryUrl} passHref legacyBehavior>
                <Text as="a" color="primary" mt="8px" fontWeight={600} display="block">
                  {t('View CAKE.PAD')}
                </Text>
              </NextLink>
            </>
          ) : (
            <Text mt="8px">{t('You have claimed all available tokens.')}</Text>
          )}
        </FlexGap>
      </CardBody>
    </Card>
  )
}

export default IfoVestingCard
