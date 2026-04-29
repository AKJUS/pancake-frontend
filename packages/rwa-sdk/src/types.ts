export type RWAFamilyType = 'ondo' | 'xstocks'

export type AllowedCounterpartyRule =
  | { kind: 'symbol'; value: string }
  | { kind: 'address'; chainId: number; value: string }
  | { kind: 'family'; value: RWAFamilyType }
  | { kind: 'native'; chainId: number }

export type SelectionPolicy =
  | { type: 'free' }
  | {
      type: 'fixed-counterparties'
      counterparties: AllowedCounterpartyRule[]
      showNative?: boolean
      supportCrossChain?: boolean
      showCommonBases?: boolean
    }

export type RoutingPolicy = {
  mode: 'normal' | 'x-only'
}

export type MarketStatusPolicy =
  | { type: 'none' }
  | {
      type: 'ondo-status'
      endpoints: {
        assetStatus: string
        marketStatus: string
      }
    }

export type CompliancePolicy =
  | { type: 'none' }
  | {
      type: 'partner-restricted-jurisdictions'
      restrictedRegions?: string[]
      disclaimerKey?: string
    }

export type RWAFamily = {
  type: RWAFamilyType
  listUrls: string[]
  routing: RoutingPolicy
  selection: SelectionPolicy
  marketStatus: MarketStatusPolicy
  compliance: CompliancePolicy
}

export type RWAFamilyRegistry = {
  families: RWAFamily[]
}

export type RWAToken = {
  chainId: number
  address: string
  symbol?: string
}

export type RWATokensByFamily = Partial<Record<RWAFamilyType, RWAToken[]>>

export type RWATokenIdentifier = {
  chainId: number
  address: string
}
