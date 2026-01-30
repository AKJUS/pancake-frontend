import type { NextApiRequest, NextApiResponse } from 'next'

const WALLET_API_BASE = 'https://wallet-api.pancakeswap.com'

const isProxyEnabled = () => process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV !== 'production'

const buildTargetUrl = (req: NextApiRequest) => {
  const pathParam = req.query.path
  const pathSegments = Array.isArray(pathParam) ? pathParam : typeof pathParam === 'string' ? pathParam.split('/') : []
  const encodedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join('/')
  const url = new URL(`${WALLET_API_BASE}/${encodedPath}`)

  const searchParams = new URLSearchParams()
  Object.entries(req.query).forEach(([key, value]) => {
    if (key === 'path') return
    if (Array.isArray(value)) {
      value.forEach((v) => searchParams.append(key, v))
    } else if (value !== undefined) {
      searchParams.append(key, value)
    }
  })
  const queryString = searchParams.toString()
  if (queryString) url.search = queryString

  return url
}

const buildProxyHeaders = (req: NextApiRequest) => {
  const headers = new Headers()
  Object.entries(req.headers).forEach(([key, value]) => {
    if (!value) return
    const lowerKey = key.toLowerCase()
    if (lowerKey === 'host' || lowerKey === 'connection' || lowerKey === 'content-length') return
    if (Array.isArray(value)) {
      headers.set(key, value.join(','))
    } else {
      headers.set(key, value)
    }
  })
  return headers
}

const proxyWalletApi = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!isProxyEnabled()) {
    return res.status(404).json({ message: 'Not found' })
  }

  const url = buildTargetUrl(req)
  const method = req.method ?? 'GET'
  const headers = buildProxyHeaders(req)
  const hasBody = method !== 'GET' && method !== 'HEAD'
  let body: BodyInit | undefined

  if (hasBody && req.body !== undefined) {
    if (Buffer.isBuffer(req.body) || typeof req.body === 'string') {
      body = req.body
    } else {
      body = JSON.stringify(req.body)
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json')
      }
    }
  }

  try {
    const response = await fetch(url, { method, headers, body })
    const contentType = response.headers.get('content-type')
    if (contentType) {
      res.setHeader('content-type', contentType)
    }
    const responseBody = await response.arrayBuffer()
    return res.status(response.status).send(Buffer.from(responseBody))
  } catch (_error) {
    return res.status(502).json({ message: 'Wallet API proxy failed' })
  }
}

export default proxyWalletApi
