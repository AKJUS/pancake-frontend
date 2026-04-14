import { ChainId } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import { WrappedTokenInfo } from '@pancakeswap/token-lists'
import {
  Acknowledgement,
  Box,
  Heading,
  Link,
  Message,
  ModalBody,
  ModalContainer,
  ModalHeader,
  ReactMarkdown,
  Text,
} from '@pancakeswap/uikit'
import { useActiveChainId } from 'hooks/useActiveChainId'
import useTheme from 'hooks/useTheme'
import { styled } from 'styled-components'
import ARB_WARNING_LIST from './arbitrum'
import BASE_WARNING_LIST from './base'
import BSC_WARNING_LIST from './bsc'
import ETH_WARNING_LIST from './mainnet'
import ZKSYNC_WARNING_LIST from './zksync'

const StyledModalContainer = styled(ModalContainer)`
  max-width: 440px;
`

const MessageContainer = styled(Message)`
  align-items: flex-start;
  justify-content: flex-start;
`

interface SwapWarningModalProps {
  swapCurrency?: WrappedTokenInfo | null
  title?: string
  reason?: string
  source?: 'cms' | 'thirdParty'
  onDismiss?: () => void
  onAcknowledge?: () => void
}

const SwapWarningModal: React.FC<React.PropsWithChildren<SwapWarningModalProps>> = ({
  swapCurrency,
  title,
  reason,
  source,
  onDismiss,
  onAcknowledge,
}) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { chainId } = useActiveChainId()

  const TOKEN_WARNINGS = {
    [ChainId.ETHEREUM]: ETH_WARNING_LIST,
    [ChainId.BSC]: BSC_WARNING_LIST,
    [ChainId.ZKSYNC]: ZKSYNC_WARNING_LIST,
    [ChainId.BASE]: BASE_WARNING_LIST,
    [ChainId.ARBITRUM_ONE]: ARB_WARNING_LIST,
  }

  if (!swapCurrency) {
    return null
  }

  const SWAP_WARNING = chainId ? TOKEN_WARNINGS?.[chainId]?.[swapCurrency.address] : undefined
  const warningSymbol = SWAP_WARNING?.symbol || swapCurrency?.symbol || t('this token')
  const warningTitle = title || t('Notice for trading %symbol%', { symbol: warningSymbol })
  const handleContinue = () => {
    onAcknowledge?.()
    onDismiss?.()
  }
  const isThirdPartyWarning = source === 'thirdParty'

  return (
    <StyledModalContainer minWidth="280px">
      <ModalHeader background={theme.colors.gradientCardHeader}>
        <Heading p="12px 24px">{warningTitle}</Heading>
      </ModalHeader>
      <ModalBody p="24px">
        <MessageContainer variant="warning" mb="24px">
          <Box>
            {SWAP_WARNING?.component ?? (
              <>
                {isThirdPartyWarning ? (
                  <Box mt="8px">
                    <Text mb="8px">
                      {t(
                        'This token has been flagged as high risk. Please do your own research and proceed with caution.',
                      )}
                    </Text>
                    <Text>
                      {t('Result provided by')}{' '}
                      <Link external color="primary60" style={{ display: 'inline' }} href="https://www.hashdit.io/">
                        HashDit
                      </Link>
                      {chainId === ChainId.BSC ? (
                        <>
                          {' '}
                          /{' '}
                          <Link
                            external
                            color="primary60"
                            style={{ display: 'inline' }}
                            href={`https://dappbay.bnbchain.org/risk-scanner/${swapCurrency.address}`}
                          >
                            {t('Get more details from RedAlarm')}
                          </Link>
                        </>
                      ) : null}
                    </Text>
                  </Box>
                ) : reason ? (
                  <Box mt="8px">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <Text>{children}</Text>,
                        a: ({ href, children }) => (
                          <Link
                            href={href}
                            external
                            color="primary60"
                            style={{ display: 'inline' }}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {children}
                          </Link>
                        ),
                      }}
                    >
                      {reason}
                    </ReactMarkdown>
                  </Box>
                ) : (
                  <Text>
                    {t(
                      'This token has been flagged as high risk. Please do your own research and proceed with caution.',
                    )}
                  </Text>
                )}
              </>
            )}
          </Box>
        </MessageContainer>
        <Acknowledgement handleContinueClick={handleContinue} />
      </ModalBody>
    </StyledModalContainer>
  )
}

export default SwapWarningModal
