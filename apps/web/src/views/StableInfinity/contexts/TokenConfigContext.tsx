import React, { createContext, useContext, useState, useMemo, useCallback } from 'react'
import { Address, Hex } from 'viem'
import { TokenType, TokenConfig, ADDRESS_ZERO, NULL_METHOD_ID } from '@pancakeswap/infinity-stable-sdk'

interface TokenConfigContextValue {
  tokenAConfig: TokenConfig
  tokenBConfig: TokenConfig
  setTokenAConfig: (config: TokenConfig) => void
  setTokenBConfig: (config: TokenConfig) => void
}

const TokenConfigContext = createContext<TokenConfigContextValue | undefined>(undefined)

const DEFAULT_TOKEN_CONFIG: TokenConfig = {
  type: TokenType.STANDARD,
  oracleAddress: ADDRESS_ZERO,
  methodId: NULL_METHOD_ID as Hex,
}

export const TokenConfigProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [tokenAConfig, setTokenAConfig] = useState<TokenConfig>(DEFAULT_TOKEN_CONFIG)
  const [tokenBConfig, setTokenBConfig] = useState<TokenConfig>(DEFAULT_TOKEN_CONFIG)

  const handleSetTokenAConfig = useCallback((config: TokenConfig) => {
    setTokenAConfig(config)
  }, [])

  const handleSetTokenBConfig = useCallback((config: TokenConfig) => {
    setTokenBConfig(config)
  }, [])

  const value = useMemo(
    () => ({
      tokenAConfig,
      tokenBConfig,
      setTokenAConfig: handleSetTokenAConfig,
      setTokenBConfig: handleSetTokenBConfig,
    }),
    [tokenAConfig, tokenBConfig, handleSetTokenAConfig, handleSetTokenBConfig],
  )

  return <TokenConfigContext.Provider value={value}>{children}</TokenConfigContext.Provider>
}

export const useTokenConfig = (): TokenConfigContextValue => {
  const context = useContext(TokenConfigContext)
  if (!context) {
    throw new Error('useTokenConfig must be used within a TokenConfigProvider')
  }
  return context
}
