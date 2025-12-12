import { Text } from '@pancakeswap/uikit'
import { useTranslation } from '@pancakeswap/localization'

const MultisigToastDescription: React.FC = () => {
  const { t } = useTranslation()

  return <Text>{t('Transaction pending approvals. Execution will occur after multisig confirmation.')}</Text>
}

export default MultisigToastDescription
