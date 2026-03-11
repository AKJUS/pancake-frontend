import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import Cookie from 'js-cookie'
import { useFirebaseAuth } from '../../wallet/Privy/firebase'
import { useSocialLoginProviderAtom } from '../../wallet/Privy/atom'

const stateRegex = /^[a-zA-Z0-9_-]{21}$/

export default function DiscordAuthPage() {
  const router = useRouter()
  const { loginWithCustomToken } = useFirebaseAuth()
  const [, setSocialProvider] = useSocialLoginProviderAtom()
  const hasAuthenticated = useRef(false)

  useEffect(() => {
    const authenticate = async () => {
      if (!router.isReady) return
      const { code, state } = router.query
      if (typeof code !== 'string' || typeof state !== 'string') {
        console.error('Invalid Discord auth callback parameters')
        return
      }
      if (!stateRegex.test(state)) {
        console.error('Invalid Discord OAuth state format')
        return
      }
      const expectedState = Cookie.get('discordAuthState')
      if (state !== expectedState) {
        console.error('Discord OAuth state mismatch')
        return
      }
      if (hasAuthenticated.current) {
        return
      }
      hasAuthenticated.current = true
      const from = localStorage.getItem('discordAuthFrom') || undefined
      localStorage.removeItem('discordAuthFrom')
      try {
        const res = await fetch('/api/auth/discord/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        })
        const data = await res.json()
        if (data.customToken) {
          setSocialProvider('discord')
          const loggedIn = await loginWithCustomToken(data.customToken)
          if (loggedIn) {
            let redirectTo = `${window.location.origin}/`
            if (from) {
              redirectTo += from.replace(/^\/+/, '')
            }
            window.location.replace(redirectTo)
          }
        } else {
          console.error('No custom token returned from Discord login')
        }
      } catch (err) {
        console.error('Discord login failed:', err)
      } finally {
        Cookie.remove('discordAuthState', { path: '/' })
      }
    }
    authenticate()
  }, [router, loginWithCustomToken, setSocialProvider])

  return null
}
