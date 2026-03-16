import { useMatchBreakpoints } from '@pancakeswap/uikit'
import { ASSET_CDN } from 'config/constants/endpoints'
import styled from 'styled-components'
import { ChainId } from '@pancakeswap/sdk'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'
import { MultipleLogos } from './MultipleLogos'

const getChainDimension = (isMobile?: boolean, isTablet?: boolean) => {
  // Minimal layout adjustment for tablet
  if (isMobile) return '8px'
  if (isTablet) return '10px'
  return '10px'
}

function getImageStyle(isMobile?: boolean, isFirstSmall?: boolean) {
  const size = isMobile ? (isFirstSmall ? '20px' : '32px') : '40px'
  return {
    width: size,
    height: size,
    minWidth: 'unset',
    minHeight: 'unset',
    ...(isFirstSmall && { position: 'absolute' as const, top: 0, left: 0 }),
  }
}

const ChainImage = styled.img<{ isMobile?: boolean; isTablet?: boolean }>`
  width: ${({ isMobile, isTablet }) => getChainDimension(isMobile, isTablet)};
  height: ${({ isMobile, isTablet }) => getChainDimension(isMobile, isTablet)};
  position: absolute;
  bottom: 0px;
  right: 0px;
  background-color: transparent;
  border-radius: 4px;
`

interface Token {
  id?: `0x${string}`
  logo: string
}

interface MultipleCurrencyLogosProps {
  tokens: Token[]
  chainId?: number
  maxDisplay?: number
  isFirstSmall?: boolean
  borderRadius?: string
  gap?: number
}

export const MultipleCurrencyLogos = ({
  tokens,
  chainId,
  maxDisplay = 3,
  isFirstSmall,
  gap,
  borderRadius,
}: MultipleCurrencyLogosProps) => {
  const { isMobile, isTablet } = useMatchBreakpoints()
  const chainIcon = chainId ? `${ASSET_CDN}/web/chains/svg/${chainId}.svg` : null

  return (
    <MultipleLogos
      borderRadius={borderRadius}
      isFirstSmall={isFirstSmall}
      logos={tokens.map((token) => token.logo!)}
      maxDisplay={maxDisplay}
      gap={gap}
    >
      {chainIcon && <ChainImage isMobile={isMobile} isTablet={isTablet} src={chainIcon} />}
    </MultipleLogos>
  )
}

type TokenInput = {
  address: string
  symbol: string
  chainId: ChainId
  isToken: boolean
}

interface TokenPairLogoWithChainProps {
  primaryToken: TokenInput
  secondaryToken: TokenInput
  isFirstSmall?: boolean
}

export const TokenPairLogoWithChain = ({
  primaryToken,
  secondaryToken,
  isFirstSmall = false,
}: TokenPairLogoWithChainProps) => {
  const { isMobile } = useMatchBreakpoints()
  const firstSmallActive = isFirstSmall && isMobile

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      <div
        style={
          firstSmallActive ? { position: 'relative', width: '28px', height: '28px', marginTop: '-12px' } : undefined
        }
      >
        <CurrencyLogo currency={primaryToken} style={getImageStyle(isMobile, firstSmallActive)} />
      </div>
      <div style={{ position: 'relative', marginLeft: '-12px' }}>
        <CurrencyLogo currency={secondaryToken} style={getImageStyle(isMobile)} showChainLogo />
      </div>
    </div>
  )
}
