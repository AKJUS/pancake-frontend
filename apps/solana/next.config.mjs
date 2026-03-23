import { withSentryConfig } from '@sentry/nextjs'
import { createVanillaExtractPlugin } from '@vanilla-extract/next-plugin'
import path from 'path'

const withVanillaExtract = createVanillaExtractPlugin()

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  experimental: {
    scrollRestoration: true,
    fallbackNodePolyfills: false,
    optimizePackageImports: ['@pancakeswap/widgets-internal', '@pancakeswap/uikit']
  },
  compiler: {
    styledComponents: true
  },
  trailingSlash: true,
  transpilePackages: [
    '@pancakeswap/widgets-internal',
    '@pancakeswap/uikit',
    // https://github.com/TanStack/query/issues/6560#issuecomment-1975771676
    '@tanstack/query-core'
  ],
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve('./src')
    }
    config.optimization.minimize = true

    return config
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: 'https://pancakeswap.finance/swap?chain=sol',
        permanent: true
      },
      {
        source: '/swap/:path*',
        destination: 'https://pancakeswap.finance/swap?chain=sol',
        permanent: true
      }
    ]
  }
}

const sentryWebpackPluginOptions =
  process.env.VERCEL_ENV === 'production'
    ? {
        // Additional config options for the Sentry Webpack plugin. Keep in mind that
        // the following options are set automatically, and overriding them is not
        // recommended:
        //   release, url, org, project, authToken, configFile, stripPrefix,
        //   urlPrefix, include, ignore
        silent: true, // Logging when deploying to check if there is any problem
        validate: true,
        hideSourceMaps: false,
        tryRun: true,
        disable: true
        // https://github.com/getsentry/sentry-webpack-plugin#options.
      }
    : {
        hideSourceMaps: false,
        silent: true, // Suppresses all logs
        dryRun: !process.env.SENTRY_AUTH_TOKEN
      }

export default withVanillaExtract(withSentryConfig(nextConfig, sentryWebpackPluginOptions))
