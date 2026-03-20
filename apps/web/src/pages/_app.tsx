import { ResetCSS, ScrollToTopButtonV2, ToastListener } from '@pancakeswap/uikit'
import BigNumber from 'bignumber.js'
import { SentryErrorBoundary } from 'components/ErrorBoundary'
import GlobalCheckClaimStatus from 'components/GlobalCheckClaimStatus'
import { PageMeta } from 'components/Layout/Page'
import { SimpleStakingSunsetModal } from 'components/Modal/SimpleStakingSunsetModal'
import { NetworkModal } from 'components/NetworkModal'
import { FixedSubgraphHealthIndicator } from 'components/SubgraphHealthIndicator/FixedSubgraphHealthIndicator'
import TransactionsDetailModal from 'components/TransactionDetailModal'
import { VercelToolbar } from 'components/VercelToolbar'
import { useAccountEventListener } from 'hooks/useAccountEventListener'
import useEagerConnect from 'hooks/useEagerConnect'
import useLockedEndNotification from 'hooks/useLockedEndNotification'
import { useInitSolanaExplorer } from 'hooks/useInitSolanaExplorer'
import useSentryUser from 'hooks/useSentryUser'
import useThemeCookie from 'hooks/useThemeCookie'
import useUserAgent from 'hooks/useUserAgent'
import { DefaultSeo } from 'next-seo'
import NextApp, { type AppContext, type AppProps } from 'next/app'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import Script from 'next/script'
import { Fragment, Suspense, useCallback } from 'react'
import { useGlobalLinkHandler } from 'hooks/useGlobalLinkHandler'
import { PersistGate } from 'redux-persist/integration/react'

import { DesktopCard } from 'components/AdPanel/DesktopCard'
import { MobileCard } from 'components/AdPanel/MobileCard'
import { layoutDesktopAdIgnoredPages, layoutMobileAdIgnoredPages } from 'components/AdPanel/config'
import { shouldRenderOnPages } from 'components/AdPanel/renderConditions'
import { ZKSyncAirdropModalWithAutoPopup } from 'components/ClaimZksyncAirdropModal'
import { useEmbeddedSmartAccountConnectorV2 } from 'wallet/Privy/hooks/usePrivySmartAccountConnector'
import { useDataDogRUM } from 'hooks/useDataDogRUM'
import { useLoadExperimentalFeatures } from 'hooks/useExperimentalFeatureEnabled'
import useInitNotificationsClient from 'hooks/useInitNotificationsClient'
import { useWalletConnectRouterSync } from 'hooks/useWalletConnectRouterSync'
import { useWeb3WalletView } from 'hooks/useWeb3WalletView'
import { useInitGlobalWorker } from 'hooks/useWorker'
import { useSecurityBlocking } from 'hooks/useSecurityBlocking'
import { persistor, useStore } from 'state'
import { usePollBlockNumber } from 'state/block/hooks'
import WalletModalManager from 'components/WalletModalManager'
import { useAtom } from 'jotai'
import { walletModalVisibleAtom } from 'state/wallet/atom'
import { Blocklist, Updaters } from '..'
import { SEO } from '../../next-seo.config'
import Providers from '../Providers'
import Menu, { SharedComponentWithOutMenu } from '../components/Menu'
import GlobalStyle from '../style/Global'
import { NextPageWithLayout } from '../utils/page.types'
import { BASE_APP_ID_BY_HOST, MINI_APP_EMBED_BY_HOST, normalizeHost } from '../utils/domainMiniAppMeta'

// polyfills
import 'core-js/features/array/to-sorted'
import 'core-js/features/array/to-reversed'
import 'core-js/features/array/find-last'
import 'core-js/features/array/to-spliced'
import 'core-js/features/string/replace-all'
import 'utils/abortcontroller-polyfill'

const EasterEgg = dynamic(() => import('components/EasterEgg'), { ssr: false })

// This config is required for number formatting
BigNumber.config({
  EXPONENTIAL_AT: 1000,
  DECIMAL_PLACES: 80,
})

function GlobalHooks() {
  useInitGlobalWorker()
  useDataDogRUM()
  useWeb3WalletView()
  useLoadExperimentalFeatures()
  usePollBlockNumber()
  useEagerConnect()
  useUserAgent()
  useAccountEventListener()
  useSentryUser()
  useThemeCookie()
  useLockedEndNotification()
  useInitNotificationsClient()
  useWalletConnectRouterSync()
  useEmbeddedSmartAccountConnectorV2()
  useGlobalLinkHandler()
  useInitSolanaExplorer()
  return null
}

function MPGlobalHooks() {
  usePollBlockNumber()
  useUserAgent()
  useAccountEventListener()
  useSentryUser()
  useLockedEndNotification()
  useInitNotificationsClient()
  return null
}

const LoadVConsole = dynamic(() => import('components/vConsole'), { ssr: false })

type ExtendedPageProps = {
  initialReduxState: any
  dehydratedState: any
  appHost?: string
}

const DomainMiniAppMeta = ({ host }: { host?: string }) => {
  const miniAppEmbedContent = host ? MINI_APP_EMBED_BY_HOST[host] : undefined
  const baseAppIdMetaContent = host ? BASE_APP_ID_BY_HOST[host] : undefined

  if (!miniAppEmbedContent && !baseAppIdMetaContent) {
    return null
  }

  return (
    <>
      {miniAppEmbedContent && <meta name="fc:miniapp" content={miniAppEmbedContent} />}
      {miniAppEmbedContent && <meta name="fc:frame" content={miniAppEmbedContent} />}
      {baseAppIdMetaContent && <meta name="base:app_id" content={baseAppIdMetaContent} />}
    </>
  )
}

function MyApp(props: AppProps<ExtendedPageProps>) {
  const { pageProps, Component } = props
  const store = useStore(pageProps.initialReduxState)
  const appHost = pageProps.appHost ?? (typeof window !== 'undefined' ? normalizeHost(window.location.host) : undefined)

  return (
    <>
      <Head>
        <DomainMiniAppMeta host={appHost} />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5, minimum-scale=1, viewport-fit=cover"
        />
        <meta
          name="description"
          content="Cheaper and faster than Uniswap? Discover PancakeSwap, the leading DEX on BNB Smart Chain (BSC) with the best farms in DeFi and a lottery for CAKE."
        />
        <meta name="theme-color" content="#1FC7D4" />
      </Head>
      <DefaultSeo {...SEO} />
      {/* <LoadVConsole /> */}
      <Providers store={store} dehydratedState={pageProps.dehydratedState}>
        <ProductionErrorBoundary>
          <PageMeta />
          {(Component as NextPageWithLayout).Meta && (
            // @ts-ignore
            <Component.Meta {...pageProps} />
          )}
          <Suspense>
            <GlobalHooks />
          </Suspense>
          <ResetCSS />
          <GlobalStyle />
          <GlobalCheckClaimStatus excludeLocations={[]} />
          <PersistGate loading={null} persistor={persistor}>
            <Updaters />
            <App {...props} />
          </PersistGate>
        </ProductionErrorBoundary>
      </Providers>
      <Script
        strategy="afterInteractive"
        id="google-tag"
        dangerouslySetInnerHTML={{
          __html: `
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${process.env.NEXT_PUBLIC_NEW_GTAG}');
        `,
        }}
      />
    </>
  )
}

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}

const ProductionErrorBoundary = process.env.NODE_ENV === 'production' ? SentryErrorBoundary : Fragment

const App = ({ Component, pageProps }: AppPropsWithLayout) => {
  const blocking = useSecurityBlocking()
  const [isOpen, setIsOpen] = useAtom(walletModalVisibleAtom)

  const handleDismiss = useCallback(() => {
    setIsOpen(false)
  }, [setIsOpen])

  if (blocking) {
    return null
  }

  if (Component.pure) {
    return <Component {...pageProps} />
  }

  // Use the layout defined at the page level, if available
  const Layout = Component.Layout || Fragment
  const ShowMenu = Component.mp ? SharedComponentWithOutMenu : Menu
  const isShowScrollToTopButton = Component.isShowScrollToTopButton || true
  const shouldScreenWallet = Component.screen || false

  return (
    <Suspense>
      <ShowMenu>
        <Layout>
          <Component {...pageProps} />
          <MobileCard shouldRender={!shouldRenderOnPages(layoutMobileAdIgnoredPages)} mt="4px" mb="12px" />
          <DesktopCard shouldRender={!shouldRenderOnPages(layoutDesktopAdIgnoredPages)} />
        </Layout>
      </ShowMenu>
      <EasterEgg iterations={2} />
      <ToastListener />
      <FixedSubgraphHealthIndicator />
      <NetworkModal
        pageSupportedChains={Component.chains}
        forceMultipleNetworkModal={Component.forceMultipleNetworkModal}
      />
      <TransactionsDetailModal />
      {isShowScrollToTopButton && <ScrollToTopButtonV2 />}
      {shouldScreenWallet && <Blocklist />}
      <ZKSyncAirdropModalWithAutoPopup />
      <SimpleStakingSunsetModal />
      <VercelToolbar />
      <WalletModalManager isOpen={isOpen} onDismiss={handleDismiss} />
    </Suspense>
  )
}

MyApp.getInitialProps = async (appContext: AppContext) => {
  const appProps = await NextApp.getInitialProps(appContext)
  const host = normalizeHost(appContext.ctx.req?.headers['x-forwarded-host'] ?? appContext.ctx.req?.headers.host)

  return {
    ...appProps,
    pageProps: {
      ...appProps.pageProps,
      appHost: host,
    },
  }
}

export default MyApp
