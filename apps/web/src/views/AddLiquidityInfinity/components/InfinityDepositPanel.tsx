import { Box, Card, CardBody } from '@pancakeswap/uikit'
import { PoolType } from '@kyberswap/pancake-liquidity-widgets'
import { ZAP_INFINITY_CL_SUPPORTED_CHAINS } from 'config/constants/zap'
import { ZapLiquidityWidget } from 'components/ZapLiquidityWidget'
import { usePoolKeyByPoolId } from 'hooks/infinity/usePoolKeyByPoolId'
import { useCurrencyByPoolId } from 'hooks/infinity/useCurrencyByPoolId'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useMemo } from 'react'
import { useCurrencyBalances } from 'state/wallet/hooks'
import { useInverted, useClRangeQueryState } from 'state/infinity/shared'
import styled from 'styled-components'
import { isAddressEqual } from 'utils'
import { Address, zeroAddress } from 'viem'
import { MevProtectToggle } from 'views/Mev/MevProtectToggle'
import { useAddDepositAmounts } from '../hooks/useAddDepositAmounts'
import { usePool } from '../hooks/usePool'
import { FieldAddDepositAmount } from './FieldAddDepositAmount'
import { SubmitButton } from './SubmitButton'

const StyledCard = styled(Card)`
  height: fit-content;
`

interface InfinityDepositPanelProps {
  poolId?: Address
  chainId?: number
}

export const InfinityDepositPanel = ({ poolId, chainId }: InfinityDepositPanelProps) => {
  // Base currencies from pool (not inverted)
  const { currency0: currency0Base, currency1: currency1Base } = useCurrencyByPoolId({ chainId, poolId })
  const [inverted] = useInverted()
  const { account } = useAccountActiveChain()

  // Pool data
  const pool = usePool<'CL'>()
  const { data: poolKey } = usePoolKeyByPoolId(poolId, chainId, 'CL')
  const [{ lowerTick, upperTick }] = useClRangeQueryState()
  const { inputValue0, inputValue1, depositCurrencyAmount0, depositCurrencyAmount1 } = useAddDepositAmounts()

  // Display currencies (inverted if needed for UI display)
  const currency0 = useMemo(() => (inverted ? currency1Base : currency0Base), [inverted, currency0Base, currency1Base])
  const currency1 = useMemo(() => (inverted ? currency0Base : currency1Base), [inverted, currency0Base, currency1Base])

  // Get balances for display currencies
  const [currency0Balance, currency1Balance] = useCurrencyBalances(
    account ?? undefined,
    useMemo(() => [currency0, currency1], [currency0, currency1]),
  )

  // Display amounts (inverted if needed to match display currencies)
  const displayInputValue0 = useMemo(() => (inverted ? inputValue1 : inputValue0), [inverted, inputValue0, inputValue1])
  const displayInputValue1 = useMemo(() => (inverted ? inputValue0 : inputValue1), [inverted, inputValue0, inputValue1])

  // Check if user has insufficient balance for either token
  const hasInsufficientBalance = useMemo(() => {
    if (!currency0Balance || !currency1Balance) return false

    // Compare display balances with deposit amounts (adjusting for inversion)
    const amount0ToCheck = inverted ? depositCurrencyAmount1 : depositCurrencyAmount0
    const amount1ToCheck = inverted ? depositCurrencyAmount0 : depositCurrencyAmount1

    return (
      (amount0ToCheck && currency0Balance.lessThan(amount0ToCheck)) ||
      (amount1ToCheck && currency1Balance.lessThan(amount1ToCheck))
    )
  }, [currency0Balance, currency1Balance, depositCurrencyAmount0, depositCurrencyAmount1, inverted])

  // Check if pool has no hook (required for Zap)
  const hasNoHook = useMemo(() => {
    if (!poolKey) return false
    return !poolKey.hooks || isAddressEqual(poolKey.hooks, zeroAddress)
  }, [poolKey])

  // Show Zap widget only when all conditions are met
  const showZap = useMemo(() => {
    return (
      pool?.poolType === 'CL' &&
      hasNoHook &&
      hasInsufficientBalance &&
      lowerTick !== null &&
      upperTick !== null &&
      poolId &&
      chainId &&
      ZAP_INFINITY_CL_SUPPORTED_CHAINS.includes(chainId)
    )
  }, [pool, hasNoHook, hasInsufficientBalance, lowerTick, upperTick, poolId, chainId])

  return (
    <StyledCard>
      <CardBody>
        {showZap && (
          <Box mb="16px">
            <ZapLiquidityWidget
              poolId={poolId}
              poolType={PoolType.DEX_PANCAKE_INFINITY_CL}
              tickLower={lowerTick ?? undefined}
              tickUpper={upperTick ?? undefined}
              baseCurrency={currency0}
              baseCurrencyAmount={displayInputValue0}
              quoteCurrency={currency1}
              quoteCurrencyAmount={displayInputValue1}
            />
          </Box>
        )}
        <FieldAddDepositAmount baseCurrency={currency0} quoteCurrency={currency1} />
        <Box mt="16px">
          <MevProtectToggle size="sm" />
        </Box>
        <SubmitButton mt="16px" />
      </CardBody>
    </StyledCard>
  )
}
