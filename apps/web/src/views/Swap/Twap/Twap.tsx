import { Orders, TWAP as PancakeTWAP, ToastProps } from '@orbs-network/twap-ui-pancake'
import { useTheme } from '@pancakeswap/hooks'
import { Percent } from '@pancakeswap/sdk'
import { Currency, CurrencyAmount, TradeType, UnifiedCurrency } from '@pancakeswap/swap-sdk-core'
import {
  AutoColumn,
  Button,
  ReactMarkdown,
  Skeleton,
  Text,
  useMatchBreakpoints,
  useToast,
  useTooltip,
} from '@pancakeswap/uikit'

import replaceBrowserHistoryMultiple from '@pancakeswap/utils/replaceBrowserHistoryMultiple'
import { CurrencyLogo, NumericalInput, SwapUIV2 } from '@pancakeswap/widgets-internal'
import ConnectWalletButton from 'components/ConnectWalletButton'
import { AutoRow } from 'components/Layout/Row'
import { CommonBasesType } from 'components/SearchModal/types'
import { useAllTokens, useCurrency } from 'hooks/Tokens'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import useNativeCurrency from 'hooks/useNativeCurrency'
import { useAtomValue } from 'jotai'
import { LottieRefCurrentProps } from 'lottie-react'
import dynamic from 'next/dynamic'
import { bestSameChainAtom } from 'quoter/atom/bestSameChainAtom'
import { useQuoteContext } from 'quoter/hook/QuoteContext'
import { multicallGasLimitAtom } from 'quoter/hook/useMulticallGasLimit'
import { QuoteProvider } from 'quoter/QuoteProvider'
import { createQuoteQuery } from 'quoter/utils/createQuoteQuery'
import { memo, Suspense, useCallback, useMemo, useRef } from 'react'
import { useCurrentBlock } from 'state/block/hooks'
import { Field } from 'state/swap/actions'
import { useDefaultsFromURLSearch, useSwapState } from 'state/swap/hooks'
import { useSwapActionHandlers } from 'state/swap/useSwapActionHandlers'
import { useCurrencyBalance } from 'state/wallet/hooks'
import { keyframes, styled } from 'styled-components'
import { maxAmountSpend } from 'utils/maxAmountSpend'
import { useAccount } from 'wagmi'
import { useTranslation } from '@pancakeswap/localization'
import { useSwitchNetwork } from 'hooks/useSwitchNetwork'
import { useRouter } from 'next/router'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'

import useWarningImport from '../hooks/useWarningImport'

import ArrowDark from '../../../../public/images/swap/arrow_dark.json' assert { type: 'json' }
import ArrowLight from '../../../../public/images/swap/arrow_light.json' assert { type: 'json' }
import { Wrapper } from '../components/styleds'
import { SwapTransactionErrorContent } from '../components/SwapTransactionErrorContent'

import { handleCurrencySelectFn } from '../../SwapSimplify/InfinitySwap/FormMainInfinity'

const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

const useBestTrade = (fromToken?: string, toToken?: string, value?: string) => {
  const independentCurrency = useCurrency(fromToken)

  const amount = useMemo(() => {
    if (!independentCurrency || !value) return undefined
    if (value !== '0') {
      return CurrencyAmount.fromRawAmount(independentCurrency, BigInt(value))
    }
    return undefined
  }, [independentCurrency, value])

  const dependentCurrency = useCurrency(toToken)
  const { singleHopOnly, split, v2Swap, v3Swap, stableSwap } = useQuoteContext()
  const blockNumber = useCurrentBlock()
  const { chainId } = useActiveChainId()
  const gasLimit = useAtomValue(multicallGasLimitAtom(chainId))
  const quoteOption = createQuoteQuery({
    amount,
    currency: dependentCurrency,
    baseCurrency: independentCurrency,
    tradeType: TradeType.EXACT_INPUT,
    maxHops: singleHopOnly ? 1 : undefined,
    maxSplits: split ? undefined : 0,
    v2Swap,
    v3Swap,
    stableSwap,
    trackPerf: true,
    autoRevalidate: false,
    xEnabled: false,
    speedQuoteEnabled: true,
    infinitySwap: false,
    infinityStableSwap: false,
    blockNumber,
    routeKey: 'twap',
    gasLimit,
    ver: 0,
  })
  const tradeResult = useAtomValue(bestSameChainAtom(quoteOption))
  const trade = tradeResult.map((x) => x.trade).unwrapOr(undefined)

  const inCurrency = useCurrency(fromToken)
  const outCurrency = useCurrency(toToken)

  const loading = useMemo(() => {
    if (!inCurrency || !outCurrency || !trade) return true
    return (
      !trade?.inputAmount.equalTo(amount?.numerator.toString() || '') ||
      !trade.inputAmount.currency.equals(inCurrency) ||
      !trade.outputAmount.currency.equals(outCurrency)
    )
  }, [inCurrency, outCurrency, trade, amount])

  return {
    isLoading: !value ? false : loading,
    outAmount: value ? trade?.outputAmount.numerator.toString() : '0',
  }
}

const useUsd = (address?: string) => {
  const { chainId } = useActiveChainId()
  const currency = useCurrency(address, chainId)
  return useCurrencyUsdPrice(currency).data
}

const TransactionErrorContent = ({ onClick, message }: { onClick: () => void; message?: string }) => {
  return <SwapTransactionErrorContent onDismiss={onClick} message={message || ''} openSettingModal={undefined} />
}

const useTwapToast = () => {
  const { toastSuccess, toastWarning, toastError } = useToast()

  return useCallback(
    (props: ToastProps) => {
      const toast = props.variant === 'error' ? toastError : props.variant === 'warning' ? toastWarning : toastSuccess

      // Log TWAP errors to console for debugging
      if (props.variant === 'error') {
        console.error('[TWAP Error]', props.title, props.message)
      } else if (props.variant === 'warning') {
        console.warn('[TWAP Warning]', props.title, props.message)
      }

      toast(props.title, props.message, { duration: props.autoCloseMillis })
    },
    [toastError, toastSuccess, toastWarning],
  )
}

const Markdown = ({ children }: { children: string }) => {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p style={{ lineHeight: 'normal' }}>{children}</p>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

const TokenPanelInput = ({
  isSrcToken,
  inputLoading,
  value,
  onChange,
  onCurrencySelect,
  isUserInsufficientBalance,
  inputCurrency,
  outputCurrency,
}: {
  isSrcToken: boolean
  inputLoading: boolean
  value: string
  onChange: (value: string) => void
  onCurrencySelect: (currency: UnifiedCurrency) => void
  isUserInsufficientBalance: boolean
  inputCurrency?: Currency
  outputCurrency?: Currency
}) => {
  const { address: account } = useAccount()
  const { t } = useTranslation()
  const loadedUrlParams = useDefaultsFromURLSearch()

  const inputBalance = useCurrencyBalance(account, inputCurrency)

  const maxAmountInput = useMemo(() => maxAmountSpend(inputBalance), [inputBalance])

  const handlePercentInput = useCallback(
    (percent: number) => {
      if (isSrcToken && maxAmountInput) {
        onChange(maxAmountInput.multiply(new Percent(percent, 100)).toExact())
      }
    },
    [maxAmountInput, onChange, isSrcToken],
  )

  const handleMaxInput = useCallback(() => {
    if (isSrcToken && maxAmountInput) {
      onChange(maxAmountInput.toExact())
    }
  }, [maxAmountInput, onChange, isSrcToken])
  return (
    <Suspense fallback={<Skeleton animation="pulse" variant="round" width="100%" height="80px" />}>
      <CurrencyInputPanelSimplify
        id={isSrcToken ? 'swap-currency-input' : 'swap-currency-output'}
        showUSDPrice
        disabled={!isSrcToken}
        showMaxButton
        showCommonBases
        inputLoading={inputLoading}
        currencyLoading={!loadedUrlParams}
        label={isSrcToken ? t('From') : t('To')}
        defaultValue={value}
        maxAmount={maxAmountInput}
        showQuickInputButton
        currency={inputCurrency}
        onUserInput={onChange}
        onPercentInput={handlePercentInput}
        onMax={handleMaxInput}
        onCurrencySelect={onCurrencySelect}
        otherCurrency={outputCurrency}
        commonBasesType={CommonBasesType.SWAP_LIMITORDER}
        title={
          <Text color="textSubtle" fontSize={12} bold>
            {isSrcToken ? t('From') : t('To')}
          </Text>
        }
        isUserInsufficientBalance={isUserInsufficientBalance}
        modalTitle={isSrcToken ? t('From') : t('To')}
        showSearchHeader
      />
    </Suspense>
  )
}

const useCurrencySelect = () => {
  const { onCurrencySelection } = useSwapActionHandlers()
  const { canSwitchToChain, switchNetwork } = useSwitchNetwork()
  const router = useRouter()

  const {
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputChainId },
  } = useSwapState()

  return useCallback(
    async (newCurrency: Currency, field: Field) => {
      return handleCurrencySelectFn({
        onCurrencySelection,
        canSwitchToChain,
        switchNetwork,
        outputChainId,
        inputChainId,
        inputCurrencyId,
        outputCurrencyId,
        router,
        replaceBrowserHistoryMultiple,
        newCurrency,
        field,
      })
    },
    [
      onCurrencySelection,
      canSwitchToChain,
      switchNetwork,
      outputChainId,
      inputChainId,
      inputCurrencyId,
      outputCurrencyId,
      router,
    ],
  )
}

export function TWAPPanel({ limit }: { limit?: boolean }) {
  const { isDesktop } = useMatchBreakpoints()
  const { chainId } = useActiveChainId()
  const tokens = useAllTokens()
  const { connector, address } = useAccount()
  const { isDark } = useTheme()
  const native = useNativeCurrency()
  const {
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputChainId },
  } = useSwapState()

  useDefaultsFromURLSearch()

  const handleCurrencySelect = useCurrencySelect()

  const toast = useTwapToast()

  const onSrcTokenSelected = useCallback(
    (token: Currency) => {
      handleCurrencySelect(token, Field.INPUT)
    },
    [handleCurrencySelect],
  )

  const onDstTokenSelected = useCallback(
    (token: Currency) => {
      handleCurrencySelect(token, Field.OUTPUT)
    },
    [handleCurrencySelect],
  )

  const inputCurrency = useCurrency(inputCurrencyId, inputChainId)
  const outputCurrency = useCurrency(outputCurrencyId, outputChainId)

  useWarningImport()

  const { t } = useTranslation()

  return (
    <QuoteProvider>
      <PancakeTWAP
        ConnectButton={ConnectWalletButton}
        connectedChainId={chainId}
        account={address}
        limit={limit}
        usePriceUSD={useUsd}
        useTrade={useBestTrade}
        dappTokens={tokens}
        isDarkTheme={isDark}
        srcToken={inputCurrency}
        dstToken={outputCurrency}
        onSrcTokenSelected={onSrcTokenSelected}
        onDstTokenSelected={onDstTokenSelected}
        isMobile={!isDesktop}
        t={t}
        nativeToken={native}
        connector={connector}
        useTooltip={useTooltip}
        Button={Button}
        TransactionErrorContent={TransactionErrorContent}
        toast={toast}
        FlipButton={FlipButton}
        Input={Input}
        CurrencyLogo={TokenLogo}
        ReactMarkdown={Markdown}
        InputTokenPanel={TokenPanelInput}
      />
    </QuoteProvider>
  )
}

const TokenLogo = ({ address, size }: { address?: string; size?: string }) => {
  const currency = useCurrency(address)

  if (!currency) {
    return null
  }
  return <CurrencyLogo currency={currency} size={size} />
}

const switchAnimation = keyframes`
  from {transform: rotate(0deg);}
  to {transform: rotate(180deg);}
`

const FlipButtonWrapper = styled.div`
  will-change: transform;
  &.switch-animation {
    animation: ${switchAnimation} 0.25s forwards ease-in-out;
  }
`

export const Line = styled.div`
  position: absolute;
  left: -16px;
  right: -16px;
  height: 1px;
  background-color: ${({ theme }) => theme.colors.cardBorder};
  top: calc(50% + 6px);
`

const FlipButton = memo(function FlipButton({ onClick }: { onClick: () => void }) {
  const flipButtonRef = useRef<HTMLDivElement>(null)
  const lottieRef = useRef<LottieRefCurrentProps | null>(null)
  const { isDark } = useTheme()
  const { isDesktop } = useMatchBreakpoints()

  const animationData = useMemo(() => (isDark ? ArrowDark : ArrowLight), [isDark])

  const handleAnimatedButtonClick = useCallback(() => {
    onClick()

    if (flipButtonRef.current && !flipButtonRef.current.classList.contains('switch-animation')) {
      flipButtonRef.current.classList.add('switch-animation')
    }
  }, [onClick])

  const handleAnimationEnd = useCallback(() => {
    flipButtonRef.current?.classList.remove('switch-animation')
  }, [])

  return (
    <AutoColumn justify="space-between" position="relative">
      <AutoRow justify="center" style={{ padding: '0 1rem' }}>
        {isDesktop ? (
          <FlipButtonWrapper ref={flipButtonRef} onAnimationEnd={handleAnimationEnd}>
            <Lottie
              lottieRef={lottieRef}
              animationData={animationData}
              style={{ height: '40px', cursor: 'pointer' }}
              onClick={handleAnimatedButtonClick}
              autoplay={false}
              loop={false}
              onMouseEnter={() => lottieRef.current?.playSegments([7, 19], true)}
              onMouseLeave={() => {
                handleAnimationEnd()
                lottieRef.current?.playSegments([39, 54], true)
              }}
            />
          </FlipButtonWrapper>
        ) : (
          <SwapUIV2.SwitchButtonV2 onClick={onClick} />
        )}
      </AutoRow>
    </AutoColumn>
  )
})

const Input = ({
  loading,
  disabled,
  value,
  onChange,
}: {
  loading?: boolean
  disabled?: boolean
  value: string
  onChange: (value: string) => void
}) => {
  return (
    <NumericalInput
      disabled={disabled}
      loading={loading}
      className="token-amount-input"
      value={value}
      onUserInput={onChange}
    />
  )
}

export const OrderHistory = () => {
  const { isDesktop } = useMatchBreakpoints()

  return (
    <div style={{ maxWidth: 'unset', marginTop: isDesktop ? 0 : 20 }}>
      <Wrapper id="swap-page" style={{ padding: 0 }}>
        <Orders />
      </Wrapper>
    </div>
  )
}
