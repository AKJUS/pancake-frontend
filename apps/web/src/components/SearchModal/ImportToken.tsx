import { ChainId } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, Token } from '@pancakeswap/sdk'
import { WrappedTokenInfo } from '@pancakeswap/token-lists'
import {
  AutoColumn,
  BscScanIcon,
  Button,
  Checkbox,
  ErrorIcon,
  Flex,
  Grid,
  HelpIcon,
  Link,
  Message,
  Tag,
  Text,
  useTooltip,
} from '@pancakeswap/uikit'
import truncateHash from '@pancakeswap/utils/truncateHash'
import { ListLogo } from '@pancakeswap/widgets-internal'
import { useQuery } from '@tanstack/react-query'
import AccessRisk, { TOKEN_RISK } from 'components/AccessRisk'
import { ACCESS_TOKEN_SUPPORT_CHAIN_IDS } from 'components/AccessRisk/config/supportedChains'
import { fetchRiskToken } from 'components/AccessRisk/utils/fetchTokenRisk'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useState } from 'react'
import { useCombinedInactiveList } from 'state/lists/hooks'
import { useAddUserToken } from 'state/user/hooks'
import { useBlockExploreLink, useBlockExploreName } from 'utils'

interface ImportProps {
  tokens: Token[]
  handleCurrencySelect?: (currency: Currency) => void
  chainId?: number
}

export function WarningMessage() {
  const { t } = useTranslation()
  return (
    <Message variant="warning">
      <Text>
        {t('Anyone can create tokens with any name, including fake or misleading versions of existing projects.')}{' '}
        <b>{t('Buying such fraudulent tokens can lead to permanent loss of funds.')}</b>
      </Text>
    </Message>
  )
}

function ImportToken({ tokens, handleCurrencySelect, chainId: chainIdProp }: ImportProps) {
  const { chainId: activeChainId } = useActiveChainId()
  const chainId = chainIdProp || activeChainId
  const blockExplorerName = useBlockExploreName(chainId)
  const getBlockExploreLink = useBlockExploreLink()

  const { t } = useTranslation()

  const [confirmed, setConfirmed] = useState(false)

  const addToken = useAddUserToken()

  // use for showing import source on inactive tokens
  const inactiveTokenList = useCombinedInactiveList()

  const { data: hasRiskToken } = useQuery({
    queryKey: ['has-risks', tokens],

    queryFn: async () => {
      const result = await Promise.all(tokens.map((token) => fetchRiskToken(token.address, token.chainId)))
      return result.some((r) => r.riskLevel >= TOKEN_RISK.MEDIUM)
    },

    enabled: Boolean(tokens),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })

  const { targetRef, tooltip, tooltipVisible } = useTooltip(
    t('I have read the scanning result, understood the risk and want to proceed with token importing.'),
  )

  return (
    <AutoColumn gap="lg">
      <WarningMessage />

      {tokens.map((token) => {
        const list = token.chainId && inactiveTokenList?.[token.chainId]?.[token.address]?.list
        const address = token.address ? `${truncateHash(token.address)}` : null
        return (
          <Flex
            flexDirection={['column', 'column', 'row']}
            key={token.address}
            alignItems={['left', 'left', 'center']}
            justifyContent="space-between"
          >
            <Grid gridTemplateRows="1fr 1fr 1fr 1fr" gridGap="4px">
              {list !== undefined ? (
                <Tag
                  variant="success"
                  outline
                  scale="sm"
                  startIcon={list.logoURI && <ListLogo logoURI={list.logoURI} size="12px" />}
                >
                  {t('via')} {list.name}
                </Tag>
              ) : (
                <Tag variant="failure" outline scale="sm" startIcon={<ErrorIcon color="failure" />}>
                  {t('Unknown Source')}
                </Tag>
              )}
              <Flex alignItems="center">
                <Text mr="8px">{token.name}</Text>
                <Text>({token.symbol})</Text>
              </Flex>
              {!!token.chainId && (
                <>
                  <Text mr="4px">{address}</Text>
                  <Link href={getBlockExploreLink(token.address, 'address', token.chainId)} external>
                    (
                    {t('View on %site%', {
                      site: blockExplorerName,
                    })}
                    {token.chainId === ChainId.BSC && <BscScanIcon color="primary" ml="4px" />})
                  </Link>
                </>
              )}
            </Grid>
            {token && chainId && ACCESS_TOKEN_SUPPORT_CHAIN_IDS.includes(chainId) && (
              <Flex mt={['20px', '20px', '0']}>
                <AccessRisk token={token} />
              </Flex>
            )}
          </Flex>
        )
      })}

      <Grid gridTemplateRows="1fr 1fr" gridGap="4px">
        <Flex alignItems="center" onClick={() => setConfirmed(!confirmed)}>
          <Checkbox
            scale="sm"
            name="confirmed"
            type="checkbox"
            checked={confirmed}
            onChange={() => setConfirmed(!confirmed)}
          />
          <Text ml="8px" style={{ userSelect: 'none' }}>
            {hasRiskToken ? t('I acknowledge the risk') : t('I understand')}
          </Text>
          {hasRiskToken && (
            <div ref={targetRef}>
              <HelpIcon color="textSubtle" />
              {tooltipVisible && tooltip}
            </div>
          )}
        </Flex>
        <Button
          variant="danger"
          disabled={!confirmed}
          onClick={() => {
            tokens.forEach((token) => {
              const inactiveToken = chainId && inactiveTokenList?.[token.chainId]?.[token.address]
              let tokenToAdd = token
              if (inactiveToken) {
                tokenToAdd = new WrappedTokenInfo({
                  ...token,
                  logoURI: inactiveToken.token.logoURI,
                  name: token.name || inactiveToken.token.name,
                })
              }
              addToken(tokenToAdd)
            })
            if (handleCurrencySelect) {
              handleCurrencySelect(tokens[0])
            }
          }}
          className=".token-dismiss-button"
        >
          {hasRiskToken ? t('Proceed') : t('Import')}
        </Button>
      </Grid>
    </AutoColumn>
  )
}

export default ImportToken
