import { ChainId } from '@pancakeswap/chains'
import { ERC20Token, WETH9 } from '@pancakeswap/sdk'

import { USDC, USDT } from './common'

export const monadTokens = {
  weth: WETH9[ChainId.MONAD_MAINNET],
  usdc: USDC[ChainId.MONAD_MAINNET],
  usdt: USDT[ChainId.MONAD_MAINNET],
  wmon: new ERC20Token(
    ChainId.MONAD_MAINNET,
    '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',
    18,
    'WMON',
    'Wrapped Monad',
    'https://www.monad.xyz/',
  ),
  ausd: new ERC20Token(
    ChainId.MONAD_MAINNET,
    '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a',
    6,
    'AUSD',
    'AUSD',
    'https://www.agora.finance/',
  ),
  usdt0: new ERC20Token(
    ChainId.MONAD_MAINNET,
    '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
    6,
    'USDT0',
    'USDT0',
    'https://usdt0.to/',
  ),
}
