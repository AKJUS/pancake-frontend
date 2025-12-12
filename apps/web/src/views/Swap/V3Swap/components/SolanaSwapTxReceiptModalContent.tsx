import { useTranslation } from '@pancakeswap/localization'
import { Box, Image, Link, Text } from '@pancakeswap/uikit'
import truncateHash from '@pancakeswap/utils/truncateHash'
import { solanaExplorerAtom } from '@pancakeswap/utils/user'
import { SwapTransactionReceiptModalContent } from '@pancakeswap/widgets-internal'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'

export const SolanaSwapTxReceiptModalContent = ({
  txHash,
  isMultisig = false,
}: {
  txHash: string
  isMultisig?: boolean
}) => {
  const { t } = useTranslation()
  const explorer = useAtomValue(solanaExplorerAtom)

  const explorerLink = useMemo(() => {
    return `${explorer.host}/tx/${txHash}`
  }, [txHash, explorer.host])

  return (
    <SwapTransactionReceiptModalContent
      isMultisig={isMultisig}
      explorerLink={
        <Link external small href={explorerLink}>
          {t('View on %site%', { site: explorer.name })}: {truncateHash(txHash, 8, 0)}
          <Box ml="4px" height={18} width={18}>
            <Image src={explorer.icon} height={18} width={18} alt={explorer.name} />
          </Box>
        </Link>
      }
    >
      {null}
    </SwapTransactionReceiptModalContent>
  )
}
