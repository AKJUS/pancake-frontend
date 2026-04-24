import { Box } from '@pancakeswap/uikit'
import { FeeAmount } from '@pancakeswap/v3-sdk'
import { useEffect, useMemo } from 'react'
import { useAtom } from 'jotai'
import { styled } from 'styled-components'
import { usePreviousValue } from '@pancakeswap/hooks'
import { useUnifiedCurrency } from 'hooks/Tokens'
import AddLiquidity from 'views/AddLiquidity'
import AddStableLiquidity from 'views/AddLiquidity/AddStableLiquidity'
import useWarningLiquidity from 'views/AddLiquidity/hooks/useWarningLiquidity'
import useStableConfig, { StableConfigContext } from 'views/Swap/hooks/useStableConfig'
import { resetMintState } from 'state/mint/actions'
import { useAddLiquidityV2FormDispatch } from 'state/mint/reducer'
import { isSolana } from '@pancakeswap/chains'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { Currency } from '@pancakeswap/swap-sdk-core'

import StableFormView from '../formViews/StableFormView'
import V2FormView from '../formViews/V2FormView'
import V3FormView from '../formViews/V3FormView'
import { SELECTOR_TYPE } from '../types'
import { SolanaFormView } from '../formViews/SolanaFormView/SolanaFormView'
import { useFeeAmountFromQuery } from '../hooks/useCurrencyParams'
import { selectTypeAtom } from './AddEVMLiquidityV3Layout'

/* two-column layout where DepositAmount is moved at the very end on mobile. */
export const ResponsiveTwoColumns = styled.div<{ $singleColumn?: boolean }>`
  display: grid;
  grid-column-gap: 32px;
  grid-row-gap: 16px;
  grid-template-columns: 1fr;

  grid-template-rows: max-content;
  grid-auto-flow: row;

  ${({ theme }) => theme.mediaQueries.md} {
    grid-template-columns: ${({ $singleColumn }) => ($singleColumn ? '1fr' : '3fr 2fr')};
  }
`

interface UniversalAddLiquidityPropsType {
  currencyIdA?: string
  currencyIdB?: string
  preferredSelectType?: SELECTOR_TYPE
  preferredFeeAmount?: FeeAmount
}

export function UniversalAddLiquidity({
  currencyIdA,
  currencyIdB,
  preferredSelectType,
  preferredFeeAmount,
}: UniversalAddLiquidityPropsType) {
  const dispatch = useAddLiquidityV2FormDispatch()
  const { chainId } = useAccountActiveChain()

  // Reset form state whenever the pool (currency pair) changes so amounts from
  // the previous pool don't persist when navigating to a new one via
  // MiniUniversalFarmsOverlay or currency selectors.
  useEffect(() => {
    dispatch(resetMintState())
  }, [dispatch, currencyIdA, currencyIdB])

  const baseCurrency = useUnifiedCurrency(currencyIdA)
  const currencyB = useUnifiedCurrency(currencyIdB)
  const evmBase: Currency | undefined =
    baseCurrency && !isSolana(baseCurrency.chainId) ? (baseCurrency as any) : undefined
  const evmQuote: Currency | undefined = currencyB && !isSolana(currencyB.chainId) ? (currencyB as any) : undefined
  useWarningLiquidity(currencyIdA, currencyIdB)

  const stableConfig = useStableConfig({
    tokenA: evmBase,
    tokenB: evmQuote,
  })

  const quoteCurrency =
    baseCurrency && currencyB && baseCurrency.wrapped.equals(currencyB.wrapped) ? undefined : currencyB

  const feeAmountFromUrl = useFeeAmountFromQuery()
  const feeAmount: FeeAmount | undefined = useMemo(
    () => preferredFeeAmount || feeAmountFromUrl,
    [preferredFeeAmount, feeAmountFromUrl],
  )

  const [selectorType, setSelectorType] = useAtom(selectTypeAtom)

  const prevPreferredSelectType = usePreviousValue(preferredSelectType)

  useEffect(() => {
    if (!currencyIdA || !currencyIdB) return

    if (selectorType === SELECTOR_TYPE.V3 && preferredSelectType === SELECTOR_TYPE.V3) {
      return
    }

    if (preferredSelectType === SELECTOR_TYPE.STABLE && stableConfig.stableSwapConfig) {
      setSelectorType(SELECTOR_TYPE.STABLE)
    } else {
      setSelectorType(preferredSelectType || SELECTOR_TYPE.V3)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currencyIdA,
    currencyIdB,
    preferredSelectType,
    prevPreferredSelectType,
    setSelectorType,
    stableConfig.stableSwapConfig,
  ])

  return (
    <>
      <Box mt="24px">
        <ResponsiveTwoColumns
          $singleColumn={selectorType === SELECTOR_TYPE.V2 || selectorType === SELECTOR_TYPE.STABLE}
        >
          {selectorType === SELECTOR_TYPE.V3 &&
            (isSolana(chainId) ? (
              <SolanaFormView
                feeAmount={feeAmount}
                baseCurrency={baseCurrency}
                quoteCurrency={quoteCurrency}
                currencyIdA={currencyIdA}
                currencyIdB={currencyIdB}
              />
            ) : (
              <V3FormView
                feeAmount={feeAmount}
                baseCurrency={evmBase}
                quoteCurrency={evmQuote}
                currencyIdA={currencyIdA}
                currencyIdB={currencyIdB}
              />
            ))}
          {selectorType === SELECTOR_TYPE.V2 && (
            <AddLiquidity currencyA={evmBase} currencyB={evmQuote}>
              {(props) => <V2FormView {...props} />}
            </AddLiquidity>
          )}
          {selectorType === SELECTOR_TYPE.STABLE && (
            <StableConfigContext.Provider value={stableConfig}>
              <AddStableLiquidity currencyA={evmBase} currencyB={evmQuote}>
                {(props) => (
                  <StableFormView {...props} stableTotalFee={stableConfig?.stableSwapConfig?.stableTotalFee} />
                )}
              </AddStableLiquidity>
            </StableConfigContext.Provider>
          )}
        </ResponsiveTwoColumns>
      </Box>
    </>
  )
}
