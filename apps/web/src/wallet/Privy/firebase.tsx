'use client'

import {
  getAuth,
  GoogleAuthProvider,
  signInWithCustomToken,
  signInWithPopup,
  signOut,
  TwitterAuthProvider,
  UserCredential,
} from 'firebase/auth'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import Cookie from 'js-cookie'
import { usePrivySocialLoginAtom, useSocialLoginProviderAtom } from './atom'
import { loginWithTelegramViaScript } from './telegramLogin'

import { firebaseApp } from './constants'

// Define the context type
interface AuthContextType {
  token: string | undefined
  getToken: () => Promise<string | undefined>
  isLoading: boolean
  loginWithGoogle: () => Promise<void>
  loginWithX: () => Promise<void>
  loginWithDiscord: () => Promise<void>
  loginWithTelegram: () => Promise<void>
  loginWithCustomToken: (customToken: string) => Promise<boolean>
  signOutAndClearUserStates: () => void
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider component
interface AuthProviderProps {
  children: ReactNode
}

export function FirebaseAuthProvider({ children }: AuthProviderProps) {
  const [isLoading, setLoading] = useState(false)
  const [token, setToken] = useState<string | undefined>()
  const [, setPrivySocialLogin] = usePrivySocialLoginAtom()
  const [, setSocialProvider] = useSocialLoginProviderAtom()

  const signInWithGoogle = async (): Promise<UserCredential> => {
    try {
      const auth = getAuth(firebaseApp)
      const googleProvider = new GoogleAuthProvider()
      const res = await signInWithPopup(auth, googleProvider)
      return res
    } catch (err: any) {
      // Handle popup cancellation gracefully
      if (err?.code === 'auth/cancelled-popup-request' || err?.code === 'auth/popup-closed-by-user') {
        console.info('Google login popup was cancelled by user')
        // Don't show alert for user cancellation, just throw silently
        throw new Error('LOGIN_CANCELLED')
      }
      // For other errors, still show alert
      console.error('Google login error:', err)
      alert(`Google login failed: ${err?.message || err}`)
      throw err
    }
  }

  const signInWithX = async (): Promise<UserCredential> => {
    try {
      const auth = getAuth(firebaseApp)
      const twitterProvider = new TwitterAuthProvider()
      const res = await signInWithPopup(auth, twitterProvider)
      return res
    } catch (err: any) {
      // Handle popup cancellation gracefully
      if (err?.code === 'auth/cancelled-popup-request' || err?.code === 'auth/popup-closed-by-user') {
        console.info('X login popup was cancelled by user')
        // Don't show alert for user cancellation, just throw silently
        throw new Error('LOGIN_CANCELLED')
      }
      // For other errors, still show alert
      console.error('X login error:', err)
      alert(`X login failed: ${err?.message || err}`)
      throw err
    }
  }

  const loginWithGoogle = useCallback(async () => {
    try {
      setPrivySocialLogin(true)
      setSocialProvider('google')
      setLoading(true)
      const loginRes = await signInWithGoogle()
      const idToken = await loginRes.user.getIdToken(true)
      setToken(idToken)
    } catch (err: any) {
      // Handle cancelled login silently
      if (err?.message === 'LOGIN_CANCELLED') {
        console.info('Google login was cancelled by user')
        setPrivySocialLogin(false)
        setSocialProvider(null)
        return
      }
      console.error('Google login error:', err)
    } finally {
      setLoading(false)
    }
  }, [setPrivySocialLogin, setSocialProvider])

  const loginWithX = useCallback(async () => {
    try {
      setPrivySocialLogin(true)
      setSocialProvider('x')
      setLoading(true)
      const loginRes = await signInWithX()
      const idToken = await loginRes.user.getIdToken(true)
      setToken(idToken)
    } catch (err: any) {
      // Handle cancelled login silently
      if (err?.message === 'LOGIN_CANCELLED') {
        console.info('X login was cancelled by user')
        setPrivySocialLogin(false)
        setSocialProvider(null)
        return
      }
      console.error('X login error:', err)
    } finally {
      setLoading(false)
    }
  }, [setPrivySocialLogin, setSocialProvider])

  // Helper function to sign in with custom token
  const loginWithCustomToken = useCallback(
    async (customToken: string) => {
      try {
        setPrivySocialLogin(true)
        const auth = getAuth(firebaseApp)
        const userCredential = await signInWithCustomToken(auth, customToken)
        const idToken = await userCredential.user.getIdToken(true)
        setToken(idToken)
        return true
      } catch (error) {
        console.error('Error signing in with custom token:', error)
        return false
      }
    },
    [setPrivySocialLogin],
  )

  const loginWithDiscord = useCallback(async () => {
    try {
      setPrivySocialLogin(true)
      setLoading(true)
      setSocialProvider('discord')

      const state = nanoid(21)
      Cookie.set('discordAuthState', state, {
        sameSite: 'Lax',
        secure: window.location.protocol === 'https:',
        path: '/',
      })
      const from = window.location.pathname + window.location.search + window.location.hash
      localStorage.setItem('discordAuthFrom', from)
      const redirectUri = `${window.location.origin}/auth/discord`
      const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID
      window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri,
      )}&response_type=code&scope=identify&state=${state}`
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [setPrivySocialLogin, setSocialProvider])

  const loginWithTelegram = useCallback(async () => {
    try {
      setPrivySocialLogin(true)
      setSocialProvider('telegram')
      setLoading(true)

      loginWithTelegramViaScript((token) => {
        loginWithCustomToken(token)
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [loginWithCustomToken, setPrivySocialLogin, setSocialProvider])

  const getToken = useCallback(async () => {
    if (token) {
      return token
    }
    const auth = getAuth(firebaseApp)
    if (!auth.currentUser) {
      return undefined
    }
    const idToken = await auth.currentUser.getIdToken(true)
    setToken(idToken)
    return idToken
  }, [token])

  useEffect(() => {
    const auth = getAuth(firebaseApp)

    // Handle auth state changes and set token
    const unsubscribeAuthState = auth.onAuthStateChanged(async (user) => {
      console.info('Firebase auth state changed, user:', user ? 'exists' : 'null')

      if (user) {
        try {
          const idToken = await user.getIdToken(true)
          setToken(idToken)
          console.info('Token set from Firebase auth state change')
        } catch (error) {
          console.error('Failed to get token on auth state change:', error)
        }
      } else {
        setToken(undefined)
        console.info('Firebase user signed out, token cleared')
      }

      setLoading(false) // Set loading to false after initial check
    })

    // Handle token changes
    const unsubscribeTokenChange = auth.onIdTokenChanged((user) => {
      console.info('Firebase token changed, user:', user ? 'exists' : 'null')
    })

    // Listen for manual retrigger events
    const handleRetrigger = (event: CustomEvent) => {
      const { token: newToken } = event.detail
      console.info('Received Firebase retrigger event, updating token...')

      // Clear current token first to force Privy to re-authenticate
      setToken(undefined)

      // Then set new token after a small delay to trigger Privy re-auth
      setTimeout(() => {
        setToken(newToken)
        console.info('Token updated for Privy re-authentication')
      }, 100)
    }

    window.addEventListener('firebase-auth-retrigger', handleRetrigger as EventListener)

    return () => {
      unsubscribeAuthState()
      unsubscribeTokenChange()
      window.removeEventListener('firebase-auth-retrigger', handleRetrigger as EventListener)
    }
  }, [])

  const signOutFirebase = useCallback(async () => {
    const auth = getAuth(firebaseApp)
    try {
      await signOut(auth)
    } catch (err) {
      console.error(err)
    }
  }, [])

  const signOutAndClearUserStates = useCallback(async () => {
    await signOutFirebase()
    setToken(undefined)
    setLoading(false)
    setSocialProvider(null)
  }, [setSocialProvider, signOutFirebase])

  const value = useMemo(
    () => ({
      token,
      isLoading,
      getToken,
      loginWithGoogle,
      loginWithX,
      loginWithDiscord,
      loginWithTelegram,
      loginWithCustomToken,
      signOutAndClearUserStates,
    }),
    [
      getToken,
      isLoading,
      loginWithDiscord,
      loginWithGoogle,
      loginWithCustomToken,
      loginWithTelegram,
      loginWithX,
      signOutAndClearUserStates,
      token,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Custom hook to use the auth context
export function useFirebaseAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Function to retrigger Firebase auth for Privy
export async function retriggerFirebaseAuth() {
  try {
    const auth = getAuth(firebaseApp)
    const { currentUser } = auth

    if (!currentUser) {
      return false
    }

    console.info('Current Firebase user exists, retriggering token...')

    // Get fresh token to trigger Privy re-authentication
    const freshToken = await currentUser.getIdToken(true) // force refresh

    // Trigger auth state change event manually
    // This should cause Privy's getCustomAccessToken to be called again
    const event = new CustomEvent('firebase-auth-retrigger', {
      detail: { token: freshToken },
    })

    window.dispatchEvent(event)

    // Wait a moment for the retrigger to take effect
    await new Promise((resolve) => setTimeout(resolve, 500))

    return true
  } catch (error) {
    console.error('Failed to retrigger Firebase auth:', error)
    return false
  }
}
