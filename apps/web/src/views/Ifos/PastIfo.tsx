import { Ifo } from '@pancakeswap/ifos'
import { CardHeader, Container } from '@pancakeswap/uikit'

import { useInActiveIfoConfigs } from 'hooks/useIfoConfig'

import HistoryIfos from 'views/Cakepad/HistoryIfos'
import { styled } from 'styled-components'
import { NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'
import { chainNames, isTestnetChainId } from '@pancakeswap/chains'
import { getBannerUrl } from './helpers'

const Header = styled(CardHeader)<{ ifoId: string }>`
  height: 112px;
  border-radius: 32px;
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  background-color: ${({ theme }) => theme.colors.dropdown};
  background-image: ${({ ifoId }) => `url('${getBannerUrl(ifoId)}')`};
`

const PastIfoCard = ({ ifo }: { ifo: Ifo }) => {
  return (
    <NextLinkFromReactRouter
      to={`https://legacy-zkevm.pancakeswap.finance/ifo/history?chain=${chainNames[ifo.chainId]}`}
      target="_blank"
      rel="noreferrer noopener"
    >
      <Header ifoId={ifo.id} />
    </NextLinkFromReactRouter>
  )
}

const PastIfo = ({ isV2, hideInactiveIfo }: { isV2?: boolean; hideInactiveIfo?: boolean }) => {
  const inactiveIfo = useInActiveIfoConfigs()

  return (
    <Container
      id="past-ifos"
      py={['24px', '24px', '40px']}
      maxWidth="736px"
      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
    >
      {isV2 && <HistoryIfos />}
      {!isV2 &&
        !hideInactiveIfo &&
        inactiveIfo
          ?.filter((ifo) => !isTestnetChainId(ifo.chainId))
          .map((ifo) => <PastIfoCard key={ifo.id} ifo={ifo} />)}
    </Container>
  )
}

export default PastIfo
