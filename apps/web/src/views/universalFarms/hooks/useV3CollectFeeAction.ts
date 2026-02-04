import { Currency, CurrencyAmount } from '@pancakeswap/sdk'
import { MasterChefV3, NonfungiblePositionManager, Pool } from '@pancakeswap/v3-sdk'
import { useMasterchefV3, useV3NFTPositionManagerContract } from 'hooks/useContract'
import { useV3TokenIdsByAccount } from 'hooks/v3/useV3Positions'
import { useCallback, useState } from 'react'
import { useTransactionAdder } from 'state/transactions/hooks'
import { calculateGasMargin } from 'utils'
import { isUserRejected } from 'utils/sentry'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import { getViemClients } from 'utils/viem'
import { unwrappedToken } from 'utils/wrappedCurrency'
import { type Hex, hexToBigInt } from 'viem'
import { useAccount, useSendTransaction, useWalletClient } from 'wagmi'
import { useCheckShouldSwitchNetwork } from './useCheckShouldSwitchNetwork'

interface V3CollectFeeAction {
  attemptingTx: boolean
  isLoadingStakedPositions: boolean
  onCollect: (params: CollectFeeProps) => Promise<Hex | undefined>
}

type CollectFeeProps = {
  pool: Pool
  tokenId: bigint
  feeValue0?: CurrencyAmount<Currency>
  feeValue1?: CurrencyAmount<Currency>
  receiveWNATIVE?: boolean
}

const useV3CollectFeeAction = ({
  chainId,
  onDone,
}: {
  chainId: number | undefined
  onDone?: (hash: Hex) => void
}): V3CollectFeeAction => {
  const { address: account } = useAccount()
  const { data: signer } = useWalletClient()
  const { sendTransactionAsync } = useSendTransaction()
  const { switchNetworkIfNecessary, isLoading: isSwitchingNetwork } = useCheckShouldSwitchNetwork()
  const addTransaction = useTransactionAdder()

  const [attemptingTx, setAttemptingTx] = useState(false)

  const positionManager = useV3NFTPositionManagerContract({ chainId })
  const masterchefV3 = useMasterchefV3()
  const isMasterChefV3Available = Boolean(masterchefV3?.address && masterchefV3?.address !== '0x')

  const { tokenIds: stakedTokenIds, loading: tokenIdsInMCv3Loading } = useV3TokenIdsByAccount(
    isMasterChefV3Available ? masterchefV3?.address : undefined,
    account,
  )

  const onCollectFee = useCallback(
    async ({
      pool,
      tokenId,
      feeValue0,
      feeValue1,
      receiveWNATIVE = false,
    }: CollectFeeProps): Promise<Hex | undefined> => {
      if (!chainId || !account || !positionManager) return undefined

      const shouldSwitch = await switchNetworkIfNecessary(chainId)
      if (shouldSwitch) return undefined

      const isStakedInMCv3 = Boolean(stakedTokenIds.find((id) => id === tokenId))
      const manager = isStakedInMCv3 ? masterchefV3 : positionManager
      const interfaceManager = isStakedInMCv3 ? MasterChefV3 : NonfungiblePositionManager

      if (!manager) return undefined

      setAttemptingTx(true)

      try {
        // Determine currencies for fee collection
        const currency0ForFeeCollectionPurposes = receiveWNATIVE ? pool.token0 : unwrappedToken(pool.token0)!
        const currency1ForFeeCollectionPurposes = receiveWNATIVE ? pool.token1 : unwrappedToken(pool.token1)!

        // Build transaction parameters
        const { calldata, value } = interfaceManager.collectCallParameters({
          tokenId: tokenId.toString(),
          expectedCurrencyOwed0: feeValue0 ?? CurrencyAmount.fromRawAmount(currency0ForFeeCollectionPurposes, 0),
          expectedCurrencyOwed1: feeValue1 ?? CurrencyAmount.fromRawAmount(currency1ForFeeCollectionPurposes, 0),
          recipient: account,
        })

        const txn = {
          to: manager.address,
          data: calldata as Hex,
          value: hexToBigInt(value),
          account,
          chain: signer?.chain,
        }

        // Estimate gas and send transaction
        const estimate = await getViemClients({ chainId })?.estimateGas(txn)
        if (!estimate) throw new Error('Failed to estimate gas')

        const newTxn = {
          ...txn,
          gas: calculateGasMargin(estimate),
        }

        const hash = await sendTransactionAsync(newTxn)

        const amount0 = feeValue0 ?? CurrencyAmount.fromRawAmount(currency0ForFeeCollectionPurposes, 0)
        const amount1 = feeValue1 ?? CurrencyAmount.fromRawAmount(currency1ForFeeCollectionPurposes, 0)

        addTransaction(
          { hash },
          {
            type: 'collect-fee',
            summary: `Collect fee ${amount0.toExact()} ${
              currency0ForFeeCollectionPurposes?.symbol
            } and ${amount1.toExact()} ${currency1ForFeeCollectionPurposes?.symbol}`,
          },
        )

        onDone?.(hash)
        setAttemptingTx(false)
        return hash
      } catch (error: any) {
        console.error('[useV3CollectFeeAction] Error collecting fees:', error)
        setAttemptingTx(false)
        throw error
      }
    },
    [
      chainId,
      account,
      positionManager,
      switchNetworkIfNecessary,
      stakedTokenIds,
      masterchefV3,
      signer,
      sendTransactionAsync,
      addTransaction,
      onDone,
    ],
  )

  return {
    attemptingTx: attemptingTx || isSwitchingNetwork,
    isLoadingStakedPositions: tokenIdsInMCv3Loading,
    onCollect: onCollectFee,
  }
}

export default useV3CollectFeeAction
