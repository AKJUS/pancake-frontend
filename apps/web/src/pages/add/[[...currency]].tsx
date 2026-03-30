import { isStableFarm } from '@pancakeswap/farms'
import { useUnifiedCurrency } from 'hooks/Tokens'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { useFarmV2PublicAPI } from 'state/farms/hooks'
import { useFarmsV3Public } from 'state/farmsV3/hooks'
import { isAddressEqual } from 'utils'
import { NextPageWithLayout } from 'utils/page.types'
import { CHAIN_IDS } from 'utils/wagmi'
import AddLiquidityV2FormProvider from 'views/AddLiquidity/AddLiquidityV2FormProvider'
import { AddLiquidityV3Layout, UniversalAddLiquidity } from 'views/AddLiquidityV3'
import LiquidityFormProvider from 'views/AddLiquidityV3/formViews/V3FormView/form/LiquidityFormProvider'
import { useCurrencyParams } from 'views/AddLiquidityV3/hooks/useCurrencyParams'
import { SELECTOR_TYPE } from 'views/AddLiquidityV3/types'

const AddLiquidityPage = () => {
  const router = useRouter()

  // fetching farm api instead of using redux store here to avoid huge amount of actions and hooks needed
  const { data: farmsV2Public } = useFarmV2PublicAPI()
  const { data: farmV3Public } = useFarmsV3Public()

  const { currencyIdA, currencyIdB, feeAmount } = useCurrencyParams()

  const currencyA = useUnifiedCurrency(currencyIdA)
  const currencyB = useUnifiedCurrency(currencyIdB)

  // Initial prefer farm type if there is a farm for the pair
  const preferFarmType = useMemo(() => {
    if (!currencyA || !currencyB || !router.isReady) return undefined

    const hasV3Farm = farmV3Public?.farmsWithPrice.find(
      (farm) =>
        farm.multiplier !== '0X' &&
        ((farm.token.equals(currencyA.wrapped) && farm.quoteToken.equals(currencyB.wrapped)) ||
          (farm.quoteToken.equals(currencyA.wrapped) && farm.token.equals(currencyB.wrapped))),
    )
    if (hasV3Farm)
      return {
        type: SELECTOR_TYPE.V3,
        feeAmount: hasV3Farm.feeAmount,
      }

    const hasV2Farm = farmsV2Public?.find(
      (farm) =>
        farm.multiplier !== '0X' &&
        ((isAddressEqual(farm.token.address, currencyA.wrapped.address) &&
          isAddressEqual(farm.quoteToken.address, currencyB.wrapped.address)) ||
          (isAddressEqual(farm.token.address, currencyB.wrapped.address) &&
            isAddressEqual(farm.quoteToken.address, currencyA.wrapped.address))),
    )
    return hasV2Farm
      ? isStableFarm(hasV2Farm)
        ? { type: SELECTOR_TYPE.STABLE }
        : { type: SELECTOR_TYPE.V2 }
      : undefined
  }, [farmsV2Public, farmV3Public?.farmsWithPrice, currencyA, currencyB, router])

  if (router.isReady && currencyA?.wrapped && currencyB?.wrapped && currencyA.wrapped.equals(currencyB.wrapped)) {
    router.replace('/liquidity/select')
    return null
  }

  return (
    <AddLiquidityV2FormProvider>
      <LiquidityFormProvider>
        <AddLiquidityV3Layout>
          <UniversalAddLiquidity
            currencyIdA={currencyIdA}
            currencyIdB={currencyIdB}
            preferredSelectType={!feeAmount ? preferFarmType?.type : SELECTOR_TYPE.V3}
            preferredFeeAmount={!feeAmount ? preferFarmType?.feeAmount : undefined}
          />
        </AddLiquidityV3Layout>
      </LiquidityFormProvider>
    </AddLiquidityV2FormProvider>
  )
}

const Page = dynamic(() => Promise.resolve(AddLiquidityPage), { ssr: false }) as NextPageWithLayout

Page.chains = CHAIN_IDS
Page.screen = true

export default Page
