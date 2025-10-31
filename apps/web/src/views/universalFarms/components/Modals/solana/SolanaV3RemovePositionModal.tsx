import {
  Button,
  ModalV2,
  MotionModal,
  Slider,
  Text,
  Flex,
  FlexGap,
  useMatchBreakpoints,
  PreTitle,
  Checkbox,
  QuestionHelper,
} from '@pancakeswap/uikit'
import { TokenInfo } from '@pancakeswap/solana-core-sdk'
import { useCallback, useEffect, useState, useMemo, ChangeEvent } from 'react'
import { useTranslation } from '@pancakeswap/localization'
import { convertRawTokenInfoIntoSPLToken } from 'config/solana-list'
import BigNumber from 'bignumber.js'
import BN from 'bn.js'
import { Percent, Price, UnifiedCurrency, UnifiedCurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { SolanaV3PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { CurrencyLogo, LightGreyCard } from '@pancakeswap/widgets-internal'
import { SolanaLiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { StyledInfoCard } from 'views/RemoveLiquidityInfinity/styled'
import { PRESET_PERCENT } from 'views/RemoveLiquidityInfinity/constants'
import FormattedCurrencyAmount from 'components/FormattedCurrencyAmount/FormattedCurrencyAmount'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { useSolanaTokenPrice } from 'hooks/solana/useSolanaTokenPrice'
import { USDT } from '@pancakeswap/tokens'
import { NonEVMChainId } from '@pancakeswap/chains'
import Divider from 'components/Divider'
import { useSolanaV3RewardInfoFromSimulation } from 'views/universalFarms/hooks/useSolanaV3RewardInfoFromSimulation'
import { SolanaV3PoolInfo } from 'state/farmsV4/state/type'
import { useRemoveLiquidityCallback } from 'hooks/solana/useRemoveLiquidityCallback'
import { useLiquidityAmount } from 'hooks/solana/useLiquidityAmount'
import { useRouter } from 'next/router'
import { SolanaV3Earnings } from '../../PositionItem/PositionInfo/SolanaV3Earnings'
import { SolanaV3PoolInfoHeader } from './PooInfoHeader'

export default function SolanaV3RemovePositionModal({
  isOpen,
  onClose,
  pool,
  position,
}: {
  isOpen: boolean
  onClose: () => void
  pool: SolanaV3PoolInfo
  position: SolanaV3PositionDetail
}) {
  const poolInfo = pool.rawPool
  const { t } = useTranslation()
  const route = useRouter()
  const [percent, setPercent] = useState(50)
  const [closePosition, setClosePosition] = useState(true)
  const [closePositionOpen, setClosePositionOpen] = useState(false)

  const currency0 = useMemo(() => convertRawTokenInfoIntoSPLToken(poolInfo.mintA as TokenInfo), [poolInfo.mintA])
  const { data: price0Raw } = useSolanaTokenPrice({ mint: currency0?.wrapped.address, enabled: Boolean(currency0) })
  const currency1 = useMemo(() => convertRawTokenInfoIntoSPLToken(poolInfo.mintB as TokenInfo), [poolInfo.mintB])
  const { data: price1Raw } = useSolanaTokenPrice({ mint: currency1?.wrapped.address, enabled: Boolean(currency1) })

  const price0 = useMemo(
    () =>
      Price.fromDecimal(
        currency0,
        USDT[NonEVMChainId.SOLANA],
        new BigNumber(price0Raw?.toString() ?? '0')
          .times(10 ** (currency0.decimals - USDT[NonEVMChainId.SOLANA].decimals))
          .toString(),
      ),
    [price0Raw, currency0],
  )
  const price1 = useMemo(
    () =>
      Price.fromDecimal(
        currency1,
        USDT[NonEVMChainId.SOLANA],
        new BigNumber(price1Raw?.toString() ?? '0')
          .times(10 ** (currency1.decimals - USDT[NonEVMChainId.SOLANA].decimals))
          .toString(),
      ),
    [price1Raw, currency1],
  )
  const { isMobile } = useMatchBreakpoints()

  const { amount0: positionCurrencyAmountA, amount1: positionCurrencyAmountB } = useLiquidityAmount({
    poolInfo,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    liquidity: position.liquidity,
  })
  const [amount0, amount1] = useMemo(
    () => [
      positionCurrencyAmountA?.multiply(new Percent(percent, 100)),
      positionCurrencyAmountB?.multiply(new Percent(percent, 100)),
    ],
    [positionCurrencyAmountA, positionCurrencyAmountB, percent],
  )

  const removeLiquidity = useRemoveLiquidityCallback()

  const [sending, setIsSending] = useState(false)

  const handleClosePositionChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setClosePosition(!event.target.checked)
  }, [])

  useEffect(() => {
    setPercent(0)
    setIsSending(false)
  }, [isOpen])

  useEffect(() => {
    setClosePositionOpen(percent === 100)
  }, [percent])

  useEffect(() => {
    setClosePosition(true)
  }, [isOpen])

  const handleConfirm = useCallback(async () => {
    // logGTMPoolLiquiditySubCmfEvent()
    if (!position || position.liquidity.isZero() || !amount0 || !amount1 || (amount0.equalTo(0) && amount1.equalTo(0)))
      return

    setIsSending(true)
    try {
      await removeLiquidity({
        params: {
          poolInfo,
          position,
          liquidity: new BN(
            new BigNumber(position.liquidity.toString()).multipliedBy(percent).dividedBy(100).toFixed(0),
          ),
          amountA: amount0.toExact(),
          amountB: amount1.toExact(),
          closePosition: percent === 100 ? closePosition : false,
        },
        onSent: () => {
          // logGTMPoolLiquiditySubSuccessEvent({
          //   walletAddress: wallet?.adapter.publicKey?.toString() ?? '',
          //   token0: poolInfo.mintA.address,
          //   token1: poolInfo.mintB.address,
          //   token0Amt: minTokenAmount[0],
          //   token1Amt: minTokenAmount[1],
          //   feeTier: toPercentString(poolInfo.feeRate * 100),
          // })
          setIsSending(false)
          setPercent(0)
          onClose()
          // close position in detail page
          if (percent === 100 && closePosition && route.pathname === '/liquidity/position/[[...positionId]]') {
            route.push('/liquidity/positions')
          }
        },
        onError: (e: any) => {
          // logGTMSolErrorLogEvent({
          //   action: 'Remove Liquidity Fail',
          //   e,
          // })
          setIsSending(false)
        },
        onFinally: () => {
          setIsSending(false)
        },
      })
    } catch (e) {
      console.error(e)
      setIsSending(false)
    }
  }, [route, onClose, percent, poolInfo, position, removeLiquidity, amount0, amount1, closePosition])

  return (
    <ModalV2 isOpen={isOpen} onDismiss={onClose} closeOnOverlayClick>
      <MotionModal
        title={t('Remove Liquidity')}
        minWidth={[null, null, '500px']}
        headerPadding="12px 24px"
        headerBorderColor="transparent"
        bodyPadding={isMobile ? '0 16px 16px' : '0 24px 24px'}
        onDismiss={onClose}
      >
        <SolanaV3PoolInfoHeader poolInfo={poolInfo} currency0={currency0} currency1={currency1} position={position} />
        <Flex mt="24px" justifyContent="space-between" alignItems="center">
          <Text>{t('Slippage Tolerance')}</Text>
          <SolanaLiquiditySlippageButton />
        </Flex>
        <PreTitle mt="24px" textTransform="uppercase">
          {t('Amount of liquidity to remove')}
        </PreTitle>
        <StyledInfoCard mt="8px">
          <Text fontSize="32px" bold>
            {percent}%
          </Text>
          <Slider
            min={0}
            max={100}
            name="remove-position"
            value={percent}
            onValueChanged={(newValue) => setPercent(Math.ceil(newValue))}
          />
          <FlexGap mt="16px" gap="8px" justifyContent="space-between">
            {PRESET_PERCENT.map((presetPercent) => (
              <Button
                variant="secondary"
                scale={['xs', null, null, 'sm']}
                width="100%"
                key={presetPercent}
                onClick={() => setPercent(presetPercent)}
              >
                {presetPercent === 100 ? t('MAX') : `${presetPercent}%`}
              </Button>
            ))}
          </FlexGap>
          {closePositionOpen && (
            <FlexGap gap="4px" alignItems="center" mt="16px">
              <Checkbox scale="xs" checked={!closePosition} onChange={handleClosePositionChange} />
              <Text fontSize="sm" color="textSubtle">
                {t('Keep my position open')}
              </Text>
              <QuestionHelper
                text={t(
                  'You can remove all your tokens and still keep your position open in order to add position seamless next time.',
                )}
              />
            </FlexGap>
          )}
        </StyledInfoCard>
        <PreTitle mt="24px" textTransform="uppercase">
          {t('You will receive')}
        </PreTitle>
        <LightGreyCard mt="8px">
          <RemovedAmountInfo
            currency0={currency0}
            currency1={currency1}
            amount0={amount0}
            amount1={amount1}
            price0={price0}
            price1={price1}
          />
          <Divider style={{ margin: '16px 0' }} />
          <SolanaV3Earnings pool={pool} position={position} />
        </LightGreyCard>
        <FlexGap flexDirection="column" gap="16px" mt="16px">
          <Button
            width="100%"
            disabled={position.liquidity.isZero() || percent === 0}
            isLoading={sending}
            onClick={handleConfirm}
          >
            {sending ? t('Confirming...') : t('Remove')}
          </Button>
        </FlexGap>
      </MotionModal>
    </ModalV2>
  )
}

const RemovedAmountInfo: React.FC<{
  currency0: UnifiedCurrency
  currency1: UnifiedCurrency
  amount0: UnifiedCurrencyAmount<UnifiedCurrency> | undefined
  amount1: UnifiedCurrencyAmount<UnifiedCurrency> | undefined
  price0: Price<UnifiedCurrency, UnifiedCurrency> | undefined
  price1: Price<UnifiedCurrency, UnifiedCurrency> | undefined
}> = ({ currency0, currency1, amount0, amount1, price0, price1 }) => {
  return (
    <>
      <Flex justifyContent="space-between" mb="8px" as="label" alignItems="center">
        <Flex alignItems="center">
          <CurrencyLogo currency={currency0} />
          <Text small color="textSubtle" id="remove-liquidity-tokena-symbol" ml="4px">
            {currency0?.symbol}
          </Text>
        </Flex>
        <Flex>
          <FormattedCurrencyAmount currencyAmount={amount0} significantDigits={8} />
        </Flex>
      </Flex>
      <Flex justifyContent="flex-end" mb="8px">
        <Text fontSize="14px" color="textSubtle" ml="4px">
          ~${formatNumber(amount0?.multiply(price0 ?? 0).toExact() ?? 0)}
        </Text>
      </Flex>
      <Flex justifyContent="space-between" mb="8px" as="label" alignItems="center">
        <Flex alignItems="center">
          <CurrencyLogo currency={currency1} />
          <Text small color="textSubtle" id="remove-liquidity-tokena-symbol" ml="4px">
            {currency1?.symbol}
          </Text>
        </Flex>
        <Flex>
          <FormattedCurrencyAmount currencyAmount={amount1} significantDigits={8} />
        </Flex>
      </Flex>
      <Flex justifyContent="flex-end" mb="8px">
        <Text fontSize="14px" color="textSubtle" ml="4px">
          ~${formatNumber(amount1?.multiply(price1 ?? 0).toExact() ?? 0)}
        </Text>
      </Flex>
    </>
  )
}

const RewardInfo: React.FC<{
  poolInfo: SolanaV3PoolInfo
  position: SolanaV3PositionDetail
  currency0: UnifiedCurrency
  currency1: UnifiedCurrency
  price0: Price<UnifiedCurrency, UnifiedCurrency> | undefined
  price1: Price<UnifiedCurrency, UnifiedCurrency> | undefined
}> = ({ poolInfo, position, currency0, currency1, price0, price1 }) => {
  const { breakdownRewardInfo: rewardInfo } = useSolanaV3RewardInfoFromSimulation({ poolInfo, position })
  const { t } = useTranslation()
  const feeValue0 = UnifiedCurrencyAmount.fromRawAmount(currency0, rewardInfo.fee.A?.amount ?? '0')
  const feeValue1 = UnifiedCurrencyAmount.fromRawAmount(currency1, rewardInfo.fee.B?.amount ?? '0')
  return (
    <>
      <Flex justifyContent="space-between" as="label" alignItems="center">
        <Flex alignItems="center">
          <CurrencyLogo currency={rewardInfo.fee.A?.mint} />
          <Text small color="textSubtle" id="remove-liquidity-tokena-symbol" ml="4px">
            {rewardInfo.fee.A?.mint?.symbol} {t('Fee Earned')}
          </Text>
        </Flex>
        <Flex>
          <FormattedCurrencyAmount currencyAmount={feeValue0} />
        </Flex>
      </Flex>
      <Flex justifyContent="flex-end" mb="8px">
        <Text fontSize="14px" color="textSubtle" ml="4px">
          ~${formatNumber(feeValue0?.multiply(price0 ?? 0).toExact() ?? 0)}
        </Text>
      </Flex>
      <Flex justifyContent="space-between" as="label" alignItems="center">
        <Flex alignItems="center">
          <CurrencyLogo currency={feeValue1?.currency} />
          <Text small color="textSubtle" id="remove-liquidity-tokena-symbol" ml="4px">
            {rewardInfo.fee.B?.mint?.symbol} {t('Fee Earned')}
          </Text>
        </Flex>
        <Flex>
          <FormattedCurrencyAmount currencyAmount={feeValue1} />
        </Flex>
      </Flex>
      <Flex justifyContent="flex-end" mb="8px">
        <Text fontSize="14px" color="textSubtle" ml="4px">
          ~${formatNumber(feeValue1?.multiply(price1 ?? 0).toExact() ?? 0)}
        </Text>
      </Flex>
    </>
  )
}
