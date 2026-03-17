import dynamic from 'next/dynamic'
import { CSSProperties, memo, useCallback, useMemo, useRef, useState } from 'react'

import { AutoColumn, Button, useMatchBreakpoints } from '@pancakeswap/uikit'

import { useTranslation } from '@pancakeswap/localization'
import replaceBrowserHistoryMultiple from '@pancakeswap/utils/replaceBrowserHistoryMultiple'

import { AutoRow } from 'components/Layout/Row'

import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import { useSwapActionHandlers } from 'state/swap/useSwapActionHandlers'
import { keyframes, styled } from 'styled-components'

import { useTheme } from '@pancakeswap/hooks'
import { SwapUIV2 } from '@pancakeswap/widgets-internal'
import { LottieRefCurrentProps } from 'lottie-react'

import { CHAIN_QUERY_NAME } from 'config/chains'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useSwitchNetwork } from 'hooks/useSwitchNetwork'
import { useRouter } from 'next/router'
import ArrowDark from '../../../../public/images/swap/arrow_dark.json' assert { type: 'json' }
import ArrowLight from '../../../../public/images/swap/arrow_light.json' assert { type: 'json' }
import { useAllowRecipient } from '../../Swap/V3Swap/hooks'

const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

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

const getCompactWapperStyle = (compact?: boolean): CSSProperties => {
  if (compact) {
    return {
      position: 'relative',
      height: 0,
      padding: 0,
      margin: 0,
    }
  }
  return {}
}
const getCompactStyle = (compact?: boolean): CSSProperties => {
  if (compact) {
    return {
      position: 'absolute',
      zIndex: 2,
      top: 0,
      marginTop: 0,
      padding: 0,
      left: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }
  return {}
}

export const FlipButton = memo(function FlipButton({
  compact,
  replaceBrowser = true,
}: {
  compact?: boolean
  replaceBrowser?: boolean
}) {
  const flipButtonRef = useRef<HTMLDivElement>(null)
  const lottieRef = useRef<LottieRefCurrentProps | null>(null)
  const { isDark } = useTheme()
  const { isDesktop } = useMatchBreakpoints()
  const { switchNetwork, isLoading } = useSwitchNetwork()
  const { chainId: activeChainId } = useActiveChainId()

  const [isSwitching, setIsSwitching] = useState(false)
  const animationData = useMemo(() => (isDark ? ArrowDark : ArrowLight), [isDark])

  const { onSwitchTokens } = useSwapActionHandlers()
  const {
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputChainId },
  } = useSwapState()

  const router = useRouter()

  const onFlip = useCallback(async () => {
    setIsSwitching(true)

    try {
      onSwitchTokens()

      if (replaceBrowser) {
        // If cross-chain swap, switch network to new Input Currency's chain
        if (outputChainId && activeChainId !== outputChainId && !isLoading) {
          const result = await switchNetwork(outputChainId, {
            replaceUrl: false,
            from: 'switch',
          })
          if (result) {
            router.replace(
              {
                query: {
                  ...router.query,
                  ...(outputCurrencyId && { inputCurrency: outputCurrencyId }),
                  ...(outputChainId && { chain: CHAIN_QUERY_NAME[outputChainId] }),
                  ...(inputCurrencyId && { outputCurrency: inputCurrencyId }),
                  ...(inputChainId && { chainOut: CHAIN_QUERY_NAME[inputChainId] }),
                },
              },
              undefined,
              {
                shallow: true,
              },
            )
          }
          return
        }

        replaceBrowserHistoryMultiple({
          inputCurrency: outputCurrencyId,
          outputCurrency: inputCurrencyId,
          ...(inputChainId &&
            outputChainId &&
            inputChainId !== outputChainId && {
              chainOut: CHAIN_QUERY_NAME[inputChainId],
              chain: CHAIN_QUERY_NAME[outputChainId],
            }),
        })
      }
    } finally {
      setIsSwitching(false)
    }
  }, [
    onSwitchTokens,
    inputCurrencyId,
    outputCurrencyId,
    activeChainId,
    isLoading,
    setIsSwitching,
    inputChainId,
    outputChainId,
    replaceBrowser,
    switchNetwork,
    router,
  ])

  const handleAnimatedButtonClick = useCallback(() => {
    if (isSwitching) return

    onFlip()

    if (flipButtonRef.current && !flipButtonRef.current.classList.contains('switch-animation')) {
      flipButtonRef.current.classList.add('switch-animation')
    }
  }, [onFlip, isSwitching])

  const handleAnimationEnd = useCallback(() => {
    flipButtonRef.current?.classList.remove('switch-animation')
  }, [])

  return (
    <AutoColumn
      justify="space-between"
      position="relative"
      style={{
        ...getCompactWapperStyle(compact),
      }}
    >
      {!compact && <Line />}
      <AutoRow
        justify="center"
        style={{
          padding: '0 1rem',
          marginTop: '1em',
          ...getCompactStyle(compact),
        }}
      >
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
          <SwapUIV2.SwitchButtonV2 onClick={onFlip} />
        )}
      </AutoRow>
    </AutoColumn>
  )
})

export const AssignRecipientButton: React.FC = memo(() => {
  const { t } = useTranslation()
  const { recipient } = useSwapState()
  const { onChangeRecipient } = useSwapActionHandlers()
  const allowRecipient = useAllowRecipient()
  if (!allowRecipient || recipient !== null) return null
  return (
    <Button
      variant="text"
      id="add-recipient-button"
      onClick={() => onChangeRecipient('')}
      data-dd-action-name="Swap flip button"
      width="100%"
    >
      {t('+ Assign Recipient')}
    </Button>
  )
})
