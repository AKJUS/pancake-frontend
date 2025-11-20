import '@kyberswap/pancake-liquidity-widgets/dist/style.css'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, UnifiedCurrency } from '@pancakeswap/sdk'
import {
  Flex,
  InfoFilledIcon,
  Message,
  MessageText,
  ModalContainer,
  ModalV2,
  Text,
  useModal,
  useToast,
} from '@pancakeswap/uikit'
import { Pool } from '@pancakeswap/v3-sdk'
import { ToastDescriptionWithTx } from 'components/Toast'
import dynamic from 'next/dynamic'
import { useCallback, useMemo, useState } from 'react'
import { useTransactionAdder } from 'state/transactions/hooks'
import styled, { useTheme } from 'styled-components'
import { getAddress } from 'viem'
import { useWalletClient } from 'wagmi'
import CurrencySearchModal from 'components/SearchModal/CurrencySearchModal'
import { CommonBasesType } from 'components/SearchModal/types'
import { isAddressEqual } from 'utils'
import WalletModalManager from 'components/WalletModalManager'
import { useMasterchefV3 } from 'hooks/useContract'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { PoolType } from '@kyberswap/pancake-liquidity-widgets'

const ActionText = styled(Text)`
  white-space: nowrap;
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
`

interface ZapLiquidityProps {
  tickLower?: number
  tickUpper?: number
  pool?: Pool | null
  tokenId?: string | null
  baseCurrency?: Currency | null
  baseCurrencyAmount?: string | null
  quoteCurrency?: Currency | null
  quoteCurrencyAmount?: string | null
  onSubmit?: () => void
  poolId?: string
  poolType?: PoolType
}

const LiquidityWidget = dynamic(
  () => import('@kyberswap/pancake-liquidity-widgets').then((mod) => mod.LiquidityWidget),
  { ssr: false },
)

const NATIVE_CURRENCY_ADDRESS = getAddress('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE')

const getCurrencyAddress = (currency: UnifiedCurrency | undefined | null): string =>
  currency?.isNative ? NATIVE_CURRENCY_ADDRESS : currency?.wrapped?.address || ''

export const ZapLiquidityWidget: React.FC<ZapLiquidityProps> = ({
  tickLower,
  tickUpper,
  tokenId,
  pool,
  baseCurrency,
  baseCurrencyAmount,
  quoteCurrency,
  quoteCurrencyAmount,
  onSubmit,
  poolId,
  poolType,
}) => {
  const { t } = useTranslation()

  const { isDark } = useTheme()

  const { account, chainId } = useAccountActiveChain()

  const { data: walletClient } = useWalletClient()

  const addTransaction = useTransactionAdder()

  const { toastSuccess } = useToast()

  const poolAddress = useMemo(() => {
    // For Infinity pools, use poolId directly
    if (poolId) {
      return poolId
    }
    // For V3 pools, calculate address from pool
    return pool && Pool.getAddress(pool.token0, pool.token1, pool.fee)
  }, [pool, poolId])

  const [isModalOpen, setIsModalOpen] = useState(false)

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)

  const [depositTokens, setDepositTokens] = useState<string>('')

  const [amounts, setAmounts] = useState<string>('')

  const handleWalletModalOnDismiss = useCallback(() => setIsWalletModalOpen(false), [])

  const handleOnWalletConnect = useCallback(() => setIsWalletModalOpen(true), [])

  const masterChefV3 = useMasterchefV3()

  // For Infinity pools, don't use MasterChef V3 addresses
  const masterChefV3Addresses = useMemo(() => {
    if (poolType === PoolType.DEX_PANCAKE_INFINITY_CL) {
      return undefined
    }
    return masterChefV3 ? [masterChefV3.address] : undefined
  }, [masterChefV3, poolType])

  const handleOnClick = useCallback(() => {
    setDepositTokens(
      [
        baseCurrencyAmount && baseCurrencyAmount !== '0' ? getCurrencyAddress(baseCurrency) : '',
        quoteCurrencyAmount && quoteCurrencyAmount !== '0' ? getCurrencyAddress(quoteCurrency) : '',
      ]
        .filter(Boolean)
        .join(','),
    )
    setAmounts(
      [
        baseCurrencyAmount && baseCurrencyAmount !== '0' ? baseCurrencyAmount : '',
        quoteCurrencyAmount && quoteCurrencyAmount !== '0' ? quoteCurrencyAmount : '',
      ]
        .filter(Boolean)
        .join(','),
    )
    setIsModalOpen(true)
  }, [baseCurrency, quoteCurrency, baseCurrencyAmount, quoteCurrencyAmount])

  const handleOnDismiss = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const handleTransaction = useCallback(
    (txHash: string) => {
      toastSuccess(`${t('Transaction Submitted')}!`, <ToastDescriptionWithTx txHash={txHash} />)
      addTransaction(
        { hash: txHash },
        {
          type: 'zap-liquidity-v3',
          summary: `Zap in for ${baseCurrency?.symbol} - ${quoteCurrency?.symbol}`,
          translatableSummary: {
            text: 'Zap in for %lpSymbol%',
            data: { lpSymbol: `${baseCurrency?.symbol} - ${quoteCurrency?.symbol}` },
          },
        },
      )
      setIsModalOpen(false)
      onSubmit?.()
    },
    [addTransaction, baseCurrency?.symbol, quoteCurrency?.symbol, t, toastSuccess, onSubmit],
  )

  const handleSelectToken = useCallback(
    (token: UnifiedCurrency) => {
      const selectedTokenAddress = getCurrencyAddress(token)
      const indexOfToken = depositTokens
        .split(',')
        .findIndex((depositToken) => isAddressEqual(depositToken, selectedTokenAddress))

      if (indexOfToken > -1) return
      setDepositTokens(depositTokens ? `${depositTokens},${selectedTokenAddress}` : `${selectedTokenAddress}`)
      setAmounts(amounts ? `${amounts},` : '')
    },
    [depositTokens, amounts],
  )

  const handleAmountChange = useCallback(
    (tokenAddress: string, amount: string) => {
      const indexOfToken = depositTokens
        .split(',')
        .findIndex((depositToken) => isAddressEqual(depositToken, tokenAddress))
      if (indexOfToken === -1) return

      const amountList = amounts.split(',')
      amountList[indexOfToken] = amount
      setAmounts(amountList.join(','))
    },
    [amounts, depositTokens],
  )

  const handleAddTokens = useCallback(
    (tokenAddresses: string) => {
      setDepositTokens(depositTokens ? `${depositTokens},${tokenAddresses}` : tokenAddresses)
      const amountsToAdd = tokenAddresses
        .split('')
        .filter((item) => item === ',')
        .join('')
      setAmounts(amounts ? `${amounts},${amountsToAdd}` : amountsToAdd)
    },
    [amounts, depositTokens],
  )

  const handleRemoveToken = useCallback(
    (tokenAddress: string) => {
      const tokens = depositTokens.split(',')
      const indexOfToken = tokens.findIndex((depositToken) => isAddressEqual(depositToken, tokenAddress))
      if (indexOfToken === -1) return

      tokens.splice(indexOfToken, 1)
      setDepositTokens(tokens.join(','))
      const amountList = amounts.split(',')
      amountList.splice(indexOfToken, 1)
      setAmounts(amountList.join(','))
    },
    [amounts, depositTokens],
  )

  const [onPresentCurrencyModal] = useModal(
    <CurrencySearchModal
      onCurrencySelect={handleSelectToken}
      commonBasesType={CommonBasesType.LIQUIDITY}
      mode="zap-currency"
      showCommonBases
      showCurrencyInHeader
      showSearchInput
    />,
  )

  return (
    <>
      <Message variant="primary60" padding="8px" icon={<InfoFilledIcon color="#02919D" />}>
        <Flex flexDirection="column" style={{ gap: 8 }}>
          <MessageText lineHeight="120%" fontSize={16} style={{ lineHeight: '1.5' }}>
            <ActionText
              as="span"
              color="#02919D"
              onClick={handleOnClick}
              role="presentation"
              data-dd-action-name={
                poolType === PoolType.DEX_PANCAKE_INFINITY_CL ? 'Zap InfinityCL Liquidity' : 'Zap V3 Liquidity'
              }
              bold
            >
              {t('Try Zap')}{' '}
            </ActionText>
            {poolType === PoolType.DEX_PANCAKE_INFINITY_CL
              ? t('to automatically balance and provide Infinity liquidity in one click.')
              : t('to automatically balance and provide V3 liquidity in one click.')}
          </MessageText>
        </Flex>
      </Message>
      <WalletModalManager isOpen={isWalletModalOpen} onDismiss={handleWalletModalOnDismiss} />
      <ModalV2 closeOnOverlayClick isOpen={isModalOpen} onDismiss={handleOnDismiss}>
        <ModalContainer style={{ maxHeight: '90vh', overflow: 'auto' }}>
          {chainId ? (
            <LiquidityWidget
              theme={isDark ? 'dark' : 'light'}
              poolType={poolType ?? PoolType.DEX_PANCAKESWAPV3}
              feeAddress="0xB82bb6Ce9A249076Ca7135470e7CA634806De168"
              feePcm={0}
              walletClient={walletClient}
              account={account ?? undefined}
              networkChainId={chainId}
              chainId={chainId}
              initTickLower={tickLower ? +tickLower : undefined}
              initTickUpper={tickUpper ? +tickUpper : undefined}
              positionId={tokenId || undefined}
              initAmounts={amounts}
              initDepositTokens={depositTokens}
              poolAddress={poolAddress ?? '0x'}
              farmContractAddresses={masterChefV3Addresses}
              onConnectWallet={handleOnWalletConnect}
              onAddTokens={handleAddTokens}
              onOpenTokenSelectModal={onPresentCurrencyModal}
              onRemoveToken={handleRemoveToken}
              onAmountChange={handleAmountChange}
              onDismiss={handleOnDismiss}
              onTxSubmit={handleTransaction}
              source="pancakeswap"
              includedSources="pancake-infinity-cl,pancake-infinity-bin,pancake-v3,pancake-stable,pancake,pancake-legacy"
            />
          ) : null}
        </ModalContainer>
      </ModalV2>
    </>
  )
}
