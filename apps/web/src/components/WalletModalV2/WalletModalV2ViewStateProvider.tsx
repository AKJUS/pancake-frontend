import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import type { BalanceData } from 'hooks/useAddressBalance'
import { SEND_ENTRY, ViewState } from './type'

interface WalletModalV2ViewStateContextType {
  viewState: ViewState
  setViewState: (viewState: ViewState) => void
  goBack: () => void
  reset: () => void
  setSendEntry: (sendEntry: SEND_ENTRY) => void
  sendEntry: SEND_ENTRY
  detailAsset: BalanceData | undefined
  setDetailAsset: (asset: BalanceData | undefined) => void
}

const WalletModalV2ViewStateContext = createContext<WalletModalV2ViewStateContextType>({
  viewState: ViewState.WALLET_INFO,
  setViewState: () => {},
  goBack: () => {},
  reset: () => {},
  setSendEntry: () => {},
  sendEntry: SEND_ENTRY.SEND_ONLY,
  detailAsset: undefined,
  setDetailAsset: () => {},
})

export const useWalletModalV2ViewState = () => {
  const context = useContext(WalletModalV2ViewStateContext)
  if (!context) {
    throw new Error('useWalletModalV2ViewState must be used within a WalletModalV2ViewStateProvider')
  }
  return context
}

interface WalletModalV2ViewStateProviderProps {
  children: ReactNode
}

export const WalletModalV2ViewStateProvider: React.FC<WalletModalV2ViewStateProviderProps> = ({ children }) => {
  const [viewState, setViewState] = useState<ViewState>(ViewState.WALLET_INFO)

  const [sendEntry, setSendEntry] = useState<SEND_ENTRY>(SEND_ENTRY.SEND_ONLY)

  const [detailAsset, setDetailAsset] = useState<BalanceData | undefined>(undefined)

  const goBack = useCallback(() => {
    setViewState((prevState) => {
      // Define the navigation hierarchy
      switch (prevState) {
        case ViewState.SEND_FORM:
          return ViewState.SEND_ASSETS
        case ViewState.CONFIRM_TRANSACTION:
          return ViewState.SEND_FORM
        case ViewState.CLAIM_GIFT_CONFIRM:
          return ViewState.CLAIM_GIFT
        case ViewState.RECEIVE_QR:
          return ViewState.RECEIVE_OPTIONS
        case ViewState.RECEIVE_OPTIONS:
          return ViewState.WALLET_INFO
        default:
          return ViewState.WALLET_INFO
      }
    })
  }, [])

  const handleSetViewState = useCallback(
    (next: ViewState) => {
      setViewState(next)
      if (next !== ViewState.WALLET_INFO) setDetailAsset(undefined)
    },
    [setViewState],
  )

  const reset = useCallback(() => {
    setViewState(ViewState.WALLET_INFO)
    setDetailAsset(undefined)
  }, [])

  const value = useMemo(
    () => ({
      viewState,
      setViewState: handleSetViewState,
      goBack,
      reset,
      setSendEntry,
      sendEntry,
      detailAsset,
      setDetailAsset,
    }),
    [viewState, handleSetViewState, goBack, reset, sendEntry, detailAsset],
  )

  return <WalletModalV2ViewStateContext.Provider value={value}>{children}</WalletModalV2ViewStateContext.Provider>
}
