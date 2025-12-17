import { useTranslation } from '@pancakeswap/localization'
import { Card, CardBody, Button, Text, FlexGap } from '@pancakeswap/uikit'
import { NumberDisplay } from '@pancakeswap/widgets-internal'
import { Native } from '@pancakeswap/sdk'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { useMemo } from 'react'
import AddToWalletButton from 'components/AddToWallet/AddToWalletButton'
import useIfo from '../hooks/useIfo'

interface IfoAllocationCardProps {
  symbol: string
  tokenAddress: string
  tokenDecimals: number
  allocatedAmount?: string
}

export const IfoAllocationDisplay: React.FC<IfoAllocationCardProps> = ({
  symbol,
  tokenAddress,
  tokenDecimals,
  allocatedAmount,
}) => {
  const { t } = useTranslation()
  const { chainId } = useIfo()
  const amount = allocatedAmount ?? '0'

  const swapUrl = useMemo(() => {
    const chainQueryName = chainId ? CHAIN_QUERY_NAME[chainId] : 'bsc'
    const nativeCurrency = chainId ? Native.onChain(chainId) : Native.onChain(56) // Default to BSC if no chainId
    const nativeSymbol = nativeCurrency.symbol
    return `https://pancakeswap.finance/swap?chain=${chainQueryName}&inputCurrency=${tokenAddress}&outputCurrency=${nativeSymbol}`
  }, [chainId, tokenAddress])

  return (
    <FlexGap flexDirection="column">
      <Text textTransform="uppercase" color="textSubtle" bold small>
        {t('%symbol% allocated', { symbol })}
      </Text>

      <NumberDisplay value={amount} suffix={` ${symbol}`} fontSize="22px" bold />

      <FlexGap mt="16px" width="100%" gap="8px">
        <AddToWalletButton
          variant="primary60Outline"
          wrapperProps={{ flex: 1 }}
          tokenAddress={tokenAddress}
          showTooltip={false}
          tokenSymbol={symbol}
          tokenDecimals={tokenDecimals}
          endIcon={null}
          buttonText={t('View in Wallet')}
          showWalletIcon={false}
        />
        <Button
          rel="noopener noreferrer"
          width="100%"
          onClick={() => {
            window.open(swapUrl, '_blank', 'noopener,noreferrer')
          }}
          style={{
            flex: 1,
            padding: 0,
          }}
        >
          {t('Swap')} {symbol}
        </Button>
      </FlexGap>
    </FlexGap>
  )
}

export const IfoAllocationCard: React.FC<IfoAllocationCardProps> = (props) => {
  if (!Number(props.allocatedAmount)) {
    return null
  }

  return (
    <Card>
      <CardBody p="16px">
        <IfoAllocationDisplay {...props} />
      </CardBody>
    </Card>
  )
}
