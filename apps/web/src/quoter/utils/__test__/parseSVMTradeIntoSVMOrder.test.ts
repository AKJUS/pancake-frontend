import { OrderType } from '@pancakeswap/price-api-sdk'
import { PoolType, SVMPool } from '@pancakeswap/smart-router'
import { SOL } from '@pancakeswap/sdk'
import { SPLToken, TradeType, UnifiedCurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { PublicKey } from '@solana/web3.js'
import type { SVMQuoteQuery } from '../../quoter.types'
import { parseRoutePlansToRoutes, parseSVMTradeIntoSVMOrder } from '../svm-utils/parseSVMTradeIntoSVMOrder'

const NATIVE_SOL = SOL

// Mock tokens
const MOCK_SOL = new SPLToken({
  chainId: 103,
  programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  address: 'So11111111111111111111111111111111111111112', // WSOL
  decimals: 9,
  symbol: 'SOL',
  name: 'Solana',
  logoURI: 'https://example.com/sol.png',
})

const MOCK_USDC = new SPLToken({
  chainId: 103,
  programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  decimals: 6,
  symbol: 'USDC',
  name: 'USD Coin',
  logoURI: 'https://example.com/usdc.png',
})

const MOCK_TOKEN_1 = new SPLToken({
  chainId: 103,
  programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // TOKEN_1
  decimals: 6,
  symbol: 'TOKEN_1',
  name: 'Token 1',
  logoURI: 'https://example.com/token1.png',
})

const MOCK_TOKEN_2 = new SPLToken({
  chainId: 103,
  programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  address: 'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij', // TOKEN_2
  decimals: 6,
  symbol: 'TOKEN_2',
  name: 'Token 2',
  logoURI: 'https://example.com/token2.png',
})

// Utility type for route swap info
interface MockSwapInfo {
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  ammKey: string
  label: string
  feeAmount: string
  feeMint: string
}

// Utility type for route
interface MockRoute {
  swapInfo: MockSwapInfo
  percent: number
  bps?: number
}

// Utility function to create mock SolRouterTrade
function createMockSolRouterTrade({
  inputAmount,
  outputAmount,
  routes,
  requestId = 'mock_request_id',
  tradeType = TradeType.EXACT_INPUT,
  otherAmountThreshold = '99000000',
  priceImpactPct = '0.0002',
  slippageBps = 50,
  transaction = 'mock_transaction_string',
}: {
  inputAmount: UnifiedCurrencyAmount<SPLToken>
  outputAmount: UnifiedCurrencyAmount<SPLToken>
  routes: MockRoute[]
  requestId?: string
  tradeType?: TradeType
  otherAmountThreshold?: string
  priceImpactPct?: string
  slippageBps?: number
  transaction?: string
}) {
  return {
    requestId,
    tradeType,
    inputAmount,
    outputAmount,
    routes: routes.map((route) => ({
      swapInfo: {
        ...route.swapInfo,
        ammKey: new PublicKey(route.swapInfo.ammKey),
        feeMint: new PublicKey(route.swapInfo.feeMint),
      },
      percent: route.percent,
      ...(route.bps && { bps: route.bps }),
    })),
    otherAmountThreshold,
    priceImpactPct,
    slippageBps,
    transaction,
  }
}

// Utility function to create simple swap info
function createSwapInfo({
  inputMint,
  outputMint,
  inAmount,
  outAmount,
  ammKey,
  label,
  feeAmount = '0',
  feeMint,
}: {
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  ammKey: string
  label: string
  feeAmount?: string
  feeMint?: string
}): MockSwapInfo {
  return {
    inputMint,
    outputMint,
    inAmount,
    outAmount,
    ammKey,
    label,
    feeAmount,
    feeMint: feeMint || inputMint, // Default to inputMint if not provided
  }
}

describe('parseSVMTradeIntoSVMOrder', () => {
  it('should convert SolRouterTrade to SVMOrder correctly with single-route and single-hop', () => {
    // Mock SolRouterTrade
    const mockSolRouterTrade = createMockSolRouterTrade({
      inputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_SOL, '1000000000'), // 1 SOL
      outputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_USDC, '100000000'), // 100 USDC
      routes: [
        {
          swapInfo: createSwapInfo({
            inputMint: MOCK_SOL.address,
            inAmount: '1000000000',
            outputMint: MOCK_USDC.address,
            outAmount: '100000000',
            ammKey: '11111111111111111111111111111112',
            label: 'Raydium',
            feeAmount: '5000000', // 0.005 SOL
            feeMint: MOCK_SOL.address,
          }),
          bps: 25, // 0.25%
          percent: 100,
        },
      ],
    })

    // Mock QuoteQuery
    const mockQuoteQuery: SVMQuoteQuery = {
      baseCurrency: MOCK_SOL,
      currency: MOCK_USDC,
      amount: UnifiedCurrencyAmount.fromRawAmount(MOCK_SOL, '1000000000'),
      tradeType: TradeType.EXACT_INPUT,
      speedQuoteEnabled: false,
      xEnabled: false,
      blockNumber: 123456,
      createTime: Date.now(),
      infinitySwap: false,
      infinityStableSwap: false,
      hash: 'mock_query_hash',
      ver: 0,
    }

    // Execute function
    const result = parseSVMTradeIntoSVMOrder(mockSolRouterTrade, mockQuoteQuery)

    // Assertions
    expect(result.type).toBe(OrderType.PCS_SVM)
    expect(result.trade).toBeDefined()

    // Test trade properties
    const { trade } = result
    expect(trade.tradeType).toBe(TradeType.EXACT_INPUT)
    expect(trade.inputAmount).toEqual(mockSolRouterTrade.inputAmount)
    expect(trade.outputAmount).toEqual(mockSolRouterTrade.outputAmount)
    expect(trade.quoteQueryHash).toBe('mock_query_hash')
    expect(trade.transaction).toBe('mock_transaction_string')

    // Test routes conversion
    expect(trade.routes).toHaveLength(1)
    const route = trade.routes[0]
    expect(route.pools).toHaveLength(1)

    // Cast to SVMPool to access SVM-specific properties
    const svmPool = route.pools[0] as SVMPool
    expect(svmPool.type).toBe(PoolType.SVM)
    expect(svmPool.id).toBe('11111111111111111111111111111112')
    // expect(svmPool.fee).toBe(25)

    expect(route.path).toHaveLength(2)
    expect(route.path[0]).toBe(MOCK_SOL)
    expect(route.path[1]).toBe(MOCK_USDC)
    expect(route.percent).toBe(100)

    // Test price impact calculation (negative price impact converts to 0)
    expect(trade.priceImpactPct.toSignificant(3)).toBe('0.02')

    // Test threshold amounts with null checks
    if (trade.minimumAmountOut) {
      expect(trade.minimumAmountOut.toExact()).toBe('99') // 99 USDC (6 decimals)
    }
    if (trade.maximumAmountIn) {
      expect(trade.maximumAmountIn.toExact()).toBe('0.099') // 0.099 SOL (9 decimals)
    }
  })
})

describe('single-route', () => {
  // NOTE: no need to test single-hop only because it's already tested in the main test

  it('should work with multi-hop', () => {
    const mockSolRouterTrade = createMockSolRouterTrade({
      inputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_SOL, '1000000'),
      outputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_USDC, '289245979504'),
      routes: [
        {
          swapInfo: createSwapInfo({
            ammKey: '3EjmVndSDMTW9bixbfku8VkwKTtGzKBezMciVa3mHGje',
            label: 'Whirlpools',
            inputMint: MOCK_SOL.address,
            outputMint: MOCK_TOKEN_1.address,
            inAmount: '1998000',
            outAmount: '292',
            feeMint: 'So11111111111111111111111111111111111111112',
          }),
          percent: 100,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: '4o9kDwyuBhcCF6mmp78HZHPc5Kdw1AmcSwBpcdyQhZvT',
            label: 'SolFi',
            inputMint: MOCK_TOKEN_1.address,
            outputMint: MOCK_TOKEN_2.address,
            inAmount: '292',
            outAmount: '335847',
            feeMint: 'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij',
          }),
          percent: 100,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: 'F4i12x6vu71dhHpWBrpRjPYGnNFqH4emVPrsPZydB5c9',
            label: 'Raydium AMM',
            inputMint: MOCK_TOKEN_2.address,
            outputMint: MOCK_USDC.address,
            inAmount: '335847',
            outAmount: '577084538457',
            feeMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }),
          percent: 100,
        },
      ],
    })

    const routes = parseRoutePlansToRoutes(mockSolRouterTrade)

    expect(routes).toHaveLength(1)

    const [route1] = routes

    expect(route1.pools).toHaveLength(3)
    expect(route1.percent).toBe(100)

    expect(route1.path.length).toBe(4)
    expect(route1.path[0]).toBe(MOCK_SOL)
    expect(route1.path[1].wrapped.address).toBe(MOCK_TOKEN_1.address)
    expect(route1.path[2].wrapped.address).toBe(MOCK_TOKEN_2.address)
    expect(route1.path[3]).toBe(MOCK_USDC)
  })
})

describe('split-routes', () => {
  it('should work with single-hop only', () => {
    const mockSolRouterTrade = createMockSolRouterTrade({
      inputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_SOL, '1000000000'), // 1 SOL
      outputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_USDC, '100000000'), // 100 USDC
      routes: [
        {
          swapInfo: createSwapInfo({
            inputMint: MOCK_SOL.address,
            inAmount: '300000000',
            outputMint: MOCK_USDC.address,
            outAmount: '30000000',
            ammKey: '11111111111111111111111111111112',
            label: 'Raydium',
            feeAmount: '5000000', // 0.005 SOL
            feeMint: MOCK_SOL.address,
          }),
          bps: 25, // 0.25%
          percent: 30,
        },
        {
          swapInfo: createSwapInfo({
            inputMint: MOCK_SOL.address,
            inAmount: '700000000',
            outputMint: MOCK_USDC.address,
            outAmount: '70000000',
            ammKey: '11111111111111111111111111111113',
            label: 'Raydium',
            feeAmount: '5000000', // 0.005 SOL
            feeMint: MOCK_SOL.address,
          }),
          bps: 25, // 0.25%
          percent: 70,
        },
      ],
    })

    const routes = parseRoutePlansToRoutes(mockSolRouterTrade)

    expect(routes).toHaveLength(2)

    const [route1, route2] = routes

    expect(route1.pools).toHaveLength(1)
    expect(route1.percent).toBe(30)
    expect(route1.path[0]).toBe(MOCK_SOL)
    expect(route1.path[1]).toBe(MOCK_USDC)

    expect(route2.pools).toHaveLength(1)
    expect(route2.percent).toBe(70)
    expect(route2.path[0]).toBe(MOCK_SOL)
    expect(route2.path[1]).toBe(MOCK_USDC)
  })

  it('should work with multi-hop in first', () => {
    const mockSolRouterTrade = createMockSolRouterTrade({
      inputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_SOL, '100000'),
      outputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_USDC, '16862'),
      otherAmountThreshold: '16780',
      priceImpactPct: '0',
      routes: [
        {
          swapInfo: createSwapInfo({
            ammKey: 'HToiT8XK8GHgAT4N3oGXadc7opdApPwsbCL9tFRYa3Rg',
            label: 'Meteora DLMM',
            inputMint: MOCK_SOL.address,
            outputMint: MOCK_TOKEN_1.address,
            inAmount: '52000',
            outAmount: '8771',
            feeAmount: '17',
            feeMint: MOCK_SOL.address,
          }),
          percent: 50,
          bps: 5200,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: '3YnYpQMUnUFxd9D1GSx6k1sNM9XcYLy2T68ymuu1WutH',
            label: 'Stabble Stable Swap',
            inputMint: MOCK_TOKEN_1.address,
            outputMint: MOCK_USDC.address,
            inAmount: '8771',
            outAmount: '8772',
            feeAmount: '0',
            feeMint: MOCK_USDC.address,
          }),
          percent: 100,
          bps: 10000,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: '81MPQqJY58rgT83sy99MkRHs2g3dyy6uWKHD24twV62F',
            label: 'Meteora DLMM',
            inputMint: MOCK_SOL.address,
            outputMint: MOCK_USDC.address,
            inAmount: '6000',
            outAmount: '1014',
            feeAmount: '2',
            feeMint: MOCK_SOL.address,
          }),
          percent: 20,
          bps: 600,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: '81MPQqJY58rgT83sy99MkRHs2g3dyy6uWKHD24twV62F',
            label: 'Meteora DLMM',
            inputMint: MOCK_SOL.address,
            outputMint: MOCK_USDC.address,
            inAmount: '6000',
            outAmount: '1014',
            feeAmount: '2',
            feeMint: MOCK_SOL.address,
          }),
          percent: 30,
          bps: 600,
        },
      ],
    })

    const routes = parseRoutePlansToRoutes(mockSolRouterTrade)

    expect(routes).toHaveLength(3)

    const [route1, route2, route3] = routes

    expect(route1.pools).toHaveLength(2)
    expect(route1.percent).toBe(50)
    expect(route1.path[0]).toBe(MOCK_SOL)
    expect(route1.path[1].wrapped.address).toBe(MOCK_TOKEN_1.address)
    expect(route1.path[2]).toBe(MOCK_USDC)

    expect(route2.pools).toHaveLength(1)
    expect(route2.percent).toBe(20)
    expect(route2.path[0]).toBe(MOCK_SOL)
    expect(route2.path[1]).toBe(MOCK_USDC)

    expect(route3.pools).toHaveLength(1)
    expect(route3.percent).toBe(30)
    expect(route3.path[0]).toBe(MOCK_SOL)
    expect(route3.path[1]).toBe(MOCK_USDC)
  })

  it('should work with multi-hop in middle', () => {
    const mockSolRouterTrade = createMockSolRouterTrade({
      inputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_SOL, '100000'),
      outputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_USDC, '16862'),
      otherAmountThreshold: '16780',
      priceImpactPct: '0',
      routes: [
        {
          swapInfo: createSwapInfo({
            ammKey: 'AvBSC1KmFNceHpD6jyyXBV6gMXFxZ8BJJ3HVUN8kCurJ',
            label: 'Obric V2',
            inputMint: MOCK_SOL.address,
            outputMint: MOCK_USDC.address,
            inAmount: '42000',
            outAmount: '7083',
            feeAmount: '0',
            feeMint: MOCK_SOL.address,
          }),
          percent: 42,
          bps: 4200,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: 'HToiT8XK8GHgAT4N3oGXadc7opdApPwsbCL9tFRYa3Rg',
            label: 'Meteora DLMM',
            inputMint: MOCK_SOL.address,
            outputMint: MOCK_TOKEN_1.address,
            inAmount: '52000',
            outAmount: '8771',
            feeAmount: '17',
            feeMint: MOCK_SOL.address,
          }),
          percent: 52,
          bps: 5200,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: '3YnYpQMUnUFxd9D1GSx6k1sNM9XcYLy2T68ymuu1WutH',
            label: 'Stabble Stable Swap',
            inputMint: MOCK_TOKEN_1.address,
            outputMint: MOCK_TOKEN_2.address,
            inAmount: '8771',
            outAmount: '8772',
            feeAmount: '0',
            feeMint: MOCK_USDC.address,
          }),
          percent: 100,
          bps: 10000,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: '3YnYpQMUnUFxd9D1GSx6k1sNM9XcYLy2T68ymuu1WutH',
            label: 'Stabble Stable Swap',
            inputMint: MOCK_TOKEN_2.address,
            outputMint: MOCK_USDC.address,
            inAmount: '8771',
            outAmount: '8772',
            feeAmount: '0',
            feeMint: MOCK_USDC.address,
          }),
          percent: 100,
          bps: 10000,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: '81MPQqJY58rgT83sy99MkRHs2g3dyy6uWKHD24twV62F',
            label: 'Meteora DLMM',
            inputMint: MOCK_SOL.address,
            outputMint: MOCK_USDC.address,
            inAmount: '6000',
            outAmount: '1014',
            feeAmount: '2',
            feeMint: MOCK_SOL.address,
          }),
          percent: 6,
          bps: 600,
        },
      ],
    })

    const routes = parseRoutePlansToRoutes(mockSolRouterTrade)

    expect(routes).toHaveLength(3)

    const [route1, route2, route3] = routes

    // Route 1
    expect(route1.pools).toHaveLength(1)
    expect(route1.percent).toBe(42)

    expect(route1.path.length).toBe(2)
    expect(route1.path[0]).toBe(MOCK_SOL)
    expect(route1.path[1]).toBe(MOCK_USDC)

    // Route 2
    expect(route2.pools).toHaveLength(3)
    expect(route2.percent).toBe(52)

    expect(route2.path.length).toBe(4)
    expect(route2.path[0]).toBe(MOCK_SOL)
    expect(route2.path[1].wrapped.address).toBe(MOCK_TOKEN_1.address)
    expect(route2.path[2].wrapped.address).toBe(MOCK_TOKEN_2.address)
    expect(route2.path[3]).toBe(MOCK_USDC)

    // Route 3
    expect(route3.pools).toHaveLength(1)
    expect(route3.percent).toBe(6)

    expect(route3.path.length).toBe(2)
    expect(route3.path[0]).toBe(MOCK_SOL)
    expect(route3.path[1]).toBe(MOCK_USDC)
  })

  it('should work with multi-hop in last', () => {
    const mockSolRouterTrade = createMockSolRouterTrade({
      inputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_SOL, '1000000'),
      outputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_USDC, '289245979504'),
      otherAmountThreshold: '99000000',
      priceImpactPct: '0.0002',
      routes: [
        {
          swapInfo: createSwapInfo({
            ammKey: 'DbuvwPuLvH8uy2B1sKuu18aCd2QpCvfZdfDtdRZztBd2',
            label: '1DEX',
            inputMint: MOCK_SOL.address,
            outputMint: MOCK_USDC.address,
            inAmount: '570000',
            outAmount: '96043',
            feeAmount: '57',
            feeMint: MOCK_SOL.address,
          }),
          percent: 57,
          bps: 5700,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: '81MPQqJY58rgT83sy99MkRHs2g3dyy6uWKHD24twV62F',
            label: 'Meteora DLMM',
            inputMint: MOCK_SOL.address,
            outputMint: MOCK_TOKEN_1.address,
            inAmount: '430000',
            outAmount: '73121',
            feeAmount: '67',
            feeMint: MOCK_SOL.address,
          }),
          percent: 43,
          bps: 4300,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: 'F4i12x6vu71dhHpWBrpRjPYGnNFqH4emVPrsPZydB5c9',
            label: 'Raydium',
            inputMint: MOCK_TOKEN_1.address,
            outputMint: MOCK_USDC.address,
            inAmount: '169164',
            outAmount: '290730861722',
            feeAmount: '161',
            feeMint: MOCK_USDC.address,
          }),
          percent: 100,
          bps: 10000,
        },
      ],
    })

    const routes = parseRoutePlansToRoutes(mockSolRouterTrade)

    expect(routes).toHaveLength(2)

    const [route1, route2] = routes

    expect(route1.pools).toHaveLength(1)
    expect(route1.percent).toBe(57)

    expect(route1.path.length).toBe(2)
    expect(route1.path[0]).toBe(MOCK_SOL)
    expect(route1.path[1]).toBe(MOCK_USDC)

    expect(route2.pools).toHaveLength(2)
    expect(route2.percent).toBe(43)

    expect(route2.path.length).toBe(3)
    expect(route2.path[0]).toBe(MOCK_SOL)
    expect(route2.path[1].wrapped.address).toBe(MOCK_TOKEN_1.address)
    expect(route2.path[2]).toBe(MOCK_USDC)
  })

  it('should work with all multi-hop', () => {
    const mockSolRouterTrade = createMockSolRouterTrade({
      inputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_SOL, '1000000'),
      outputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_USDC, '289245979504'),
      otherAmountThreshold: '99000000',
      priceImpactPct: '0.0002',
      routes: [
        {
          swapInfo: createSwapInfo({
            ammKey: 'DbuvwPuLvH8uy2B1sKuu18aCd2QpCvfZdfDtdRZztBd2',
            label: '1DEX',
            inputMint: MOCK_SOL.address,
            outputMint: MOCK_TOKEN_1.address,
            inAmount: '570000',
            outAmount: '96043',
            feeAmount: '57',
            feeMint: MOCK_SOL.address,
          }),
          percent: 30,
          bps: 5700,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: '81MPQqJY58rgT83sy99MkRHs2g3dyy6uWKHD24twV62F',
            label: 'Meteora DLMM',
            inputMint: MOCK_TOKEN_1.address,
            outputMint: MOCK_USDC.address,
            inAmount: '430000',
            outAmount: '73121',
            feeAmount: '67',
            feeMint: MOCK_SOL.address,
          }),
          percent: 100,
          bps: 4300,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: 'F4i12x6vu71dhHpWBrpRjPYGnNFqH4emVPrsPZydB5c9',
            label: 'Raydium',
            inputMint: MOCK_SOL.address,
            outputMint: MOCK_TOKEN_2.address,
            inAmount: '169164',
            outAmount: '290730861722',
            feeAmount: '161',
            feeMint: MOCK_USDC.address,
          }),
          percent: 70,
          bps: 10000,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: 'F4i12x6vu71dhHpWBrpRjPYGnNFqH4emVPrsPZydB5c9',
            label: 'Raydium',
            inputMint: MOCK_TOKEN_2.address,
            outputMint: MOCK_USDC.address,
            inAmount: '169164',
            outAmount: '290730861722',
            feeAmount: '161',
            feeMint: MOCK_USDC.address,
          }),
          percent: 100,
          bps: 10000,
        },
      ],
    })

    const routes = parseRoutePlansToRoutes(mockSolRouterTrade)

    expect(routes).toHaveLength(2)

    const [route1, route2] = routes

    expect(route1.pools).toHaveLength(2)
    expect(route1.percent).toBe(30)

    expect(route1.path.length).toBe(3)
    expect(route1.path[0]).toBe(MOCK_SOL)
    expect(route1.path[1].wrapped.address).toBe(MOCK_TOKEN_1.address)
    expect(route1.path[2]).toBe(MOCK_USDC)

    expect(route2.pools).toHaveLength(2)
    expect(route2.percent).toBe(70)

    expect(route2.path.length).toBe(3)
    expect(route2.path[0]).toBe(MOCK_SOL)
    expect(route2.path[1].wrapped.address).toBe(MOCK_TOKEN_2.address)
    expect(route2.path[2]).toBe(MOCK_USDC)
  })

  it('should work with native solana', () => {
    const mockSolRouterTrade = createMockSolRouterTrade({
      inputAmount: UnifiedCurrencyAmount.fromRawAmount(NATIVE_SOL as unknown as SPLToken, '1000000'),
      outputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_USDC, '289245979504'),
      otherAmountThreshold: '99000000',
      priceImpactPct: '0.0002',
      routes: [
        {
          swapInfo: createSwapInfo({
            ammKey: 'GtpsrTHYnfFVm3qkPJtyKVwQLpXT7p2MRy9bp5hYeJnQ',
            label: 'PancakeSwap',
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
            inAmount: '53000000',
            outAmount: '36501273675',
            feeAmount: '9576',
            feeMint: 'So11111111111111111111111111111111111111112',
          }),
          percent: 53,
          bps: 5300,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: '8B8KYcFPMjZyDtJ1BENsqhW3fEmMrB4ekoEQJiM6z3SC',
            label: 'TesseraV',
            inputMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
            outputMint: MOCK_USDC.address,
            inAmount: '36501273675',
            outAmount: '8864881',
            feeAmount: '0',
            feeMint: '11111111111111111111111111111111',
          }),
          percent: 100,
          bps: 10000,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: 'FLckHLGMJy5gEoXWwcE68Nprde1D4araK4TGLw4pQq2n',
            label: 'TesseraV',
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: '674PmuiDtgKx3uKuJ1B16f9m5L84eFvNwj3xDMvHcbo7',
            inAmount: '47000000',
            outAmount: '7861054',
            feeAmount: '0',
            feeMint: '11111111111111111111111111111111',
          }),
          percent: 47,
          bps: 4700,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: 'F4i12x6vu71dhHpWBrpRjPYGnNFqH4emVPrsPZydB5c9',
            label: 'Raydium',
            inputMint: '674PmuiDtgKx3uKuJ1B16f9m5L84eFvNwj3xDMvHcbo7',
            outputMint: MOCK_USDC.address,
            inAmount: '16725935',
            outAmount: '28213897225637',
            feeAmount: '15890',
            feeMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }),
          percent: 100,
          bps: 10000,
        },
      ],
    })

    expect(mockSolRouterTrade.inputAmount.currency.isNative).toBe(true)

    const routes = parseRoutePlansToRoutes(mockSolRouterTrade)

    expect(routes).toHaveLength(2)

    const [route1, route2] = routes

    expect(route1.pools).toHaveLength(2)
    expect(route1.percent).toBe(53)

    expect(route1.path.length).toBe(3)
    expect(route1.path[0]).toBe(NATIVE_SOL)
    expect(route1.path[1].wrapped.address).toBe('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')
    expect(route1.path[2]).toBe(MOCK_USDC)

    expect(route2.pools).toHaveLength(2)
    expect(route2.percent).toBe(47)

    expect(route2.path.length).toBe(3)
    expect(route2.path[0]).toBe(NATIVE_SOL)
    expect(route2.path[1].wrapped.address).toBe('674PmuiDtgKx3uKuJ1B16f9m5L84eFvNwj3xDMvHcbo7')
    expect(route2.path[2]).toBe(MOCK_USDC)
  })

  it('should work with split-routes at the end', () => {
    const mockSolRouterTrade = createMockSolRouterTrade({
      inputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_TOKEN_1, '1000000'),
      outputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_TOKEN_2, '289245979504'),
      otherAmountThreshold: '16780',
      priceImpactPct: '0',
      routes: [
        {
          swapInfo: createSwapInfo({
            ammKey: 'AxHocY4moH8roYQXMQWqoehtW5piMtTJQYmfL4wQ83D8',
            label: 'SolFi',
            inputMint: MOCK_TOKEN_1.address,
            outputMint: MOCK_USDC.address,
            inAmount: '2000000',
            outAmount: '2000421',
            feeAmount: '0',
            feeMint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
          }),
          percent: 100,
          bps: 10000,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: '6n9VhCwQ7EwK6NqFDjnHPzEk6wZdRBTfh43RFgHQWHuQ',
            label: 'HumidiFi',
            inputMint: MOCK_USDC.address,
            outputMint: 'So11111111111111111111111111111111111111112',
            inAmount: '2000421',
            outAmount: '11754402',
            feeAmount: '0',
            feeMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }),
          percent: 100,
          bps: 10000,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: 'Ax8bLZsJBEHifTKqqajnXgaLZXTG11hUJjWdg3Ytyz9L',
            label: 'Whirlpool',
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: MOCK_TOKEN_2.address,
            inAmount: '2115794',
            outAmount: '738679',
            feeAmount: '572',
            feeMint: 'So11111111111111111111111111111111111111112',
          }),
          percent: 18,
          bps: 1800,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: 'HJuipW7pcVq6kPQWJ4hovubwcu3gg8Vd2hmkR5bHh1Vs',
            label: 'PancakeSwap',
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: MOCK_TOKEN_2.address,
            inAmount: '9638608',
            outAmount: '3365297',
            feeAmount: '3042',
            feeMint: 'So11111111111111111111111111111111111111112',
          }),
          percent: 82,
          bps: 8200,
        },
      ],
    })

    const routes = parseRoutePlansToRoutes(mockSolRouterTrade)

    expect(routes).toHaveLength(3)

    const [route1, route2, route3] = routes

    expect(route1.pools).toHaveLength(2)
    expect(route1.percent).toBe(100)

    expect(route1.path.length).toBe(3)
    expect(route1.path[0]).toBe(MOCK_TOKEN_1)
    expect(route1.path[1].wrapped.address).toBe(MOCK_USDC.address)
    expect(route1.path[2].wrapped.address).toBe('So11111111111111111111111111111111111111112')

    expect(route2.pools).toHaveLength(1)
    expect(route2.percent).toBe(18)

    expect(route2.path.length).toBe(2)
    expect(route2.path[0].wrapped.address).toBe('So11111111111111111111111111111111111111112')
    expect(route2.path[1]).toBe(MOCK_TOKEN_2)

    expect(route3.pools).toHaveLength(1)
    expect(route3.percent).toBe(82)

    expect(route3.path.length).toBe(2)
    expect(route3.path[0].wrapped.address).toBe('So11111111111111111111111111111111111111112')
    expect(route3.path[1]).toBe(MOCK_TOKEN_2)
  })

  it('should work with split-routes in the middle with multiple hops', () => {
    const mockSolRouterTrade = createMockSolRouterTrade({
      inputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_TOKEN_1, '1000000'),
      outputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_TOKEN_2, '289245979504'),
      otherAmountThreshold: '16780',
      priceImpactPct: '0',
      routes: [
        {
          swapInfo: createSwapInfo({
            ammKey: 'AhhoxZDmsg2snm85vPjqzYzEYESoKfb4KmTj4HrBBNwY',
            label: 'Whirlpool',
            inputMint: MOCK_TOKEN_1.address,
            outputMint: 'So11111111111111111111111111111111111111112',
            inAmount: '2000000',
            outAmount: '11864753',
            feeAmount: '76',
            feeMint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
          }),
          percent: 100,
          bps: 10000,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: 'AvBSC1KmFNceHpD6jyyXBV6gMXFxZ8BJJ3HVUN8kCurJ',
            label: 'Obric V2',
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            inAmount: '9966442',
            outAmount: '1681032',
            feeAmount: '45',
            feeMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }),
          percent: 84,
          bps: 8400,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: '1jw5fDodwGEGBVqNXsx2eqiLgNmgMDEeXWSbrTreLCM',
            label: 'Meteora DLMM',
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            inAmount: '1898311',
            outAmount: '320281',
            feeAmount: '774',
            feeMint: 'So11111111111111111111111111111111111111112',
          }),
          percent: 16,
          bps: 1600,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: 'FBQyw6gmiPKFY2RUJFo8xcbv8QuSWKBjnVbuQGtmvQwU',
            label: 'SolFi',
            inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            outputMint: MOCK_TOKEN_2.address,
            inAmount: '2001313',
            outAmount: '4151270',
            feeAmount: '0',
            feeMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }),
          percent: 100,
          bps: 10000,
        },
      ],
    })

    const routes = parseRoutePlansToRoutes(mockSolRouterTrade)

    expect(routes).toHaveLength(4)

    const [route1, route2, route3, route4] = routes

    expect(route1.percent).toBe(100)

    expect(route1.path.length).toBe(2)
    expect(route1.path[0]).toBe(MOCK_TOKEN_1)
    expect(route1.path[1].wrapped.address).toBe('So11111111111111111111111111111111111111112')

    expect(route2.percent).toBe(84)
    expect(route2.path.length).toBe(2)
    expect(route2.path[0].wrapped.address).toBe('So11111111111111111111111111111111111111112')
    expect(route2.path[1].wrapped.address).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')

    expect(route3.percent).toBe(16)
    expect(route3.path.length).toBe(2)
    expect(route3.path[0].wrapped.address).toBe('So11111111111111111111111111111111111111112')
    expect(route3.path[1].wrapped.address).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')

    expect(route4.percent).toBe(100)
    expect(route4.path.length).toBe(2)
    expect(route4.path[0].wrapped.address).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    expect(route4.path[1]).toBe(MOCK_TOKEN_2)
  })

  it('should work with split-routes in the middle with single hop', () => {
    const mockSolRouterTrade = createMockSolRouterTrade({
      inputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_TOKEN_1, '1000000'),
      outputAmount: UnifiedCurrencyAmount.fromRawAmount(MOCK_TOKEN_2, '289245979504'),
      otherAmountThreshold: '16780',
      priceImpactPct: '0',
      routes: [
        {
          swapInfo: createSwapInfo({
            ammKey: '27ZbVdmoUhG639CfqG6kW8a4VXZeGBi8Dd4HUXjVDxeS',
            label: 'Whirlpool',
            inputMint: MOCK_TOKEN_1.address,
            outputMint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
            inAmount: '180000',
            outAmount: '11237',
            feeAmount: '57',
            feeMint: 'So11111111111111111111111111111111111111112',
          }),
          percent: 18,
          bps: 1800,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: '2zMAVBZjA55CejUUBUHRYDqS3CN39n1QLdKn5ZgytdYz',
            label: 'Raydium CLMM',
            inputMint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
            outputMint: MOCK_USDC.address,
            inAmount: '11237',
            outAmount: '30479',
            feeAmount: '13',
            feeMint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
          }),
          percent: 100,
          bps: 10000,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: 'HyGVf4UhoQ4ux9ueZgTCf6aJwCcvWqeWf258ZtbeRteV',
            label: 'Lifinity V2',
            inputMint: MOCK_TOKEN_1.address,
            outputMint: MOCK_USDC.address,
            inAmount: '820000',
            outAmount: '138775',
            feeAmount: '65',
            feeMint: 'So11111111111111111111111111111111111111112',
          }),
          percent: 82,
          bps: 8200,
        },
        {
          swapInfo: createSwapInfo({
            ammKey: '5455YeNwDtgXrAhWZjE4epAbuKVpbGH2yhUrqJ4EYGMw',
            label: 'PancakeSwap',
            inputMint: MOCK_USDC.address,
            outputMint: MOCK_TOKEN_2.address,
            inAmount: '169254',
            outAmount: '62226412',
            feeAmount: '51',
            feeMint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
          }),
          percent: 100,
          bps: 10000,
        },
      ],
    })

    const routes = parseRoutePlansToRoutes(mockSolRouterTrade)

    expect(routes).toHaveLength(3)

    const [route1, route2, route3] = routes

    expect(route1.percent).toBe(18)
    expect(route1.path.length).toBe(3)
    expect(route1.path[0]).toBe(MOCK_TOKEN_1)
    expect(route1.path[1].wrapped.address).toBe('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R')
    expect(route1.path[2].wrapped.address).toBe(MOCK_USDC.address)

    expect(route2.percent).toBe(82)
    expect(route2.path.length).toBe(2)
    expect(route2.path[0].wrapped.address).toBe(MOCK_TOKEN_1.address)
    expect(route2.path[1].wrapped.address).toBe(MOCK_USDC.address)

    expect(route3.percent).toBe(100)
    expect(route3.path.length).toBe(2)
    expect(route3.path[0].wrapped.address).toBe(MOCK_USDC.address)
    expect(route3.path[1]).toBe(MOCK_TOKEN_2)
  })
})
