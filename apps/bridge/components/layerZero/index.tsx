import { Box, Flex } from '@pancakeswap/uikit'
import AptosBridgeFooter from 'components/layerZero/AptosBridgeFooter'
import { LayerZeroWidget } from 'components/layerZero/LayerZeroWidget'
import { FEE_COLLECTOR, FEE_TENTH_BPS, LAYER_ZERO_JS, PARTNER_ID } from 'components/layerZero/config'
import Script from 'next/script'
import { useEffect, useState } from 'react'
import { styled, useTheme } from 'styled-components'
import { PancakeSwapTheme } from './theme'
import { initializeAptosCompatAdapter } from './AptosCompatAdapter'

declare global {
  interface Window {
    app?: any
  }
}

const Page = styled(Box)`
  display: flex;
  height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.backgroundAlt};

  ${({ theme }) => theme.mediaQueries.sm} {
    min-height: 1000px;
    background: ${({ theme }) => theme.colors.gradientBubblegum};
  }
`

const LayerZero = ({ isCake }: { isCake?: boolean }) => {
  const theme = useTheme()
  const [show, setShow] = useState(false)

  useEffect(() => {
    initializeAptosCompatAdapter()
    let currencyInterval: any = null
    let cancelled = false

    customElements.whenDefined('lz-bridge').then((Bridge: any) => {
      if (cancelled) return

      const { createBasicTheme, bootstrap, uiStore } = Bridge

      if (!Bridge.initialized) {
        bootstrap({
          stargate: {
            partner: {
              partnerId: PARTNER_ID,
              feeCollector: FEE_COLLECTOR,
              feeBps: FEE_TENTH_BPS,
            },
          },
        })

        const newTheme = {
          dark: createBasicTheme(PancakeSwapTheme.dark),
          light: createBasicTheme(PancakeSwapTheme.light),
        }
        uiStore.theme.setConfig(newTheme)
      }

      if (isCake) {
        currencyInterval = setInterval(async () => {
          try {
            await customElements.whenDefined('lz-bridge')
            const app: any = customElements.get('lz-bridge')

            const rawCurrencies = app?.bridgeStore?.currencies
            const length = rawCurrencies?.length

            if (!Array.isArray(rawCurrencies) || length === 0) {
              return
            }

            clearInterval(currencyInterval)

            const currencies = rawCurrencies.slice()
            app.bridgeStore.currencies.length = 0

            const list = currencies.filter((i: any) => i?.symbol?.toUpperCase() === 'CAKE' && i?.chainId !== 158)
            app.bridgeStore.addCurrencies(list)

            const srcCake = app.bridgeStore.currencies.find(
              (i: any) => i?.symbol?.toUpperCase() === 'CAKE' && i?.chainId === 102,
            )
            app.bridgeStore.setSrcCurrency(srcCake)
          } catch (error) {
            console.error('Failed to load lz-bridge', error)
            clearInterval(currencyInterval)
          }
        }, 150)
      }

      setShow(true)
    })

    return () => {
      cancelled = true
      if (currencyInterval) clearInterval(currencyInterval)
    }
  }, [isCake])

  return (
    <Page>
      <Script type="module" crossOrigin="anonymous" src={LAYER_ZERO_JS.src} integrity={LAYER_ZERO_JS.integrity} />
      <link rel="stylesheet" href={`${LAYER_ZERO_JS.css}`} />
      {show && (
        <Box width={['100%', null, '420px']} m="auto">
          <Flex flexDirection="column" bg="backgroundAlt" borderRadius={[0, null, 24]} alignItems="center">
            <LayerZeroWidget theme={theme} />
            <Box display={['block', null, 'none']}>
              <AptosBridgeFooter isCake />
            </Box>
          </Flex>
          <Box display={['none', null, 'block']}>
            <AptosBridgeFooter isCake />
          </Box>
        </Box>
      )}
    </Page>
  )
}

export default LayerZero
