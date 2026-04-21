import { useTranslation } from '@pancakeswap/localization'
import { Route, RouteType, SVMPool } from '@pancakeswap/smart-router'
import {
  AutoColumn,
  ButtonProps,
  Flex,
  Modal,
  ModalV2,
  PoolTypeIcon,
  QuestionHelper,
  Text,
  UseModalV2Props,
  useTooltip,
} from '@pancakeswap/uikit'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'
import { memo, useMemo, useState } from 'react'

import { RoutingSettingsModalContent } from 'components/Menu/GlobalSettings/SettingsModalV2'
import { CurrencyLogoWrapper, RouterBox, RouterTypeText } from 'views/Swap/components/RouterViewer'
import { useHookDiscount } from 'views/SwapSimplify/hooks/useHookDiscount'
import { Currency, SPLToken, UnifiedCurrency } from '@pancakeswap/sdk'
import { useUnifiedCurrency } from 'hooks/Tokens'
import { TertiaryButton } from 'views/Swap/components/SlippageButton'
import { useTheme } from '@pancakeswap/hooks'

import { BridgeRoutesDisplay } from './RouteDisplay/BridgeRoutesDisplay'
import { EVMPairNodes } from './RouteDisplay/pairNode'
import { JupPairNodes } from './RouteDisplay/JupPairNodes'
import { Pair } from './RouteDisplay/types'

export type RouteDisplayEssentials = Pick<Route, 'path' | 'pools' | 'inputAmount' | 'outputAmount' | 'percent' | 'type'>

interface Props extends UseModalV2Props {
  routes: RouteDisplayEssentials[]
  tradeInputCurrency?: Currency
  tradeOutputCurrency?: Currency
}

interface RoutesDisplayButtonViewProps extends ButtonProps {
  onClick: () => void
  children: React.ReactNode
}
export const RoutesDisplayButtonView = ({ onClick, children, ...props }: RoutesDisplayButtonViewProps) => {
  const { theme } = useTheme()
  return (
    <TertiaryButton role="button" $color={theme.colors.primary60} onClick={onClick} {...props}>
      {children}
    </TertiaryButton>
  )
}

const RoutesDisplayView = ({
  routes,
  tradeInputCurrency,
  tradeOutputCurrency,
}: {
  routes: RouteDisplayEssentials[]
  tradeInputCurrency?: Currency
  tradeOutputCurrency?: Currency
}) => {
  const { t } = useTranslation()
  const isBridgeRouting = routes?.some((route) => route.type === RouteType.BRIDGE)

  return (
    <Modal
      title={
        <Flex justifyContent="center">
          {t('Route')}{' '}
          <QuestionHelper
            text={t('Routing through these tokens resulted in the best price for your trade.')}
            ml="4px"
            placement="top-start"
          />
        </Flex>
      }
      minHeight="0px"
      bodyPadding="24px 24px 48px"
    >
      {isBridgeRouting ? (
        <BridgeRoutesDisplay routes={routes} />
      ) : (
        <AutoColumn gap="56px" height="100%" pb="16px">
          {routes.map((route, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <RouteDisplay
              key={i}
              route={route}
              tradeInputCurrency={tradeInputCurrency}
              tradeOutputCurrency={tradeOutputCurrency}
            />
          ))}
        </AutoColumn>
      )}
    </Modal>
  )
}

export const RouteDisplayModal = memo(function RouteDisplayModal({
  isOpen,
  onDismiss,
  routes,
  tradeInputCurrency,
  tradeOutputCurrency,
}: Props) {
  const [showRoutingSettingsModal, setShowRoutingSettingsModal] = useState(false)

  return (
    <ModalV2
      closeOnOverlayClick
      isOpen={isOpen}
      onDismiss={() => {
        setShowRoutingSettingsModal(false)
        onDismiss?.()
      }}
      minHeight="0px"
    >
      {showRoutingSettingsModal ? (
        <RoutingSettingsModalContent onBack={() => setShowRoutingSettingsModal(false)} />
      ) : (
        <RoutesDisplayView
          routes={routes}
          tradeInputCurrency={tradeInputCurrency}
          tradeOutputCurrency={tradeOutputCurrency}
        />
      )}
    </ModalV2>
  )
})

interface RouteDisplayProps {
  route: RouteDisplayEssentials
  tradeInputCurrency?: Currency
  tradeOutputCurrency?: Currency
}

function RouteDisplayView({
  inputCurrency,
  outputCurrency,
  pairNodes,
  percent,
}: {
  inputCurrency: UnifiedCurrency | null | undefined
  outputCurrency: UnifiedCurrency | null | undefined
  pairNodes: React.ReactNode
  percent: number
}) {
  const { targetRef, tooltip, tooltipVisible } = useTooltip(<Text>{inputCurrency?.symbol ?? ''}</Text>, {
    placement: 'right',
  })

  const {
    targetRef: outputTargetRef,
    tooltip: outputTooltip,
    tooltipVisible: outputTooltipVisible,
  } = useTooltip(<Text>{outputCurrency?.symbol ?? ''}</Text>, {
    placement: 'right',
  })

  if (!inputCurrency || !outputCurrency) {
    return null
  }

  return (
    <AutoColumn gap="24px">
      <RouterBox justifyContent="space-between" alignItems="center">
        <CurrencyLogoWrapper
          size={{
            xs: '32px',
            md: '48px',
          }}
          ref={targetRef}
        >
          <CurrencyLogo size="100%" currency={inputCurrency as Currency} />

          <RouterTypeText fontWeight="bold">{Math.round(percent)}%</RouterTypeText>
        </CurrencyLogoWrapper>
        {tooltipVisible && tooltip}
        {pairNodes}
        <CurrencyLogoWrapper
          size={{
            xs: '32px',
            md: '48px',
          }}
          ref={outputTargetRef}
        >
          <CurrencyLogo size="100%" currency={outputCurrency as Currency} />
        </CurrencyLogoWrapper>
        {outputTooltipVisible && outputTooltip}
      </RouterBox>
    </AutoColumn>
  )
}

function getPairs(path: UnifiedCurrency[]) {
  if (path.length <= 1) {
    return []
  }

  const currencyPairs: Pair[] = []
  for (let i = 0; i < path.length - 1; i += 1) {
    currencyPairs.push([path[i] as Currency, path[i + 1] as Currency])
  }
  return currencyPairs
}

export function EVMRouteDisplayContainer({ route, tradeInputCurrency, tradeOutputCurrency }: RouteDisplayProps) {
  const { hookDiscount, category } = useHookDiscount(route.pools)
  const { path, pools, inputAmount, outputAmount } = route

  // When the trade-level currency is native (e.g. ETH), substitute it at the first/last
  // path positions so logos render as ETH instead of WETH. The aggregator API returns
  // wrapped-token addresses in route paths even when the user is swapping native ETH.
  const displayPath = useMemo(() => {
    let result = path
    if (tradeInputCurrency?.isNative && result.length > 0) {
      result = [tradeInputCurrency, ...result.slice(1)]
    }
    if (tradeOutputCurrency?.isNative && result.length > 0) {
      result = [...result.slice(0, -1), tradeOutputCurrency]
    }
    return result
  }, [path, tradeInputCurrency, tradeOutputCurrency])

  const inputCurrency = tradeInputCurrency?.isNative ? tradeInputCurrency : inputAmount.currency
  const outputCurrency = tradeOutputCurrency?.isNative ? tradeOutputCurrency : outputAmount.currency

  const pairs = useMemo(() => getPairs(displayPath), [displayPath])

  return (
    <RouteDisplayView
      percent={route.percent}
      inputCurrency={inputCurrency}
      outputCurrency={outputCurrency}
      pairNodes={
        <EVMPairNodes
          pairs={pairs}
          pools={pools}
          routePoolsLength={route.pools.length}
          hookDiscount={hookDiscount}
          category={category}
        />
      }
    />
  )
}

function SolanaRouteDisplayContainer({ route }: RouteDisplayProps) {
  const { path, pools, inputAmount, outputAmount } = route
  const { currency: inputCurrencyMaybeMock } = inputAmount
  const { currency: outputCurrencyMaybeMock } = outputAmount

  const pairs = useMemo(() => getPairs(path), [path])

  const inputCurrency = useUnifiedCurrency(
    (inputCurrencyMaybeMock as SPLToken).address,
    (inputCurrencyMaybeMock as SPLToken).chainId,
  )

  const outputCurrency = useUnifiedCurrency(
    (outputCurrencyMaybeMock as SPLToken).address,
    (outputCurrencyMaybeMock as SPLToken).chainId,
  )

  return (
    <RouteDisplayView
      percent={route.percent}
      inputCurrency={inputCurrency}
      outputCurrency={outputCurrency}
      pairNodes={<JupPairNodes pairs={pairs} pools={pools as SVMPool[]} />}
    />
  )
}

export const RouteDisplay = memo(function RouteDisplay({
  route,
  tradeInputCurrency,
  tradeOutputCurrency,
}: RouteDisplayProps) {
  if (route.type === RouteType.SVM) {
    return <SolanaRouteDisplayContainer route={route} />
  }

  return (
    <EVMRouteDisplayContainer
      route={route}
      tradeInputCurrency={tradeInputCurrency}
      tradeOutputCurrency={tradeOutputCurrency}
    />
  )
})
