export enum WalletIds {
  Injected = 'injected',

  // Multi-Chain Wallets (EVM + Solana)
  Metamask = 'metamask',
  Okx = 'okx',
  BinanceW3W = 'BinanceW3W',
  Trust = 'trust',
  Tokenpocket = 'tokenpocket',
  Coin98 = 'coin98',
  SafePal = 'safePal',
  Walletconnect = 'walletconnect',
  Coinbase = 'coinbase',
  Math = 'math',

  // EVM Only Wallets
  Opera = 'opera',
  Brave = 'brave',
  Rabby = 'rabby',
  // Blocto = 'blocto',
  Cyberwallet = 'cyberwallet',
  Petra = 'petra',
  Martian = 'martian',
  Pontem = 'pontem',
  Fewcha = 'fewcha',
  Rise = 'rise',
  Msafe = 'msafe',

  // Solana Only Wallets
  Phantom = 'phantom', // Not support BNB Chain/ Arbitrum yet, mark as Solana only now
  Solflare = 'solflare',
  Slope = 'slope',
  Glow = 'glow',
  BitGet = 'bitget',
  Exodus = 'exodus',
  Backpack = 'backpack',
  SquadsX = 'SquadsX',
}

export const isWalletId = (id: string): id is WalletIds => {
  return Object.values(WalletIds).includes(id as WalletIds)
}
