/* eslint-disable jsx-a11y/iframe-has-title */
import { FARMS_API } from 'config/constants/endpoints'
import Document, { DocumentContext, Head, Html, Main, NextScript } from 'next/document'
import { ServerStyleSheet } from 'styled-components'

const CAKEPAD_HOST = 'cakepad.pancakeswap.finance'
const PANCAKESWAP_HOST = 'pancakeswap.finance'
const BASE_APP_ID_BY_HOST: Record<string, string> = {
  [CAKEPAD_HOST]: '698194b61672d70694e293ea',
  [PANCAKESWAP_HOST]: '69bcf00a8d299162030cdffd',
}
const MINI_APP_EMBED_BY_HOST: Record<string, string> = {
  [CAKEPAD_HOST]: JSON.stringify({
    version: '1',
    imageUrl: 'https://assets.pancakeswap.finance/web/og/ifo.jpg',
    button: {
      title: 'Open Cakepad',
      action: {
        type: 'launch_frame',
        name: 'Cakepad (CAKE.PAD)',
        url: 'https://cakepad.pancakeswap.finance',
        splashImageUrl: 'https://pancakeswap.finance/logo.png',
        splashBackgroundColor: '#0f1220',
      },
    },
  }),
  [PANCAKESWAP_HOST]: JSON.stringify({
    version: '1',
    imageUrl: 'https://assets.pancakeswap.finance/web/og/v2/hero.jpg',
    button: {
      title: 'Open PancakeSwap',
      action: {
        type: 'launch_frame',
        name: 'PancakeSwap',
        url: 'https://pancakeswap.finance',
        splashImageUrl: 'https://pancakeswap.finance/logo.png',
        splashBackgroundColor: '#0f1220',
      },
    },
  }),
}

const normalizeHost = (host?: string | string[]) => (Array.isArray(host) ? host[0] : host)?.split(':')[0]?.toLowerCase()

type DocumentProps = {
  miniAppEmbedContent?: string
  baseAppIdMetaContent?: string
}

class MyDocument extends Document<DocumentProps> {
  static async getInitialProps(ctx: DocumentContext) {
    const sheet = new ServerStyleSheet()
    const originalRenderPage = ctx.renderPage

    try {
      // eslint-disable-next-line no-param-reassign
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => (props) => sheet.collectStyles(<App {...props} />),
        })

      const initialProps = await Document.getInitialProps(ctx)
      const host = normalizeHost(ctx.req?.headers['x-forwarded-host'] ?? ctx.req?.headers.host)
      const miniAppEmbedContent = host ? MINI_APP_EMBED_BY_HOST[host] : undefined
      const baseAppIdMetaContent = host ? BASE_APP_ID_BY_HOST[host] : undefined

      return {
        ...initialProps,
        miniAppEmbedContent,
        baseAppIdMetaContent,
        styles: (
          <>
            {initialProps.styles}
            {sheet.getStyleElement()}
          </>
        ),
      }
    } finally {
      sheet.seal()
    }
  }

  render() {
    return (
      <Html translate="no">
        <Head>
          {this.props.miniAppEmbedContent && <meta name="fc:miniapp" content={this.props.miniAppEmbedContent} />}
          {this.props.miniAppEmbedContent && <meta name="fc:frame" content={this.props.miniAppEmbedContent} />}
          {this.props.baseAppIdMetaContent && <meta name="base:app_id" content={this.props.baseAppIdMetaContent} />}
          {process.env.NEXT_PUBLIC_NODE_PRODUCTION && (
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_NODE_PRODUCTION} />
          )}
          <link rel="preconnect" href="https://fonts.gstatic.com" />
          <link rel="preconnect" href={FARMS_API} />
          <link
            href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;800&amp;display=swap"
            rel="stylesheet"
          />
          <link rel="shortcut icon" href="/favicon.ico" />
          <link rel="apple-touch-icon" href="/logo.png" />
          <link rel="manifest" href="/manifest.json" />
        </Head>
        <body>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${process.env.NEXT_PUBLIC_NEW_GTAG}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
          <Main />
          <NextScript />
          <div id="portal-root" />
        </body>
      </Html>
    )
  }
}

export default MyDocument
