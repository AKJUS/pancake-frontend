import { ChainId } from '@pancakeswap/chains'

import { Address } from 'viem'
import { HOOK_CATEGORY, HookType, POOL_TYPE, type HookData, type PoolType } from '../../types'
import { CL_DYNAMIC_FEE_HOOKS_BY_CHAIN } from './dynamicFeeHook'

export const CL_DYNAMIC_HOOK: HookData = {
  address: CL_DYNAMIC_FEE_HOOKS_BY_CHAIN[ChainId.BSC],
  name: 'Dynamic Fees (CLAMM)',
  poolType: POOL_TYPE.CLAMM,
  description:
    'PancakeSwap’s Dynamic Fee Hook adjusts swap fees based on market volatility—penalizing arbitrageurs and rewarding LPs during turbulence, while keeping fees low in stable conditions for smoother trading.',
  github: 'https://github.com/pancakeswap/infinity-dynamic-fee-hook',
  learnMoreLink: 'https://docs.pancakeswap.finance/trade/pancakeswap-infinity/hooks/dynamic-fee-hook',
  category: [HOOK_CATEGORY.DynamicFees],
  isVerified: false,
  isUpgradable: false,
  creator: 'https://github.com/pancakeswap/',
  defaultFee: 500,
  hooksRegistration: {
    afterInitialize: true,
    beforeSwap: true,
    afterSwap: true,
  },
  hookType: HookType.Universal,
}

// const BIN_DYNAMIC_HOOK = {
//   address: BIN_DYNAMIC_FEE_HOOKS_BY_CHAIN[ChainId.BSC],
//   name: 'Dynamic Fees (Bin)',
//   poolType: POOL_TYPE.Bin,
//   description: 'It will set lpFee to 3000 i.e 0.3% in afterInitialize',
//   github: 'https://bscscan.com/address/0x870c167eFCEEaDd081EE783Af8c5c7b436f1d3Ce',
//   category: [HOOK_CATEGORY.DynamicFees],
//   isVerified: true,
//   isUpgradable: false,
//   hooksRegistration: {
//     afterInitialize: true,
//     beforeAddLiquidity: true,
//     beforeSwap: true,
//   },
// }
// const BIN_DYNAMIC_HOOK = undefined

const dynamicHooksList: HookData[] = [CL_DYNAMIC_HOOK]

export const bscHooksList: HookData[] = [
  ...dynamicHooksList,

  // {
  //   // bnb/usdt
  //   poolType: POOL_TYPE.CLAMM,
  //   address: '0x9c5554cCEa7F38c3337f017E8357C3eD62BF9885',
  //   name: 'CEX Whale Discount Hook (Primus)',
  //   description: `Prove your CEX 30-day spot trading volume exceeded $1M with zkTLS by Primus and get 50% off the pool fee. Create your proof here: https://hook.primuslabs.xyz/cexwhale . The proof is valid for 14 days.`,
  //   github: 'https://github.com/primus-labs/pancakeswapv4-cex-trading-hooks',
  //   category: [HOOK_CATEGORY.PrimusDiscount, HOOK_CATEGORY.DynamicFees],
  //   creator: 'https://github.com/primus-labs/',
  //   audit: '',
  //   isVerified: true,
  //   isUpgradable: false,
  //   hooksRegistration: {
  //     afterInitialize: true,
  //     beforeSwap: true,
  //   },
  //   hookType: HookType.PerPool,
  //   defaultFee: 500,
  // },
  {
    // cake-usdt
    poolType: POOL_TYPE.CLAMM,
    address: '0x1A3DFBCAc585e22F993Cc8e09BcC0dB388Cc1Ca3',
    name: 'CAKE Holder Discount Hook (Brevis)',
    description: `Powered by Brevis, this hook enables swap fee discounts for CAKE holders who have made at least 1 swap in this pool in the last 30 days. The fee discount tier is based on a user’s last 30-day Time-Weighted Average (TWA) CAKE balance: 
(VIP 1) 5% discount if 100 CAKE < TWA <= 1,000 CAKE, 
(VIP 2) 15% discount if 1,000 CAKE < TWA <= 10,000 CAKE,
(VIP 3) 25% discount if 10,000 CAKE < TWA <= 20,000 CAKE,
(VIP 4) 35% discount if 20,000 CAKE < TWA <= 30,000 CAKE, 
(VIP 5) 45% discount if TWA > 30,000 CAKE.
    `,
    github: 'https://github.com/brevis-network/pancake-tokenholding-hook/tree/main',
    category: [HOOK_CATEGORY.BrevisDiscount, HOOK_CATEGORY.DynamicFees],
    creator: 'https://github.com/brevis-network',
    audit: 'https://github.com/brevis-network/pancake-tokenholding-hook/tree/main/audits',
    isVerified: true,
    isUpgradable: true,
    hooksRegistration: {
      beforeSwap: true,
    },
    hookType: HookType.PerPool,
    defaultFee: 2500,
  },
  {
    // USDT-USDC
    poolType: POOL_TYPE.CLAMM,
    address: '0x1e9c64Cad39DDD36fB808E004067Cffc710EB71D',
    name: 'VIP discount Hook (Brevis)',
    description: `Powered by Brevis, this hook enables swap fee discounts for VIP traders based on their cumulative trading volume in this pool in the last 30 days:
(VIP 1) 5% discount if 50,000 USDT < 30-Day Volume <= 1,000,000 USDT, 
(VIP 2) 15% discount if 1,000,000 USDT < 30-Day Volume <= 5,000,000 USDT,
(VIP 3) 25% discount if 5,000,000 USDT < 30-Day Volume <= 15,000,000 USDT,
(VIP 4) 35% discount if 15,000,000 USDT < 30-Day Volume <= 20,000,000 USDT,
(VIP 5) 45% discount if 30-Day Volume > 20,000,000 USDT.
    `,
    github: 'https://github.com/brevis-network/vip-hook',
    category: [HOOK_CATEGORY.BrevisDiscount, HOOK_CATEGORY.DynamicFees],
    creator: 'https://github.com/brevis-network',
    audit: 'https://github.com/brevis-network/vip-hook/tree/main/audits',
    isVerified: true,
    isUpgradable: true,
    hooksRegistration: {
      beforeSwap: true,
    },
    hookType: HookType.PerPool,
    defaultFee: 100,
  },
  {
    // ETH-USDT
    poolType: POOL_TYPE.CLAMM,
    address: '0xF27b9134B23957D842b08fFa78b07722fB9845BD',
    name: 'VIP discount Hook (Brevis)',
    description: `Powered by Brevis, this hook enables swap fee discounts for VIP traders based on their cumulative trading volume in this pool in the last 30 days:
(VIP 1) 5% discount if 28 ETH < 30-Day Volume <= 555 ETH, 
(VIP 2) 15% discount if 555 ETH < 30-Day Volume <= 2,778 ETH,
(VIP 3) 25% discount if 2,778 ETH < 30-Day Volume <= 8,333 ETH,
(VIP 4) 35% discount if 8,333 ETH < 30-Day Volume <= 11,111 ETH,
(VIP 5) 45% discount if 30-Day Volume > 11,111 ETH.
    `,
    github: 'https://github.com/brevis-network/vip-hook',
    category: [HOOK_CATEGORY.BrevisDiscount, HOOK_CATEGORY.DynamicFees],
    creator: 'https://github.com/brevis-network',
    audit: 'https://github.com/brevis-network/vip-hook/tree/main/audits',
    isVerified: true,
    isUpgradable: true,
    hooksRegistration: {
      beforeSwap: true,
    },
    hookType: HookType.PerPool,
    defaultFee: 500,
  },
  {
    // BNB-USDT
    poolType: POOL_TYPE.Bin,
    address: '0x60FbCAfaB24bc117b6facECd00D3e8f56ca4D5e9',
    name: 'CAKE Holder Discount Hook (Brevis)',
    description: `Powered by Brevis, this hook enables swap fee discounts for CAKE holders who have made at least 1 swap in this pool in the last 30 days. The fee discount tier is based on a user’s last 30-day Time-Weighted Average (TWA) CAKE balance: 
(VIP 1) 5% discount if 100 CAKE < TWA <= 1,000 CAKE, 
(VIP 2) 15% discount if 1,000 CAKE < TWA <= 10,000 CAKE,
(VIP 3) 25% discount if 10,000 CAKE < TWA <= 20,000 CAKE,
(VIP 4) 35% discount if 20,000 CAKE < TWA <= 30,000 CAKE, 
(VIP 5) 45% discount if TWA > 30,000 CAKE.
    `,
    github: 'https://github.com/brevis-network/pancake-tokenholding-hook/tree/main',
    category: [HOOK_CATEGORY.BrevisDiscount, HOOK_CATEGORY.DynamicFees],
    creator: 'https://github.com/brevis-network',
    audit: 'https://github.com/brevis-network/pancake-tokenholding-hook/tree/main/audits',
    isVerified: true,
    isUpgradable: true,
    hooksRegistration: {
      beforeSwap: true,
    },
    hookType: HookType.PerPool,
    defaultFee: 500,
  },
  {
    // BTCB-BNB
    poolType: POOL_TYPE.CLAMM,
    address: '0x0fcF6D110Cf96BE56D251716E69E37619932edF2',
    name: 'CAKE Holder Discount Hook (Brevis)',
    description: `Powered by Brevis, this hook enables swap fee discounts for CAKE holders who have made at least 1 swap in this pool in the last 30 days. The fee discount tier is based on a user’s last 30-day Time-Weighted Average (TWA) CAKE balance: 
(VIP 1) 5% discount if 100 CAKE < TWA <= 1,000 CAKE, 
(VIP 2) 15% discount if 1,000 CAKE < TWA <= 10,000 CAKE,
(VIP 3) 25% discount if 10,000 CAKE < TWA <= 20,000 CAKE,
(VIP 4) 35% discount if 20,000 CAKE < TWA <= 30,000 CAKE, 
(VIP 5) 45% discount if TWA > 30,000 CAKE.
    `,
    github: 'https://github.com/brevis-network/pancake-tokenholding-hook/tree/main',
    category: [HOOK_CATEGORY.BrevisDiscount, HOOK_CATEGORY.DynamicFees],
    creator: 'https://github.com/brevis-network',
    audit: 'https://github.com/brevis-network/pancake-tokenholding-hook/tree/main/audits',
    isVerified: true,
    isUpgradable: true,
    hooksRegistration: {
      beforeSwap: true,
    },
    hookType: HookType.PerPool,
    defaultFee: 500,
  },
  {
    // CAKE-BNB
    poolType: POOL_TYPE.CLAMM,
    address: '0xDfdfB2c5a717AB00B370E883021f20C2fbaEd277',
    name: 'CAKE Holder Discount Hook (Brevis)',
    description: `Powered by Brevis, this hook enables swap fee discounts for CAKE holders who have made at least 1 swap in this pool in the last 30 days. The fee discount tier is based on a user’s last 30-day Time-Weighted Average (TWA) CAKE balance: 
(VIP 1) 5% discount if 100 CAKE < TWA <= 1,000 CAKE, 
(VIP 2) 15% discount if 1,000 CAKE < TWA <= 10,000 CAKE,
(VIP 3) 25% discount if 10,000 CAKE < TWA <= 20,000 CAKE,
(VIP 4) 35% discount if 20,000 CAKE < TWA <= 30,000 CAKE, 
(VIP 5) 45% discount if TWA > 30,000 CAKE.
    `,
    github: 'https://github.com/brevis-network/pancake-tokenholding-hook/tree/main',
    category: [HOOK_CATEGORY.BrevisDiscount, HOOK_CATEGORY.DynamicFees],
    creator: 'https://github.com/brevis-network',
    audit: 'https://github.com/brevis-network/pancake-tokenholding-hook/tree/main/audits',
    isVerified: true,
    isUpgradable: true,
    hooksRegistration: {
      beforeSwap: true,
    },
    hookType: HookType.PerPool,
    defaultFee: 2500,
  },
  {
    poolType: POOL_TYPE.CLAMM,
    address: '0xD7059ABd653e87cb124690E2eba175391AC52243',
    name: 'Arbiter MEV Capture',
    description: `Arbiter hook allows LPs to capture significant part of MEV extracted from pool. This is achieved by introducing auction for MEV actors. Winner can control the pool’s fee, outperform competitors and optimize routing traffic - increasing their and LPs profits as proceeds from auction go to LPs.`,
    github: 'https://github.com/ArbiterFinance/arbiter-contracts/blob/main/src/ArbiterAmAmmPoolCurrencyHook.sol',
    category: [HOOK_CATEGORY.MEV, HOOK_CATEGORY.DynamicFees],
    creator: 'https://github.com/ArbiterFinance',
    audit: 'https://github.com/ArbiterFinance/arbiter-contracts/tree/main/audits',
    isVerified: true,
    isUpgradable: false,
    hooksRegistration: {
      afterInitialize: true,
      beforeAddLiquidity: true,
      beforeSwap: true,
      beforeSwapReturnsDelta: true,
    },
    hookType: HookType.PerPool,
    defaultFee: 500, // 0.05%
  },
  {
    address: '0x6AdC560aF85377f9a73d17c658D798c9B39186e8',
    name: 'Limit Order',
    poolType: POOL_TYPE.CLAMM,
    description:
      'Fee Earning Limit Orders let you set a target price to buy or sell tokens automatically, while earning fees.',
    github: 'https://github.com/pancakeswap/limit-order-hook-contract',
    category: [HOOK_CATEGORY.OrderType],
    isVerified: true,
    isUpgradable: false,
    hooksRegistration: {
      beforeInitialize: true,
      afterInitialize: true,
      beforeSwap: true,
      afterSwap: true,
    },
    hookType: HookType.Universal,
  },
]

/**
 * Dynamic hook for each pool type for auto-selection on "Dynamic" fee tier
 */
export const bscDynamicHooks: Record<PoolType, HookData | undefined> = {
  CL: CL_DYNAMIC_HOOK,
  Bin: undefined,
}

// whitelisted hooks but without metadata, just for eliminating the fe warning
export const bscWhitelistLabeledHooks: Address[] = [
  '0x9a9B5331ce8d74b2B721291D57DE696E878353fd', // IDO TGE
  '0x72e09eBd9b24F47730b651889a4eD984CBa53d90',
]
