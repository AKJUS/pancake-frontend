import styled from 'styled-components'

import { NonEVMChainId } from '@pancakeswap/chains'
import { Button, ButtonProps, ChevronDownIcon, Flex, FlexGap } from '@pancakeswap/uikit'
import { ASSET_CDN } from 'config/constants/endpoints'

export type ConnectedWalletsButtonProps = ButtonProps & {
  evmAccount: string | undefined
  solanaAccount: string | undefined
}

const StyledNetworkIcons = styled(Flex)`
  img {
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }

  img:not(:first-child) {
    margin-left: -10px;
    z-index: 1;
  }

  img:first-child {
    z-index: 2;
  }
`

const EvmNetworkIcon = styled.img`
  display: block;
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  background-color: ${({ theme }) => theme.colors.cardSecondary};
`

const SolanaNetworkIcon = styled.img`
  display: block;
`

const StyledAccountsButton = styled(Button)`
  border: 1px solid ${(props) => props.theme.colors.cardBorder};
  border-bottom-width: 2px;
  border-radius: 16px;
  background-color: ${(props) => props.theme.colors.cardSecondary};
  padding: 8px;
`

export const ConnectedWalletsButton = ({ evmAccount, solanaAccount, ...props }: ConnectedWalletsButtonProps) => {
  return (
    <StyledAccountsButton variant="text" {...props}>
      <FlexGap gap="8px" alignItems="center">
        <StyledNetworkIcons>
          {evmAccount && (
            <EvmNetworkIcon
              src={`${ASSET_CDN}/web/wallet-ui/network-tag-evm.svg`}
              width={32}
              height={32}
              alt="EVM network"
            />
          )}
          {solanaAccount && (
            <SolanaNetworkIcon
              src={`${ASSET_CDN}/web/chains/square/${NonEVMChainId.SOLANA}.svg`}
              width={32}
              height={32}
              alt="Solana network"
            />
          )}
        </StyledNetworkIcons>
        <ChevronDownIcon color="textSubtle" width={24} height={24} />
      </FlexGap>
    </StyledAccountsButton>
  )
}
