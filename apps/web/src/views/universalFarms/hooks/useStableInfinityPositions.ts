import { INetworkProps, ITokenProps, toTokenValueByCurrency } from '@pancakeswap/widgets-internal'
import { POSITION_STATUS } from 'state/farmsV4/state/accountPositions/type'
import { useAccount } from 'wagmi'
import { useMemo } from 'react'
import { useAccountInfinityStablePositions } from 'state/farmsV4/state/accountPositions/hooks/useAccountInfinityStablePositions'

export const useStableInfinityPositions = ({
  selectedNetwork,
  selectedTokens,
  positionStatus,
  farmsOnly,
}: {
  selectedNetwork: INetworkProps['value']
  selectedTokens: ITokenProps['value']
  positionStatus: POSITION_STATUS
  farmsOnly: boolean
}) => {
  const { address: account } = useAccount()
  const { data: stablePositions, pending: stableLoading } = useAccountInfinityStablePositions(selectedNetwork, account)

  const filteredStablePositions = useMemo(
    () =>
      stablePositions.filter(
        (pos) =>
          selectedNetwork.includes(pos.pair.liquidityToken.chainId) &&
          (!selectedTokens?.length ||
            selectedTokens.some(
              (token) =>
                token === toTokenValueByCurrency(pos.pair.token0) || token === toTokenValueByCurrency(pos.pair.token1),
            )) &&
          [POSITION_STATUS.ALL, POSITION_STATUS.ACTIVE].includes(positionStatus) &&
          (!farmsOnly || (pos.isStaked && pos.farmingBalance.greaterThan(0))),
      ),
    [farmsOnly, selectedNetwork, selectedTokens, stablePositions, positionStatus],
  )

  return useMemo(
    () => ({
      stableLoading,
      stablePositions: filteredStablePositions,
    }),
    [stableLoading, filteredStablePositions],
  )
}
