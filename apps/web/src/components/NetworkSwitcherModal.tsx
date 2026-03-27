import { Chain, ChainId, Chains, isTestnetChainId, NonEVMChainId, UnifiedChainId } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Box,
  Button,
  Flex,
  InfoIcon,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
  ModalV2,
  ModalWrapper,
  Text,
  useMatchBreakpoints,
  UserMenuDivider,
  UserMenuItem,
  useTooltip,
} from '@pancakeswap/uikit'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useHover } from 'hooks/useHover'
import { useSwitchNetwork } from 'hooks/useSwitchNetwork'
import useTheme from 'hooks/useTheme'
import { atom, useAtom } from 'jotai'
import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import { useUserShowTestnet } from 'state/user/hooks/useUserShowTestnet'
import { useAccount } from 'wagmi'
import { getQueryChainId } from 'wallet/util/getQueryChainId'
import { type SwitchChainOption } from 'wallet/hook/useSwitchNetworkV2'
import { ChainLogo } from './Logo/ChainLogo'

type ChainSpecificBehavior = {
  onClick: () => void
}

export const networkSwitcherModalAtom = atom(false)

interface NetworkSelectProps {
  switchNetwork: (chainId: number) => void
  chainId: number
  isWrongNetwork: boolean
  onDismiss: () => void
}

function getSortedChains(chainId: UnifiedChainId, showTestnet: boolean): Chain[] {
  return Chains.filter((chain) => {
    if (chain.isEVM) {
      if (chain.id === chainId) return true
      if (isTestnetChainId(chain.id as ChainId)) {
        return showTestnet
      }
      return true
    }
    // always include non-EVM chains
    return true
  }).map((chain) => ({
    ...chain,
    isEvm: chain.isEVM,
  }))
}

const NetworkSelect = ({ switchNetwork, chainId, isWrongNetwork, onDismiss }: NetworkSelectProps) => {
  const { t } = useTranslation()
  const [showTestnet] = useUserShowTestnet()
  const { theme } = useTheme()
  const { isMobile } = useMatchBreakpoints()
  const chainSpecificBehavior: Partial<Record<UnifiedChainId, ChainSpecificBehavior>> = useMemo(
    () => ({
      [NonEVMChainId.APTOS]: {
        onClick: () => {
          window.open('https://aptos.pancakeswap.finance', '_self')
          onDismiss()
        },
      },
    }),
    [onDismiss],
  )
  const networks = useMemo(() => getSortedChains(chainId, showTestnet), [chainId, showTestnet])

  return (
    <Box borderRadius={isMobile ? '32px' : '32px 32px 0 0'} overflow="hidden">
      <ModalHeader background={theme.colors.gradientCardHeader}>
        <ModalTitle>
          <Text bold fontSize="20px">
            {t('Select a Network')}
          </Text>
        </ModalTitle>
        <ModalCloseButton onDismiss={onDismiss} />
      </ModalHeader>

      <Box maxHeight="70vh" overflow="auto" padding="16px 0">
        {networks.map((net) =>
          !chainSpecificBehavior[net.id] ? (
            // in-wallet network switch
            <UserMenuItem
              key={net.id}
              style={{ justifyContent: 'flex-start', cursor: 'pointer', padding: '0px 24px' }}
              onClick={() => {
                if (net.id !== chainId || isWrongNetwork) {
                  switchNetwork(net.id)
                }
                onDismiss()
              }}
            >
              <ChainLogo chainId={net.id} />
              <Text
                color={net.id === chainId && !isWrongNetwork ? 'secondary' : 'text'}
                bold={net.id === chainId && !isWrongNetwork}
                pl="12px"
              >
                {net.fullName}
              </Text>
            </UserMenuItem>
          ) : (
            // chain-specific behavior: external or custom handling
            <UserMenuItem
              key={`non-evm-${net.id}`}
              onClick={chainSpecificBehavior[net.id]?.onClick}
              style={{ justifyContent: 'flex-start', cursor: 'pointer', padding: '0px 24px' }}
            >
              <ChainLogo chainId={net.id} />
              <Text color="text" pl="12px">
                {net.fullName}
              </Text>
            </UserMenuItem>
          ),
        )}
      </Box>
    </Box>
  )
}

interface WrongNetworkSelectProps {
  switchNetwork: (chainId: number, opt?: SwitchChainOption) => void
  chainId: number
  onDismiss: () => void
}

const WrongNetworkSelect = ({ switchNetwork, chainId, onDismiss }: WrongNetworkSelectProps) => {
  const { t } = useTranslation()
  const { targetRef, tooltip, tooltipVisible } = useTooltip(
    t(
      'The URL you are accessing (Chain id: %chainId%) belongs to %network%; mismatching your wallet’s network. Please switch the network to continue.',
      {
        chainId,
        network: Chains.find((c) => c.id === chainId)?.fullName ?? 'Unknown network',
      },
    ),
    {
      placement: 'auto-start',
      hideTimeout: 0,
    },
  )
  const { chain } = useAccount()
  const localChainId = getQueryChainId() || ChainId.BSC

  const localChainName = Chains.find((c) => c.id === localChainId)?.fullName ?? 'BSC'

  const [ref1, isHover] = useHover<HTMLButtonElement>()

  return (
    <>
      <Flex ref={targetRef} alignItems="center" px="16px" py="8px">
        <InfoIcon color="textSubtle" />
        <Text color="textSubtle" pl="6px">
          {t('Please switch network')}
        </Text>
      </Flex>
      {tooltipVisible && tooltip}
      <UserMenuDivider />
      {chain && (
        <UserMenuItem ref={ref1} style={{ justifyContent: 'flex-start' }}>
          <ChainLogo chainId={chain.id} />
          <Text color="secondary" bold pl="12px">
            {chain.name}
          </Text>
        </UserMenuItem>
      )}
      <Box px="16px" pt="8px">
        {isHover ? <ArrowUpIcon color="text" /> : <ArrowDownIcon color="text" />}
      </Box>
      <UserMenuItem
        onClick={() => {
          switchNetwork(localChainId, { from: 'switch', force: true })
          onDismiss()
        }}
        style={{ justifyContent: 'flex-start' }}
      >
        <ChainLogo chainId={localChainId} />
        <Text pl="12px">{localChainName}</Text>
      </UserMenuItem>
      <Button
        mx="16px"
        my="8px"
        scale="sm"
        onClick={() => {
          switchNetwork(localChainId, { from: 'switch', force: true })
          onDismiss()
        }}
      >
        {t('Switch network in wallet')}
      </Button>
    </>
  )
}

export const NetworkSelectPanel = ({ onDismiss }: { onDismiss: () => void }) => {
  const { chainId, isWrongNetwork } = useActiveChainId()
  const { switchNetwork } = useSwitchNetwork()
  const [showTestnet] = useUserShowTestnet()
  const chainSpecificBehavior: Partial<Record<UnifiedChainId, ChainSpecificBehavior>> = useMemo(
    () => ({
      [NonEVMChainId.APTOS]: {
        onClick: () => {
          window.open('https://aptos.pancakeswap.finance', '_self')
          onDismiss()
        },
      },
    }),
    [onDismiss],
  )
  const networks = useMemo(() => getSortedChains(chainId, showTestnet), [chainId, showTestnet])

  return (
    <Box padding="8px 0">
      {networks.map((net) =>
        !chainSpecificBehavior[net.id] ? (
          <UserMenuItem
            key={net.id}
            style={{ justifyContent: 'flex-start', cursor: 'pointer', padding: '0px 24px' }}
            onClick={() => {
              if (net.id !== chainId || isWrongNetwork) {
                switchNetwork(net.id)
              }
              onDismiss()
            }}
          >
            <ChainLogo chainId={net.id} />
            <Text
              color={net.id === chainId && !isWrongNetwork ? 'secondary' : 'text'}
              bold={net.id === chainId && !isWrongNetwork}
              pl="12px"
            >
              {net.fullName}
            </Text>
          </UserMenuItem>
        ) : (
          <UserMenuItem
            key={`non-evm-${net.id}`}
            onClick={chainSpecificBehavior[net.id]?.onClick}
            style={{ justifyContent: 'flex-start', cursor: 'pointer', padding: '0px 24px' }}
          >
            <ChainLogo chainId={net.id} />
            <Text color="text" pl="12px">
              {net.fullName}
            </Text>
          </UserMenuItem>
        ),
      )}
    </Box>
  )
}

export const NetworkSwitcherModal = () => {
  const { chainId, isWrongNetwork, isNotMatched } = useActiveChainId()
  const { switchNetwork } = useSwitchNetwork()
  const router = useRouter()
  const [isOpen, setIsOpen] = useAtom(networkSwitcherModalAtom)

  const handleDismiss = useCallback(() => {
    setIsOpen(false)
  }, [setIsOpen])

  if (!chainId || router.pathname.includes('/info')) {
    return null
  }

  return (
    <ModalV2 isOpen={isOpen} onDismiss={handleDismiss} closeOnOverlayClick>
      <ModalWrapper minWidth="360px" maxHeight="90vh" style={{ overflowY: 'auto' }}>
        {isNotMatched ? (
          <WrongNetworkSelect switchNetwork={switchNetwork} chainId={chainId} onDismiss={handleDismiss} />
        ) : (
          <NetworkSelect
            switchNetwork={switchNetwork}
            chainId={chainId}
            isWrongNetwork={isWrongNetwork}
            onDismiss={handleDismiss}
          />
        )}
      </ModalWrapper>
    </ModalV2>
  )
}
