# @pancakeswap/solana-core-sdk

> Core Solana utilities and helpers for PancakeSwap's cross-chain integration.

This package provides the foundational SDK components used to interact with the Solana blockchain in PancakeSwap's frontend. It includes transaction building utilities, key account layouts, token registry helpers, and constants related to Solana programs and tokens.

---

## ✨ Features

- Lightweight and modular Solana SDK for PancakeSwap
- Utilities for working with SPL tokens and token accounts
- Predefined program IDs and layout helpers for Raydium, Jupiter, and other Solana protocols
- Constants for token mints and metadata
- Used internally by [PancakeSwap Frontend](https://github.com/pancakeswap/pancake-frontend)

---

## 📦 Installation

```bash
# via npm
npm install @pancakeswap/solana-core-sdk

# or yarn
yarn add @pancakeswap/solana-core-sdk
```

## Fork Provenance

This package is derived from [raydium-io/raydium-sdk-V2](https://github.com/raydium-io/raydium-sdk-V2).

PancakeSwap maintains this package inside the `pancake-frontend` monorepo and publishes it as `@pancakeswap/solana-core-sdk` for reuse across PancakeSwap Solana integrations and related tooling.

## License

This project is a fork of [raydium-io/raydium-sdk-V2](https://github.com/raydium-io/raydium-sdk-V2), originally licensed under the GNU General Public License v3.0.

This project is licensed under the terms of the [GNU GPLv3](./LICENSE).
