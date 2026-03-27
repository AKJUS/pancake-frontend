import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { UnifiedChainId } from '@pancakeswap/chains'

export type WalletPanelAction = 'send' | 'receive'

export type WalletPanelSendTarget = {
  chainId: UnifiedChainId
  tokenAddress: string
}

type WalletPanelRequest = {
  id: number
  action: WalletPanelAction
  sendTarget?: WalletPanelSendTarget
}

type WalletPanelContextValue = {
  request: WalletPanelRequest | null
  pendingSendTarget: WalletPanelSendTarget | null
  openWalletPanel: (action: WalletPanelAction, sendTarget?: WalletPanelSendTarget) => void
  clearWalletPanelRequest: () => void
  clearPendingSendTarget: () => void
}

const WalletPanelContext = createContext<WalletPanelContextValue>({
  request: null,
  pendingSendTarget: null,
  openWalletPanel: () => {},
  clearWalletPanelRequest: () => {},
  clearPendingSendTarget: () => {},
})

export const WalletPanelProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [request, setRequest] = useState<WalletPanelRequest | null>(null)
  const [pendingSendTarget, setPendingSendTarget] = useState<WalletPanelSendTarget | null>(null)

  const openWalletPanel = useCallback((action: WalletPanelAction, sendTarget?: WalletPanelSendTarget) => {
    setPendingSendTarget(action === 'send' ? sendTarget ?? null : null)
    setRequest({ id: Date.now(), action, sendTarget })
  }, [])

  const clearWalletPanelRequest = useCallback(() => {
    setRequest(null)
  }, [])

  const clearPendingSendTarget = useCallback(() => {
    setPendingSendTarget(null)
  }, [])

  const value = useMemo(
    () => ({
      request,
      pendingSendTarget,
      openWalletPanel,
      clearWalletPanelRequest,
      clearPendingSendTarget,
    }),
    [request, pendingSendTarget, openWalletPanel, clearWalletPanelRequest, clearPendingSendTarget],
  )

  return <WalletPanelContext.Provider value={value}>{children}</WalletPanelContext.Provider>
}

export const useWalletPanel = () => useContext(WalletPanelContext)
