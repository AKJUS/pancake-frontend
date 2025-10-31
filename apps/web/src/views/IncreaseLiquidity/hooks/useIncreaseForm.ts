import { getPoolId, PoolKey } from '@pancakeswap/infinity-sdk'
import { Currency, CurrencyAmount, Percent } from '@pancakeswap/swap-sdk-core'
import { Position, Pool as V3Pool } from '@pancakeswap/v3-sdk'
import { usePoolById } from 'hooks/infinity/usePool'
import isUndefined from 'lodash/isUndefined'
import { useCallback, useMemo, useState } from 'react'
import { useCurrencyBalances } from 'state/wallet/hooks'
import tryParseCurrencyAmount from 'utils/tryParseCurrencyAmount'
import { useAccount } from 'wagmi'

export const useIncreaseForm = ({
  currency0,
  currency1,
  poolKey,
  tickLower,
  tickUpper,
  outOfRange,
  invalidRange,
}: {
  currency0: Currency | undefined
  currency1: Currency | undefined
  poolKey: PoolKey<'CL'> | undefined
  tickLower: number | undefined
  tickUpper: number | undefined
  outOfRange: boolean
  invalidRange: boolean
}) => {
  const poolId = useMemo(() => (poolKey ? getPoolId(poolKey) : undefined), [poolKey])
  const [lastEditCurrency, setLastEditCurrency] = useState<0 | 1>(0)
  const [, pool] = usePoolById(poolId)
  const [inputAmountRaw, setInputAmountRaw] = useState('')
  const [outputAmountRaw, setOutputAmountRaw] = useState('')

  const { address: account } = useAccount()
  const [inputBalance, outputBalance] = useCurrencyBalances(
    account,
    useMemo(() => [currency0, currency1], [currency0, currency1]),
  )

  const inputAmount: CurrencyAmount<Currency> | undefined = useMemo(() => {
    return tryParseCurrencyAmount(inputAmountRaw, currency0)
  }, [inputAmountRaw, currency0])

  const outputAmount: CurrencyAmount<Currency> | undefined = useMemo(() => {
    return tryParseCurrencyAmount(outputAmountRaw, currency1)
  }, [outputAmountRaw, currency1])

  const _updateOutputAmount = useCallback(
    (val: string) => {
      if (!pool || isUndefined(tickLower) || isUndefined(tickUpper)) return
      const pos = Position.fromAmount0({
        pool: pool as unknown as V3Pool,
        tickLower,
        tickUpper,
        amount0: tryParseCurrencyAmount(val, currency0)?.quotient ?? 0n,
        useFullPrecision: true,
      })
      const newAmount1 = pos.amount1.toSignificant(6)
      if (newAmount1 === outputAmountRaw) {
        return
      }
      setLastEditCurrency(1)
      if (!outOfRange) {
        setOutputAmountRaw(newAmount1)
      } else {
        setOutputAmountRaw('')
      }
    },
    [currency0, outputAmountRaw, pool, tickUpper, tickLower, outOfRange],
  )

  const _updateInputAmount = useCallback(
    (val: string) => {
      if (!pool || isUndefined(tickLower) || isUndefined(tickUpper)) return
      const pos = Position.fromAmount1({
        pool: pool as unknown as V3Pool,
        tickLower,
        tickUpper,
        amount1: tryParseCurrencyAmount(val, currency1)?.quotient ?? 0n,
      })
      const newAmount0 = pos.amount0.toSignificant(6)
      if (newAmount0 === inputAmountRaw) {
        return
      }
      setLastEditCurrency(0)
      if (!outOfRange) {
        setInputAmountRaw(newAmount0)
      } else {
        setInputAmountRaw('')
      }
    },
    [currency1, inputAmountRaw, pool, tickUpper, tickLower, outOfRange],
  )

  const onInputAmountChange = useCallback(
    (val: string) => {
      setInputAmountRaw(val)
      _updateOutputAmount(val)
    },
    [_updateOutputAmount],
  )

  const onOutputAmountChange = useCallback(
    (val: string) => {
      setOutputAmountRaw(val)
      _updateInputAmount(val)
    },
    [_updateInputAmount],
  )
  const onInputPercentChange = useCallback(
    (percent: number) => {
      onInputAmountChange(inputBalance?.multiply(new Percent(percent, 100))?.toExact() ?? '')
    },
    [inputBalance, onInputAmountChange],
  )

  const onOutputPercentChange = useCallback(
    (percent: number) => {
      onOutputAmountChange(outputBalance?.multiply(new Percent(percent, 100))?.toExact() ?? '')
    },
    [outputBalance, onOutputAmountChange],
  )

  return {
    inputBalance,
    outputBalance,
    inputAmountRaw,
    outputAmountRaw,
    inputAmount,
    outputAmount,
    onInputAmountChange,
    onOutputAmountChange,
    onInputPercentChange,
    onOutputPercentChange,
    lastEditCurrency,
  }
}
