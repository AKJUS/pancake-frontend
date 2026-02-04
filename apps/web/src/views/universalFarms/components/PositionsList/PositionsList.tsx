import React from 'react'
import { Flex, Text } from '@pancakeswap/uikit'
import { UnifiedPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { useTranslation } from '@pancakeswap/localization'
import styled from 'styled-components'
import { PositionListCard } from './PositionListCard'
import { getPositionChainId } from '../../utils'
import { getPositionKey } from '../../utils/getPositionKey'

type PositionsListProps = {
  positions: UnifiedPositionDetail[]
  poolLengthMap?: Record<number, number>
}

const ListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const PositionsList: React.FC<PositionsListProps> = ({ positions, poolLengthMap }) => {
  const { t } = useTranslation()

  if (!positions.length) {
    return (
      <Flex justifyContent="center" p="40px">
        <Text color="textSubtle">{t('No positions found')}</Text>
      </Flex>
    )
  }

  return (
    <ListContainer>
      {positions.map((position) => {
        const chainId = getPositionChainId(position)
        const positionKey = getPositionKey(position)

        return (
          <PositionListCard
            key={`${chainId}-${position.protocol}-${positionKey}`}
            position={position}
            poolLength={poolLengthMap?.[chainId]}
          />
        )
      })}
    </ListContainer>
  )
}
