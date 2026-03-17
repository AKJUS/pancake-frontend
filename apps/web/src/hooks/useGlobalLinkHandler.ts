import { useEffect } from 'react'

const getIsAndroid = () => {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const android = Boolean(ua.match(/Android/i))
  return android
}

const isInWalletBrowser = () => {
  if (typeof window === 'undefined') return false

  return (
    window.ethereum !== undefined ||
    window.solana !== undefined ||
    window.phantom !== undefined ||
    window.bitkeep !== undefined
  )
}

const isInternalLink = (href) => {
  if (!href) return false

  try {
    const url = new URL(href, window.location.origin)
    const linkHostname = url.hostname
    const currentHostname = window.location.hostname

    const getBaseDomain = (hostname) => {
      const parts = hostname.split('.')
      return parts.length >= 2 ? parts.slice(-2).join('.') : hostname
    }

    const currentBase = getBaseDomain(currentHostname)
    const linkBase = getBaseDomain(linkHostname)

    return linkBase === currentBase
  } catch (e) {
    return true // Treat as internal
  }
}

/**
 * Prevents target="_blank" links from opening in default browser on Android wallet dApps.
 * Keeps navigation within the wallet's in-app browser by detecting wallet injected objects
 * (window.ethereum, window.solana, window.phantom, window.bitkeep) and redirecting internal links to same window.
 * Only affects Android devices with wallet browsers accessing internal domains.
 */
export const useGlobalLinkHandler = () => {
  useEffect(() => {
    if (!getIsAndroid() || !isInWalletBrowser()) {
      return undefined
    }

    const handleInternalBlankLink = (href, target) => {
      if (target === '_blank' && href && isInternalLink(href)) {
        window.location.href = href
        return true
      }
      return false
    }

    const handleClick = (e) => {
      const link = e.target.closest('a')
      if (!link) return

      const target = link.getAttribute('target')
      const href = link.getAttribute('href')

      if (handleInternalBlankLink(href, target)) {
        e.preventDefault()
      }
    }

    const originalWindowOpen = window.open
    window.open = function (url, target, features) {
      const urlString = url ? (typeof url === 'string' ? url : url.toString()) : ''

      if (handleInternalBlankLink(urlString, target)) {
        return null
      }

      return originalWindowOpen.call(window, url, target, features)
    }

    document.addEventListener('click', handleClick, true)

    return () => {
      document.removeEventListener('click', handleClick, true)
      window.open = originalWindowOpen
    }
  }, [])
}
