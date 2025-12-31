import bundleAnalyzer from '@next/bundle-analyzer'

import { withWebSecurityHeaders } from '@pancakeswap/next-config/withWebSecurityHeaders'
import { createVanillaExtractPlugin } from '@vanilla-extract/next-plugin'
import { RetryChunkLoadPlugin } from 'webpack-retry-chunk-load-plugin'

const withVanillaExtract = createVanillaExtractPlugin()
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    tsconfigPath: 'tsconfig.json',
    ignoreBuildErrors: true
  },
  reactStrictMode: true,
  compiler: {
    styledComponents: true,
  },
  transpilePackages: [
    '@pancakeswap/localization',
    '@pancakeswap/hooks',
    '@pancakeswap/utils',
    '@pancakeswap/tokens',
    '@pancakeswap/farms',
    '@pancakeswap/widgets-internal',
    // https://github.com/TanStack/query/issues/6560#issuecomment-1975771676
    '@tanstack/query-core',
  ],
  experimental: {
    optimizePackageImports: ['@pancakeswap/widgets-internal', '@pancakeswap/uikit'],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/swap',
        permanent: false,
      },
    ]
  },
  webpack: (webpackConfig) => {
    webpackConfig.plugins.push(
        new RetryChunkLoadPlugin({
          cacheBust: `function() {
          return 'cache-bust=' + Date.now();
        }`,
          retryDelay: `function(retryAttempt) {
          return 2 ** (retryAttempt - 1) * 500;
        }`,
          maxRetries: 5,
        }),
    )
    return webpackConfig
  },
}

export default withBundleAnalyzer(withVanillaExtract(withWebSecurityHeaders(nextConfig)))
