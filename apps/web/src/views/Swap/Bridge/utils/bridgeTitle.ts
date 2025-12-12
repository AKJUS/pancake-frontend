import { TranslateFunction } from '@pancakeswap/localization'
import { BridgeStatus } from '../types'

export const getBridgeTitle = (t: TranslateFunction, status?: BridgeStatus) => {
  switch (status) {
    case BridgeStatus.PENDING:
    case BridgeStatus.BRIDGE_PENDING:
      return t('Order Submitted')
    case BridgeStatus.SUCCESS:
      return t('Success')
    case BridgeStatus.PARTIAL_SUCCESS:
      return t('Partial Success')
    case BridgeStatus.FAILED:
      return t('Unsuccessful')
    case BridgeStatus.MULTISIG_SUBMITTED:
      return t('Multisig transaction submitted')
    default:
      return t('Order Submitted')
  }
}
