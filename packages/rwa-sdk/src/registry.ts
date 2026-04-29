import { RWAFamily, RWAFamilyRegistry, RWAFamilyType } from './types'

const PANCAKE_ONDO_RWA_LIST = 'https://tokens.pancakeswap.finance/ondo-rwa-tokens.json'
const PANCAKE_XSTOCKS_LIST = 'https://tokens.pancakeswap.finance/xstocks/xstocks-pancake.tokenlist.json'

const families: RWAFamily[] = [
  {
    type: 'ondo',
    listUrls: [PANCAKE_ONDO_RWA_LIST],
    routing: { mode: 'x-only' },
    selection: {
      type: 'fixed-counterparties',
      counterparties: [
        { kind: 'symbol', value: 'USDT' },
        { kind: 'symbol', value: 'USDON' },
        { kind: 'native', chainId: 56 },
        { kind: 'native', chainId: 1 },
      ],
      showNative: true,
      supportCrossChain: false,
      showCommonBases: false,
    },
    marketStatus: {
      type: 'ondo-status',
      endpoints: {
        assetStatus: 'https://raw-api.pancakeswap.com/ondo/status',
        marketStatus: 'https://raw-api.pancakeswap.com/ondo/market-status',
      },
    },
    compliance: { type: 'none' },
  },
  {
    type: 'xstocks',
    listUrls: [PANCAKE_XSTOCKS_LIST],
    routing: { mode: 'x-only' },
    selection: { type: 'free' },
    marketStatus: { type: 'none' },
    compliance: {
      type: 'partner-restricted-jurisdictions',
      restrictedRegions: ['US', 'CA', 'UK', 'AU'],
    },
  },
]

const familyMap = Object.freeze(
  families.reduce<Record<RWAFamilyType, RWAFamily>>(
    (acc, family) => ({
      ...acc,
      [family.type]: family,
    }),
    {} as Record<RWAFamilyType, RWAFamily>,
  ),
)

export const rwaRegistry: RWAFamilyRegistry = {
  families,
}

export const rwaFamilies = families

export const getRWAFamily = (type: RWAFamilyType): RWAFamily => familyMap[type]
