import { AtomBox, FlexGap, Heading, Image, Loading, Text } from '@pancakeswap/uikit'
import { useTranslation } from '@pancakeswap/localization'
import { useAtomValue } from 'jotai'
import { errorEvmAtom, errorSolanaAtom } from '../../state/atom'
import { WalletAdaptedNetwork, WalletConfigV3 } from '../../types'
import { ErrorContent } from '../ErrorContent'

export type ConfirmingProps = {
  wallet: WalletConfigV3
  network: WalletAdaptedNetwork
  reConnect: (wallet: WalletConfigV3, network: WalletAdaptedNetwork) => void
}

export const Confirming: React.FC<ConfirmingProps> = ({ wallet, network, reConnect }) => {
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
        {error ? (
          <ErrorContent message={error} onRetry={() => reConnect(wallet, network)} />
        ) : (
          <FlexGap gap="4px" alignItems="center">
            <Text color="textSubtle">{t('Please confirm in %wallet%', { wallet: wallet.title })}</Text>
            <Loading />
          </FlexGap>
        )}
      </>
    </AtomBox>
  )
}
