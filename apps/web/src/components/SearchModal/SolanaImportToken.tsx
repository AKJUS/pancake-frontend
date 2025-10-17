import { SPLToken } from '@pancakeswap/swap-sdk-core'
import { AutoColumn, Button, Checkbox, ErrorIcon, Flex, FlexGap, ScanLink, Tag, Text } from '@pancakeswap/uikit'
import { useState } from 'react'

import { useTranslation } from '@pancakeswap/localization'
import truncateHash from '@pancakeswap/utils/truncateHash'
import { solanaExplorerAtom } from '@pancakeswap/utils/user'
import { useAtom } from 'jotai'
import { useSolanaTokenList } from 'hooks/solana/useSolanaTokenList'
import { convertSPLTokenIntoRawTokenInfoUserAdded } from 'config/solana-list'

import { WarningMessage } from './ImportToken'

interface ImportProps {
  tokens: SPLToken[]
  handleCurrencySelect?: (currency: SPLToken) => void
}

function SolanaImportToken({ tokens, handleCurrencySelect }: ImportProps) {
  const { t } = useTranslation()

  const [confirmed, setConfirmed] = useState(false)
  const [currentExplorer] = useAtom(solanaExplorerAtom)
  const { addUserToken } = useSolanaTokenList()

  return (
    <AutoColumn gap="lg">
      <WarningMessage />

      {tokens.map((token) => {
        const address = token.address ? `${truncateHash(token.address)}` : null
        return (
          <FlexGap key={token.address} gap="4px" flexDirection="column">
            {/* For now, we'll show all tokens as unknown source since we don't have list integration */}
            <Tag variant="failure" outline scale="sm" startIcon={<ErrorIcon color="failure" />}>
              {t('Unknown Source')}
            </Tag>

            <Flex alignItems="center">
              <Text mr="8px">{token.name || token.symbol}</Text>
              <Text>({token.symbol})</Text>
            </Flex>

            <Flex justifyContent="space-between" width="100%">
              <Text mr="4px">{address}</Text>
              <ScanLink href={`${currentExplorer.host}/token/${token.address}`}>
                {t('View on %site%', {
                  site: 'Solana Explorer',
                })}
              </ScanLink>
            </Flex>
          </FlexGap>
        )
      })}

      <Flex justifyContent="space-between" alignItems="center">
        <Flex alignItems="center" onClick={() => setConfirmed(!confirmed)}>
          <Checkbox
            scale="sm"
            name="confirmed"
            type="checkbox"
            checked={confirmed}
            onChange={() => setConfirmed(!confirmed)}
          />
          <Text ml="8px" style={{ userSelect: 'none' }}>
            {t('I understand')}
          </Text>
        </Flex>
        <Button
          variant="danger"
          disabled={!confirmed}
          onClick={() => {
            tokens.forEach((token) => {
              addUserToken(convertSPLTokenIntoRawTokenInfoUserAdded(token))
            })
            if (handleCurrencySelect) {
              handleCurrencySelect(tokens[0])
            }
          }}
          className=".token-dismiss-button"
        >
          {t('Import')}
        </Button>
      </Flex>
    </AutoColumn>
  )
}

export default SolanaImportToken
