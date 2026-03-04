# @pancakeswap/sdk

## 5.9.0

### Minor Changes

- ed68c36: merge solana liquidity to evm

### Patch Changes

- Updated dependencies [ed68c36]
- Updated dependencies [f43133d]
  - @pancakeswap/swap-sdk-core@1.6.0
  - @pancakeswap/chains@0.8.0
  - @pancakeswap/swap-sdk-evm@1.2.0
  - @pancakeswap/v2-sdk@1.2.0
  - @pancakeswap/swap-sdk-solana@1.1.7

## 5.8.18

### Patch Changes

- Updated dependencies [edc65d4]
  - @pancakeswap/swap-sdk-core@1.5.1
  - @pancakeswap/swap-sdk-evm@1.1.7
  - @pancakeswap/swap-sdk-solana@1.1.6
  - @pancakeswap/v2-sdk@1.1.7

## 5.8.17

### Patch Changes

- Updated dependencies [d6de8ef]
  - @pancakeswap/chains@0.7.0
  - @pancakeswap/swap-sdk-evm@1.1.6
  - @pancakeswap/swap-sdk-solana@1.1.5
  - @pancakeswap/v2-sdk@1.1.6

## 5.8.16

### Patch Changes

- Updated dependencies [cd589e1]
  - @pancakeswap/swap-sdk-core@1.5.0
  - @pancakeswap/chains@0.6.0
  - @pancakeswap/swap-sdk-evm@1.1.5
  - @pancakeswap/swap-sdk-solana@1.1.4
  - @pancakeswap/v2-sdk@1.1.5

## 5.8.15

### Patch Changes

- Updated dependencies [979f5e0]
  - @pancakeswap/chains@0.5.3
  - @pancakeswap/swap-sdk-evm@1.1.4
  - @pancakeswap/v2-sdk@1.1.4

## 5.8.14

### Patch Changes

- Updated dependencies [3de0443]
  - @pancakeswap/chains@0.5.2
  - @pancakeswap/swap-sdk-evm@1.1.3
  - @pancakeswap/v2-sdk@1.1.3

## 5.8.13

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
  - @pancakeswap/swap-sdk-core@1.4.0
  - @pancakeswap/v2-sdk@1.1.2
  - @pancakeswap/swap-sdk-evm@1.1.2

## 5.8.12

### Patch Changes

- Updated dependencies [5f264c5]
- Updated dependencies [0436fec]
  - @pancakeswap/chains@0.5.1
  - @pancakeswap/swap-sdk-evm@1.1.1
  - @pancakeswap/v2-sdk@1.1.1

## 5.8.11

### Patch Changes

- Updated dependencies [6a6acdb]
  - @pancakeswap/chains@0.5.0
  - @pancakeswap/swap-sdk-evm@1.1.0
  - @pancakeswap/v2-sdk@1.1.0

## 5.8.10

### Patch Changes

- 36f8955: Update packages

## 5.8.9

### Patch Changes

- Updated dependencies [176eb10]
- Updated dependencies [176eb10]
  - @pancakeswap/swap-sdk-core@1.3.0
  - @pancakeswap/swap-sdk-evm@1.0.6
  - @pancakeswap/v2-sdk@1.0.6

## 5.8.8

### Patch Changes

- Updated dependencies [f551e5e]
  - @pancakeswap/swap-sdk-core@1.2.0
  - @pancakeswap/swap-sdk-evm@1.0.5
  - @pancakeswap/v2-sdk@1.0.5

## 5.8.7

### Patch Changes

- Updated dependencies [9a16780]
  - @pancakeswap/chains@0.4.6
  - @pancakeswap/swap-sdk-evm@1.0.4
  - @pancakeswap/v2-sdk@1.0.4

## 5.8.6

### Patch Changes

- Updated dependencies [b9c91d1]
  - @pancakeswap/chains@0.4.5
  - @pancakeswap/swap-sdk-evm@1.0.3
  - @pancakeswap/v2-sdk@1.0.3

## 5.8.5

### Patch Changes

- edc3f30: Upgrade viem and wagmi
- Updated dependencies [edc3f30]
  - @pancakeswap/swap-sdk-evm@1.0.2
  - @pancakeswap/v2-sdk@1.0.2

## 5.8.4

### Patch Changes

- Updated dependencies [edf4640]
  - @pancakeswap/chains@0.4.4
  - @pancakeswap/swap-sdk-evm@1.0.1
  - @pancakeswap/v2-sdk@1.0.1

## 5.8.3

### Patch Changes

- e99c216: Introduce v2-sdk and swap-sdk-evm
- Updated dependencies [e99c216]
  - @pancakeswap/swap-sdk-evm@1.0.0
  - @pancakeswap/v2-sdk@1.0.0

## 5.8.2

### Patch Changes

- Updated dependencies [0f4281c]
- Updated dependencies [63a63d8]
  - @pancakeswap/chains@0.4.3

## 5.8.1

### Patch Changes

- 72c834c: Upgrade viem and wagmi v2
- Updated dependencies [72c834c]
- Updated dependencies [d4283e5]
  - @pancakeswap/chains@0.4.2

## 5.8.0

### Minor Changes

- 610a24a: Introduce v4 router with faster quoting speed

### Patch Changes

- Updated dependencies [610a24a]
  - @pancakeswap/swap-sdk-core@1.1.0

## 5.7.7

### Patch Changes

- Updated dependencies [c269d43]
  - @pancakeswap/swap-sdk-core@1.0.1

## 5.7.6

### Patch Changes

- 91969f80f: Add sepolia, base sepolia, arbitrum sepolia support
- Updated dependencies [91969f80f]
  - @pancakeswap/chains@0.4.1

## 5.7.5

### Patch Changes

- Updated dependencies [8fcd67c85]
  - @pancakeswap/chains@0.4.0

## 5.7.4

### Patch Changes

- Updated dependencies [49730e609]
  - @pancakeswap/chains@0.3.1

## 5.7.3

### Patch Changes

- 2ec03f1b2: chore: Bump up gauges

## 5.7.2

### Patch Changes

- Updated dependencies [c236a3ee4]
  - @pancakeswap/chains@0.3.0

## 5.7.1

### Patch Changes

- Updated dependencies [ed3146c93]
  - @pancakeswap/chains@0.2.0

## 5.7.0

### Minor Changes

- 8e3ac5427: Add back ChainId export

## 5.6.0

### Minor Changes

- 435a90ac2: Add support for opBNB mainnet

### Patch Changes

- Updated dependencies [435a90ac2]
  - @pancakeswap/chains@0.1.0

## 5.5.0

### Minor Changes

- 1831356d9: refactor: Move ChainsId usage from Sdk to Chains package

## 5.4.2

### Patch Changes

- 2d7e1b3e2: Upgraded viem
- Updated dependencies [2d7e1b3e2]
  - @pancakeswap/chains@0.0.1

## 5.4.1

### Patch Changes

- 7a0c21e72: fix base v2 factory address

## 5.4.0

### Minor Changes

- 868f4d11f: Add Base support

## 5.3.0

### Minor Changes

- 5e15c611e: Add linea support

## 5.2.1

### Patch Changes

- 3ba496cb1: Fix factory address

## 5.2.0

### Minor Changes

- 77fc3406a: Add zkSync support

## 5.1.0

### Minor Changes

- f9fda4ebe: Add Polygon zkEVM support

## 5.0.0

### Major Changes

- 938aa75f5: Migrate ethers to viem

## 4.0.0

### Major Changes

- b5dbd2921: Remove JSBI and use BigInt native instead

### Patch Changes

- Updated dependencies [b5dbd2921]
  - @pancakeswap/swap-sdk-core@1.0.0

## 3.2.1

### Patch Changes

- 9bee15cad: Fix v2 sdk fetcher export

## 3.2.0

### Minor Changes

- 65fbb250a: Bump version

### Patch Changes

- Updated dependencies [65fbb250a]
  - @pancakeswap/swap-sdk-core@0.1.0

## 3.1.5

### Patch Changes

- 7fb419ece: chore: Add fetcher and tokenAmount

## 3.1.4

### Patch Changes

- 1ce404aaf: Remove redundant import

## 3.1.3

### Patch Changes

- d83530d6b: Remove duplicate isTradeBetter util

## 3.1.2

### Patch Changes

- da105c1eb: Remove duplicate util functions

## 3.1.1

### Patch Changes

- 8ddd5956f: Export missing token classes
