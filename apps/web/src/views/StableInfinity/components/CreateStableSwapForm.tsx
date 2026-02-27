import { useCallback, useEffect, useMemo, useState } from 'react'
import { AutoColumn, Card, CardBody, Grid, Message, MessageText, useModal } from '@pancakeswap/uikit'
import { useTranslation } from '@pancakeswap/localization'
import { useWaitForTransactionReceipt } from 'wagmi'
import { useAccountActiveChain } from 'hooks/useAccountActiveChain'
import { useRouter } from 'next/router'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import { type Currency } from '@pancakeswap/swap-sdk-core'
import { useCurrencies } from 'views/CreateLiquidityPool/hooks/useCurrencies'
import { chainIdToExplorerInfoChainName } from 'state/info/api/client'
import { isEvm } from '@pancakeswap/chains'
import {
  InfinityStablePoolFactory,
  getHookAddressFromReceipt,
  getPoolIdFromReceipt,
} from '@pancakeswap/infinity-stable-sdk'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { TokenConfigProvider, useTokenConfig } from '../contexts/TokenConfigContext'
import { InfinityStableFieldSelectCurrencies } from './FieldSelectCurrency'
import { ParamSettingSection } from './ParamSettingSection'
import { CreatePoolPreviewModal } from './CreatePoolPreviewModal'
import { useCreateInfinityStablePool } from '../hooks/useCreateInfinityStablePool'

export const CreateStableSwapForm = () => {
  return (
    <TokenConfigProvider>
      <CreateStableSwapFormInner />
    </TokenConfigProvider>
  )
}

const CreateStableSwapFormInner = () => {
  const { t } = useTranslation()
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined)
  const [createPoolError, setCreatePoolError] = useState<string | undefined>(undefined)
  const [poolParams, setPoolParams] = useState<{
    selectedPreset?: string
    swapFee: string
    isAdvancedEnabled: boolean
    amplificationParam: string
    offpegFeeMultiplier: string
    movingAverageTime: string
    depositAmountA: string
    depositAmountB: string
  } | null>(null)

  const router = useRouter()
  const { chainId } = useAccountActiveChain()
  const { baseCurrency, quoteCurrency } = useCurrencies()
  const { createInfinityStablePool, attemptingTxn } = useCreateInfinityStablePool()
  const { tokenAConfig, tokenBConfig } = useTokenConfig()

  // Fetch USD prices for both tokens
  const { data: baseCurrencyUsdPrice } = useCurrencyUsdPrice(baseCurrency ?? undefined, {
    enabled: Boolean(baseCurrency),
  })
  const { data: quoteCurrencyUsdPrice } = useCurrencyUsdPrice(quoteCurrency ?? undefined, {
    enabled: Boolean(quoteCurrency),
  })

  // Calculate price deviation percentage
  const priceDeviation = useMemo(() => {
    if (!baseCurrencyUsdPrice || !quoteCurrencyUsdPrice) return undefined
    const avg = (baseCurrencyUsdPrice + quoteCurrencyUsdPrice) / 2
    if (avg === 0) return undefined
    return Math.abs(baseCurrencyUsdPrice - quoteCurrencyUsdPrice) / avg
  }, [baseCurrencyUsdPrice, quoteCurrencyUsdPrice])

  const isPriceDeviationTooHigh = priceDeviation !== undefined && priceDeviation > 0.05

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({
    chainId,
    hash: txHash,
  })

  const hookAddress = getHookAddressFromReceipt(receipt)

  useEffect(() => {
    if (isConfirmed && hookAddress) {
      // router to pool detail page
      router.push(`/liquidity/pool/${chainIdToExplorerInfoChainName[chainId]}/${hookAddress}`)
    }
  }, [isConfirmed, hookAddress, chainId, router])

  const handleCreatePool = useCallback(async () => {
    if (!poolParams) {
      console.error('Missing pool params')
      return
    }

    if (!isEvm(baseCurrency?.chainId) || !isEvm(quoteCurrency?.chainId)) {
      console.error('Missing currencies for pool creation')
      return
    }

    const parsedAmountA = tryParseAmount(poolParams.depositAmountA, baseCurrency)
    const parsedAmountB = tryParseAmount(poolParams.depositAmountB, quoteCurrency)

    if (!parsedAmountA || !parsedAmountB) {
      console.error('Missing deposit amounts')
      return
    }

    setCreatePoolError(undefined)

    try {
      const poolOptions = InfinityStablePoolFactory.parsePoolFormParams(poolParams)

      const hash = await createInfinityStablePool({
        // NOTE: already check isEvm above, safe to cast
        tokenA: baseCurrency as Currency,
        tokenB: quoteCurrency as Currency,
        preset: poolParams.selectedPreset as any,
        assetTypes: [tokenAConfig.type, tokenBConfig.type],
        methodIds: [tokenAConfig.methodId, tokenBConfig.methodId],
        oracles: [tokenAConfig.oracleAddress, tokenBConfig.oracleAddress],
        amount0: parsedAmountA.quotient,
        amount1: parsedAmountB.quotient,
        ...poolOptions,
      })

      if (!hash) {
        throw new Error('Failed to create pool')
      }

      setTxHash(hash)
    } catch (error) {
      console.error('Failed to create pool:', error)
      setCreatePoolError(error instanceof Error ? error.message : 'Failed to create pool')
    }
  }, [poolParams, baseCurrency, quoteCurrency, createInfinityStablePool, tokenAConfig, tokenBConfig])

  const handleDismissConfirmation = useCallback(() => {
    setTxHash(undefined)
    setCreatePoolError(undefined)
  }, [])

  const handlePreviewPool = useCallback(
    (params: {
      selectedPreset?: string
      swapFee: string
      isAdvancedEnabled: boolean
      amplificationParam: string
      offpegFeeMultiplier: string
      movingAverageTime: string
      depositAmountA: string
      depositAmountB: string
    }) => {
      setPoolParams(params)
    },
    [],
  )

  const [onPresentAddLiquidityModal] = useModal(
    isEvm(baseCurrency?.chainId) && isEvm(quoteCurrency?.chainId) && poolParams ? (
      <CreatePoolPreviewModal
        isOpen
        onDismiss={() => {}}
        customOnDismiss={handleDismissConfirmation}
        tokenA={baseCurrency as Currency}
        tokenB={quoteCurrency as Currency}
        preset={poolParams.selectedPreset as any}
        swapFee={poolParams.swapFee}
        amplificationParam={poolParams.amplificationParam}
        offpegFeeMultiplier={poolParams.offpegFeeMultiplier}
        movingAverageTime={poolParams.movingAverageTime}
        depositAmountA={poolParams.depositAmountA}
        depositAmountB={poolParams.depositAmountB}
        onCreatePool={handleCreatePool}
        attemptingTxn={attemptingTxn || isConfirming}
        hash={txHash}
        errorMessage={createPoolError}
      />
    ) : (
      <div />
    ),
    true,
    true,
    'createPoolPreviewModal',
  )

  return (
    <Grid gridTemplateColumns={['1fr', '1fr', '1fr', 'repeat(2, 1fr)']} style={{ gap: '24px' }}>
      <Card style={{ height: 'fit-content' }}>
        <CardBody>
          <AutoColumn gap="16px">
            <InfinityStableFieldSelectCurrencies />
            {isPriceDeviationTooHigh && (
              <Message variant="warning" mt="8px">
                <MessageText>
                  {t(
                    'The selected tokens have a price difference of %deviation%%. Stable swap pools work best with tokens that maintain a 1:1 price ratio (less than 5% deviation). Using tokens with a larger price gap may result in losses.',
                    { deviation: (priceDeviation * 100).toFixed(0) },
                  )}
                </MessageText>
              </Message>
            )}
          </AutoColumn>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <ParamSettingSection
            onPreviewPool={(params) => {
              handlePreviewPool(params)
              onPresentAddLiquidityModal()
            }}
            attemptingTxn={attemptingTxn || isConfirming}
          />
        </CardBody>
      </Card>
    </Grid>
  )
}
