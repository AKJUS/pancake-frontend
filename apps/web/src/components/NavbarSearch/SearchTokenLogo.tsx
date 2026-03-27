import { useMemo } from 'react'

import { useAtomValue } from 'jotai'
import { combinedTokenMapFromActiveUrlsAtom, combinedTokenMapFromInActiveUrlsAtom } from 'state/lists/hooks'
import { safeGetAddress } from 'utils/safeGetAddress'

import { ChainId, UnifiedChainId } from '@pancakeswap/chains'
import { Native } from '@pancakeswap/sdk'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'

import { SearchLogoWrap } from './styled'

export function SearchTokenLogo({
  chainId,
  address,
  symbol,
  isNative,
}: {
  chainId: UnifiedChainId
  address: string
  symbol?: string
  isNative?: boolean
}) {
  const activeMap = useAtomValue(combinedTokenMapFromActiveUrlsAtom)
  const inactiveMap = useAtomValue(combinedTokenMapFromInActiveUrlsAtom)

  const currencyInfo = useMemo(() => {
    if (isNative) {
      try {
        return Native.onChain(chainId as ChainId)
      } catch {
        // fall through to token lookup
      }
    }
    const checksumAddress = safeGetAddress(address) ?? address
    const lookup = (map: typeof activeMap) => (map[chainId as ChainId] ?? {})[checksumAddress]?.token
    // Check active lists first, then inactive — mirrors how swap modal resolves logos via active + inactive lists
    const token = lookup(activeMap) ?? lookup(inactiveMap)
    return token ?? { address: checksumAddress, symbol, chainId, isToken: true as const, isNative: false as const }
  }, [isNative, address, symbol, chainId, activeMap, inactiveMap])

  return (
    <SearchLogoWrap>
      <CurrencyLogo style={{ height: '36px' }} currency={currencyInfo} size="36px" showChainLogo />
    </SearchLogoWrap>
  )
}
