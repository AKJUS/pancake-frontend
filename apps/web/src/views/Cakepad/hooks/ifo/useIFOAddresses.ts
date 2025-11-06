import { useQuery } from '@tanstack/react-query'
import { QUERY_SETTINGS_IMMUTABLE } from 'config/constants'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { getViemClients } from 'utils/viem'
import { zeroAddress } from 'viem'
import { isAddressEqual } from 'utils'
import type { Address } from 'viem/accounts'
import { useIfoV2Context } from 'views/Cakepad/contexts/useIfoV2Context'

export type IFOAddresses = {
  lpToken0: Address
  lpToken1: Address | undefined
  offeringToken: Address
  adminAddress: Address
}

export const useIFOAddresses = () => {
  const { chainId } = useActiveChainId()
  const { ifoContract } = useIfoV2Context()

  return useQuery({
    queryKey: ['ifoAddresses', chainId, ifoContract?.address],
    queryFn: async (): Promise<IFOAddresses> => {
      const publicClient = getViemClients({ chainId })
      if (!ifoContract || !publicClient) throw new Error('IFO contract not found')

      const [lpToken0, lpToken1, offeringToken, adminAddress] = await publicClient.multicall({
        allowFailure: false,
        contracts: [
          {
            address: ifoContract.address,
            abi: ifoContract.abi,
            functionName: 'addresses',
            args: [0n],
          },
          {
            address: ifoContract.address,
            abi: ifoContract.abi,
            functionName: 'addresses',
            args: [1n],
          },
          {
            address: ifoContract.address,
            abi: ifoContract.abi,
            functionName: 'addresses',
            args: [2n],
          },
          {
            address: ifoContract.address,
            abi: ifoContract.abi,
            functionName: 'addresses',
            args: [3n],
          },
        ],
      })

      return {
        lpToken0: lpToken0 as Address,
        lpToken1: isAddressEqual(lpToken1, zeroAddress) ? undefined : lpToken1,
        offeringToken,
        adminAddress,
      }
    },
    enabled: !!ifoContract,
    ...QUERY_SETTINGS_IMMUTABLE,
  })
}
