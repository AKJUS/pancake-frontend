import { expect, test } from 'vitest'
import * as exportedNameSpaces from './index'

test('exports', () => {
  expect(Object.keys(exportedNameSpaces)).toMatchInlineSnapshot(`
    [
      "INFI_CL_POOL_TYPE",
      "INFI_BIN_POOL_TYPE",
      "INFI_STABLE_POOL_TYPE",
      "COST_PER_UNINIT_TICK",
      "BASE_SWAP_COST_V3",
      "COST_PER_INIT_TICK",
      "COST_PER_HOP_V3",
      "BASE_SWAP_COST_STABLE_SWAP",
      "COST_PER_EXTRA_HOP_STABLE_SWAP",
      "NEGATIVE_ONE",
      "Q96",
      "Q192",
      "MAX_FEE",
      "ONE_HUNDRED_PERCENT",
      "ZERO_PERCENT",
      "Q128",
      "createInfinityBinPool",
      "createInfinityCLPool",
      "createInfinityStablePool",
      "toSerializableBinPoolReserveOfBin",
      "toSerializableTick",
      "toSerializableInfinityCLPool",
      "toSerializableInfinityStablePool",
      "toSerializableInfinityBinPool",
      "parseTick",
      "parseInfinityCLPool",
      "parseInfinityBinPoolReserveOfBins",
      "parseInfinityBinPool",
      "parseInfinityStablePool",
      "getInfinityPoolFee",
      "isInfinityBinPool",
      "isInfinityStablePool",
      "isInfinityCLPool",
    ]
  `)
})
