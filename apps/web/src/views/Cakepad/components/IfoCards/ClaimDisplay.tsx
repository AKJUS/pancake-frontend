import { useTranslation } from '@pancakeswap/localization'
import { Button, CheckmarkIcon, FlexGap, InfoIcon, SwapLoading, Text, useTooltip } from '@pancakeswap/uikit'
import { CurrencyLogo, NumberDisplay } from '@pancakeswap/widgets-internal'
import { useStablecoinPriceAmount } from 'hooks/useStablecoinPrice'
import useTheme from 'hooks/useTheme'
import { useAccount } from 'wagmi'
import { logGTMIfoConnectWalletEvent } from 'utils/customGTMEventTracking'
import ConnectWalletButton from 'components/ConnectWalletButton'
import { formatAmount } from '@pancakeswap/utils/formatFractions'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useSwitchNetwork } from 'hooks/useSwitchNetwork'
import { useIFOClaimCallback } from '../../hooks/ifo/useIFOClaimCallback'
import useIfo from '../../hooks/useIfo'
import { formatDollarAmount } from './IfoDepositForm'

export const ClaimDisplay: React.FC<{ pid: number }> = ({ pid }) => {
  const { t } = useTranslation()
  const { claim, isPending: isLoading } = useIFOClaimCallback()
  const { info, pools, users, config } = useIfo()
  const userStatus = users[pid]
  const claimableAmount = formatAmount(userStatus?.claimableAmount, 6)
  const offeringCurrency = info?.offeringCurrency
  const status = info?.status
  const stakeCurrency = pools?.[pid]?.stakeCurrency
  const amountInDollar = useStablecoinPriceAmount(
    offeringCurrency ?? undefined,
    claimableAmount !== undefined && Number.isFinite(+claimableAmount) ? +claimableAmount : undefined,
  )
  const refundAmount = formatAmount(userStatus?.stakeRefund, 6)
  const hasRefund = userStatus?.stakeRefund?.greaterThan(0)

  const refundInDollar = useStablecoinPriceAmount(
    stakeCurrency ?? undefined,
    refundAmount !== undefined && Number.isFinite(+refundAmount) ? +refundAmount : undefined,
  )
  // fee tier information is no longer displayed

  const userHasStaked = userStatus?.stakedAmount?.greaterThan(0)

  const { targetRef, tooltip, tooltipVisible } = useTooltip(
    t(
      'When the sale is oversubscribed, deposit that were not used is being refunded. You may withdraw together when claiming.',
    ),
    {
      placement: 'top',
    },
  )
  const userClaimed = userStatus?.claimed

  const { isDark } = useTheme()
  const { address: account } = useAccount()
  const { chainId: currentChainId } = useActiveChainId()
  const { switchNetwork, canSwitch, isLoading: isSwitchingNetwork } = useSwitchNetwork()
  const ifoChainId = config?.chainId
  const isWrongNetwork = ifoChainId && currentChainId !== ifoChainId

  const handleConnectWallet = (e) => {
    logGTMIfoConnectWalletEvent(status === 'coming_soon')
  }

  const handleSwitchNetwork = async () => {
    if (ifoChainId) {
      await switchNetwork(ifoChainId)
    }
  }
  return (
    <>
      {userHasStaked ? (
        <FlexGap flexDirection="column" gap="8px">
          <FlexGap gap="8px" justifyContent="space-between" alignItems="center">
            <FlexGap flexDirection="column">
              <FlexGap gap="8px" alignItems="center">
                {stakeCurrency && <CurrencyLogo size="24px" currency={stakeCurrency} />}
                <Text fontSize="12px" bold color="secondary" lineHeight="18px" textTransform="uppercase">
                  {stakeCurrency?.symbol} {t('Pool')}
                </Text>
              </FlexGap>
              <FlexGap flexDirection="column" mt="8px">
                <Text textTransform="uppercase" color="secondary" fontSize="12px" bold>
                  {t('%symbol% allocated', { symbol: offeringCurrency?.symbol })}
                </Text>

                <NumberDisplay
                  value={claimableAmount}
                  suffix={` ${offeringCurrency?.symbol}`}
                  fontSize="20px"
                  bold
                  lineHeight="30px"
                />

                <FlexGap>
                  {Number.isFinite(amountInDollar) ? (
                    <>
                      <Text fontSize="14px" color="textSubtle" ellipsis>
                        {`~${amountInDollar && formatDollarAmount(amountInDollar)}`}
                      </Text>
                      <Text ml="4px" fontSize="14px" color="textSubtle">
                        USD
                      </Text>
                    </>
                  ) : null}
                </FlexGap>
              </FlexGap>
            </FlexGap>
            {isWrongNetwork && !userClaimed ? (
              <Button onClick={handleSwitchNetwork} isLoading={isSwitchingNetwork} disabled={!canSwitch}>
                {t('Switch network to claim')}
                {isSwitchingNetwork ? <SwapLoading ml="3px" /> : null}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (!userClaimed) claim(pid)
                }}
                width={userClaimed ? '48px' : undefined}
                variant={userClaimed ? 'success' : undefined}
                isLoading={isLoading}
              >
                {userClaimed ? (
                  <CheckmarkIcon color={isDark ? '#000000' : '#FFFFFF'} />
                ) : (
                  <>
                    {t('Claim')} {isLoading ? <SwapLoading ml="3px" /> : null}
                  </>
                )}
              </Button>
            )}
          </FlexGap>
          <FlexGap justifyContent="space-between" mt="8px">
            <Text color="textSubtle">{t('Subscribed')}</Text>
            <Text>
              <NumberDisplay value={formatAmount(userStatus?.stakedAmount, 6)} suffix={` ${stakeCurrency?.symbol}`} />
            </Text>
          </FlexGap>
          {hasRefund && (
            <>
              <FlexGap justifyContent="space-between" alignItems="flex-start">
                <FlexGap gap="3px" alignItems="center">
                  <Text color="textSubtle">{userStatus?.claimed ? t('Refunded') : t('Refund')}</Text>
                  {userStatus?.claimed ? null : (
                    <FlexGap ref={targetRef}>
                      <InfoIcon width="14px" color="textSubtle" />
                      {tooltipVisible && tooltip}
                    </FlexGap>
                  )}
                </FlexGap>
                <FlexGap flexDirection="column" alignItems="flex-end">
                  <Text>
                    <NumberDisplay value={refundAmount} suffix={` ${stakeCurrency?.symbol}`} />
                  </Text>
                  <FlexGap>
                    {Number.isFinite(refundInDollar) ? (
                      <>
                        <Text fontSize="14px" color="textSubtle" ellipsis>
                          {`~${refundInDollar && formatDollarAmount(refundInDollar)}`}
                        </Text>
                        <Text ml="4px" fontSize="14px" color="textSubtle">
                          USD
                        </Text>
                      </>
                    ) : null}
                  </FlexGap>
                </FlexGap>
              </FlexGap>
              {/* Tax and fee tier display removed */}
            </>
          )}
        </FlexGap>
      ) : (
        <FlexGap flexDirection="column" gap="8px">
          <Text fontSize="12px" bold color="secondary" lineHeight="18px" textTransform="uppercase">
            {stakeCurrency?.symbol} {t('Pool')}
          </Text>
          <FlexGap gap="8px" alignItems="center">
            {stakeCurrency && <CurrencyLogo size="40px" currency={stakeCurrency} />}
            {!account ? (
              <ConnectWalletButton width="100%" onClickCapture={handleConnectWallet} />
            ) : (
              <Text fontSize="16px" color="textDisabled" bold>
                {t('You didn’t deposit')} {stakeCurrency?.symbol}
              </Text>
            )}
          </FlexGap>
        </FlexGap>
      )}
    </>
  )
}
