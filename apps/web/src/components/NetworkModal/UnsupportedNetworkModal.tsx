import { Button, Grid, Message, MessageText, Modal, Text } from '@pancakeswap/uikit'
import { useTranslation } from '@pancakeswap/localization'
import { useSwitchNetwork } from 'hooks/useSwitchNetwork'
import Image from 'next/image'
import useAuth from 'hooks/useAuth'
import { useRouter } from 'next/router'
import { getActiveMenuItem, getActiveSubMenuItem } from 'components/Menu/utils'
import { useAccount } from 'wagmi'
import { useMemo } from 'react'
import { ChainId, isTestnetChainId } from '@pancakeswap/chains'
import { viemClients } from 'utils/viem'
import config from 'components/Menu/config/config'
import Dots from '../Loader/Dots'

// Where chain is not supported or page not supported
export function UnsupportedNetworkModal({ pageSupportedChains }: { pageSupportedChains: number[] }) {
  const { switchNetwork, isLoading, canSwitch } = useSwitchNetwork()
  const chainId =
    pageSupportedChains.find((x) => x === ChainId.BSC) ||
    pageSupportedChains.find((x) => !isTestnetChainId(x)) ||
    ChainId.BSC
  const { isConnected } = useAccount()
  const { logout } = useAuth()
  const { t } = useTranslation()
  const { pathname } = useRouter()

  const title = useMemo(() => {
    const menuItems = config(t, false)
    const activeMenuItem = getActiveMenuItem({ menuConfig: menuItems, pathname })
    const activeSubMenuItem = getActiveSubMenuItem({ menuItem: activeMenuItem, pathname })

    return activeSubMenuItem?.label || activeMenuItem?.label
  }, [t, pathname])

  const supportedMainnetChains = useMemo(
    () =>
      Object.values(viemClients)
        .map((client) => client.chain)
        .filter((chain) => chain && !chain.testnet && pageSupportedChains?.includes(chain.id)),
    [pageSupportedChains],
  )

  return (
    <Modal title={t('Check your network')} hideCloseButton headerBackground="gradientCardHeader">
      <Grid style={{ gap: '16px' }} maxWidth={['100%', null, '336px']}>
        <Text>
          {t('Currently %feature% are only supported on', { feature: typeof title === 'string' ? title : 'this page' })}{' '}
          {supportedMainnetChains?.map((c) => c?.name).join(', ')}
        </Text>
        <div style={{ textAlign: 'center' }}>
          <Image
            layout="fixed"
            width={194}
            height={175}
            src="/images/check-your-network.png"
            alt="check your network"
          />
        </div>
        <Message variant="warning">
          <MessageText>{t('Please switch your network to continue.')}</MessageText>
        </Message>
        {canSwitch ? (
          <Button
            isLoading={isLoading}
            onClick={() => {
              switchNetwork(chainId, {
                from: 'switch',
                replaceUrl: true,
              })
            }}
          >
            {isLoading ? (
              <Dots>{isConnected ? t('Switch network in wallet') : t('Switch network')}</Dots>
            ) : isConnected ? (
              t('Switch network in wallet')
            ) : (
              t('Switch network')
            )}
          </Button>
        ) : (
          <Message variant="danger">
            <MessageText>{t('Unable to switch network. Please try it on your wallet')}</MessageText>
          </Message>
        )}
        {isConnected && (
          <Button
            variant="secondary"
            onClick={() =>
              logout().then(() => {
                switchNetwork(ChainId.BSC, {
                  from: 'switch',
                })
              })
            }
          >
            {t('Disconnect Wallet')}
          </Button>
        )}
      </Grid>
    </Modal>
  )
}
