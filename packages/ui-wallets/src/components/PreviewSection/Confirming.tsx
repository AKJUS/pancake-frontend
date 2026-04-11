import { AtomBox, FlexGap, Heading, Image, Loading, Message, MessageText, Text } from '@pancakeswap/uikit'
import { useTranslation } from '@pancakeswap/localization'
import { useAtomValue } from 'jotai'
import { errorEvmAtom, errorSolanaAtom } from '../../state/atom'
import { WalletAdaptedNetwork, WalletConfigV3 } from '../../types'
import { ErrorContent } from '../ErrorContent'

export type ConfirmingProps = {
  wallet: WalletConfigV3
  network: WalletAdaptedNetwork
  reConnect: (wallet: WalletConfigV3, network: WalletAdaptedNetwork) => void
  shouldShowMetamaskVersionWarning?: boolean
}

export const Confirming: React.FC<ConfirmingProps> = ({
  wallet,
  network,
  reConnect,
  shouldShowMetamaskVersionWarning,
}) => {
  const { t } = useTranslation()
  const evmError = useAtomValue(errorEvmAtom)
  const solanaError = useAtomValue(errorSolanaAtom)
  const error = network === WalletAdaptedNetwork.EVM ? evmError : solanaError

  return (
    <AtomBox
      display="flex"
      flexDirection="column"
      background="gradientCardHeader"
      alignItems="center"
      style={{ gap: '12px' }}
      textAlign="center"
      width="100%"
    >
      <>
        {typeof wallet.icon === 'string' && (
          <Image src={wallet.icon} width={56} height={56} style={{ borderRadius: '12px', overflow: 'hidden' }} />
        )}
        <Heading as="h1" fontSize="16px">
          {wallet.title}
        </Heading>
        <FlexGap gap="8px" alignItems="center" flexDirection="column">
          {error ? (
            <ErrorContent message={error} onRetry={() => reConnect(wallet, network)} />
          ) : (
            <>
              <Text color="textSubtle">{t('Please confirm in %wallet%', { wallet: wallet.title })}</Text>
              <Loading />
            </>
          )}
          {shouldShowMetamaskVersionWarning && (
            <Message variant="warning">
              <MessageText>
                {t(`If you're having trouble connecting with MetaMask, try updating to the latest version.`)}
              </MessageText>
            </Message>
          )}
        </FlexGap>
      </>
    </AtomBox>
  )
}
