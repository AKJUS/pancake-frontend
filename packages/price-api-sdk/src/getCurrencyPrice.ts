import { ChainId, isTestnetChainId, NonEVMChainId, UnifiedChainId } from '@pancakeswap/chains'

import { Address } from './types/common'

const API_ENDPOINT = process.env.NEXT_PUBLIC_WALLET_API || 'https://wallet-api.pancakeswap.com'
const WALLET_API = `${API_ENDPOINT}/v1/prices/list/`
const getWalletPriceUrl = (chainName: string) => `${API_ENDPOINT}/${chainName}/v1/prices/list/`

export const zeroAddress = '0x0000000000000000000000000000000000000000' as const

type TokenUsdPrice = {
  address: Address
  priceUSD: number
}

// duck typing for native currency, token, token info
export type CurrencyParams =
  | {
      chainId: ChainId
      chainName?: string
      address: string
      isNative?: false
    }
  | {
      chainId: ChainId
      chainName?: string
      isNative: true
    }

export type CurrencyKey = `${number}:${string}`

export type CurrencyUsdResult = Record<CurrencyKey, number>

const CHAINS_FOR_NEW_WALLET_API: UnifiedChainId[] = [NonEVMChainId.SOLANA]
const NATIVE_ADDRESSES: { [key in UnifiedChainId]?: string } = {
  [NonEVMChainId.SOLANA]: 'So11111111111111111111111111111111111111112',
}
export function getCurrencyKey(currencyParams?: CurrencyParams): CurrencyKey | undefined {
  if (!currencyParams) {
    return undefined
  }

  if (CHAINS_FOR_NEW_WALLET_API.includes(currencyParams.chainId)) {
    if ('isNative' in currencyParams && currencyParams.isNative === true) {
      return NATIVE_ADDRESSES[currencyParams.chainId] as CurrencyKey
    }
    return currencyParams.address as CurrencyKey
  }

  if ('isNative' in currencyParams && currencyParams.isNative === true) {
    return `${currencyParams.chainId}:${zeroAddress}`
  }
  const { chainId, address } = currencyParams
  return `${chainId}:${address.toLowerCase()}`
}

export function getCurrencyListKey(currencyListParams?: CurrencyParams[]): string | undefined {
  if (!currencyListParams) {
    return undefined
  }

  const currencyKeys = currencyListParams.map(getCurrencyKey).filter((key): key is CurrencyKey => !!key)

  const uniqueKeys = [...new Set(currencyKeys)]

  return uniqueKeys.join(',')
}

function getRequestUrl(params?: CurrencyParams | CurrencyParams[]): string | undefined {
  if (!params) {
    return undefined
  }
  const infoList = Array.isArray(params) ? params : [params]
  const key = getCurrencyListKey(infoList.filter((c) => !isTestnetChainId(c.chainId)))
  if (!key) {
    return undefined
  }
  const encodedKey = encodeURIComponent(key)
  return CHAINS_FOR_NEW_WALLET_API.includes(infoList[0].chainId) && infoList[0].chainName
    ? `${getWalletPriceUrl(infoList[0].chainName)}${encodedKey}`
    : `${WALLET_API}${encodedKey}`
}

export async function getCurrencyUsdPrice(currencyParams?: CurrencyParams, options?: RequestInit) {
  if (!currencyParams || isTestnetChainId(currencyParams.chainId)) {
    return 0
  }

  const prices = await getCurrencyListUsdPrice([currencyParams], options)
  const key = getCurrencyKey(currencyParams)
  return (key && prices[key]) ?? 0
}

export async function getCurrencyListUsdPrice(
  currencyListParams?: CurrencyParams[],
  options?: RequestInit,
): Promise<CurrencyUsdResult> {
  const requestUrl = getRequestUrl(currencyListParams)
  if (!requestUrl || !currencyListParams) {
    throw new Error(`Invalid request for currency prices, request url: ${requestUrl}`)
  }

  try {
    const res = await fetch(requestUrl, options)
    const data = await res.json()
    return data
  } catch (error) {
    // in case wallet api is down, return empty object
    console.error('Failed to get currency list usd price:', error)
    return {}
  }
}

export async function getTokenPrices(
  chainId: ChainId,
  addresses: Address[],
  options?: RequestInit,
): Promise<TokenUsdPrice[]> {
  const requestParams: CurrencyParams[] = addresses.map((address) => ({
    address,
    chainId,
  }))

  const prices = await getCurrencyListUsdPrice(requestParams, options)
  return addresses.map((address) => {
    const key = getCurrencyKey({
      address,
      chainId,
    })
    const priceUSD = (key && prices[key]) ?? 0
    return { address, priceUSD }
  })
}

export async function getNativeTokenPrices(chainIds: ChainId[], options?: RequestInit): Promise<Map<ChainId, number>> {
  const requestParams: CurrencyParams[] = chainIds.map((chainId) => ({
    isNative: true,
    chainId,
  }))
  const prices = await getCurrencyListUsdPrice(requestParams, options)
  return chainIds.reduce((acc, chainId) => {
    const key = getCurrencyKey({
      chainId,
      isNative: true,
    })
    acc.set(chainId, (key && prices[key]) ?? 0)
    return acc
  }, new Map<ChainId, number>())
}
