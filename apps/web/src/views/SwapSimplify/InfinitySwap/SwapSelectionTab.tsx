import { useTheme } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import {
  ButtonMenu,
  ButtonMenuItem,
  ChartDisableIcon,
  ChartIcon,
  IconButton,
  Text,
  TooltipText,
  useMatchBreakpoints,
  useTooltip,
} from '@pancakeswap/uikit'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useIsSmartAccount } from 'hooks/useIsSmartAccount'
import { useAtom } from 'jotai'
import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import { styled } from 'styled-components'
import { isEvm } from '@pancakeswap/chains'
import { SWAP_CHART_UNSUPPORTED_CHAINS } from 'config/constants/supportChains'
import { chartDisplayAtom } from './atoms'

import { SwapType } from '../../Swap/types'
import { isTwapSupported, isLimitSupported } from '../../Swap/utils'

const ColoredIconButton = styled(IconButton)`
  color: ${({ theme }) => theme.colors.textSubtle};
  overflow: hidden;
`

const StyledButtonMenuItem = styled(ButtonMenuItem)`
  height: 40px;
  padding: 0px 16px;
  * ${({ theme }) => theme.mediaQueries.md} {
    width: 124px;
    padding: 0px 24px;
  }
`
const StyledButtonMenuItemTooltip = styled(StyledButtonMenuItem)`
  padding: 0px;
  > div {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    text-decoration: none;
    padding: 0px 16px;
    color: inherit;
    font-weight: inherit;
  }
  * ${({ theme }) => theme.mediaQueries.md} {
    padding: 0px;
  }
`

const SwapSelectionWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  gap: 4px;
  padding: 16px;
  background-color: ${({ theme }) => theme.colors.backgroundAlt};
  border-radius: 24px;
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  ${({ theme }) => theme.mediaQueries.md} {
    gap: 16px;
  }
`

export const SwapSelection = ({
  swapType,
  withToolkit = false,
  style,
  outputChainId,
}: {
  swapType: SwapType
  withToolkit?: boolean
  style?: React.CSSProperties
  outputChainId?: number
}) => {
  const { t } = useTranslation()
  const router = useRouter()

  const onSelect = useCallback(
    (value: SwapType) => {
      let url = ''
      switch (value) {
        case SwapType.LIMIT:
          url = '/swap/limit'
          break
        case SwapType.TWAP:
          url = '/swap/twap'
          break
        case SwapType.MARKET:
          url = '/'
          break
        default:
          break
      }
      router.push(url)
    },
    [router],
  )
  const { chainId } = useActiveChainId()
  const { isMobile } = useMatchBreakpoints()
  const isSmartAccount = useIsSmartAccount()

  const { targetRef, tooltip, tooltipVisible } = useTooltip(
    <Text>
      {isSmartAccount
        ? t('TWAP and Limit orders are currently not supported for Smart Account wallets.')
        : t(
            'TWAP (Time-Weighted Average Price) helps minimises market impact from large orders by averaging the asset price over a set time period.',
          )}
    </Text>,
    { placement: 'top' },
  )

  const [isChartDisplayed, setIsChartDisplayed] = useAtom(chartDisplayAtom)

  const toggleChartDisplayed = () => {
    setIsChartDisplayed((currentIsChartDisplayed) => !currentIsChartDisplayed)
  }

  const { theme } = useTheme()
  const tSwapProps = useMemo(() => {
    const isTSwapSupported = isTwapSupported(chainId) && !isSmartAccount
    return {
      disabled: !isTSwapSupported,
      style: {
        cursor: isTSwapSupported ? 'pointer' : 'not-allowed',
        pointerEvents: isTSwapSupported ? 'auto' : 'none',
        color: !isTSwapSupported ? theme.colors.textDisabled : undefined,
        userSelect: 'none',
      } as React.CSSProperties,
    }
  }, [chainId, theme.colors.textDisabled, isSmartAccount])

  const limitProps = useMemo(() => {
    const isLimitSwapSupported = isLimitSupported(chainId)
    return {
      disabled: !isLimitSwapSupported,
      style: {
        cursor: isLimitSwapSupported ? 'pointer' : 'not-allowed',
        pointerEvents: isLimitSwapSupported ? 'auto' : 'none',
        color: !isLimitSwapSupported ? theme.colors.textDisabled : undefined,
        userSelect: 'none',
      } as React.CSSProperties,
    }
  }, [theme.colors.textDisabled, chainId])

  return (
    <SwapSelectionWrapper style={style}>
      <ButtonMenu
        scale="md"
        activeIndex={swapType}
        onItemClick={(index) => onSelect(index)}
        variant="subtle"
        noButtonMargin
        fullWidth
      >
        <StyledButtonMenuItem>{t('Swap')}</StyledButtonMenuItem>
        {isMobile ? (
          <StyledButtonMenuItemTooltip {...tSwapProps}>{t('TWAP')}</StyledButtonMenuItemTooltip>
        ) : (
          <StyledButtonMenuItemTooltip {...tSwapProps}>
            <TooltipText ref={targetRef}>{t('TWAP')}</TooltipText>
            {tooltipVisible && tooltip}
          </StyledButtonMenuItemTooltip>
        )}

        <StyledButtonMenuItem {...limitProps}>{t('Limit')}</StyledButtonMenuItem>
      </ButtonMenu>

      {withToolkit && !SWAP_CHART_UNSUPPORTED_CHAINS.includes(chainId) && (
        <ColoredIconButton
          onClick={() => {
            toggleChartDisplayed()
          }}
          variant="text"
          scale="sm"
          data-dd-action-name="Price chart button"
          width="24px"
          p="0"
        >
          {isChartDisplayed ? (
            <ChartDisableIcon width="24px" color="textSubtle" />
          ) : (
            <ChartIcon width="24px" color="textSubtle" />
          )}
        </ColoredIconButton>
      )}
    </SwapSelectionWrapper>
  )
}
