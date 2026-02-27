import { expect, test } from 'vitest'
import * as exportedNameSpaces from './index'

test('exports', () => {
  expect(Object.keys(exportedNameSpaces)).toMatchInlineSnapshot(`
    [
      "InfinityMixedQuoterActions",
      "INFI_BIN_QUOTER_ADDRESSES",
      "INFI_CL_QUOTER_ADDRESSES",
      "INFI_MIXED_QUOTER_ADDRESSES",
      "EMPTY_FEE_PATH_PLACEHOLDER",
      "MIXED_ROUTE_QUOTER_ADDRESSES",
      "V3_QUOTER_ADDRESSES",
      "encodeRouteToPath",
      "isInfinityCLRoute",
      "isInfinityBinRoute",
      "isInfinityStableRoute",
      "isMixedRoute",
      "isInfinityMixedRoute",
      "isV3Route",
      "buildV3QuoteCall",
      "fetchV3Quote",
      "fetchQuotes",
    ]
  `)
})
