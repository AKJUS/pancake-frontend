import { useContext } from 'react'
import { BaseMiniAppContext } from 'components/BaseMiniAppProvider'

export const useIsBaseMiniApp = () => {
  const context = useContext(BaseMiniAppContext)
  if (!context) {
    throw new Error('useIsBaseMiniApp must be used within BaseMiniAppProvider')
  }
  return context.isInMiniApp
}
