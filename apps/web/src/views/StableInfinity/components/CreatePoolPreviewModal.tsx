import React, { useCallback, useState } from 'react'
import { useTranslation } from '@pancakeswap/localization'
import { Currency } from '@pancakeswap/sdk'
import { Button, Checkbox, Text, Box, Flex, Card, CardBody } from '@pancakeswap/uikit'
import { ConfirmationModalContent } from '@pancakeswap/widgets-internal'
import TransactionConfirmationModal from 'components/TransactionConfirmationModal'
import { styled } from 'styled-components'
import DoubleCurrencyLogo from 'components/Logo/DoubleLogo'
import CurrencyLogo from 'components/Logo/CurrencyLogo'
import { PRESET_CONFIGS, type PoolPreset } from '@pancakeswap/infinity-stable-sdk'

const ParameterRow = styled(Flex)`
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
`

const StyledCard = styled(Card)`
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  border-radius: 16px;
`

const TokenRow = styled(Flex)`
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  border-radius: 16px;
  padding: 8px 16px;
  align-items: center;
  justify-content: space-between;

  &:first-child {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-bottom: none;
  }

  &:last-child {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }
`

interface CreatePoolPreviewModalProps {
  isOpen: boolean
  onDismiss: () => void
  customOnDismiss?: () => void
  tokenA?: Currency
  tokenB?: Currency
  preset?: PoolPreset
  swapFee?: string
  amplificationParam?: string
  offpegFeeMultiplier?: string
  movingAverageTime?: string
  depositAmountA?: string
  depositAmountB?: string
  onCreatePool: () => void
  attemptingTxn: boolean
  hash?: string
  errorMessage?: string
}

export const CreatePoolPreviewModal: React.FC<CreatePoolPreviewModalProps> = ({
  isOpen,
  onDismiss,
  customOnDismiss,
  tokenA,
  tokenB,
  preset,
  swapFee,
  amplificationParam,
  offpegFeeMultiplier,
  movingAverageTime,
  depositAmountA,
  depositAmountB,
  onCreatePool,
  attemptingTxn,
  hash,
  errorMessage,
}) => {
  const { t } = useTranslation()
  const [confirmed, setConfirmed] = useState(false)

  const presetConfig = preset ? PRESET_CONFIGS[preset] : null

  // Format display values
  const displaySwapFee = swapFee || '0.01'
  const displayA = amplificationParam || (presetConfig?.A ? String(presetConfig.A) : '1000')
  const displayOffpegMultiplier = offpegFeeMultiplier || '10'
  const displayMaExpTime = movingAverageTime || '60'

  const pendingText = t('Creating %tokenA%-%tokenB% Pool', {
    tokenA: tokenA?.symbol,
    tokenB: tokenB?.symbol,
  })

  const modalHeader = useCallback(
    () => (
      <Box>
        {/* Token Pair Header */}
        <Flex flexDirection="column" alignItems="center" mb="16px">
          <Box mb="8px">
            {tokenA && tokenB ? (
              <DoubleCurrencyLogo currency0={tokenA} currency1={tokenB} size={32} margin />
            ) : (
              <Box width="64px" height="32px" />
            )}
          </Box>

          <Text fontSize="20px" bold color="text" textAlign="center" mb="8px">
            {tokenA?.symbol || 'Token 1'} / {tokenB?.symbol || 'Token 2'}
          </Text>

          <Box
            background="background"
            border="1px solid"
            borderColor="cardBorder"
            borderRadius="16px"
            px="16px"
            py="8px"
          >
            <Text fontSize="16px" bold color="text">
              StableSwap
            </Text>
          </Box>
        </Flex>

        {/* Token Amounts */}
        {depositAmountA && depositAmountB && (
          <Box mb="16px">
            <TokenRow>
              <Flex alignItems="center" style={{ gap: '8px' }}>
                {tokenA && <CurrencyLogo currency={tokenA} size="24px" />}
                <Text fontSize="16px" bold color="text">
                  {tokenA?.symbol || 'Token1'}
                </Text>
              </Flex>
              <Flex flexDirection="column" alignItems="flex-end">
                <Text fontSize="16px" bold color="text">
                  {depositAmountA}
                </Text>
              </Flex>
            </TokenRow>

            <TokenRow>
              <Flex alignItems="center" style={{ gap: '8px' }}>
                {tokenB && <CurrencyLogo currency={tokenB} size="24px" />}
                <Text fontSize="16px" bold color="text">
                  {tokenB?.symbol || 'Token2'}
                </Text>
              </Flex>
              <Flex flexDirection="column" alignItems="flex-end">
                <Text fontSize="16px" bold color="text">
                  {depositAmountB}
                </Text>
              </Flex>
            </TokenRow>
          </Box>
        )}

        {/* Pool Parameters */}
        <StyledCard mb="16px">
          <CardBody>
            <ParameterRow>
              <Text
                fontSize="14px"
                color="textSubtle"
                style={{ textDecoration: 'underline', textDecorationStyle: 'dotted' }}
              >
                {t('Swap fee')}
              </Text>
              <Text fontSize="14px" color="text">
                {displaySwapFee}%
              </Text>
            </ParameterRow>

            <ParameterRow>
              <Text
                fontSize="14px"
                color="textSubtle"
                style={{ textDecoration: 'underline', textDecorationStyle: 'dotted' }}
              >
                A
              </Text>
              <Text fontSize="14px" color="text">
                {displayA}
              </Text>
            </ParameterRow>

            <ParameterRow>
              <Text
                fontSize="14px"
                color="textSubtle"
                style={{ textDecoration: 'underline', textDecorationStyle: 'dotted' }}
              >
                {t('Offpeg fee multiplier')}
              </Text>
              <Text fontSize="14px" color="text">
                {displayOffpegMultiplier}
              </Text>
            </ParameterRow>

            <ParameterRow>
              <Text
                fontSize="14px"
                color="textSubtle"
                style={{ textDecoration: 'underline', textDecorationStyle: 'dotted' }}
              >
                {t('Moving average time')}
              </Text>
              <Text fontSize="14px" color="text">
                {displayMaExpTime}s
              </Text>
            </ParameterRow>

            {/* TODO: Display oracle information here when needed
             * tokenAConfig and tokenBConfig are available for display
             * Example: Show oracle type, address, and methodId for each token
             */}
          </CardBody>
        </StyledCard>

        {/* Confirmation Checkbox */}
        <Flex alignItems="flex-start" style={{ gap: '8px' }} mb="16px">
          <Checkbox scale="sm" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <Text fontSize="14px" color="text" style={{ lineHeight: '1.5' }}>
            {t('I confirm that I have reviewed the pool settings and understand the risks of setting it incorrectly.')}
          </Text>
        </Flex>
      </Box>
    ),
    [
      tokenA,
      tokenB,
      depositAmountA,
      depositAmountB,
      displaySwapFee,
      displayA,
      displayOffpegMultiplier,
      displayMaExpTime,
      confirmed,
      t,
    ],
  )

  const modalBottom = useCallback(
    () => (
      <Button width="100%" onClick={onCreatePool} disabled={!confirmed}>
        {t('Create Pool')}
      </Button>
    ),
    [confirmed, onCreatePool, t],
  )

  const confirmationContent = useCallback(
    () => <ConfirmationModalContent topContent={modalHeader} bottomContent={modalBottom} />,
    [modalHeader, modalBottom],
  )

  if (!isOpen) return null

  return (
    <TransactionConfirmationModal
      title={t('Create Pool')}
      onDismiss={onDismiss}
      customOnDismiss={customOnDismiss}
      attemptingTxn={attemptingTxn}
      errorMessage={errorMessage}
      hash={hash}
      content={confirmationContent}
      pendingText={pendingText}
    />
  )
}
