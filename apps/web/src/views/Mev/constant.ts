export const walletSupportDefaultMevOnBSC = ['isTrustWallet', 'isTrust', 'isBinance']
// wallet support mev on bsc default, but it not using PCS RPC

export const walletConnectSupportDefaultMevOnBSC = ['Binance Wallet', 'Trust Wallet']
// wallet connect wallets that support mev on bsc default

export const walletSupportCustomRPCNative = ['isMetaMask'] // isOkxWallet okx can't support EIP-3085 on wallet app
// wallet support wallet_addEthereumChain native

export const walletSupportManualRPCConfig = ['isRabby']
// wallet support manual config on wallet app, don't support support wallet_addEthereumChain native

export const walletPretendToBinanceWallet = ['isSafePal']

export const walletPretendToMetamask = [
  'isBraveWallet',
  'isApexWallet',
  'isAvalanche',
  'isBitKeep',
  'isBitgetWallet',
  'isBlockWallet',
  'isKuCoinWallet',
  'isMathWallet',
  'isOneInchIOSWallet',
  'isOneInchAndroidWallet',
  'isOpera',
  'isPortal',
  'isPhantom',
  'isRabby',
  'isTokenPocket',
  'isTokenary',
  'isUniswapWallet',
  'isZerion',
  'isSafePal',
  'isBybit',
  'isCoinbaseWallet',
  'isOkxWallet',
]
// wallet support mev on bsc default, but it not using PCS RPC

export const rpcData = {
  'Network Name': 'PancakeSwap MEV Guard',
  'RPC URL': 'https://bscrpc.pancakeswap.finance',
  'Chain ID': '56',
  'Currency symbol': 'BNB',
  'Block Explorer URL': 'https://bscscan.com',
}

export const walletConfig = [
  {
    title: 'Rabby Wallet',
    image: 'rabby.png',
    doc: 'https://support.rabby.io/hc/en-us/articles/11319672399247-List-of-supported-chains-and-tokens#:~:text=For%20testnets%20and%20networks%20that%20are%20not%20yet%20integrated%2C%20you%20can%20still%20access%20them%20by%20adding%20a%20custom%20network%20through%3A%20More%20%3E%20Add%20Custom%20Network.',
  },
  // {
  //   title: 'TokenPocket',
  //   image: 'token-pocket.png',
  //   doc: 'https://help.tokenpocket.pro/en/wallet-operation/custom-network-token/how-to-add-custom-network',
  // },
]

export const INFO_SECTION_ID = 'mev-info-section'
