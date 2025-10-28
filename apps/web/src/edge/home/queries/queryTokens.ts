import { ChainId } from '@pancakeswap/chains'
import { getCurrencyKey } from '@pancakeswap/price-api-sdk'
import { ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'
import { cacheByLRU } from '@pancakeswap/utils/cacheByLRU'
import { WALLET_API } from 'config/constants/endpoints'
import { checksumAddress } from 'utils/checksumAddress'
import { HomePageToken } from '../types'
import { queryTokenList } from './queryTokenList'
import { getHomeCacheSettings } from './settings'

const tokens: HomePageToken[] = [
  {
    id: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    symbol: 'BTC',
    chainId: 56,
    price: 0,
    icon: '',
    percent: 0,
  },
  {
    id: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    symbol: 'ETH',
    chainId: 56,
    price: 0,
    icon: '',
    percent: 0,
  },
  {
    id: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE',
    chainId: 56,
    symbol: 'XRP',
    price: 0,
    icon: '',
    percent: 0,
  },
  {
    id: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    chainId: 56,
    symbol: 'CAKE',
    price: 0,
    icon: '',
    percent: 0,
  },
  {
    id: ZERO_ADDRESS,
    chainId: 56,
    symbol: 'BNB',
    price: 0,
    icon: '',
    percent: 0,
  },
]

async function getTokenPrices(chainId: ChainId, addresses: `0x${string}`[]) {
  const ids = addresses.map((address) => getCurrencyKey({ chainId, address }))
  const url24h = `${WALLET_API}/v1/prices24h/list/${ids.join(',')}`
  const url = `${WALLET_API}/v1/prices/list/${ids.join(',')}`

  const [result, result24h] = await Promise.all([
    fetch(url).then((res) => res.json()),
    fetch(url24h).then((res) => res.json()),
  ])

  return addresses.map((address) => {
    const key = getCurrencyKey({ chainId, address })!
    const price = result[key] ?? 0
    const price24h = result24h[key] ?? 0
    return {
      priceUSD: price,
      percent: 100 * ((price24h ? price / price24h : 0) - 1),
    }
  })
}

export const queryTokens = cacheByLRU(async () => {
  const [prices, tokenMap] = await Promise.all([
    getTokenPrices(
      ChainId.BSC,
      tokens.map((x) => x.id),
    ),
    queryTokenList(),
  ])

  const topTokens = tokens.map((x, i) => {
    const price = prices[i]
    const addr = checksumAddress(x.id)
    const logo = tokenMap[`${x.chainId}-${addr}`]?.logoURI || `https://tokens.pancakeswap.finance/images/${addr}.png`
    return {
      ...x,
      id: addr,
      price: price ? price.priceUSD : 0,
      percent: price ? price.percent : 0,
      icon: logo,
    }
  })
  return {
    topTokens,
    tokenMap,
  }
}, getHomeCacheSettings('tokens'))
