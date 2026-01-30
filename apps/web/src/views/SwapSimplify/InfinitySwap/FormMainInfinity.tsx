import { isSolana, UnifiedChainId } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, Percent, UnifiedCurrency, UnifiedCurrencyAmount } from '@pancakeswap/sdk'
import { Box, FlexGap, Image, Skeleton, Text } from '@pancakeswap/uikit'
import { formatAmount } from '@pancakeswap/utils/formatFractions'
import replaceBrowserHistoryMultiple from '@pancakeswap/utils/replaceBrowserHistoryMultiple'
import truncateHash from '@pancakeswap/utils/truncateHash'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import { CommonBasesType } from 'components/SearchModal/types'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { useUnifiedCurrency } from 'hooks/Tokens'
import { useUnifiedTokenUsdPrice } from 'hooks/useUnifiedTokenUsdPrice'
import { useSwitchNetwork } from 'hooks/useSwitchNetwork'
import { useUnifiedCurrencyBalance } from 'hooks/useUnifiedCurrencyBalance'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useRouter } from 'next/router'
import { ParsedUrlQuery } from 'querystring'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useAtomValue } from 'jotai'
import styled from 'styled-components'
import { Field } from 'state/swap/actions'
import { useCurrentWalletIcon } from 'state/wallet/hooks'
import { useDefaultsFromURLSearch, useSwapState } from 'state/swap/hooks'
import { SwitchChainOption } from 'wallet/hook/useSwitchNetworkV2'
import { useSwapActionHandlers } from 'state/swap/useSwapActionHandlers'
import currencyId from 'utils/currencyId'
import { maxUnifiedAmountSpend } from 'utils/maxAmountSpend'
import { getDefaultToken } from 'views/Swap/utils'
import { useBridgeAvailableChains } from 'views/Swap/Bridge/hooks'
import { isRwaTokenFnAtom } from 'quoter/atom/rwaTokenAtoms'
import useWarningImport from '../../Swap/hooks/useWarningImport'
import { useIsWrapping } from '../../Swap/V3Swap/hooks'
import { AssignRecipientButton, FlipButton } from './FlipButton'
import { FormContainer } from './FormContainer'
import { Recipient } from './Recipient'
import { useSanctionRuleForTokenSelection } from './useSanctionRuleForTokenSelection'

interface Props {
  inputAmount?: UnifiedCurrencyAmount<UnifiedCurrency>
  outputAmount?: UnifiedCurrencyAmount<UnifiedCurrency>
  tradeLoading?: boolean
  isUserInsufficientBalance?: boolean
}

interface HandleCurrencySelectDeps {
  onCurrencySelection: (field: Field, currency: any) => void
  canSwitchToChain: (chainId: number) => boolean
  switchNetwork: (chainId: number, options?: SwitchChainOption) => void
  outputChainId: number | undefined
  supportedBridgeChains?: UnifiedChainId[]
  inputChainId: number | undefined
  inputCurrencyId: string | undefined
  outputCurrencyId: string | undefined
  router: {
    query: ParsedUrlQuery
    replace: (route: any, as?: any, opts?: { shallow: boolean }) => void
  }
  replaceBrowserHistoryMultiple: (updates: Record<string, any>) => void
  newCurrency: any
  field: Field
  isRwaTokenFn?: (chainId?: number, address?: string) => boolean
}

export const handleCurrencySelectFn = async ({
  onCurrencySelection,
  canSwitchToChain,
  switchNetwork,
  outputChainId,
  supportedBridgeChains,
  inputChainId,
  inputCurrencyId,
  outputCurrencyId,
  router,
  replaceBrowserHistoryMultiple,
  newCurrency,
  field,
  isRwaTokenFn,
}: HandleCurrencySelectDeps): Promise<void> => {
  const isInput = field === Field.INPUT

  if (isInput && canSwitchToChain(newCurrency.chainId) && newCurrency.chainId !== inputChainId) {
    switchNetwork(newCurrency.chainId, {
      replaceUrl: false,
      from: 'switch',
    })

    const isSameAsOutput = currencyId(newCurrency) === outputCurrencyId && newCurrency.chainId === outputChainId

    router.replace(
      {
        query: {
          ...router.query,
          inputCurrency: currencyId(newCurrency),
          chain: CHAIN_QUERY_NAME[newCurrency.chainId],
          ...(isSameAsOutput
            ? {
                ...(inputCurrencyId && { outputCurrency: inputCurrencyId }),
                ...(inputChainId && { chainOut: CHAIN_QUERY_NAME[inputChainId] }),
              }
            : {
                ...(outputCurrencyId && { outputCurrency: outputCurrencyId }),
                ...(outputChainId && { chainOut: CHAIN_QUERY_NAME[outputChainId] }),
              }),
        },
      },
      undefined,
      { shallow: true },
    )

    return
  }

  onCurrencySelection(field, newCurrency)

  if (isInput && newCurrency.chainId !== outputChainId) {
    const isNewCurrencyRwa = Boolean(isRwaTokenFn?.(newCurrency.chainId, newCurrency?.wrapped?.address))
    const isOutputChainSupported =
      !isNewCurrencyRwa &&
      Boolean(
        outputChainId !== undefined &&
          supportedBridgeChains?.includes(newCurrency.chainId) &&
          supportedBridgeChains?.includes(outputChainId),
      )

    if (!isOutputChainSupported) {
      // if output chain is not supported, reset output currency
      onCurrencySelection(Field.OUTPUT, {
        address: getDefaultToken(newCurrency.chainId) as `0x${string}`,
        chainId: newCurrency.chainId,
      } as Currency)
    }
  }

  const newCurrencyId = currencyId(newCurrency)

  // Output chain name (undefined if no need to apply)
  const chainOut = !isInput && inputChainId !== newCurrency.chainId && CHAIN_QUERY_NAME[newCurrency.chainId]

  const isSameCurrency = !chainOut && newCurrencyId === inputCurrencyId && newCurrencyId === outputCurrencyId

  replaceBrowserHistoryMultiple({
    [isInput ? 'inputCurrency' : 'outputCurrency']: newCurrencyId,
    ...(isSameCurrency && { [isInput ? 'outputCurrency' : 'inputCurrency']: undefined }),
    chainOut: chainOut || null, // null to remove from URL if no need to apply
  })
}

export function FormMain({ inputAmount, outputAmount, tradeLoading, isUserInsufficientBalance }: Props) {
  const { t } = useTranslation()
  const { solanaAccount, account } = useAccountActiveChain()

  const {
    independentField,
    typedValue,
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputChainId },
    recipient,
  } = useSwapState()

  const { onCurrencySelection, onUserInput } = useSwapActionHandlers()
  const [usdMode, setUsdMode] = useState(false)

  const inputCurrency = useUnifiedCurrency(inputCurrencyId, inputChainId)
  const outputCurrency = useUnifiedCurrency(outputCurrencyId, outputChainId)

  const { data: inputUsdPrice, isLoading: inputUsdPriceLoading } = useUnifiedTokenUsdPrice(
    inputCurrency ?? undefined,
    Boolean(inputCurrency),
  )
  const { data: outputUsdPrice, isLoading: outputUsdPriceLoading } = useUnifiedTokenUsdPrice(
    outputCurrency ?? undefined,
    Boolean(outputCurrency),
  )

  const canUseInputUsdMode = useMemo(() => {
    if (!inputCurrency) {
      return false
    }
    if (inputUsdPriceLoading) {
      return false
    }
    if (inputUsdPrice === undefined) {
      return false
    }
    return inputUsdPrice > 0
  }, [inputCurrency, inputUsdPrice, inputUsdPriceLoading])

  const canUseOutputUsdMode = useMemo(() => {
    if (!outputCurrency) {
      return false
    }
    if (outputUsdPriceLoading) {
      return false
    }
    if (outputUsdPrice === undefined) {
      return false
    }
    return outputUsdPrice > 0
  }, [outputCurrency, outputUsdPrice, outputUsdPriceLoading])

  const canUseUsdMode = useMemo(() => {
    if (independentField === Field.OUTPUT) {
      return canUseOutputUsdMode
    }
    return canUseInputUsdMode
  }, [canUseInputUsdMode, canUseOutputUsdMode, independentField])

  useEffect(() => {
    if (usdMode && !canUseUsdMode) {
      setUsdMode(false)
    }
  }, [usdMode, canUseUsdMode])

  const isInputIndependent = independentField === Field.INPUT
  const isOutputIndependent = independentField === Field.OUTPUT
  const inputValueMode: 'token' | 'usd' = isInputIndependent && usdMode && canUseUsdMode ? 'usd' : 'token'
  const outputValueMode: 'token' | 'usd' = isOutputIndependent && usdMode && canUseUsdMode ? 'usd' : 'token'

  const fromAccount = isSolana(inputChainId) ? solanaAccount : account
  const toAccount = isSolana(outputChainId) ? solanaAccount : account

  const walletIconFrom = useCurrentWalletIcon(inputChainId)
  const walletIconTo = useCurrentWalletIcon(outputChainId)

  const isWrapping = useIsWrapping()
  const loadedUrlParams = useDefaultsFromURLSearch()
  const { inputConfig: inputRwaConfig, outputConfig: outputRwaConfig } = useSanctionRuleForTokenSelection(
    inputCurrency,
    outputCurrency,
  )

  const inputBalance = useUnifiedCurrencyBalance(inputCurrency)

  const maxAmountInput = useMemo(() => maxUnifiedAmountSpend(inputBalance), [inputBalance])

  const handleTypeInput = useCallback((value: string) => onUserInput(Field.INPUT, value), [onUserInput])
  const handleTypeOutput = useCallback((value: string) => onUserInput(Field.OUTPUT, value), [onUserInput])

  const handlePercentInput = useCallback(
    (percent: number) => {
      if (maxAmountInput) {
        onUserInput(Field.INPUT, maxAmountInput.multiply(new Percent(percent, 100)).toExact())
      }
    },
    [maxAmountInput, onUserInput],
  )

  const handleMaxInput = useCallback(() => {
    if (maxAmountInput) {
      onUserInput(Field.INPUT, maxAmountInput.toExact())
    }
  }, [maxAmountInput, onUserInput])

  const { canSwitchToChain, switchNetwork } = useSwitchNetwork()

  const { chains: supportedBridgeChains } = useBridgeAvailableChains()

  const router = useRouter()

  const isRwaTokenFn = useAtomValue(isRwaTokenFnAtom)

  useWarningImport()

  const handleCurrencySelect = useCallback(
    async (newCurrency: UnifiedCurrency, field: Field) => {
      return handleCurrencySelectFn({
        onCurrencySelection,
        canSwitchToChain,
        switchNetwork,
        outputChainId,
        supportedBridgeChains,
        inputChainId,
        inputCurrencyId,
        outputCurrencyId,
        router,
        replaceBrowserHistoryMultiple,
        newCurrency,
        field,
        isRwaTokenFn,
      })
    },
    [
      onCurrencySelection,
      canSwitchToChain,
      switchNetwork,
      outputChainId,
      supportedBridgeChains,
      inputChainId,
      inputCurrencyId,
      outputCurrencyId,
      router,
      isRwaTokenFn,
    ],
  )
  const handleInputSelect = useCallback(
    (newCurrency: UnifiedCurrency) => handleCurrencySelect(newCurrency, Field.INPUT),
    [handleCurrencySelect],
  )
  const handleOutputSelect = useCallback(
    (newCurrency: UnifiedCurrency) => handleCurrencySelect(newCurrency, Field.OUTPUT),
    [handleCurrencySelect],
  )

  const isTypingInput = independentField === Field.INPUT
  const inputValue = useMemo(
    () => typedValue && (isTypingInput ? typedValue : formatAmount(inputAmount) || ''),
    [typedValue, isTypingInput, inputAmount],
  )
  const outputValue = useMemo(
    () => typedValue && (isTypingInput ? formatAmount(outputAmount) || '' : typedValue),
    [typedValue, isTypingInput, outputAmount],
  )
  const inputLoading = typedValue ? !isTypingInput && tradeLoading : false
  const outputLoading = typedValue ? isTypingInput && tradeLoading : false

  const isBridge = inputCurrency?.chainId !== outputCurrency?.chainId

  return (
    <FormContainer>
      <Suspense fallback={<Skeleton animation="pulse" variant="round" width="100%" height="80px" />}>
        <CurrencyInputPanelSimplify
          id="swap-currency-input"
          showUSDPrice
          valueDisplayMode={inputValueMode}
          onToggleValueDisplayMode={canUseUsdMode ? () => setUsdMode((prev) => !prev) : undefined}
          usdPrice={inputUsdPrice}
          showMaxButton
          showCommonBases={inputRwaConfig.showCommonBases}
          supportCrossChain={inputRwaConfig.supportCrossChain}
          tokensToShow={inputRwaConfig.tokensToShow}
          inputLoading={!isWrapping && inputLoading}
          currencyLoading={!loadedUrlParams}
          label={!isTypingInput && !isWrapping ? t('From (estimated)') : t('From')}
          defaultValue={isWrapping ? typedValue : inputValue}
          maxAmount={maxAmountInput}
          showQuickInputButton
          currency={inputCurrency}
          onUserInput={handleTypeInput}
          onPercentInput={handlePercentInput}
          onMax={handleMaxInput}
          onCurrencySelect={handleInputSelect}
          otherCurrency={outputCurrency}
          commonBasesType={CommonBasesType.SWAP_LIMITORDER}
          title={
            <FlexGap gap="8px" alignItems="center">
              <Text color="textSubtle" fontSize={12} bold>
                {t('From')}:
              </Text>
              {fromAccount && (
                <FlexGap gap="4px" alignItems="center">
                  {walletIconFrom && (
                    <Box width={24} height={24}>
                      <WalletIcon src={walletIconFrom} width={24} height={24} alt="Wallet Icon" />
                    </Box>
                  )}
                  <Text fontSize="12px" color="textSubtle" fontWeight="600">
                    {truncateHash(fromAccount, 6, 4)}
                  </Text>
                </FlexGap>
              )}
            </FlexGap>
          }
          isUserInsufficientBalance={isUserInsufficientBalance}
          modalTitle={t('From')}
          showSearchHeader
        />
      </Suspense>
      <FlipButton />
      <Suspense fallback={<Skeleton animation="pulse" variant="round" width="100%" height="80px" />}>
        <CurrencyInputPanelSimplify
          disabled={isBridge}
          id="swap-currency-output"
          showUSDPrice
          valueDisplayMode={outputValueMode}
          onToggleValueDisplayMode={!isBridge && canUseUsdMode ? () => setUsdMode((prev) => !prev) : undefined}
          usdPrice={outputUsdPrice}
          showCommonBases={outputRwaConfig.showCommonBases}
          supportCrossChain={outputRwaConfig.supportCrossChain}
          tokensToShow={outputRwaConfig.tokensToShow}
          showMaxButton={false}
          inputLoading={!isWrapping && outputLoading}
          currencyLoading={!loadedUrlParams}
          label={isTypingInput && !isWrapping ? t('To (estimated)') : t('To')}
          defaultValue={isWrapping ? typedValue : outputValue}
          currency={outputCurrency}
          onUserInput={handleTypeOutput}
          onCurrencySelect={handleOutputSelect}
          otherCurrency={inputCurrency}
          commonBasesType={CommonBasesType.SWAP_LIMITORDER}
          title={
            <FlexGap gap="8px" alignItems="center">
              <Text color="textSubtle" fontSize={12} bold>
                {t('To')}:
              </Text>
              {(toAccount || recipient) && (
                <FlexGap gap="4px" alignItems="center">
                  {walletIconTo && !recipient && (
                    <Box width={24} height={24}>
                      <WalletIcon src={walletIconTo} width={24} height={24} alt="Wallet Icon" />
                    </Box>
                  )}
                  <Text fontSize="12px" color="textSubtle" fontWeight="600">
                    {recipient ? truncateHash(recipient, 6, 4) : truncateHash(toAccount ?? '', 6, 4)}
                  </Text>
                </FlexGap>
              )}
            </FlexGap>
          }
          modalTitle={t('To')}
          showSearchHeader
        />
      </Suspense>
      <AssignRecipientButton />
      <Recipient />
    </FormContainer>
  )
}

const WalletIcon = styled(Image)`
  border-radius: 8px;
  background-color: ${({ theme }) => theme.colors.background};
`
