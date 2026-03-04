# @pancakeswap/multicall

## 3.8.0

### Minor Changes

- f43133d: Add Monad Mainnet support

### Patch Changes

- 9f8255b: Add Perf. Stats in returns of multicall
- Updated dependencies [ed68c36]
- Updated dependencies [f43133d]
  - @pancakeswap/sdk@5.9.0
  - @pancakeswap/chains@0.8.0

## 3.7.4

### Patch Changes

- @pancakeswap/sdk@5.8.18

## 3.7.3

### Patch Changes

- Updated dependencies [d6de8ef]
  - @pancakeswap/chains@0.7.0
  - @pancakeswap/sdk@5.8.17

## 3.7.2

### Patch Changes

- Updated dependencies [cd589e1]
  - @pancakeswap/chains@0.6.0
  - @pancakeswap/sdk@5.8.16

## 3.7.1

### Patch Changes

- Updated dependencies [979f5e0]
  - @pancakeswap/chains@0.5.3
  - @pancakeswap/sdk@5.8.15

## 3.7.0

### Minor Changes

- ea1da46: update zod package

### Patch Changes

- 44601d1: Fix input parameters not being used
- d182909: Increase block tolerance for bsc post Maxwell upgrade

## 3.6.4

### Patch Changes

- 5b4135c: Added `account` support for multicall, quote will mutlicall quote hooked pool with account, added whitelist hooks

## 3.6.3

### Patch Changes

- Updated dependencies [3de0443]
  - @pancakeswap/chains@0.5.2
  - @pancakeswap/sdk@5.8.14

## 3.6.2

### Patch Changes

- cb44715: [Major Updates]
  **@pancakeswap/routing-sdk-addon-infinity**
  **@pancakeswap/routing-sdk-addon-quoter**
  **@pancakeswap/infinity-sdk**

  3 packages added for support infinity(CL & Bin) pools and dynamic hooks path finding and liquidity management.

  [Minor Updates]
  **@pancakeswap/universal-router-sdk**: This update implements Infinity CL/BIN route planning, merges and restructures code for stable, V2, V3, and Infinity pools, refactors commands into a RoutePlanner, and removes legacy ABIs. It adds new decode logic for universal calldata, reorganizes input token permits, and updates addresses in constants, improving flexibility and reducing complexity.

  **@pancakeswap/widgets-internal** : Add Infinity modules, "PriceRangeChartWithPeriodAndLiquidity," new "ProtocolMenu," "PoolTypeFilter," and "Tips," and remove "PoolTagFilter," "PoolTypeMenu." We update "FeatureStack" (folding/info icons), "FeeTierTooltip," "NetworkFilter," "TokenFilter," "TokenOverview," and ROI logic. We also revise Infinity liquidity features with new chart components and hooks.

  **@pancakeswap/swap-sdk-core**: Reduce rounding errors and improve quote accuracy, with refined type definitions ensuring a smoother developer experience.

  **@pancakeswap/smart-router**: Refactored some references to Infinity and introduced InfinityRouter with Infinity CL and BIN pools. Removed V4 code, updated on-chain quote providers, route encoders, logging, and aggregator logic. Enhanced route handling performance and ensured compatibility with Infinity SDK for improved quoting.

  **@pancakeswap/routing-sdk**: Add Infinity CL and Bin pool support to the routing SDK. Introduce new constants, math utilities, and route encoding for Infinity mixed routes. Integrate Infinity quoter logic, including bin and CL quote calls, gas cost estimation, and logging improvements for better debugging.

  **@pancakeswap/farms**: Added InfinityBIN and InfinityCLAMM protocols, introduced BSC testnet support, updated fetch logic to handle zeroAddress with Native tokens, and included new V4 farm format in utilities. Also updated test exports, chain arrays, and support lists to incorporate these changes and ensure robust universal farm configuration.

  **@pancakeswap/uikit**
  '@pancakeswap/utils': Added forwardRef support to Breadcrumbs, new Button variant "textPrimary60," a noButtonMargin prop in ButtonMenu, children rendering in CopyButton, itemKey in DropdownMenu, new icons (CurveGraph, CurvedChart, HookFeature, SpotGraph), updated color tokens and styles, refined useModal logic.

  [Patch Updates]

  Added support for infinity by introducing internal types and updating unit tests to improve code maintainability and logging accuracy.

- Updated dependencies [cb44715]
  - @pancakeswap/sdk@5.8.13

## 3.6.1

### Patch Changes

- Updated dependencies [5f264c5]
- Updated dependencies [0436fec]
  - @pancakeswap/chains@0.5.1
  - @pancakeswap/sdk@5.8.12

## 3.6.0

### Minor Changes

- 6a6acdb: support monad testnet

### Patch Changes

- Updated dependencies [6a6acdb]
  - @pancakeswap/chains@0.5.0
  - @pancakeswap/sdk@5.8.11

## 3.5.10

### Patch Changes

- Updated dependencies [36f8955]
  - @pancakeswap/sdk@5.8.10

## 3.5.9

### Patch Changes

- @pancakeswap/sdk@5.8.9

## 3.5.8

### Patch Changes

- @pancakeswap/sdk@5.8.8

## 3.5.7

### Patch Changes

- Updated dependencies [9a16780]
  - @pancakeswap/chains@0.4.6
  - @pancakeswap/sdk@5.8.7

## 3.5.6

### Patch Changes

- Updated dependencies [b9c91d1]
  - @pancakeswap/chains@0.4.5
  - @pancakeswap/sdk@5.8.6

## 3.5.5

### Patch Changes

- edc3f30: Upgrade viem and wagmi
- Updated dependencies [edc3f30]
  - @pancakeswap/sdk@5.8.5

## 3.5.4

### Patch Changes

- Updated dependencies [edf4640]
  - @pancakeswap/chains@0.4.4
  - @pancakeswap/sdk@5.8.4

## 3.5.3

### Patch Changes

- Updated dependencies [e99c216]
  - @pancakeswap/sdk@5.8.3

## 3.5.2

### Patch Changes

- Updated dependencies [0f4281c]
- Updated dependencies [63a63d8]
  - @pancakeswap/chains@0.4.3
  - @pancakeswap/sdk@5.8.2

## 3.5.1

### Patch Changes

- 72c834c: Upgrade viem and wagmi v2
- Updated dependencies [72c834c]
- Updated dependencies [d4283e5]
  - @pancakeswap/sdk@5.8.1
  - @pancakeswap/chains@0.4.2

## 3.5.0

### Minor Changes

- 610a24a: Introduce v4 router with faster quoting speed

### Patch Changes

- Updated dependencies [610a24a]
  - @pancakeswap/sdk@5.8.0

## 3.4.2

### Patch Changes

- @pancakeswap/sdk@5.7.7

## 3.4.1

### Patch Changes

- Updated dependencies [91969f80f]
  - @pancakeswap/sdk@5.7.6
  - @pancakeswap/chains@0.4.1

## 3.4.0

### Minor Changes

- ec7e469ca: Add support for abort control

## 3.3.4

### Patch Changes

- Updated dependencies [8fcd67c85]
  - @pancakeswap/chains@0.4.0
  - @pancakeswap/sdk@5.7.5

## 3.3.3

### Patch Changes

- Updated dependencies [49730e609]
  - @pancakeswap/chains@0.3.1
  - @pancakeswap/sdk@5.7.4

## 3.3.2

### Patch Changes

- 2ec03f1b2: chore: Bump up gauges
- Updated dependencies [2ec03f1b2]
  - @pancakeswap/sdk@5.7.3

## 3.3.1

### Patch Changes

- 95c5fb6cd: Update default configuration on base network

## 3.3.0

### Minor Changes

- fd7a96a36: Add multicall3 contract addresses

## 3.2.3

### Patch Changes

- Updated dependencies [c236a3ee4]
  - @pancakeswap/chains@0.3.0
  - @pancakeswap/sdk@5.7.2

## 3.2.2

### Patch Changes

- Updated dependencies [ed3146c93]
  - @pancakeswap/chains@0.2.0
  - @pancakeswap/sdk@5.7.1

## 3.2.1

### Patch Changes

- Updated dependencies [8e3ac5427]
  - @pancakeswap/sdk@5.7.0

## 3.2.0

### Minor Changes

- 435a90ac2: Add support for opBNB mainnet

### Patch Changes

- Updated dependencies [435a90ac2]
  - @pancakeswap/sdk@5.6.0
  - @pancakeswap/chains@0.1.0

## 3.1.2

### Patch Changes

- 1831356d9: refactor: Move ChainsId usage from Sdk to Chains package
- Updated dependencies [1831356d9]
  - @pancakeswap/sdk@5.5.0

## 3.1.1

### Patch Changes

- 2d7e1b3e2: Upgraded viem
- Updated dependencies [2d7e1b3e2]
  - @pancakeswap/sdk@5.4.2

## 3.1.0

### Minor Changes

- 4cca3f688: Support dropping unexected multicalls

## 3.0.1

### Patch Changes

- 5a9836d39: Add contracts to readme

## 3.0.0

### Major Changes

- 8337b09a8: Multicall major bump

## 1.0.0

### Major Changes

- a784ca6ed: Pancake Multicall release
