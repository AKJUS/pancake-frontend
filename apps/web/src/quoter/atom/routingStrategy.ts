import { getCurrencyAddress } from '@pancakeswap/swap-sdk-core'
import { Loadable } from '@pancakeswap/utils/Loadable'
import { AGGREGATOR_SUPPORTED_CHAIN_IDS } from 'config/constants/aggregatorRouters'
import { Atom, atom } from 'jotai'
import { atomFamily } from 'jotai/utils'
import { AtomFamily } from 'jotai/vanilla/utils/atomFamily'
import { QuoteQuery } from 'quoter/quoter.types'
import { aggregatorOverrideAtom, isAggregatorOverrideEnabled } from 'state/featureFlags/aggregatorOverrideAtom'
import { POSTHOG_FLAGS, posthogFlagsAtom } from 'state/featureFlags/posthogFlagsAtom'
import { InterfaceOrder } from 'views/Swap/utils'
import { atomWithLoadable } from './atomWithLoadable'
import { bestAggregatorQuoteAtom } from './bestAggregatorQuoteAtom'
import { bestAMMTradeFromQuoterWorker2Atom } from './bestAMMTradeFromQuoterWorker2Atom'
import { bestAMMTradeFromQuoterWorkerAtom } from './bestAMMTradeFromQuoterWorkerAtom'
import { bestRoutingSDKTradeAtom } from './bestRoutingSDKTradeAtom'
import { bestXApiAtom } from './bestXAPIAtom'
import { isRwaTokenAtom } from './rwaTokenAtoms'

// Off production we want aggregator to run for QA/dev regardless of PostHog flag state,
// so the release flag only gates prod traffic.
const isProductionEnv = () => process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'

type AtomType = AtomFamily<QuoteQuery, Atom<Loadable<InterfaceOrder>>>
export interface StrategyRoute {
  query: AtomType
  overrides: Partial<QuoteQuery>
  isShadow?: boolean // shadow queries don't provide final result, used for get quite quote for user
  priority?: number
  key: string
}

const Strategies = {
  aggregator: {
    query: bestAggregatorQuoteAtom,
    overrides: {},
  },
  single: {
    query: bestAMMTradeFromQuoterWorker2Atom,
    overrides: {
      maxHops: 1,
      maxSplits: 0,
    },
  },
  'routing-sdk': {
    query: bestRoutingSDKTradeAtom,
    overrides: {},
  },
  x: {
    query: bestXApiAtom,
    overrides: {},
  },
  full: {
    query: bestAMMTradeFromQuoterWorkerAtom,
    overrides: {},
  },
}

interface StrategyConfig {
  key: keyof typeof Strategies
  priority: number
  isShadow?: boolean
}

const AGGREGATOR_ONLY_ROUTING_CONFIG: StrategyConfig[] = [
  {
    key: 'aggregator',
    priority: 1,
  },
]

const RWA_ONLY_ROUTING_CONFIG: StrategyConfig[] = [
  {
    key: 'x',
    priority: 1,
  },
]

const AGGREGATOR_FIRST_ROUTING_CONFIG: StrategyConfig[] = [
  {
    key: 'aggregator',
    priority: 1,
  },
  {
    key: 'single',
    priority: 2,
  },
  {
    key: 'routing-sdk',
    priority: 2,
  },
  {
    key: 'x',
    priority: 2,
  },
  {
    key: 'full',
    priority: 3,
  },
]

const LEGACY_FIRST_ROUTING_CONFIG: StrategyConfig[] = [
  {
    key: 'aggregator',
    priority: 1,
  },
  {
    key: 'single',
    priority: 1,
  },
  {
    key: 'routing-sdk',
    priority: 1,
  },
  {
    key: 'x',
    priority: 1,
  },
  {
    key: 'full',
    priority: 2,
  },
]

export type RoutingMode = 'aggregator-first' | 'legacy-first'

export function getRoutingMode(): RoutingMode {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ? 'legacy-first' : 'aggregator-first'
}

export function getDefaultRoutingConfig(mode: RoutingMode): StrategyConfig[] {
  return mode === 'aggregator-first' ? AGGREGATOR_FIRST_ROUTING_CONFIG : LEGACY_FIRST_ROUTING_CONFIG
}

interface TokenSpecificRoutingStrategy {
  [chainId: number]: {
    [address: string]: StrategyConfig[]
  }
}

export const getTokenRoutingConfig = async () => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_PROOF_API}/cms-config/tokens-routing-config.json`)
    if (!response.ok) {
      return {}
    }
    return response.json()
  } catch (ex) {
    return {}
  }
}

export const tokenRoutingConfigForInitAtom = atomWithLoadable<TokenSpecificRoutingStrategy>(async () => {
  try {
    return await getTokenRoutingConfig()
  } catch (ex) {
    return {}
  }
})

export const routingStrategyAtom = atomFamily(
  (query: QuoteQuery) => {
    return atom((get) => {
      const config = get(tokenRoutingConfigForInitAtom)
      if (!config.isJust()) {
        throw new Error('Routing config not loaded')
      }

      const { baseCurrency } = query
      const quoteCurrency = query.currency

      const baseAddress = baseCurrency ? getCurrencyAddress(baseCurrency)?.toLowerCase() : undefined
      const quoteAddress = quoteCurrency ? getCurrencyAddress(quoteCurrency)?.toLowerCase() : undefined

      const isRwaTrade =
        (baseCurrency && baseAddress
          ? get(isRwaTokenAtom({ chainId: baseCurrency.chainId, address: baseAddress }))
          : false) ||
        (quoteCurrency && quoteAddress
          ? get(isRwaTokenAtom({ chainId: quoteCurrency.chainId, address: quoteAddress }))
          : false)

      const flags = get(posthogFlagsAtom)
      const aggregatorOverrideEnabled = isAggregatorOverrideEnabled(get(aggregatorOverrideAtom))
      const aggregatorReleaseEnabled =
        aggregatorOverrideEnabled || (isProductionEnv() ? flags[POSTHOG_FLAGS.AGGREGATOR_V1] === true : true)
      if (process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production') {
        console.log('[PostHog] Routing strategy evaluation:', {
          isProduction: isProductionEnv(),
          flagValue: flags[POSTHOG_FLAGS.AGGREGATOR_V1],
          aggregatorOverrideEnabled,
          aggregatorReleaseEnabled,
          allFlags: flags,
        })
      }

      return getRoutingStrategy(query, config.unwrap(), isRwaTrade, aggregatorReleaseEnabled, aggregatorOverrideEnabled)
    })
  },
  (a, b) => a.hash === b.hash,
)

export function getRoutingStrategy(
  query: QuoteQuery,
  tokenSpecificConfig: TokenSpecificRoutingStrategy,
  isRwaTrade: boolean,
  aggregatorReleaseEnabled: boolean,
  aggregatorOverrideEnabled = false,
): StrategyRoute[] {
  const currencyA = query.baseCurrency!
  const currencyB = query.currency!
  const { chainId } = currencyA
  const addressA = getCurrencyAddress(currencyA)
  const addressB = getCurrencyAddress(currencyB)
  if (query.aggregatorOnly && !isProductionEnv()) {
    return AGGREGATOR_ONLY_ROUTING_CONFIG.map((x) => ({ ...Strategies[x.key], ...x })) as StrategyRoute[]
  }
  if (isRwaTrade) {
    return RWA_ONLY_ROUTING_CONFIG.map((x) => ({ ...Strategies[x.key], ...x })) as StrategyRoute[]
  }
  const config =
    tokenSpecificConfig[chainId]?.[addressA] ||
    tokenSpecificConfig[chainId]?.[addressB] ||
    getDefaultRoutingConfig(getRoutingMode())

  const isAggregatorSupported = AGGREGATOR_SUPPORTED_CHAIN_IDS.includes(chainId)
  const aggregatorAllowed = isAggregatorSupported && aggregatorReleaseEnabled
  const filteredConfig = aggregatorAllowed ? config : config.filter((x) => x.key !== 'aggregator')
  if (process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production') {
    console.log('[PostHog] Routing config applied:', {
      chainId,
      isAggregatorSupported,
      aggregatorOverrideEnabled,
      aggregatorReleaseEnabled,
      aggregatorAllowed,
      selectedStrategies: filteredConfig.map((x) => x.key),
    })
  }

  return filteredConfig.map((x) => {
    const strategy = Strategies[x.key]
    if (!strategy) {
      throw new Error(`Routing strategy ${x.key} not found`)
    }
    return {
      ...strategy,
      ...x,
    } as StrategyRoute
  })
}
