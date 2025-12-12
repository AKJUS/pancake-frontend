import { Wallet } from '@solana/wallet-adapter-react'

export const isMultisigWallet = (wallet?: Wallet | null): boolean => {
  return wallet?.adapter?.name === 'SquadsX'
}
