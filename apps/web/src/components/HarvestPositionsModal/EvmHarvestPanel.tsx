import { Protocol } from '@pancakeswap/farms'
import { ChainId, chainNames, isEvm } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import { getTokenByAddress, CAKE } from '@pancakeswap/tokens'
import { Box, Button, CircleLoader, Dots, FlexGap, Message, MessageText, PreTitle, Text } from '@pancakeswap/uikit'
import { formatFiatNumber } from '@pancakeswap/utils/formatFiatNumber'
import { Tips } from '@pancakeswap/widgets-internal'
import { useCurrencyByChainId, useTokensByChainId } from 'hooks/Tokens'
import { useUnclaimedFarmRewardsUSDByTokenId } from 'hooks/infinity/useFarmReward'
import { useCakePrice } from 'hooks/useCakePrice'
import { useAtomValue } from 'jotai'
import dayjs from 'dayjs'
import { memo, useMemo } from 'react'
import { useAccount } from 'wagmi'
import type { Address } from 'viem'
import { useAccountActiveChain } from 'hooks/useAccountActiveChain'
import { useSwitchNetwork } from 'hooks/useSwitchNetwork'
import type {
  InfinityCLPositionDetail,
  PositionDetail,
  StableLPDetail,
  V2LPDetail,
} from 'state/farmsV4/state/accountPositions/type'
import { LinkText } from 'components/Liquidity/LinkText'
import { getFullChainNameById } from 'utils/getFullChainNameById'
import { safeGetAddress } from 'utils'
import { HarvestTxStatus, evmTxMapAtom, evmHarvestingAtom } from './state/atoms'
import { useEvmHarvestAll, type V2HarvestTarget } from './hooks/useEvmHarvestAll'
import type {
  V3HarvestPositionEnriched,
  InfinityHarvestPositionEnriched,
  V2StableHarvestEarningsByKey,
} from './hooks/useHarvestModalData'
import { PositionCard } from './shared/PositionCard'
import { VerticalList } from './shared/styles'
import { DEFAULT_EVM_CHAIN_ID } from './constants'

// --- Per-protocol row components ---

const V3HarvestRow = memo(function V3HarvestRow({
  item,
  txMap,
}: {
  item: V3HarvestPositionEnriched
  txMap: Record<string, { status?: HarvestTxStatus }>
}) {
  const { position, pendingCakeAmount, earningsUSD } = item
  // Match Infinity rows: resolve via on-chain metadata when tokens are not in the static list.
  const currency0 = useCurrencyByChainId(position.token0, position.chainId)
  const currency1 = useCurrencyByChainId(position.token1, position.chainId)
  const cake = CAKE[position.chainId as keyof typeof CAKE]
  // Batch harvest uses a single tx status key per chain (see useEvmHarvestAll).
  const txKey = `v3-${position.chainId}`

  if (currency0 === null || currency1 === null) return null
  if (!currency0 || !currency1) return null

  return (
    <PositionCard
      currency0={currency0}
      currency1={currency1}
      tokenId={String(position.tokenId)}
      earningsUSD={earningsUSD}
      rewards={cake ? [{ currency: cake, amount: pendingCakeAmount }] : []}
      protocol={Protocol.V3}
      status={txMap[txKey]?.status}
    />
  )
})

const InfinityHarvestRow = memo(function InfinityHarvestRow({
  item,
  txMap,
}: {
  item: InfinityHarvestPositionEnriched
  txMap: Record<string, { status?: HarvestTxStatus }>
}) {
  const { position } = item
  const { chainId } = position
  const currency0 = useCurrencyByChainId(position.poolKey?.currency0, chainId) ?? undefined
  const currency1 = useCurrencyByChainId(position.poolKey?.currency1, chainId) ?? undefined
  const cake = CAKE[chainId]
  const { address } = useAccount()
  // Use the same timestamp granularity as the positions table rows
  const hourTimestamp = useMemo(() => dayjs().startOf('hour').unix(), [])

  // Per-position unclaimed amount — mirrors InfinityCLPositionRow / InfinityBinPositionRow.
  // Passing tokenId for CLAMM (pool-specific snapshot per token); undefined for BIN (pool total).
  const clPositionId =
    position.protocol === Protocol.InfinityCLAMM ? (position as InfinityCLPositionDetail).tokenId : undefined
  const { data: unclaimedData } = useUnclaimedFarmRewardsUSDByTokenId({
    chainId,
    poolId: position.poolId,
    tokenId: clPositionId,
    address,
    timestamp: hourTimestamp,
  })

  const unclaimedCakeAmount = Number(unclaimedData?.rewardsAmount?.toExact() ?? 0)
  const unclaimedUSD = unclaimedData?.rewardsUSD ?? 0

  // All infinity positions on the same chain are claimed in a single tx (useEvmHarvestAll uses `infinity-${chainId}`)
  const txKey = `infinity-${chainId}`

  if (!currency0 || !currency1) return null
  // Hide positions whose rewards have all been claimed already
  if (unclaimedCakeAmount <= 0) return null

  return (
    <PositionCard
      currency0={currency0}
      currency1={currency1}
      tokenId={
        position.protocol === Protocol.InfinityCLAMM
          ? String((position as InfinityCLPositionDetail).tokenId)
          : undefined
      }
      earningsUSD={unclaimedUSD}
      rewards={cake ? [{ currency: cake, amount: unclaimedCakeAmount }] : []}
      protocol={position.protocol}
      status={txMap[txKey]?.status}
    />
  )
})

const V2HarvestRow = memo(function V2HarvestRow({
  position,
  txMap,
  v2StableEarningsByKey,
}: {
  position: V2LPDetail
  txMap: Record<string, { status?: HarvestTxStatus }>
  v2StableEarningsByKey: V2StableHarvestEarningsByKey
}) {
  const { chainId } = position.pair
  const cake = CAKE[chainId]
  const txKey = `v2-${position.pair?.liquidityToken?.address}`
  const { earningsUSD, pendingCakeAmount } = v2StableEarningsByKey[txKey] ?? {
    earningsUSD: 0,
    pendingCakeAmount: 0,
  }

  if (!position.pair?.token0 || !position.pair?.token1) return null

  return (
    <PositionCard
      currency0={position.pair.token0}
      currency1={position.pair.token1}
      earningsUSD={earningsUSD}
      rewards={cake ? [{ currency: cake, amount: pendingCakeAmount }] : []}
      protocol={Protocol.V2}
      status={txMap[txKey]?.status}
    />
  )
})

const StableHarvestRow = memo(function StableHarvestRow({
  position,
  txMap,
  v2StableEarningsByKey,
}: {
  position: StableLPDetail
  txMap: Record<string, { status?: HarvestTxStatus }>
  v2StableEarningsByKey: V2StableHarvestEarningsByKey
}) {
  const { chainId } = position.pair.liquidityToken
  const cake = CAKE[chainId]
  const lpAddress: string | undefined =
    (position as any).pair?.stableSwapAddress ?? position.pair?.liquidityToken?.address
  const txKey = `ss-${lpAddress}`
  const { earningsUSD, pendingCakeAmount } = v2StableEarningsByKey[txKey] ?? {
    earningsUSD: 0,
    pendingCakeAmount: 0,
  }

  if (!position.pair?.token0 || !position.pair?.token1) return null

  return (
    <PositionCard
      currency0={position.pair.token0}
      currency1={position.pair.token1}
      earningsUSD={earningsUSD}
      rewards={cake ? [{ currency: cake, amount: pendingCakeAmount }] : []}
      protocol={Protocol.STABLE}
      status={txMap[txKey]?.status}
    />
  )
})

// --- Panel ---

export interface EvmHarvestPanelProps {
  v3HarvestPositions: V3HarvestPositionEnriched[]
  infinityHarvestPositions: InfinityHarvestPositionEnriched[]
  v2Positions: V2LPDetail[]
  stablePositions: StableLPDetail[]
  v3StakedTokenIds: string[]
  v2Targets: V2HarvestTarget[]
  v2StableEarningsByKey: V2StableHarvestEarningsByKey
  /** Same as useHarvestModalData `effectiveEvmChainId` — Infinity totals + harvest calldata must use this chain. */
  harvestModalChainId: number
  otherChainsWithRewards?: number[]
  /** When true, hide the switch-network message until the other-chains scan finishes */
  otherChainsLoading?: boolean
  /** When true, some position/earnings data is still loading for the current chain */
  positionsLoading?: boolean
  onSwitchChain?: (chainId: number) => void
  /** When set, show a "Switch Network" button instead of "Harvest All" if the active chain differs */
  focusedChainId?: number
}

export function EvmHarvestPanel({
  v3HarvestPositions,
  infinityHarvestPositions,
  v2Positions,
  stablePositions,
  v3StakedTokenIds,
  v2Targets,
  v2StableEarningsByKey,
  harvestModalChainId,
  otherChainsWithRewards = [],
  otherChainsLoading = false,
  positionsLoading = false,
  onSwitchChain,
  focusedChainId,
}: EvmHarvestPanelProps) {
  const { t } = useTranslation()
  const { chainId: rawChainId, account: evmAccount } = useAccountActiveChain()
  const chainId = rawChainId && isEvm(rawChainId) ? rawChainId : DEFAULT_EVM_CHAIN_ID
  const isNonEvmChain = !rawChainId || !isEvm(rawChainId)
  const { switchNetwork, isLoading: isSwitching } = useSwitchNetwork()
  const txMap = useAtomValue(evmTxMapAtom)
  const harvesting = useAtomValue(evmHarvestingAtom)

  // Only pass targets with non-zero pending CAKE; avoids attempting harvests for positions
  // that have no rewards (which would fail on-chain and create phantom failures in the UI).
  const filteredV2Targets = useMemo(
    () => v2Targets.filter((t) => (v2StableEarningsByKey[t.key]?.pendingCakeAmount ?? 0) > 0),
    [v2Targets, v2StableEarningsByKey],
  )

  const {
    harvestAll,
    retryFailed,
    txCount,
    totalUnclaimedRewards,
    infinityHasRewards,
    infinityMerkleRootMismatch,
    hasInfinityRewards,
  } = useEvmHarvestAll({
    v3StakedTokenIds,
    v2Targets: filteredV2Targets,
    harvestModalChainId,
  })

  // Same safety gate as InfinityPositionActions (expanded panel Harvest button `disabled` prop).
  // Suppress Infinity rows when: merkle root is out of sync, no merkle payload exists, or
  // aggregate unclaimed rewards are zero — even if per-pool hooks report positive amounts.
  const infinityClaimable = infinityHasRewards && hasInfinityRewards && !infinityMerkleRootMismatch

  const hasStarted = useMemo(() => Object.keys(txMap).length > 0, [txMap])
  const allSucceeded = useMemo(
    () => hasStarted && Object.values(txMap).every((tx) => tx.status === HarvestTxStatus.Success),
    [txMap, hasStarted],
  )
  const failedCount = useMemo(
    () => Object.values(txMap).filter((tx) => tx.status === HarvestTxStatus.Failed).length,
    [txMap],
  )

  // When the modal was opened from a specific position whose chain differs from the active chain,
  // show a "Switch Network" prompt instead of "Harvest All".
  const isWrongChain = !isNonEvmChain && focusedChainId !== undefined && chainId !== focusedChainId

  // Use focusedChainId for the label when provided — data is fetched for that chain,
  // so the label should reflect what's actually being shown, not the wallet's active chain.
  const displayChainId = focusedChainId ?? chainId
  const chainName = chainNames[displayChainId] ?? ''
  const showEvmChainLabel = Boolean(chainName && evmAccount)

  // For Infinity: use totalUnclaimedRewards (on-chain-subtracted aggregate) × CAKE price,
  // which is the same source as InfinityHarvestModal and matches what MetaMask will actually claim.
  const cakePrice = useCakePrice()
  const infinityTotalUSD = useMemo(() => {
    if (!infinityClaimable) return 0
    if (!totalUnclaimedRewards?.length || !cakePrice.gt(0)) return 0
    const totalCAKE = totalUnclaimedRewards.reduce((acc, r) => acc + Number(r.totalReward), 0)
    return totalCAKE * Number(cakePrice.toString())
  }, [infinityClaimable, totalUnclaimedRewards, cakePrice])

  const v3TokenAddresses = useMemo(() => {
    const s = new Set<string>()
    for (const { position } of v3HarvestPositions) {
      if (position.token0) s.add(position.token0)
      if (position.token1) s.add(position.token1)
    }
    return [...s]
  }, [v3HarvestPositions])

  const v3TokensFetchChainId = v3HarvestPositions[0]?.position.chainId
  const v3TokensByAddress = useTokensByChainId(v3TokenAddresses, v3TokensFetchChainId)

  const totalEarningsUSD = useMemo(() => {
    const resolveV3Currency = (position: PositionDetail, tokenAddress: Address) => {
      const addr = safeGetAddress(tokenAddress)
      if (!addr) return undefined
      const fromBatch = v3TokensByAddress[addr]
      if (fromBatch === null) return null
      if (fromBatch) return fromBatch
      return getTokenByAddress(position.chainId, tokenAddress)
    }

    const v3Earnings = v3HarvestPositions.reduce((acc, item) => {
      const { position } = item
      const currency0 = resolveV3Currency(position, position.token0)
      const currency1 = resolveV3Currency(position, position.token1)
      if (currency0 === null || currency1 === null) return acc
      if (!currency0 || !currency1) return acc
      return acc + item.earningsUSD
    }, 0)

    let v2StableEarnings = 0
    for (const pos of v2Positions) {
      if (!pos.pair?.token0 || !pos.pair?.token1) continue
      const key = `v2-${pos.pair?.liquidityToken?.address}`
      v2StableEarnings += v2StableEarningsByKey[key]?.earningsUSD ?? 0
    }
    for (const pos of stablePositions) {
      if (!pos.pair?.token0 || !pos.pair?.token1) continue
      const lp: string | undefined = (pos as any).pair?.stableSwapAddress ?? pos.pair?.liquidityToken?.address
      const key = `ss-${lp}`
      v2StableEarnings += v2StableEarningsByKey[key]?.earningsUSD ?? 0
    }

    return infinityTotalUSD + v3Earnings + v2StableEarnings
  }, [infinityTotalUSD, v3HarvestPositions, v3TokensByAddress, v2Positions, stablePositions, v2StableEarningsByKey])

  // Flatten all positions into a single ordered list so we can determine isLast.
  // Known mismatches elsewhere: (1) Infinity rows here use cumulative API in the parent list while
  // InfinityHarvestRow hides positions with zero *unclaimed* rewards — some list keys can render no row.
  // (2) useHarvestModalData `evmTotalEarningsUSD` sums all V3 USD without token-resolution guards.
  // V3 is already pre-filtered to pendingCakeAmount > 0 in useHarvestModalData.
  // Apply the same treatment to V2/Stable: only include rows that have a non-zero entry in
  // v2StableEarningsByKey so that the "no rewards" empty state is consistent across protocols.
  const allRows = useMemo(
    () => [
      ...(infinityClaimable ? infinityHarvestPositions.map((item) => ({ type: 'infinity' as const, item })) : []),
      ...v3HarvestPositions.map((item) => ({ type: 'v3' as const, item })),
      ...v2Positions
        .filter((pos) => {
          const key = `v2-${pos.pair?.liquidityToken?.address}`
          return (v2StableEarningsByKey[key]?.pendingCakeAmount ?? 0) > 0
        })
        .map((pos) => ({ type: 'v2' as const, pos })),
      ...stablePositions
        .filter((pos) => {
          const lp: string | undefined = (pos as any).pair?.stableSwapAddress ?? pos.pair?.liquidityToken?.address
          const key = `ss-${lp}`
          return (v2StableEarningsByKey[key]?.pendingCakeAmount ?? 0) > 0
        })
        .map((pos) => ({ type: 'stable' as const, pos })),
    ],
    [
      infinityClaimable,
      infinityHarvestPositions,
      v3HarvestPositions,
      v2Positions,
      stablePositions,
      v2StableEarningsByKey,
    ],
  )

  const noRewards = allRows.length === 0
  const hasRows = allRows.length > 0

  return (
    <div style={{ fontVariantNumeric: 'tabular-nums' }}>
      <FlexGap justifyContent="space-between" alignItems="center" mb="12px">
        <PreTitle color="secondary">
          {t('EVM POSITIONS')}
          {showEvmChainLabel ? ` (${chainName.toUpperCase()})` : ''}
        </PreTitle>
        <Text bold fontSize="16px">
          {formatFiatNumber(totalEarningsUSD)}
        </Text>
      </FlexGap>

      {noRewards && !positionsLoading ? (
        <Text color="textSubtle" textAlign="center" py="16px" fontSize="14px">
          {t('No farm rewards to harvest on this chain')}
        </Text>
      ) : (
        <>
          {hasRows && (
            <VerticalList>
              {allRows.map((row) => {
                if (row.type === 'infinity') {
                  const { position } = row.item
                  const key =
                    position.protocol === Protocol.InfinityCLAMM
                      ? `infinity-${position.chainId}-${position.poolId}-${
                          (position as InfinityCLPositionDetail).tokenId
                        }`
                      : `infinity-${position.chainId}-${position.poolId}`
                  return <InfinityHarvestRow key={key} item={row.item} txMap={txMap} />
                }
                if (row.type === 'v3') {
                  return (
                    <V3HarvestRow
                      key={`v3-${row.item.position.chainId}-${row.item.position.tokenId}`}
                      item={row.item}
                      txMap={txMap}
                    />
                  )
                }
                if (row.type === 'v2') {
                  return (
                    <V2HarvestRow
                      key={`v2-${row.pos.pair?.liquidityToken?.address}`}
                      position={row.pos}
                      txMap={txMap}
                      v2StableEarningsByKey={v2StableEarningsByKey}
                    />
                  )
                }
                return (
                  <StableHarvestRow
                    key={`ss-${(row.pos as any).pair?.stableSwapAddress ?? row.pos.pair?.liquidityToken?.address}`}
                    position={row.pos}
                    txMap={txMap}
                    v2StableEarningsByKey={v2StableEarningsByKey}
                  />
                )
              })}
            </VerticalList>
          )}

          {positionsLoading && (
            <FlexGap alignItems="center" gap="12px" justifyContent="center" py={hasRows ? '12px' : '32px'}>
              <CircleLoader size="20px" />
              <Text color="textSubtle" fontSize="14px">
                <Dots>{t('Loading positions')}</Dots>
              </Text>
            </FlexGap>
          )}

          {!positionsLoading && !hasStarted && !isNonEvmChain && !isWrongChain && txCount > 1 && (
            <Box mt="8px">
              <Tips
                primaryMsg={t('You will need to confirm %count% transactions in your wallet', { count: txCount })}
              />
            </Box>
          )}

          {isNonEvmChain ? (
            <Button
              mt="12px"
              width="100%"
              variant="primary60Outline"
              disabled={isSwitching}
              onClick={() => switchNetwork(DEFAULT_EVM_CHAIN_ID)}
            >
              {t('Switch to %network%', { network: getFullChainNameById(DEFAULT_EVM_CHAIN_ID) })}
            </Button>
          ) : isWrongChain ? (
            <Button
              mt="12px"
              width="100%"
              variant="primary60Outline"
              disabled={isSwitching}
              onClick={() => onSwitchChain?.(focusedChainId!)}
            >
              {t('Switch to %network%', { network: getFullChainNameById(focusedChainId!) })}
            </Button>
          ) : (
            <>
              {!hasStarted && (
                <Button
                  mt="12px"
                  width="100%"
                  variant="primary60Outline"
                  disabled={harvesting || noRewards || positionsLoading}
                  onClick={harvestAll}
                >
                  {t('Harvest all')}
                </Button>
              )}

              {harvesting && !allSucceeded && (
                <Button mt="12px" width="100%" variant="primary60Outline" disabled>
                  {t('Harvesting')}
                </Button>
              )}

              {allSucceeded && (
                <Button mt="12px" width="100%" variant="primary60Outline" disabled>
                  {t('Harvested')}
                </Button>
              )}
            </>
          )}

          {failedCount > 0 && !harvesting && (
            <>
              <Button mt="12px" width="100%" variant="primary60Outline" onClick={retryFailed}>
                {t('Retry')}
              </Button>
              <Message variant="warning60" mt="12px">
                <MessageText>
                  {failedCount === 1
                    ? t('An error occurred during the harvest, please try again')
                    : t('%count% harvests failed, please try again', { count: failedCount })}
                </MessageText>
              </Message>
            </>
          )}
        </>
      )}

      {!otherChainsLoading && otherChainsWithRewards.length > 0 && (
        <Message variant="primary" mt="12px">
          <MessageText>
            {t('You also have earnings on ')}{' '}
            {otherChainsWithRewards.map((cId, idx) => (
              <LinkText
                key={cId}
                as="span"
                fontSize="14px"
                bold
                color="primary60"
                style={{ cursor: 'pointer' }}
                onClick={() => onSwitchChain?.(cId)}
              >
                {chainNames[cId]?.toUpperCase()}
                {idx < otherChainsWithRewards.length - 1 ? ', ' : ''}
              </LinkText>
            ))}
            {'. '}
            {t('Switch network to harvest.')}
          </MessageText>
        </Message>
      )}
    </div>
  )
}
