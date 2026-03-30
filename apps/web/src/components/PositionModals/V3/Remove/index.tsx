import { useDebouncedChangeHandler } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import { CurrencyAmount, WNATIVE } from '@pancakeswap/sdk'
import { Currency } from '@pancakeswap/swap-sdk-core'
import { Box, Button, Flex, FlexGap, Message, PreTitle, RowBetween, Slider, Text, Toggle } from '@pancakeswap/uikit'
import { INITIAL_ALLOWED_SLIPPAGE, useLiquidityUserSlippage } from '@pancakeswap/utils/user'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import { MasterChefV3, NonfungiblePositionManager } from '@pancakeswap/v3-sdk'
import { BigNumber as BN } from 'bignumber.js'
import { BalanceDifferenceDisplay } from 'components/PositionModals/shared/BalanceDifferenceDisplay'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useMasterchefV3ByChain, useV3NFTPositionManagerContract } from 'hooks/useContract'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import useNativeCurrency from 'hooks/useNativeCurrency'
import { useTransactionDeadline } from 'hooks/useTransactionDeadline'
import { useDerivedV3BurnInfo } from 'hooks/v3/useDerivedV3BurnInfo'
import { useV3TokenIdsByAccount } from 'hooks/v3/useV3Positions'
import { useCallback, useMemo, useState } from 'react'
import { PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { useTransactionAdder } from 'state/transactions/hooks'
import { calculateGasMargin } from 'utils'
import { logGTMClickRemoveLiquidityEvent } from 'utils/customGTMEventTracking'
import { basisPointsToPercent } from 'utils/exchange'
import { formatRawAmount } from 'utils/formatCurrencyAmount'
import { isUserRejected } from 'utils/sentry'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import { getViemClients } from 'utils/viem'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { hexToBigInt } from 'viem'
import { useSendTransaction } from 'wagmi'

interface V3PositionRemoveProps {
  position: PositionDetail
  poolInfo: PoolInfo
}
export const V3PositionRemove = ({ position, poolInfo }: V3PositionRemoveProps) => {
  const { t } = useTranslation()

  const { account, chainId: activeChainId } = useAccountActiveChain()
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()

  const currency0 = poolInfo.token0 as Currency
  const currency1 = poolInfo.token1 as Currency

  const chainId = position.chainId ?? poolInfo.chainId
  const { tokenId } = position
  const removed = position.liquidity === 0n

  const [allowedSlippage] = useLiquidityUserSlippage() || [INITIAL_ALLOWED_SLIPPAGE]
  const [deadline] = useTransactionDeadline()

  const [percent, setPercent] = useState(50)
  const [percentForSlider, onPercentSelectForSlider] = useDebouncedChangeHandler(percent, setPercent)

  const handleChangePercent = useCallback(
    (value: any) => onPercentSelectForSlider(Math.ceil(value)),
    [onPercentSelectForSlider],
  )

  const native = useNativeCurrency(chainId)
  const [receiveWNATIVE, setReceiveWNATIVE] = useState(false)

  const displayCurrency0 = useMemo((): Currency => {
    if (!chainId) return currency0
    const wn = WNATIVE[chainId]
    if (!wn) return currency0
    if (wn.equals(currency0.wrapped)) return receiveWNATIVE ? wn : native
    return currency0
  }, [currency0, chainId, receiveWNATIVE, native])

  const displayCurrency1 = useMemo((): Currency => {
    if (!chainId) return currency1
    const wn = WNATIVE[chainId]
    if (!wn) return currency1
    if (wn.equals(currency1.wrapped)) return receiveWNATIVE ? wn : native
    return currency1
  }, [currency1, chainId, receiveWNATIVE, native])

  const {
    position: positionSDK,
    liquidityPercentage,
    liquidityValue0,
    liquidityValue1,
    feeValue0,
    feeValue1,
    error,
  } = useDerivedV3BurnInfo(position, percentForSlider, receiveWNATIVE, chainId)

  const showCollectAsWNative = Boolean(
    liquidityValue0?.currency &&
      liquidityValue1?.currency &&
      (liquidityValue0.currency.isNative ||
        liquidityValue1.currency.isNative ||
        WNATIVE[liquidityValue0.currency.chainId]?.equals(liquidityValue0.currency.wrapped) ||
        WNATIVE[liquidityValue1.currency.chainId]?.equals(liquidityValue1.currency.wrapped)),
  )

  const masterchefV3 = useMasterchefV3ByChain(chainId)
  const positionManager = useV3NFTPositionManagerContract({ chainId })
  const isMasterChefV3Available = Boolean(masterchefV3?.address && masterchefV3?.address !== '0x')
  const { tokenIds: stakedTokenIds, loading: tokenIdsInMCv3Loading } = useV3TokenIdsByAccount(
    isMasterChefV3Available ? masterchefV3?.address : undefined,
    account,
    chainId,
  )
  const isStakedInMCv3 = useMemo(
    () => Boolean(tokenId && stakedTokenIds.find((id) => id === tokenId)),
    [tokenId, stakedTokenIds],
  )

  const manager = isStakedInMCv3 ? masterchefV3 : positionManager
  const interfaceManager = isStakedInMCv3 ? MasterChefV3 : NonfungiblePositionManager

  const { data: currency0Usd } = useCurrencyUsdPrice(currency0)
  const { data: currency1Usd } = useCurrencyUsdPrice(currency1)

  const fullAmount0 = positionSDK?.amount0
  const fullAmount1 = positionSDK?.amount1

  const currency0Amount = fullAmount0?.toSignificant(6) ?? '0'
  const currency1Amount = fullAmount1?.toSignificant(6) ?? '0'

  const currency0NewAmount = useMemo(() => {
    if (!fullAmount0 || !liquidityValue0) return currency0Amount
    const newQuotient = fullAmount0.quotient - liquidityValue0.quotient
    if (newQuotient < 0n) return '0'
    return CurrencyAmount.fromRawAmount(fullAmount0.currency, newQuotient).toSignificant(6)
  }, [fullAmount0, liquidityValue0, currency0Amount])

  const currency1NewAmount = useMemo(() => {
    if (!fullAmount1 || !liquidityValue1) return currency1Amount
    const newQuotient = fullAmount1.quotient - liquidityValue1.quotient
    if (newQuotient < 0n) return '0'
    return CurrencyAmount.fromRawAmount(fullAmount1.currency, newQuotient).toSignificant(6)
  }, [fullAmount1, liquidityValue1, currency1Amount])

  const totalPositionUsd = useMemo(() => {
    if (!fullAmount0 || !fullAmount1 || !currency0Usd || !currency1Usd) return '$0'
    const usd0 = BN(fullAmount0.toExact()).multipliedBy(currency0Usd)
    const usd1 = BN(fullAmount1.toExact()).multipliedBy(currency1Usd)
    return `$${usd0.plus(usd1).toFormat(2)}`
  }, [fullAmount0, fullAmount1, currency0Usd, currency1Usd])

  const removedTokensUsd = useMemo(() => {
    if (!liquidityValue0 || !liquidityValue1 || !currency0Usd || !currency1Usd) return '0'
    const usdValue0 = BN(liquidityValue0.toExact()).multipliedBy(currency0Usd)
    const usdValue1 = BN(liquidityValue1.toExact()).multipliedBy(currency1Usd)
    return usdValue0.plus(usdValue1).toFormat(2)
  }, [liquidityValue0, liquidityValue1, currency0Usd, currency1Usd])

  const totalPositionNewUsd = useMemo(() => {
    if (totalPositionUsd === '$0' || removedTokensUsd === '0') return totalPositionUsd
    const total = BN(totalPositionUsd.replace(/[$,]/g, ''))
    const removed_ = BN(removedTokensUsd.replace(/,/g, ''))
    const result = total.minus(removed_)
    return `$${result.isNegative() ? '0' : result.toFormat(2)}`
  }, [totalPositionUsd, removedTokensUsd])

  const feesEarnedUsdFormatted = useMemo(() => {
    if (!feeValue0?.greaterThan(0) && !feeValue1?.greaterThan(0)) return undefined
    const usd0 =
      feeValue0 && feeValue0.greaterThan(0) && currency0Usd ? BN(feeValue0.toExact()).multipliedBy(currency0Usd) : BN(0)
    const usd1 =
      feeValue1 && feeValue1.greaterThan(0) && currency1Usd ? BN(feeValue1.toExact()).multipliedBy(currency1Usd) : BN(0)
    return `$${usd0.plus(usd1).toFormat(2)}`
  }, [feeValue0, feeValue1, currency0Usd, currency1Usd])

  // Transaction
  const addTransaction = useTransactionAdder()
  const { sendTransactionAsync } = useSendTransaction()
  const [attemptingTxn, setAttemptingTxn] = useState(false)
  const [txnErrorMessage, setTxnErrorMessage] = useState<string | undefined>()

  const onRemove = useCallback(async () => {
    if (
      (isMasterChefV3Available && tokenIdsInMCv3Loading) ||
      !interfaceManager ||
      !manager ||
      !liquidityValue0 ||
      !liquidityValue1 ||
      !deadline ||
      !account ||
      !chainId ||
      !positionSDK ||
      !liquidityPercentage ||
      !tokenId ||
      !sendTransactionAsync
    )
      return

    setAttemptingTxn(true)

    const { calldata, value } = interfaceManager.removeCallParameters(positionSDK, {
      tokenId: tokenId.toString(),
      liquidityPercentage,
      slippageTolerance: basisPointsToPercent(allowedSlippage),
      deadline: deadline.toString(),
      collectOptions: {
        expectedCurrencyOwed0: feeValue0 ?? CurrencyAmount.fromRawAmount(liquidityValue0.currency, 0),
        expectedCurrencyOwed1: feeValue1 ?? CurrencyAmount.fromRawAmount(liquidityValue1.currency, 0),
        recipient: account,
      },
    })

    const txn = {
      to: manager.address,
      data: calldata,
      value: hexToBigInt(value),
      account,
    }

    getViemClients({ chainId })
      ?.estimateGas(txn)
      .then((gas) => {
        return sendTransactionAsync({
          ...txn,
          gas: calculateGasMargin(gas),
          chainId,
        })
      })
      .then((response) => {
        const amount0 = formatRawAmount(liquidityValue0.quotient.toString(), liquidityValue0.currency.decimals, 4)
        const amount1 = formatRawAmount(liquidityValue1.quotient.toString(), liquidityValue1.currency.decimals, 4)

        setAttemptingTxn(false)
        addTransaction(
          { hash: response },
          {
            type: 'remove-liquidity-v3',
            summary: `Remove ${amount0} ${liquidityValue0.currency.symbol} and ${amount1} ${liquidityValue1.currency.symbol}`,
          },
        )
      })
      .catch((err) => {
        if (!isUserRejected(err)) {
          setTxnErrorMessage(transactionErrorToUserReadableMessage(err, t))
        }
        setAttemptingTxn(false)
        console.error(err)
      })
  }, [
    isMasterChefV3Available,
    tokenIdsInMCv3Loading,
    interfaceManager,
    manager,
    liquidityValue0,
    liquidityValue1,
    deadline,
    account,
    chainId,
    positionSDK,
    liquidityPercentage,
    tokenId,
    sendTransactionAsync,
    allowedSlippage,
    feeValue0,
    feeValue1,
    addTransaction,
    t,
  ])

  const buttonDisabled = attemptingTxn || removed || Boolean(error) || percent === 0

  return (
    <Box>
      <RowBetween mb="4px">
        <Text color="textSubtle" small>
          {t('Slippage Tolerance')}
        </Text>
        <LiquiditySlippageButton />
      </RowBetween>

      {showCollectAsWNative && (
        <Flex justifyContent="space-between" alignItems="center" mt="16px">
          <Text color="textSubtle" small>
            {t('Collect as %symbol%', { symbol: native.wrapped.symbol })}
          </Text>
          <Toggle
            id="receive-as-wnative"
            scale="sm"
            checked={receiveWNATIVE}
            onChange={() => setReceiveWNATIVE((prevState) => !prevState)}
          />
        </Flex>
      )}

      <PreTitle mt="16px">{t('Amount of liquidity to remove')}</PreTitle>

      <LightGreyCard mt="8px" padding="16px" borderRadius="24px">
        <Text fontSize="40px" bold mb="16px" style={{ lineHeight: 1 }}>
          {percentForSlider}%
        </Text>
        <Slider
          name="lp-amount"
          min={0}
          max={100}
          value={percentForSlider}
          onValueChanged={handleChangePercent}
          mb="16px"
        />
        <FlexGap gap="8px" justifyContent="space-between">
          <Button variant="primary60Outline" scale="sm" onClick={() => setPercent(10)} width="100%" borderRadius="12px">
            10%
          </Button>
          <Button variant="primary60Outline" scale="sm" onClick={() => setPercent(20)} width="100%" borderRadius="12px">
            20%
          </Button>
          <Button variant="primary60Outline" scale="sm" onClick={() => setPercent(75)} width="100%" borderRadius="12px">
            75%
          </Button>
          <Button
            variant="primary60Outline"
            scale="sm"
            onClick={() => setPercent(100)}
            width="100%"
            borderRadius="12px"
          >
            {t('Max.fill-max')}
          </Button>
        </FlexGap>
      </LightGreyCard>

      <BalanceDifferenceDisplay
        currency0={displayCurrency0}
        currency1={displayCurrency1}
        currency0Amount={currency0Amount}
        currency0NewAmount={currency0NewAmount}
        currency1Amount={currency1Amount}
        currency1NewAmount={currency1NewAmount}
        totalPositionUsd={totalPositionUsd}
        totalPositionNewUsd={totalPositionNewUsd}
        removedAmountUsd={`$${removedTokensUsd}`}
        feeValue0={feeValue0}
        feeValue1={feeValue1}
        feesEarnedUsd={feesEarnedUsdFormatted}
      />

      {isStakedInMCv3 ? (
        <Message variant="secondary60" mt="16px">
          <Text small>
            {t(
              'This liquidity position is currently staking in the Farm. Adding or removing liquidity will also harvest any unclaimed CAKE to your wallet.',
            )}
          </Text>
        </Message>
      ) : null}

      {txnErrorMessage ? (
        <Message variant="danger" mt="16px">
          <Text small>{txnErrorMessage}</Text>
        </Message>
      ) : null}

      {activeChainId !== chainId ? (
        <Button
          mt="16px"
          width="100%"
          onClick={() => (chainId ? switchNetworkIfNecessary(chainId) : undefined)}
          disabled={isSwitchNetworkLoading}
        >
          {t('Switch Network')}
        </Button>
      ) : (
        <Button
          mt="16px"
          width="100%"
          disabled={buttonDisabled}
          onClick={() => {
            onRemove()
            logGTMClickRemoveLiquidityEvent()
          }}
        >
          {removed ? t('Closed') : error ?? t('Remove')}
        </Button>
      )}
    </Box>
  )
}
