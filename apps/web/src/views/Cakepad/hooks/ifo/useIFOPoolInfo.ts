import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { getViemClients } from 'utils/viem'
import { zeroAddress, type Address } from 'viem'
import { isAddressEqual } from 'utils'
import { useCurrency } from 'hooks/Tokens'
import { Currency, CurrencyAmount, Fraction } from '@pancakeswap/swap-sdk-core'
import { useAtomValue } from 'jotai'
import { ifoPoolsAtom } from 'views/Cakepad/atom/ifo.atoms'
import { useIfoV2Context } from 'views/Cakepad/contexts/useIfoV2Context'
import { CAKE } from '@pancakeswap/tokens'
import { ifoVersionAtom } from 'views/Cakepad/atom/ifoVersionAtom'
import { useIFOAddresses } from './useIFOAddresses'
import type { PoolInfo } from '../../ifov2.types'
import { mapToPoolInfo, type RawPoolInfo } from './mapToPoolInfo'

const TAX_RATE_PRECISION = 1_000_000_000_000n

export const useIFOPoolInfo = () => {
  const { config } = useIfoV2Context()
  const pools = useAtomValue(ifoPoolsAtom(config.id))
  return useMemo(() => pools ?? [], [pools])
}

export const useIFOPoolInfoCtx = (): PoolInfo[] => {
  const { config, ifoContract } = useIfoV2Context()
  const { chainId } = config
  const latestTxReceipt = useLatestTxReceipt()
  const { data: addresses } = useIFOAddresses()
  const stakeCurrency0 = useCurrency(addresses?.lpToken0, chainId)
  const stakeCurrency1 = useCurrency(addresses?.lpToken1, chainId)
  const offeringCurrency = useCurrency(addresses?.offeringToken, chainId)
  const cakeAddress = CAKE[chainId as keyof typeof CAKE]?.address ?? zeroAddress
  const version = useAtomValue(ifoVersionAtom)

  const { data } = useQuery({
    queryKey: ['ifoPoolInfo', chainId, addresses, latestTxReceipt, version, ifoContract?.address],
    queryFn: async (): Promise<{ raw: RawPoolInfo; taxRateRaw: bigint }[]> => {
      const publicClient = getViemClients({ chainId })
      if (!ifoContract || !publicClient || !addresses) throw new Error('IFO contract not found')

      const [infos, taxRates] = await Promise.all([
        publicClient.multicall({
          contracts: [
            {
              address: ifoContract.address,
              abi: ifoContract.abi,
              functionName: 'viewPoolInformation',
              args: [0n],
            },
            {
              address: ifoContract.address,
              abi: ifoContract.abi,
              functionName: 'viewPoolInformation',
              args: [1n],
            },
          ],
          allowFailure: false,
        }),
        publicClient.multicall({
          contracts: [
            {
              address: ifoContract.address,
              abi: ifoContract.abi,
              functionName: 'viewPoolTaxRateOverflow',
              args: [0n],
            },
            {
              address: ifoContract.address,
              abi: ifoContract.abi,
              functionName: 'viewPoolTaxRateOverflow',
              args: [1n],
            },
          ],
          allowFailure: false,
        }),
      ])

      return (infos as RawPoolInfo[]).map((info, idx) => ({
        raw: info,
        taxRateRaw: taxRates[idx] as bigint,
      }))
    },
    enabled: !!ifoContract && !!addresses,
  })

  return useMemo(() => {
    if (!data || !addresses) return []

    return data
      .map(({ raw, taxRateRaw }, idx) => {
        const poolToken = ((idx === 0 ? addresses.lpToken0 : addresses.lpToken1) ?? zeroAddress) as Address
        const stakeCurrency = (idx === 0 ? stakeCurrency0 : stakeCurrency1) as Currency
        const [raisingAmountPool, , , , totalAmountPool] = raw
        const feeTier = totalAmountPool < raisingAmountPool ? 0 : Number(taxRateRaw) / Number(TAX_RATE_PRECISION)
        const mapped = mapToPoolInfo({
          raw,
          pid: idx,
          poolToken,
          stakeCurrency,
          offeringCurrency: offeringCurrency as Currency,
          feeTier,
        })

        if (!mapped) return undefined

        const isCakePool = isAddressEqual(poolToken, cakeAddress as `0x${string}`)
        const estimatedCakeToBurn =
          isCakePool &&
          stakeCurrency &&
          taxRateRaw > 0n &&
          totalAmountPool > 0n &&
          mapped.raise !== undefined &&
          totalAmountPool >= mapped.raise.quotient
            ? CurrencyAmount.fromRawAmount(stakeCurrency, totalAmountPool)
                .subtract(mapped.raise)
                .multiply(new Fraction(taxRateRaw, TAX_RATE_PRECISION))
            : undefined

        return {
          ...mapped,
          isCakePool,
          estimatedCakeToBurn,
        } as PoolInfo
      })
      .filter((pool): pool is PoolInfo => Boolean(pool))
  }, [data, addresses, stakeCurrency0, stakeCurrency1, offeringCurrency, cakeAddress])
}
