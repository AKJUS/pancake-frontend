import { expect, test } from 'vitest'
import * as exports from './index'

test('exports', () => {
  expect(Object.keys(exports)).toMatchInlineSnapshot(`
    [
      "AVERAGE_CHAIN_BLOCK_TIMES",
      "ChainId",
      "NonEVMChainId",
      "SunsetChainId",
      "testnetChainIds",
      "chainNames",
      "chainFullNames",
      "chainNamesInKebabCase",
      "mainnetChainNamesInKebabCase",
      "chainNameToChainId",
      "allCasesNameToChainId",
      "defiLlamaChainNames",
      "Chains",
      "getChainName",
      "getChainNameInKebabCase",
      "getMainnetChainNameInKebabCase",
      "getLlamaChainName",
      "getChainIdByChainName",
      "isTestnetChainId",
      "isEvm",
      "isSolana",
      "isAptos",
      "isChainSupported",
      "V3_SUBGRAPHS",
      "V2_SUBGRAPHS",
      "BLOCKS_SUBGRAPHS",
      "STABLESWAP_SUBGRAPHS",
      "filterSubgraphs",
      "getStableSwapSubgraphs",
      "getV3Subgraphs",
      "getV2Subgraphs",
      "getBlocksSubgraphs",
    ]
  `)
})
