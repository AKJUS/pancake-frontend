import { useQuery } from '@tanstack/react-query'
import { QUERY_SETTINGS_IMMUTABLE } from 'config/constants'
import { useCurrency } from 'hooks/Tokens'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { getViemClients } from 'utils/viem'
import { zeroAddress } from 'viem'
import { isAddressEqual } from 'utils'
import type { Address } from 'viem/accounts'
import { useIDOContract } from './useIDOContract'

type IDOAddresses = {
  lpToken0: Address
  lpToken1: Address | undefined
  offeringToken: Address
  adminAddress: Address
}

export const useIDOAddresses = () => {
  const { chainId } = useActiveChainId()
  const idoContract = useIDOContract()

  return useQuery({
    queryKey: ['idoAddresses', chainId],
    queryFn: async (): Promise<IDOAddresses> => {
      const publicClient = getViemClients({ chainId })
      if (!idoContract || !publicClient) throw new Error('IDO contract not found')

      const [lpToken0, lpToken1, offeringToken, adminAddress] = await publicClient.multicall({
        allowFailure: false,
        contracts: [
          {
            address: idoContract.address,
            abi: idoContract.abi,
            functionName: 'addresses',
            args: [0n],
          },
          {
            address: idoContract.address,
            abi: idoContract.abi,
            functionName: 'addresses',
            args: [1n],
          },
          {
            address: idoContract.address,
            abi: idoContract.abi,
            functionName: 'addresses',
            args: [2n],
          },
          {
            address: idoContract.address,
            abi: idoContract.abi,
            functionName: 'addresses',
            args: [3n],
          },
        ],
      })

      return {
        lpToken0,
        lpToken1: isAddressEqual(lpToken1, zeroAddress) ? undefined : lpToken1,
        offeringToken,
        adminAddress,
      }
    },
    enabled: !!idoContract,
    ...QUERY_SETTINGS_IMMUTABLE,
  })
}

export const useIDOCurrencies = () => {
  const { data: addresses } = useIDOAddresses()
  const stakeCurrency0 = useCurrency(addresses?.lpToken0)
  const stakeCurrency1 = useCurrency(addresses?.lpToken1)
  const offeringCurrency = useCurrency(addresses?.offeringToken)

  return {
    stakeCurrency0,
    stakeCurrency1,
    offeringCurrency,
  }
}
