import { zeroAddress } from '@pancakeswap/price-api-sdk'
import { Token } from '@pancakeswap/sdk'
import { TokenLogo } from '@pancakeswap/uikit'
import { chainName as CHAIN_PATH } from '@pancakeswap/widgets-internal'
import { useMemo } from 'react'
import { multiChainId, MultiChainNameExtend } from 'state/info/constant'
import { styled } from 'styled-components'
import { safeGetAddress, isAddressEqual } from 'utils'
import { Address } from 'viem'
import getTokenLogoURL from 'utils/getTokenLogoURL'

const StyledLogo = styled(TokenLogo)<{ size: string }>`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
  border-radius: ${({ size }) => size};
`

const chainNameToPath = (chainName: MultiChainNameExtend) => {
  if (chainName === 'BSC') return ''
  if (CHAIN_PATH[multiChainId[chainName]]) return `${CHAIN_PATH[multiChainId[chainName]]}/`
  return `${chainName.toLowerCase()}/`
}

export const CurrencyLogo: React.FC<
  React.PropsWithChildren<{
    address?: string
    token?: Token
    size?: string
    chainName?: MultiChainNameExtend
  }>
> = ({ address, size = '24px', chainName = 'BSC', ...rest }) => {
  const src = useMemo(() => {
    return getTokenLogoURL(new Token(multiChainId[chainName], address as Address, 18, ''))
  }, [address, chainName])

  const imagePath = chainNameToPath(chainName)
  const checkedsummedAddress = safeGetAddress(address)

  let srcFromPCS = checkedsummedAddress
    ? `https://tokens.pancakeswap.finance/images/${imagePath}${checkedsummedAddress}.png`
    : ''
  if (checkedsummedAddress && isAddressEqual(checkedsummedAddress, zeroAddress)) {
    srcFromPCS = `https://assets.pancakeswap.finance/web/native/${multiChainId[chainName]}.png`
  }

  return <StyledLogo size={size} srcs={src ? [srcFromPCS, src] : [srcFromPCS]} alt="token logo" {...rest} />
}

const DoubleCurrencyWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 32px;
`

interface DoubleCurrencyLogoProps {
  address0?: string
  address1?: string
  size?: number
  chainName?: MultiChainNameExtend
}

export const DoubleCurrencyLogo: React.FC<React.PropsWithChildren<DoubleCurrencyLogoProps>> = ({
  address0,
  address1,
  size = 16,
  chainName = 'BSC',
}) => {
  return (
    <DoubleCurrencyWrapper>
      {address0 && <CurrencyLogo address={address0} size={`${size.toString()}px`} chainName={chainName} />}
      {address1 && <CurrencyLogo address={address1} size={`${size.toString()}px`} chainName={chainName} />}
    </DoubleCurrencyWrapper>
  )
}
