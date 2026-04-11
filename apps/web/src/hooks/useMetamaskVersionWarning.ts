import { useEffect, useState } from 'react'
import { useConnections, useConnectorClient } from 'wagmi'

export const isOutdatedVersion = (minimum: string, current?: string | null) => {
  if (typeof current !== 'string') return false

  const a = current.split('.').map((v) => Number(v))
  const b = minimum.split('.').map((v) => Number(v))

  if (a.some(Number.isNaN)) return false

  while (a.length < 3) a.push(0)
  while (b.length < 3) b.push(0)

  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return true
    if (a[i] > b[i]) return false
  }

  return false
}

/**
 * Metamask version < 13.3.0 has an issue that it can't connect to Solana and EVM at the same time.
 * This hook will check Metamask version and return true if it's less than 13.3.0.
 */
export const useMetamaskVersionWarning = () => {
  const connections = useConnections()
  const metaMask = connections.find((c) => c.connector.rdns?.includes?.('io.metamask'))?.connector
  const { data: walletClient } = useConnectorClient({ connector: metaMask })

  const [shouldShowMetamaskVersionWarning, toggleMetamaskVersionWarning] = useState<boolean>(false)

  useEffect(() => {
    walletClient?.request({ method: 'web3_clientVersion' }).then((clientVersion) => {
      const version =
        /MetaMask\/v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)/i.exec(clientVersion)?.[1] ?? null

      if (version && isOutdatedVersion('13.3.0', version)) {
        toggleMetamaskVersionWarning(true)
      } else {
        toggleMetamaskVersionWarning(false)
      }
    })
  }, [walletClient])

  return shouldShowMetamaskVersionWarning
}
