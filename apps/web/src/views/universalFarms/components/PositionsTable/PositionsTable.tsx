import { Flex, Text } from '@pancakeswap/uikit'
import { UnifiedPositionDetail, V2LPDetail, StableLPDetail } from 'state/farmsV4/state/accountPositions/type'
import { Protocol } from '@pancakeswap/farms'
import styled from 'styled-components'
import { useTranslation } from '@pancakeswap/localization'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { useSelectedProtocols } from '../PoolsFilterPanel'
import { PositionTableRow } from './PositionTableRow'
import { getPositionChainId } from '../../utils'
import { getPositionKey } from '../../utils/getPositionKey'

type PositionsTableProps = {
  positions: UnifiedPositionDetail[]
  poolLengthMap?: Record<number, number>
}

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  background: ${({ theme }) => theme.card.background};
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  border-radius: 20px;
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: ${({ theme }) => theme.card.background};
`

const TableHeader = styled.thead`
  border-bottom: 1px solid ${({ theme }) => theme.colors.cardBorder};
`

const HeaderRow = styled.tr``

const HeaderCell = styled.th<{ align?: 'left' | 'center' | 'right'; width?: string }>`
  padding: 20px 16px;
  text-align: ${({ align }) => align || 'left'};
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.secondary};
  text-transform: uppercase;
  width: ${({ width }) => width || 'auto'};

  &:first-child {
    padding-left: 24px;
  }

  &:last-child {
    padding-right: 24px;
  }
`

const TableBody = styled.tbody``

export const PositionsTable: React.FC<PositionsTableProps> = ({ positions, poolLengthMap }) => {
  const { t } = useTranslation()
  const router = useRouter()

  // Read type query parameter directly from URL and map to Protocol enum (computed once for all rows)
  const { type: typeParam } = router.query
  const typeIndex = useMemo(
    () => (typeParam ? Number(Array.isArray(typeParam) ? typeParam[0] : typeParam) : 0),
    [typeParam],
  )
  const selectedProtocols = useSelectedProtocols(typeIndex)

  // Hide earnings column when filtering to only V2 or only StableSwap (computed once for all rows)
  const hideEarningsColumn = useMemo(
    () =>
      selectedProtocols.length === 1 &&
      (selectedProtocols[0] === Protocol.V2 || selectedProtocols[0] === Protocol.STABLE),
    [selectedProtocols],
  )

  if (!positions.length) {
    return (
      <Flex justifyContent="center" p="40px">
        <Text color="textSubtle">{t('No positions found')}</Text>
      </Flex>
    )
  }

  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <HeaderRow>
            <HeaderCell>
              {t('Position')} ({positions.length})
            </HeaderCell>
            <HeaderCell align="left">{t('Price Range (Min/Max)')}</HeaderCell>
            <HeaderCell align="right">{t('Liquidity')}</HeaderCell>
            {!hideEarningsColumn && <HeaderCell align="right">{t('Earnings')}</HeaderCell>}
            <HeaderCell align="right">{t('APR')}</HeaderCell>
            <HeaderCell align="right" />
          </HeaderRow>
        </TableHeader>
        <TableBody>
          {positions.map((position) => {
            const chainId = getPositionChainId(position)
            const positionKey = getPositionKey(position)

            return (
              <PositionTableRow
                key={`${chainId}-${position.protocol}-${positionKey}`}
                position={position}
                poolLength={poolLengthMap?.[chainId]}
                hideEarningsColumn={hideEarningsColumn}
              />
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
