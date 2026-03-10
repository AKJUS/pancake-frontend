import { useTranslation } from '@pancakeswap/localization'
import { Box, LinkExternal, Text, useTooltip } from '@pancakeswap/uikit'
import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import { formatAmount } from '@pancakeswap/utils/formatInfoNumbers'
import { NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'
import BigNumber from 'bignumber.js'
import { getChainId } from 'config/chains'
import { ASSET_CDN } from 'config/constants/endpoints'
import { useIncentraInfo } from 'hooks/useIncentra'
import { useEffect, useMemo } from 'react'
import { usePoolApr, usePoolInfo } from 'state/farmsV4/hooks'
import { ChainIdAddressKey } from 'state/farmsV4/state/type'
import styled from 'styled-components'
import { useMyPositions } from 'views/PoolDetail/components/MyPositionsContext'
import { sumApr } from 'views/universalFarms/utils/sumApr'
import { logPancakePicksClickEvent } from 'utils/customGTMEventTracking'
import { AdTag } from '../AdTag'
import { BodyText } from '../BodyText'
import { AdCard } from '../Card'
import { PickBaseCoin } from '../PickBaseCoin'
import { PickConfig } from '../ads.types'

const usePicksData = (poolId: `0x{string}`, chain: string) => {
  const chainId = getChainId(chain)!
  const pool = usePoolInfo({ poolAddress: poolId, chainId }) || null

  const key = useMemo<ChainIdAddressKey | null>(() => {
    return pool ? `${pool.chainId}:${pool.lpAddress}` : null
  }, [pool])

  const { lpApr, cakeApr, merklApr } = usePoolApr(key, pool, true)
  const { incentraApr } = useIncentraInfo(pool?.lpAddress)

  const numerator = useMemo(() => {
    if (!pool || !cakeApr) return BIG_ZERO // Default value if pool or cakeApr is missing
    return new BigNumber(lpApr).times(cakeApr?.userTvlUsd ?? BIG_ZERO)
  }, [lpApr, cakeApr, pool])

  const denominator = useMemo(() => {
    return cakeApr?.userTvlUsd ?? BIG_ZERO
  }, [cakeApr?.userTvlUsd])

  const { updateTotalApr } = useMyPositions()

  useEffect(() => {
    if (pool && key) {
      updateTotalApr(key, numerator, denominator)
    }
  }, [cakeApr, denominator, key, lpApr, merklApr, numerator, pool, updateTotalApr])

  if (!pool) {
    return null
  }

  const total = sumApr(lpApr, cakeApr.value, merklApr, incentraApr)
  const fee = pool.feeTier
  const tvl = pool.tvlUsd
  return {
    pickData: {
      apr: total,
      fee: Number(fee) / 10000,
      tvl,
    },
    pool,
  }
}

export const AdPicks = ({ config, index }: { config: PickConfig; index: number }) => {
  const { poolId, chain, token0, token1 } = config
  const { t } = useTranslation()
  const data = usePicksData(poolId, chain)
  const { tooltip, targetRef, tooltipVisible } = useTooltip(<AdPicksTooltip />)
  const chainId = getChainId(chain)

  if (!data) {
    return null
  }

  const { pickData } = data
  const { fee, apr, tvl } = pickData
  const tvlAmt = formatAmount(Number(tvl || '0'))

  return (
    <div
      style={{
        position: 'relative',
      }}
    >
      <PickBaseCoin
        chain={chain}
        id={`${index}-0`}
        color={token0.color}
        top="-9px"
        right="61px"
        tokenAddress={token0.address}
      />
      <PickBaseCoin
        chain={chain}
        id={`${index}-1`}
        color={token1.color}
        top="29px"
        right="9px"
        tokenAddress={token1.address}
      />
      <ChainImage src={`${ASSET_CDN}/web/chains/v2/${chainId}.png`} />
      <AdCard isExpanded style={{ padding: '16px' }} isDismissible={false}>
        <BodyText mb="0">
          <Text
            fontSize="inherit"
            as="span"
            color="secondary"
            bold
            ref={targetRef}
            style={{
              cursor: 'pointer',
            }}
          >
            {t('PANCAKE PICKS')} #{index + 1} 🔥
          </Text>
          {tooltipVisible && tooltip}
        </BodyText>
        <Box
          style={{
            marginTop: '14.5px',
          }}
        >
          <NextLinkFromReactRouter to={config.url}>
            <Text
              onClick={() => {
                logPancakePicksClickEvent(`${token0.symbol}/${token1.symbol}`)
              }}
              color="primary60"
            >
              {token0.symbol}/{token1.symbol}
            </Text>
          </NextLinkFromReactRouter>
        </Box>
        <Box
          display="flex"
          style={{
            marginTop: '14.5px',
          }}
        >
          <AdTag title="FEE TIER" value={`${fee}%`} index={0} />
          <AdTag title="APR" value={`${(100 * apr).toFixed(2)}%`} index={1} />
          <AdTag title="TVL" value={tvlAmt || '-'} index={2} />
        </Box>
      </AdCard>
    </div>
  )
}

const AdPicksTooltip = () => {
  const { t } = useTranslation()
  return (
    <>
      <Text>
        {t(
          'Pancake Picks are trending tokens from selected categories, filtered by meaningful metrics, and refreshed every weekday.',
        )}
      </Text>
      <LinkExternal href="https://docs.pancakeswap.finance/products/pancake-picks">
        {t('More Information')}
      </LinkExternal>
    </>
  )
}

const ChainImage = styled.img`
  position: absolute;
  bottom: 46px;
  right: 12px;
  z-index: 3;
  width: 24px;
  height: 24px;
`
