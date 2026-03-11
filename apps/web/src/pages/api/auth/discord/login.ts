import { getAuth } from 'firebase-admin/auth'
import { firebaseAdmin } from 'lib/firebase-admin'
import type { NextApiRequest, NextApiResponse } from 'next'

const stateRegex = /^[a-zA-Z0-9_-]{21}$/

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { code, state } = req.body ?? {}
  const cookieState = req.cookies?.discordAuthState

  if (
    !code ||
    typeof code !== 'string' ||
    !state ||
    typeof state !== 'string' ||
    !cookieState ||
    typeof cookieState !== 'string'
  ) {
    res.status(400).json({ error: 'Invalid code or state' })
    return
  }

  if (!stateRegex.test(state)) {
    // ensure state matches nanoid(21) format
    res.status(400).json({ error: 'Invalid state format' })
    return
  }

  if (state !== cookieState) {
    res.status(400).json({ error: 'State mismatch' })
    return
  }

  try {
    // 1. Exchange authorization code for access token
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    })

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })
    if (!tokenRes.ok) {
      const errData = await tokenRes.json()
      throw new Error(`Token exchange failed: ${errData.error || tokenRes.status}`)
    }

    const tokenData = await tokenRes.json()
    const { access_token: accessToken } = tokenData
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('Missing Discord access token')
    }

    // 2. Retrieve Discord user information
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!userRes.ok) {
      const errData = await userRes.json().catch(() => null)
      throw new Error(`Failed to fetch Discord user: ${errData?.message || userRes.status}`)
    }

    const userData = (await userRes.json()) as { id?: unknown }
    const discordId = typeof userData.id === 'string' ? userData.id : null
    if (!discordId) {
      throw new Error('Discord user id is missing')
    }

    // 3. Issue Firebase custom token
    await firebaseAdmin() // Ensure Admin SDK is initialized
    const customToken = await getAuth().createCustomToken(`discord:${discordId}`)

    // 4. Return token to frontend and clear state cookie
    const forwardedProto = req.headers['x-forwarded-proto']
    const protoHeader = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto
    const isHttps = protoHeader?.split(',')[0] === 'https'
    const useSecureCookie = process.env.NODE_ENV === 'production' || isHttps
    res.setHeader(
      'Set-Cookie',
      `discordAuthState=; Path=/; Max-Age=0; SameSite=Lax${useSecureCookie ? '; Secure' : ''}`,
    )
    res.status(200).json({ customToken })
  } catch (err) {
    console.error('[Discord login error]:', err)
    res.status(500).json({ error: 'Discord authentication failed' })
  }
}
