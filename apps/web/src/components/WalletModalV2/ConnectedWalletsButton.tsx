import styled from 'styled-components'

import { useTranslation } from '@pancakeswap/localization'
import { ASSET_CDN } from '@pancakeswap/ui-wallets/src/config/url'
import { Button, ButtonProps, ChevronDownIcon, Flex, FlexGap, Text } from '@pancakeswap/uikit'

export type ConnectedWalletsButtonProps = ButtonProps & {
  evmAccount: string | undefined
  solanaAccount: string | undefined
}

const StyledNetworkIcons = styled(Flex)`
  img {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid ${(props) => props.theme.colors.cardBorder};
    background-color: ${(props) => props.theme.colors.cardSecondary};
  }

  img:not(:first-child) {
    margin-left: -10px;
    z-index: 1;
  }

  img:first-child {
    z-index: 2;
  }
`

const StyledAccountsButton = styled(Button)`
  border: 1px solid ${(props) => props.theme.colors.cardBorder};
  border-bottom-width: 2px;
  border-radius: 16px;
  background-color: ${(props) => props.theme.colors.tertiary};
  padding: 8px;
`

export const ConnectedWalletsButton = ({ evmAccount, solanaAccount, ...props }: ConnectedWalletsButtonProps) => {
  const { t } = useTranslation()

  return (
    <StyledAccountsButton variant="text" {...props}>
      <FlexGap gap="8px" alignItems="center">
        <StyledNetworkIcons>
          {evmAccount && (
            <img
              src={`${ASSET_CDN}/web/wallet-ui/network-tag-evm.svg`}
              width={16}
              height={16}
              alt="EVM network"
              style={{ display: 'block' }}
            />
          )}
          {solanaAccount && (
            <img
              src={`${ASSET_CDN}/web/wallet-ui/network-tag-solana.png`}
              width={16}
              height={16}
              alt="Solana network"
              style={{ display: 'block' }}
            />
          )}
        </StyledNetworkIcons>
        <Text fontSize="16px" fontWeight={600}>
          {t('Accounts')}
        </Text>
        <ChevronDownIcon color="textSubtle" width={24} height={24} />
      </FlexGap>
    </StyledAccountsButton>
  )
}
