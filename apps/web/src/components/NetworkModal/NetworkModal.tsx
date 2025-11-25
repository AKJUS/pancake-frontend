import { ChainId } from '@pancakeswap/chains'
import { ModalV2 } from '@pancakeswap/uikit'
import { SUPPORT_ONLY_BSC } from 'config/constants/supportChains'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { atom, useAtom } from 'jotai'
import dynamic from 'next/dynamic'
import { useCallback, useMemo } from 'react'
import { viemClients } from 'utils/viem'
import { CHAIN_IDS } from 'utils/wagmi'
import { useAccount } from 'wagmi'

export const mustSwitchNetworkModalAtom = atom<number | boolean>(false)

const PageNetworkSupportModal = dynamic(
  () => import('./PageNetworkSupportModal').then((mod) => mod.PageNetworkSupportModal),
  { ssr: false },
)
const WrongNetworkModal = dynamic(() => import('./WrongNetworkModal').then((mod) => mod.WrongNetworkModal), {
  ssr: false,
})
const UnsupportedNetworkModal = dynamic(
  () => import('./UnsupportedNetworkModal').then((mod) => mod.UnsupportedNetworkModal),
  { ssr: false },
)

export const NetworkModal = ({
  pageSupportedChains = SUPPORT_ONLY_BSC,
  forceMultipleNetworkModal = false,
}: {
  pageSupportedChains?: number[]
  forceMultipleNetworkModal?: boolean
}) => {
  const { chainId, isWrongNetwork } = useActiveChainId()
  const { chain } = useAccount()
  const [mustSwitchNetworkModal, setMustSwitchNetworkModal] = useAtom(mustSwitchNetworkModalAtom)

  const isBNBOnlyPage = useMemo(() => {
    if (forceMultipleNetworkModal) return false
    return pageSupportedChains?.length === 1 && pageSupportedChains[0] === ChainId.BSC
  }, [pageSupportedChains, forceMultipleNetworkModal])

  const isPageNotSupported = useMemo(
    () => Boolean(pageSupportedChains.length) && chainId && !pageSupportedChains.includes(chainId),
    [chainId, pageSupportedChains],
  )
  const handleDismiss = useCallback(() => setMustSwitchNetworkModal(false), [setMustSwitchNetworkModal])

  if (pageSupportedChains?.length === 0) return null // open to all chains

  if (isPageNotSupported && isBNBOnlyPage) {
    return (
      <ModalV2 isOpen closeOnOverlayClick={false}>
        <PageNetworkSupportModal />
      </ModalV2>
    )
  }

  const switchNetworkModal = Boolean(isWrongNetwork && !isPageNotSupported && mustSwitchNetworkModal)

  if (switchNetworkModal) {
    const nextChain = Object.values(viemClients)
      .map((client) => client.chain)
      .find((c) => (typeof mustSwitchNetworkModal === 'number' ? c?.id === mustSwitchNetworkModal : c?.id === chainId))

    if (!nextChain) return null

    return (
      <ModalV2 isOpen={Boolean(mustSwitchNetworkModal)} closeOnOverlayClick={false} onDismiss={handleDismiss}>
        <WrongNetworkModal currentChain={nextChain} onDismiss={handleDismiss} />
      </ModalV2>
    )
  }

  // @ts-ignore
  if ((chain?.unsupported ?? false) || isPageNotSupported) {
    return (
      <ModalV2 isOpen closeOnOverlayClick={false}>
        <UnsupportedNetworkModal pageSupportedChains={pageSupportedChains?.length ? pageSupportedChains : CHAIN_IDS} />
      </ModalV2>
    )
  }

  return null
}
