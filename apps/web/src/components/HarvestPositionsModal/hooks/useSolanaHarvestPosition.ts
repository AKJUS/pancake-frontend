import { useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { useQueryClient } from '@tanstack/react-query'
import { useHarvestRewardCallback } from 'hooks/solana/useHarvestRewardCallback'
import { SOLANA_POSITION_INFO_QUERY_KEY } from 'state/token/solanaPositionsInfo'
import type { SolanaHarvestTarget } from 'hooks/solana/useSolanaClmmHarvestAllRewards'

import { addSolanaOptimisticallyRemovedKeyAtom, HarvestTxStatus, setHarvestStatusAtom } from '../state/atoms'

export type { SolanaHarvestTarget }

/**
 * Per-position Solana harvest hook. Each SolanaPositionRow component instance
 * calls this with its own target so the hook can be invoked per-component.
 *
 * Uses `useHarvestRewardCallback` (decreaseLiquidity with zero liquidity) and
 * tracks status via the shared `harvestTxMapAtom`.
 */
export function useSolanaHarvestPosition(target: SolanaHarvestTarget | undefined) {
  const harvestReward = useHarvestRewardCallback()
  const setStatus = useSetAtom(setHarvestStatusAtom)
  const addOptimisticallyRemoved = useSetAtom(addSolanaOptimisticallyRemovedKeyAtom)
  const queryClient = useQueryClient()

  const harvest = useCallback(async () => {
    if (!target) return
    const { key, poolInfo, position } = target

    setStatus({ key, status: HarvestTxStatus.Pending })

    // `useRemoveLiquidityCallback` catches errors internally and calls onError
    // but resolves the promise instead of rethrowing. We use a ref flag to
    // distinguish success from handled failure after the await.
    const errorFired = { current: false }

    try {
      await harvestReward({
        params: { poolInfo, position },
        onSent: (txId) => setStatus({ key, status: HarvestTxStatus.Pending, hash: txId }),
        onError: (err) => {
          errorFired.current = true
          setStatus({ key, status: HarvestTxStatus.Failed, error: err?.message ?? 'Harvest failed' })
        },
      })

      if (!errorFired.current) {
        setStatus({ key, status: HarvestTxStatus.Success })

        // Optimistically hide the harvested position row immediately.
        addOptimisticallyRemoved(key)

        // Refetch in background; do not block the UI / render.
        Promise.all([
          queryClient.invalidateQueries({ queryKey: ['solana-v3-positions'], exact: false }),
          queryClient.invalidateQueries({ queryKey: ['solana-harvest-modal-reward'], exact: false }),
          queryClient.invalidateQueries({ queryKey: [SOLANA_POSITION_INFO_QUERY_KEY], exact: false }),
        ]).catch(() => undefined)
      }
    } catch (e) {
      if (!errorFired.current) {
        setStatus({
          key,
          status: HarvestTxStatus.Failed,
          error: e instanceof Error ? e.message : 'Harvest failed',
        })
      }
    }
  }, [target, harvestReward, setStatus, addOptimisticallyRemoved, queryClient])

  return { harvest }
}
