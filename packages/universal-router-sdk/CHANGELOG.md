# @pancakeswap/universal-router-sdk

## 1.5.0

### Minor Changes

- f43133d: Add Monad Mainnet support

### Patch Changes

- Updated dependencies [ed68c36]
- Updated dependencies [4426ae8]
- Updated dependencies [f43133d]
- Updated dependencies [dd15a4f]
- Updated dependencies [abdc983]
  - @pancakeswap/sdk@5.9.0
  - @pancakeswap/chains@0.8.0
  - @pancakeswap/smart-router@7.6.0
  - @pancakeswap/permit2-sdk@1.2.0
  - @pancakeswap/v3-sdk@3.10.0
  - @pancakeswap/infinity-sdk@1.0.8

## 1.4.16

### Patch Changes

- Updated dependencies [edc65d4]
  - @pancakeswap/smart-router@7.5.4
  - @pancakeswap/v3-sdk@3.9.7
  - @pancakeswap/infinity-sdk@1.0.7
  - @pancakeswap/sdk@5.8.18
  - @pancakeswap/permit2-sdk@1.1.7

## 1.4.15

### Patch Changes

- Updated dependencies [d6de8ef]
  - @pancakeswap/chains@0.7.0
  - @pancakeswap/infinity-sdk@1.0.6
  - @pancakeswap/permit2-sdk@1.1.6
  - @pancakeswap/smart-router@7.5.3
  - @pancakeswap/sdk@5.8.17
  - @pancakeswap/v3-sdk@3.9.6

## 1.4.14

### Patch Changes

- @pancakeswap/smart-router@7.5.2

## 1.4.13

### Patch Changes

- Updated dependencies [1de662b]
  - @pancakeswap/infinity-sdk@1.0.5
  - @pancakeswap/smart-router@7.5.1

## 1.4.12

### Patch Changes

- Updated dependencies [cd589e1]
- Updated dependencies [1f6c9ec]
  - @pancakeswap/smart-router@7.5.0
  - @pancakeswap/chains@0.6.0
  - @pancakeswap/infinity-sdk@1.0.4
  - @pancakeswap/sdk@5.8.16
  - @pancakeswap/v3-sdk@3.9.5
  - @pancakeswap/permit2-sdk@1.1.5

## 1.4.11

### Patch Changes

- Updated dependencies [979f5e0]
  - @pancakeswap/smart-router@7.4.0
  - @pancakeswap/chains@0.5.3
  - @pancakeswap/infinity-sdk@1.0.3
  - @pancakeswap/permit2-sdk@1.1.4
  - @pancakeswap/sdk@5.8.15
  - @pancakeswap/v3-sdk@3.9.4

## 1.4.10

### Patch Changes

- Updated dependencies [ea1da46]
  - @pancakeswap/smart-router@7.3.0
  - @pancakeswap/infinity-sdk@1.0.2
  - @pancakeswap/v3-sdk@3.9.3

## 1.4.9

### Patch Changes

- 8fe32db: Update Base Address

## 1.4.8

### Patch Changes

- 174f538: Handle WrapEth when give user changes

## 1.4.7

### Patch Changes

- e6c8008: Update Wrap Output Behavior
  - @pancakeswap/infinity-sdk@1.0.2
  - @pancakeswap/smart-router@7.2.5
  - @pancakeswap/v3-sdk@3.9.3

## 1.4.6

### Patch Changes

- 0895014: Allow Contract Call without perm2 from unwrap
- Updated dependencies [7270ffa]
- Updated dependencies [2f165c8]
  - @pancakeswap/smart-router@7.2.5
  - @pancakeswap/infinity-sdk@1.0.2
  - @pancakeswap/v3-sdk@3.9.3

## 1.4.5

### Patch Changes

- Updated dependencies [5b4135c]
  - @pancakeswap/infinity-sdk@1.0.2
  - @pancakeswap/smart-router@7.2.4

## 1.4.4

### Patch Changes

- Updated dependencies [36fdc2a]
  - @pancakeswap/smart-router@7.2.3

## 1.4.3

### Patch Changes

- 87f089f: Bump version for update deps in @pancakeswap/utils
  - @pancakeswap/infinity-sdk@1.0.1
  - @pancakeswap/smart-router@7.2.2
  - @pancakeswap/v3-sdk@3.9.3

## 1.4.2

### Patch Changes

- 9cc7613: Add unit test for option payerIsUser
- Updated dependencies [1718057]
  - @pancakeswap/smart-router@7.2.2
  - @pancakeswap/infinity-sdk@1.0.1
  - @pancakeswap/v3-sdk@3.9.3

## 1.4.1

### Patch Changes

- Updated dependencies [10acda5]
- Updated dependencies [3de0443]
  - @pancakeswap/infinity-sdk@1.0.1
  - @pancakeswap/chains@0.5.2
  - @pancakeswap/smart-router@7.2.1
  - @pancakeswap/permit2-sdk@1.1.3
  - @pancakeswap/sdk@5.8.14
  - @pancakeswap/v3-sdk@3.9.3

## 1.4.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [cb44715]
  - @pancakeswap/infinity-sdk@1.0.0
  - @pancakeswap/smart-router@7.2.0
  - @pancakeswap/v3-sdk@3.9.2
  - @pancakeswap/sdk@5.8.13
  - @pancakeswap/permit2-sdk@1.1.2

## 1.3.2

### Patch Changes

- Updated dependencies [5f264c5]
- Updated dependencies [0436fec]
  - @pancakeswap/chains@0.5.1
  - @pancakeswap/permit2-sdk@1.1.1
  - @pancakeswap/smart-router@7.1.3
  - @pancakeswap/sdk@5.8.12
  - @pancakeswap/v3-sdk@3.9.1

## 1.3.1

### Patch Changes

- Updated dependencies [9fa225f]
  - @pancakeswap/smart-router@7.1.2

## 1.3.0

### Minor Changes

- 5bcf3e0: Add payerIsUser option to erc20 swap calldata encoding

## 1.2.0

### Minor Changes

- 5d6c6e0: Add payerIsUser option

## 1.1.1

### Patch Changes

- @pancakeswap/smart-router@7.1.1

## 1.1.0

### Minor Changes

- 6a6acdb: support monad testnet

### Patch Changes

- Updated dependencies [6a6acdb]
  - @pancakeswap/chains@0.5.0
  - @pancakeswap/permit2-sdk@1.1.0
  - @pancakeswap/smart-router@7.1.0
  - @pancakeswap/v3-sdk@3.9.0
  - @pancakeswap/sdk@5.8.11

## 1.0.42

### Patch Changes

- Updated dependencies [8578d8f]
  - @pancakeswap/smart-router@7.0.2

## 1.0.41

### Patch Changes

- Updated dependencies [4181a79]
  - @pancakeswap/smart-router@7.0.1

## 1.0.40

### Patch Changes

- Updated dependencies [36f8955]
  - @pancakeswap/smart-router@7.0.0
  - @pancakeswap/sdk@5.8.10
  - @pancakeswap/permit2-sdk@1.0.12
  - @pancakeswap/v3-sdk@3.8.13

## 1.0.39

### Patch Changes

- @pancakeswap/smart-router@6.2.1

## 1.0.38

### Patch Changes

- Updated dependencies [176eb10]
- Updated dependencies [176eb10]
  - @pancakeswap/smart-router@6.2.0
  - @pancakeswap/sdk@5.8.9
  - @pancakeswap/v3-sdk@3.8.12
  - @pancakeswap/permit2-sdk@1.0.11

## 1.0.37

### Patch Changes

- @pancakeswap/smart-router@6.1.6

## 1.0.36

### Patch Changes

- Updated dependencies [3e83a9c]
  - @pancakeswap/smart-router@6.1.5

## 1.0.35

### Patch Changes

- @pancakeswap/smart-router@6.1.4

## 1.0.34

### Patch Changes

- @pancakeswap/smart-router@6.1.3

## 1.0.33

### Patch Changes

- @pancakeswap/smart-router@6.1.2

## 1.0.32

### Patch Changes

- Updated dependencies [618ad06]
  - @pancakeswap/smart-router@6.1.1

## 1.0.31

### Patch Changes

- Updated dependencies [b1d1eaf]
  - @pancakeswap/smart-router@6.1.0

## 1.0.30

### Patch Changes

- @pancakeswap/smart-router@6.0.17
- @pancakeswap/sdk@5.8.8
- @pancakeswap/v3-sdk@3.8.11
- @pancakeswap/permit2-sdk@1.0.10

## 1.0.29

### Patch Changes

- Updated dependencies [911d107]
  - @pancakeswap/v3-sdk@3.8.10
  - @pancakeswap/smart-router@6.0.16

## 1.0.28

### Patch Changes

- Updated dependencies [fe96bb1]
  - @pancakeswap/v3-sdk@3.8.9
  - @pancakeswap/smart-router@6.0.15

## 1.0.27

### Patch Changes

- @pancakeswap/smart-router@6.0.14

## 1.0.26

### Patch Changes

- Updated dependencies [9a16780]
  - @pancakeswap/chains@0.4.6
  - @pancakeswap/permit2-sdk@1.0.9
  - @pancakeswap/smart-router@6.0.13
  - @pancakeswap/sdk@5.8.7
  - @pancakeswap/v3-sdk@3.8.8

## 1.0.25

### Patch Changes

- Updated dependencies [b9c91d1]
  - @pancakeswap/chains@0.4.5
  - @pancakeswap/permit2-sdk@1.0.8
  - @pancakeswap/smart-router@6.0.12
  - @pancakeswap/sdk@5.8.6
  - @pancakeswap/v3-sdk@3.8.7

## 1.0.24

### Patch Changes

- edc3f30: Upgrade viem and wagmi
- Updated dependencies [edc3f30]
  - @pancakeswap/smart-router@6.0.11
  - @pancakeswap/permit2-sdk@1.0.7
  - @pancakeswap/sdk@5.8.5
  - @pancakeswap/v3-sdk@3.8.6

## 1.0.23

### Patch Changes

- Updated dependencies [edf4640]
  - @pancakeswap/chains@0.4.4
  - @pancakeswap/permit2-sdk@1.0.6
  - @pancakeswap/smart-router@6.0.10
  - @pancakeswap/sdk@5.8.4
  - @pancakeswap/v3-sdk@3.8.5

## 1.0.22

### Patch Changes

- Updated dependencies [e99c216]
  - @pancakeswap/sdk@5.8.3
  - @pancakeswap/smart-router@6.0.9
  - @pancakeswap/permit2-sdk@1.0.5
  - @pancakeswap/v3-sdk@3.8.4

## 1.0.21

### Patch Changes

- @pancakeswap/smart-router@6.0.8

## 1.0.20

### Patch Changes

- Updated dependencies [0f4281c]
- Updated dependencies [63a63d8]
  - @pancakeswap/chains@0.4.3
  - @pancakeswap/permit2-sdk@1.0.4
  - @pancakeswap/smart-router@6.0.7
  - @pancakeswap/sdk@5.8.2
  - @pancakeswap/v3-sdk@3.8.3

## 1.0.19

### Patch Changes

- Updated dependencies [a29edf6]
  - @pancakeswap/v3-sdk@3.8.2
  - @pancakeswap/smart-router@6.0.6

## 1.0.18

### Patch Changes

- @pancakeswap/smart-router@6.0.5

## 1.0.17

### Patch Changes

- @pancakeswap/smart-router@6.0.4

## 1.0.16

### Patch Changes

- @pancakeswap/smart-router@6.0.3

## 1.0.15

### Patch Changes

- 72c834c: Upgrade viem and wagmi v2
- Updated dependencies [72c834c]
- Updated dependencies [d4283e5]
  - @pancakeswap/smart-router@6.0.2
  - @pancakeswap/permit2-sdk@1.0.3
  - @pancakeswap/sdk@5.8.1
  - @pancakeswap/chains@0.4.2
  - @pancakeswap/v3-sdk@3.8.1

## 1.0.14

### Patch Changes

- Updated dependencies [1aaed60]
  - @pancakeswap/smart-router@6.0.1

## 1.0.13

### Patch Changes

- Updated dependencies [1d74cbb]
  - @pancakeswap/smart-router@6.0.0

## 1.0.12

### Patch Changes

- Updated dependencies [4e88d8f]
  - @pancakeswap/smart-router@5.1.8

## 1.0.11

### Patch Changes

- @pancakeswap/smart-router@5.1.7

## 1.0.10

### Patch Changes

- Updated dependencies [67ca3d6]
  - @pancakeswap/v3-sdk@3.8.0
  - @pancakeswap/smart-router@5.1.6

## 1.0.9

### Patch Changes

- d807074: Remove smart router evm sub path
- Updated dependencies [ab7f9fb]
- Updated dependencies [d807074]
  - @pancakeswap/smart-router@5.1.5

## 1.0.8

### Patch Changes

- @pancakeswap/smart-router@5.1.4

## 1.0.7

### Patch Changes

- @pancakeswap/smart-router@5.1.3

## 1.0.6

### Patch Changes

- Updated dependencies [526586d]
  - @pancakeswap/smart-router@5.1.2

## 1.0.5

### Patch Changes

- Updated dependencies [e6e8751]
  - @pancakeswap/smart-router@5.1.1

## 1.0.4

### Patch Changes

- Updated dependencies [31ec81b]
  - @pancakeswap/permit2-sdk@1.0.2

## 1.0.3

### Patch Changes

- Updated dependencies [3b76a26]
  - @pancakeswap/smart-router@5.1.0

## 1.0.2

### Patch Changes

- @pancakeswap/smart-router@5.0.4

## 1.0.1

### Patch Changes

- acc454d: Remove binance extension wallet connector @pancakeswap/wagmi
  release new pkg @pancakeswap/universal-router-sdk & @pancakeswap/permit2-sdk
- Updated dependencies [acc454d]
  - @pancakeswap/smart-router@5.0.3
  - @pancakeswap/permit2-sdk@1.0.1
  - @pancakeswap/v3-sdk@3.7.13
