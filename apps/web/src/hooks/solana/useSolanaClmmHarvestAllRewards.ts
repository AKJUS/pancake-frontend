import { PancakeClmmProgramId } from '@pancakeswap/solana-clmm-sdk'
import { TxVersion } from '@pancakeswap/solana-core-sdk'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import useSolanaTxError from 'components/WalletModalV2/hooks/useSolanaTxError'
import { useSolanaPriorityFee } from 'components/WalletModalV2/hooks/useSolanaPriorityFee'
import { SOLANA_POSITION_INFO_QUERY_KEY } from 'state/token/solanaPositionsInfo'
import { SolanaV3PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { SolanaV3Pool } from 'state/pools/solana'

import { useRaydium } from './useRaydium'

export interface SolanaHarvestTarget {
  key: string
  position: SolanaV3PositionDetail
  poolInfo: SolanaV3Pool
}

/**
 * Batch CLMM harvest via `raydium.clmm.harvestAllRewards` (same primitive as apps/solana portfolio
 * and pool-detail "harvest all"). Does not pass `lockInfo` (locked positions not supported in web).
 */
export function useSolanaClmmHarvestAllRewards() {
  const raydium = useRaydium()
  const { computeBudgetConfig } = useSolanaPriorityFee()
  const { executeSolanaTransaction } = useSolanaTxError()
  const queryClient = useQueryClient()

  const executeHarvestAll = useCallback(
    async (targets: SolanaHarvestTarget[]) => {
      if (targets.length === 0) return
      if (!raydium) {
        throw new Error('Raydium not initialized')
      }

      const programId = PancakeClmmProgramId['mainnet-beta']
      const allPoolInfo: Record<string, SolanaV3Pool> = {}
      const allPositions: Record<string, SolanaV3PositionDetail[]> = {}

      for (const t of targets) {
        const pid = t.poolInfo.id
        if (!allPoolInfo[pid]) {
          allPoolInfo[pid] = t.poolInfo
        }
        if (!allPositions[pid]) {
          allPositions[pid] = []
        }
        allPositions[pid].push(t.position)
      }

      const buildData = await raydium.clmm.harvestAllRewards({
        allPoolInfo,
        allPositions,
        ownerInfo: { useSOLBalance: true },
        programId,
        computeBudgetConfig,
        txVersion: TxVersion.V0,
      })

      const run = async () => {
        const { txIds } = await buildData.execute({ sequentially: true })
        const hash = txIds[txIds.length - 1] ?? ''
        if (!hash) {
          throw new Error('Transaction failed to execute')
        }
        return { hash }
      }

      await executeSolanaTransaction(run, () => ({
        summary: 'Harvest all positions',
        type: 'collect-fee',
        translatableSummary: {
          text: 'Harvest all positions',
          data: {},
        },
      }))

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['solana-v3-positions'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['solana-harvest-modal-reward'], exact: false }),
        queryClient.invalidateQueries({ queryKey: [SOLANA_POSITION_INFO_QUERY_KEY], exact: false }),
      ])
    },
    [raydium, computeBudgetConfig, executeSolanaTransaction, queryClient],
  )

  return { executeHarvestAll }
}
